/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle, RefreshCw, Ban
} from 'lucide-react';
import { Alarm } from '../types';
import { gingAudio } from '../utils/audio';
import { matchesWakeUpCode } from '../utils/qrValidation';
import { Capacitor } from '@capacitor/core';
import { GingAndroid } from '../native/GingAndroid';

interface AlarmRingerProps {
  alarm: Alarm;
  onDismiss: () => void;
}

export default function AlarmRinger({ alarm, onDismiss }: AlarmRingerProps) {
  const [scanStatus, setScanStatus] = useState<'scanning' | 'wrong-code' | 'authenticated'>('scanning');
  const scanStatusRef = useRef<'scanning' | 'wrong-code' | 'authenticated'>('scanning');

  const updateScanStatus = (status: 'scanning' | 'wrong-code' | 'authenticated') => {
    setScanStatus(status);
    scanStatusRef.current = status;
  };

  const [errorText, setErrorText] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef(0);
  const isMountedRef = useRef(false);
  const endedTrackRef = useRef<{ track: MediaStreamTrack; listener: () => void } | null>(null);
  const lastScanAtRef = useRef(0);
  const dismissTimerRef = useRef<number | null>(null);
  const wrongCodeTimerRef = useRef<number | null>(null);

  // Start the alarm audio and enable strict native alarm behavior.
  useEffect(() => {
    // Start playing the brutal audio on load at absolute maximum volume!
    try {
      gingAudio.start(alarm.soundType, 1.0);
    } catch (err) {
      // Keep applying the native alarm lock even if Web Audio is unavailable.
      console.error('Alarm audio could not start:', err);
    }

    // Lock the native Android back-buttons and system-exits during alarm ringing
    if (Capacitor.getPlatform() === 'android') {
      GingAndroid.setAlarmActive({ active: true }).catch(err => console.error(err));
      GingAndroid.forceMaxVolume().catch(err => console.error(err));
    }

    return () => {
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
      if (wrongCodeTimerRef.current) window.clearTimeout(wrongCodeTimerRef.current);
      gingAudio.stop();
      stopCamera();

      // Release native lock when alarm is successfully dismissed
      if (Capacitor.getPlatform() === 'android') {
        GingAndroid.setAlarmActive({ active: false }).catch(err => console.error(err));
      }
    };
  }, [alarm]);

  // Handle bootstrap camera feed and invalidate in-flight permission requests on unmount.
  useEffect(() => {
    isMountedRef.current = true;
    void startCamera();
    return () => {
      isMountedRef.current = false;
      stopCamera(false);
    };
  }, []);

  const startCamera = async () => {
    stopCamera();
    const requestId = cameraRequestIdRef.current;
    const isCurrentRequest = () => isMountedRef.current && cameraRequestIdRef.current === requestId;
    let acquiredStream: MediaStream | null = null;

    try {
      setErrorText(null);
      updateScanStatus('scanning');

      try {
        // First choice: High Quality back camera constraints suitable for QR scan
        const constraints: MediaStreamConstraints = {
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        };
        acquiredStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        if (!isCurrentRequest()) return;
        console.warn("High-quality back camera failed, trying simple video: true fallback. Info:", firstErr);
        // Fallback to simple generic video constraints
        acquiredStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      if (!isCurrentRequest()) {
        acquiredStream.getTracks().forEach(track => track.stop());
        return;
      }

      const video = videoRef.current;
      const videoTrack = acquiredStream.getVideoTracks()[0];
      if (!video || !videoTrack) {
        throw new Error('Camera stream is missing its video element or video track.');
      }

      mediaStreamRef.current = acquiredStream;
      const onTrackEnded = () => {
        if (mediaStreamRef.current !== acquiredStream || !isMountedRef.current) return;
        showCameraError('The camera feed stopped. Restart the camera to keep scanning.');
      };
      videoTrack.addEventListener('ended', onTrackEnded);
      endedTrackRef.current = { track: videoTrack, listener: onTrackEnded };

      video.srcObject = acquiredStream;
      video.setAttribute('playsinline', 'true'); // required by mobile WebViews
      await video.play();
      if (!isCurrentRequest() || mediaStreamRef.current !== acquiredStream) return;
      setIsCameraActive(true);

      scheduleScanFrame();
    } catch (err: any) {
      if (acquiredStream && mediaStreamRef.current !== acquiredStream) {
        acquiredStream.getTracks().forEach(track => track.stop());
      }
      if (!isCurrentRequest()) return;
      console.error("Camera startup fully failed:", err);
      showCameraError("Couldn't start the camera. Check camera access or close another app using it, then try again.");
    }
  };

  const stopCamera = (updateState = true) => {
    cameraRequestIdRef.current += 1;
    if (loopRef.current !== null) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    if (endedTrackRef.current) {
      endedTrackRef.current.track.removeEventListener('ended', endedTrackRef.current.listener);
      endedTrackRef.current = null;
    }
    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null;
    }
    if (updateState && isMountedRef.current) setIsCameraActive(false);
  };

  const showCameraError = (message: string) => {
    stopCamera();
    updateScanStatus('scanning');
    if (isMountedRef.current) setErrorText(message);
  };

  const scheduleScanFrame = () => {
    if (!isMountedRef.current || !mediaStreamRef.current || loopRef.current !== null || scanStatusRef.current === 'authenticated') return;
    loopRef.current = requestAnimationFrame(qrScanTick);
  };

  // QR scanning recursive routine using off-screen canvas rendering + jsQR decoding
  const qrScanTick = () => {
    loopRef.current = null;
    // If we've been authenticated, stop the loop permanently
    if (!isMountedRef.current || scanStatusRef.current === 'authenticated') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const stream = mediaStreamRef.current;
    if (!video || !canvas || !stream || !stream.active) {
      showCameraError('The camera feed is unavailable. Restart the camera to keep scanning.');
      return;
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
      video.play().catch(err => {
        console.error('[GING] Video playback stopped:', err);
        showCameraError('The camera preview stopped. Restart the camera to keep scanning.');
      });
    }

    // Pause frame decoding while showing incorrect-code error (but keep the loop alive!)
    if (scanStatusRef.current !== 'scanning') {
      scheduleScanFrame();
      return;
    }

    try {
      const now = performance.now();
      if (now - lastScanAtRef.current < 80) {
        scheduleScanFrame();
        return;
      }
      lastScanAtRef.current = now;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context is unavailable.');
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
        // Bound work on high-resolution phone cameras while keeping enough detail for QR decoding.
        const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

        // Draw active frame and decode the exact payload.
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code) {
          if (matchesWakeUpCode(code.data, alarm.qrSecret)) {
            // CORRECT QR CODE MATCHED!
            updateScanStatus('authenticated');
            stopCamera();

            // Sound off!
            gingAudio.stop();

            // Play a short voice confirmation if speech synthesis is available.
            try {
              if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const authUtterance = new SpeechSynthesisUtterance("Alarm off.");
                authUtterance.lang = 'en-US';
                authUtterance.volume = 1.0;
                window.speechSynthesis.speak(authUtterance);
              }
            } catch (e) { }

            // End the loop and trigger success callback to parent.
            dismissTimerRef.current = window.setTimeout(() => {
              onDismiss();
              dismissTimerRef.current = null;
            }, 2400);
            return;
          } else {
            // Any other QR payload leaves the alarm active and resumes scanning shortly.
            updateScanStatus('wrong-code');
            wrongCodeTimerRef.current = window.setTimeout(() => {
              if (scanStatusRef.current === 'wrong-code') updateScanStatus('scanning');
              wrongCodeTimerRef.current = null;
            }, 2500);
          }
        }
      }
    } catch (err) {
      console.error('[GING] QR frame could not be analyzed:', err);
      showCameraError('The camera could not read this frame. Restart the camera to keep scanning.');
      return;
    }

    scheduleScanFrame();
  };

  if (scanStatus === 'authenticated') {
    return (
      <motion.main
        className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden ambient-glow-bg ging-screen ging-screen--alarm-off font-sans"
        role="status"
        aria-live="assertive"
        aria-label="Alarm off"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="glow-sphere-orange top-[-10%] left-[-15%]" />
        <div className="glow-sphere-red bottom-[-15%] right-[-10%]" />

        <div className="alarm-off-content z-10">
          <img
            src="/gingy-mascot-cutout.webp"
            alt=""
            aria-hidden="true"
            className="alarm-off-mascot"
          />
          <motion.div
            className="alarm-off-check"
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, type: 'spring', stiffness: 300, damping: 18 }}
            aria-hidden="true"
          >
            <CheckCircle className="w-9 h-9" strokeWidth={1.8} />
          </motion.div>
          <motion.h1
            className="alarm-off-title"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            Alarm off
          </motion.h1>
        </div>
      </motion.main>
    );
  }

  return (
    <div className="relative min-h-dvh text-[#261813] select-none flex flex-col overflow-x-hidden font-sans ambient-glow-bg ging-screen ging-screen--ringing">
      {/* Hidden processing canvas used for frame analysis */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Faint ambient haze */}
      <div className="glow-sphere-red top-[-10%] left-[-15%] opacity-60" />
      <div className="glow-sphere-orange bottom-[-15%] right-[-10%] opacity-50" />

      {/* Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between px-6 pt-5 pb-3 z-10 ringing-header">
        <div className="ringing-title">
          <img src="/gingy-mascot-cutout.webp" alt="" aria-hidden="true" className="ringing-mascot" />
          <span className="font-sans font-semibold text-[17px] text-[#261813] tracking-tight truncate">
            {alarm.label || 'Alarm'}
          </span>
        </div>
        {scanStatus !== 'authenticated' && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium glass-badge-red">
            <span className="w-1.5 h-1.5 rounded-full soft-pulse bg-ging-red" />
            <span>Ringing</span>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-4 flex flex-col z-10 space-y-5 ringing-main">
        {/* Camera viewport — always mounted so the stream is never disconnected */}
        <div className="relative glass-card rounded-3xl overflow-hidden ringing-camera">
          <div className="aspect-[4/5] relative bg-black ringing-camera-view">
            {!isCameraActive && !errorText && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-3 p-4 text-center z-10 camera-loading">
                <RefreshCw className="w-8 h-8 animate-spin text-zinc-400" />
                <span className="text-[13px] text-zinc-400 font-medium">Starting camera…</span>
              </div>
            )}

            {errorText && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-red-300 gap-3 overflow-y-auto z-20 camera-error" role="alert">
                <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                  <Ban className="w-6 h-6 text-red-400" />
                </div>
                <span className="text-[13px] text-zinc-300 leading-relaxed font-medium">{errorText}</span>

                <button
                  onClick={() => void startCamera()}
                  className="w-full max-w-xs text-[14px] glass-button font-medium py-3 rounded-xl transition-transform active:scale-95 mt-1"
                >
                  Retry camera
                </button>
              </div>
            )}

            {/* Always-mounted video stream */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Scanner overlay — minimal: corners + scan line only */}
            {isCameraActive && scanStatus === 'scanning' && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 relative">
                  {/* Animated scan line — theme token, no glow */}
                  <div className="absolute inset-x-2 h-0.5 bg-ging-orange scan-line rounded-full" />
                  {/* L-shaped corner brackets */}
                  <div className="absolute -top-px -left-px w-7 h-7 border-t-2 border-l-2 border-ging-orange rounded-tl-xl" />
                  <div className="absolute -top-px -right-px w-7 h-7 border-t-2 border-r-2 border-ging-orange rounded-tr-xl" />
                  <div className="absolute -bottom-px -left-px w-7 h-7 border-b-2 border-l-2 border-ging-orange rounded-bl-xl" />
                  <div className="absolute -bottom-px -right-px w-7 h-7 border-b-2 border-r-2 border-ging-orange rounded-br-xl" />
                </div>
              </div>
            )}

            {/* Keep a short wrong-code response over the live camera. */}
            <AnimatePresence mode="wait">
              {scanStatus === 'wrong-code' && (
                <motion.div
                  key="wrong-code"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 z-30 flex items-center justify-center bg-black/50"
                >
                  <div className="glass-card border-red-500/25 p-6 text-center w-[80%] rounded-2xl">
                    <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-3 text-red-300">
                      <Ban className="w-7 h-7" />
                    </div>
                    <h3 className="text-[17px] font-semibold text-white">Wrong code</h3>
                    <p className="text-[13px] text-zinc-400 mt-1.5">
                      Scan the QR code for this alarm.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Keep camera diagnostics out of the alarm UI; the task is simply to scan. */}
          {scanStatus !== 'authenticated' && (isCameraActive || errorText) && (
            <div className="px-4 py-3 flex justify-center items-center text-[13px] border-t border-[rgba(164,62,0,0.1)]" role="status" aria-live="polite">
              <span className={`inline-flex items-center gap-2 font-medium ${errorText || scanStatus === 'wrong-code' ? 'text-red-400' : 'text-ging-burnt'}`}>
                {!errorText && isCameraActive && scanStatus === 'scanning' && (
                  <span className="w-2 h-2 rounded-full soft-pulse bg-ging-orange" aria-hidden="true" />
                )}
                {errorText ? 'Camera unavailable' : scanStatus === 'wrong-code' ? 'Retrying' : 'Scanning'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
