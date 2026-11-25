/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { motion } from 'motion/react';
import {
  RefreshCw, Ban
} from 'lucide-react';
import AlarmSuccessScreen from './AlarmSuccessScreen';
import { Alarm } from '../types';
import { gingAudio } from '../utils/audio';
import { matchesWakeUpCode } from '../utils/qrValidation';
import { Capacitor } from '@capacitor/core';
import { GingAndroid } from '../native/GingAndroid';
import { successHaptic } from '../utils/haptics';

interface AlarmRingerProps {
  alarm: Alarm;
  onDismiss: () => void;
}

export default function AlarmRinger({ alarm, onDismiss }: AlarmRingerProps) {
  const [scanStatus, setScanStatus] = useState<'scanning' | 'wrong-code' | 'stopping' | 'stop-error' | 'authenticated'>('scanning');
  const scanStatusRef = useRef<'scanning' | 'wrong-code' | 'stopping' | 'stop-error' | 'authenticated'>('scanning');

  const updateScanStatus = (status: 'scanning' | 'wrong-code' | 'stopping' | 'stop-error' | 'authenticated') => {
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
  const nativeAlarmStoppedRef = useRef(false);

  // Start the alarm audio and enable strict native alarm behavior.
  useEffect(() => {
    const isNativeAndroid = Capacitor.getPlatform() === 'android';
    nativeAlarmStoppedRef.current = !isNativeAndroid;

    // Android's foreground ringing service owns playback so the alarm keeps
    // sounding even when the WebView is backgrounded or the app is closed.
    if (!isNativeAndroid) {
      try {
        gingAudio.start(alarm.soundType, 1.0);
      } catch (err) {
        console.error('Alarm audio could not start:', err);
      }
    }

    // Lock the native Android back-buttons and system-exits during alarm ringing
    if (isNativeAndroid) {
      GingAndroid.setAlarmActive({ active: true, alarmId: alarm.id, soundType: alarm.soundType })
        .catch(err => console.error(err));
      GingAndroid.forceMaxVolume().catch(err => console.error(err));
    }

    return () => {
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
      if (wrongCodeTimerRef.current) window.clearTimeout(wrongCodeTimerRef.current);
      gingAudio.stop();
      stopCamera();

      // Release native lock when alarm is successfully dismissed
      if (isNativeAndroid && !nativeAlarmStoppedRef.current) {
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

  const stopAlarmAfterSuccessfulScan = async () => {
    updateScanStatus('stopping');
    setErrorText(null);
    stopCamera();
    gingAudio.stop();
    try {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch (error) {
      console.warn('Could not cancel the alarm confirmation audio:', error);
    }

    try {
      if (Capacitor.getPlatform() === 'android' && !nativeAlarmStoppedRef.current) {
        // Android resolves this only after the native ringer service and its
        // foreground notification have stopped completely.
        await GingAndroid.setAlarmActive({ active: false });
        nativeAlarmStoppedRef.current = true;
      }

      updateScanStatus('authenticated');
      void successHaptic();
      dismissTimerRef.current = window.setTimeout(() => {
        onDismiss();
        dismissTimerRef.current = null;
      }, 2400);
    } catch (error) {
      console.error('The alarm did not confirm that it stopped:', error);
      setErrorText('Ging could not confirm that the alarm stopped. Try again.');
      updateScanStatus('stop-error');
    }
  };

  const scheduleScanFrame = () => {
    if (!isMountedRef.current || !mediaStreamRef.current || loopRef.current !== null
      || scanStatusRef.current === 'stopping'
      || scanStatusRef.current === 'stop-error'
      || scanStatusRef.current === 'authenticated') return;
    loopRef.current = requestAnimationFrame(qrScanTick);
  };

  // QR scanning recursive routine using off-screen canvas rendering + jsQR decoding
  const qrScanTick = () => {
    loopRef.current = null;
    // If we've been authenticated, stop the loop permanently
    if (!isMountedRef.current || scanStatusRef.current === 'stopping'
      || scanStatusRef.current === 'stop-error'
      || scanStatusRef.current === 'authenticated') return;

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
            void stopAlarmAfterSuccessfulScan();
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
    return <AlarmSuccessScreen />;
  }

  return (
    <div className="relative h-dvh min-h-dvh text-[#261813] select-none flex flex-col overflow-hidden font-sans ambient-glow-bg ging-screen ging-screen--ringing">
      {/* Hidden processing canvas used for frame analysis */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Faint ambient haze */}
      <div className="glow-sphere-red top-[-10%] left-[-15%] opacity-60" />
      <div className="glow-sphere-orange bottom-[-15%] right-[-10%] opacity-50" />

      {/* Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between px-6 pt-5 pb-3 z-10 ringing-header">
        <div className="ringing-title">
          <img src="/gingy-face-cutout.webp" alt="" aria-hidden="true" className="ringing-mascot" />
          <span className="font-sans font-semibold text-[17px] text-[#261813] tracking-tight truncate">
            {alarm.label || 'Alarm'}
          </span>
        </div>
        {scanStatus !== 'authenticated' && (
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium ${scanStatus === 'stopping' ? 'glass-badge-orange' : 'glass-badge-red'}`}>
            <span className={`w-1.5 h-1.5 rounded-full soft-pulse ${scanStatus === 'stopping' ? 'bg-ging-orange' : 'bg-ging-red'}`} />
            <span>{scanStatus === 'stopping' ? 'Stopping…' : 'Ringing'}</span>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 min-h-0 max-w-md w-full mx-auto py-3 flex flex-col z-10 ringing-main">
        <div className="ringing-camera-stack">
          {/* Camera viewport — always mounted so the stream is never disconnected */}
          <div className="relative overflow-hidden rounded-[28px] ringing-camera">
            <div className="relative bg-black ringing-camera-view">
              {!isCameraActive && !errorText && scanStatus !== 'stopping' && (
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
                    onClick={() => scanStatus === 'stop-error'
                      ? void stopAlarmAfterSuccessfulScan()
                      : void startCamera()}
                    className="w-full max-w-xs text-[14px] glass-button font-medium py-3 rounded-xl transition-transform active:scale-95 mt-1"
                  >
                    {scanStatus === 'stop-error' ? 'Retry stopping' : 'Retry camera'}
                  </button>
                </div>
              )}

              {/* Always-mounted video stream */}
              <video
                ref={videoRef}
                className="ringing-camera-video"
                playsInline
                muted
              />

              {scanStatus === 'stopping' && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/25" role="status" aria-live="polite">
                  <div className="glass-card flex items-center gap-3 px-5 py-4 rounded-2xl">
                    <RefreshCw className="w-5 h-5 animate-spin text-ging-orange" />
                    <span className="text-[14px] font-medium">Stopping alarm…</span>
                  </div>
                </div>
              )}

              {/* Keep the live scan guide visible during brief wrong-code feedback. */}
              {isCameraActive && (scanStatus === 'scanning' || scanStatus === 'wrong-code') && (
                <div className={`scanner-overlay absolute inset-0 pointer-events-none flex items-center justify-center ${scanStatus === 'wrong-code' ? 'scanner-overlay--error' : ''}`}>
                  <div className="scanner-frame relative">
                    <div className="scanner-corner absolute -top-px -left-px w-8 h-8 border-t-2 border-l-2 rounded-tl-2xl" />
                    <div className="scanner-corner absolute -top-px -right-px w-8 h-8 border-t-2 border-r-2 rounded-tr-2xl" />
                    <div className="scanner-corner absolute -bottom-px -left-px w-8 h-8 border-b-2 border-l-2 rounded-bl-2xl" />
                    <div className="scanner-corner absolute -bottom-px -right-px w-8 h-8 border-b-2 border-r-2 rounded-br-2xl" />
                  </div>
                </div>
              )}

            </div>
          </div>

          <p className="ringing-scan-hint">
            Center your wake-up code in the frame to stop this alarm.
          </p>

          {/* Keep camera diagnostics out of the alarm UI; the task is simply to scan. */}
          {scanStatus !== 'authenticated' && (isCameraActive || errorText) && (
            <div className={`scanner-camera-status ${scanStatus === 'wrong-code' ? 'scanner-camera-status--error' : ''}`} role="status" aria-live="polite">
              {scanStatus === 'wrong-code' ? (
                <div className="scanner-error-feedback">
                  <span className="scanner-error-icon" aria-hidden="true"><Ban className="w-5 h-5" /></span>
                  <span className="scanner-error-copy">
                    <strong>Wrong QR code</strong>
                    <span>Keep this alarm&apos;s code in view.</span>
                  </span>
                </div>
              ) : (
                <span className={`inline-flex items-center gap-2 font-medium ${errorText ? 'text-red-400' : 'text-ging-burnt'}`}>
                  {!errorText && isCameraActive && scanStatus === 'scanning' && (
                    <span className="w-2 h-2 rounded-full soft-pulse bg-ging-orange" aria-hidden="true" />
                  )}
                  {errorText
                    ? scanStatus === 'stop-error' ? 'Alarm still ringing' : 'Camera unavailable'
                    : scanStatus === 'stopping' ? 'Stopping alarm' : 'Scanning'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
