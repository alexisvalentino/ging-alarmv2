/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera, CheckCircle, RefreshCw, Ban
} from 'lucide-react';
import { Alarm } from '../types';
import { gingAudio } from '../utils/audio';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface GingAndroidPlugin {
  setAlarmActive(options: { active: boolean }): Promise<void>;
  forceMaxVolume(): Promise<void>;
  checkBatteryBypass(): Promise<{ granted: boolean }>;
  requestBatteryBypass(): Promise<{ requested: boolean }>;
  checkOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<{ requested: boolean }>;
}

const GingAndroid = registerPlugin<GingAndroidPlugin>('GingAndroid');

interface AlarmRingerProps {
  alarm: Alarm;
  onDismiss: (success: boolean) => void;
}

export default function AlarmRinger({ alarm, onDismiss }: AlarmRingerProps) {
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [scanStatus, setScanStatus] = useState<'scanning' | 'wrong-code' | 'authenticated'>('scanning');
  const scanStatusRef = useRef<'scanning' | 'wrong-code' | 'authenticated'>('scanning');

  const updateScanStatus = (status: 'scanning' | 'wrong-code' | 'authenticated') => {
    setScanStatus(status);
    scanStatusRef.current = status;
  };

  const [errorText, setErrorText] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLabel, setCameraLabel] = useState('Default Camera');
  const [currentScannedVal, setCurrentScannedVal] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Keep a flash/color toggle state for the calm pulsing background
  const [flashToggle, setFlashToggle] = useState(false);

  // Sound triggering and live clock
  useEffect(() => {
    // Start playing the brutal audio on load at absolute maximum volume!
    gingAudio.start(alarm.soundType, 1.0);

    let volumeGuardInterval: number | null = null;

    // Lock the native Android back-buttons and system-exits during alarm ringing
    if (Capacitor.isNativePlatform()) {
      GingAndroid.setAlarmActive({ active: true }).catch(err => console.error(err));
      GingAndroid.forceMaxVolume().catch(err => console.error(err));

      // Continually override and enforce 100% full system speaker volume every 2.5 seconds!
      // This blocks the user from muting GING using their physical hardware volume-down keys.
      volumeGuardInterval = window.setInterval(() => {
        GingAndroid.forceMaxVolume().catch(err => console.error(err));
      }, 2500);
    }

    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);

    // Calm pulsing toggle for the background (replaces the 180ms hard strobe)
    const flashInterval = setInterval(() => {
      setFlashToggle(prev => !prev);
    }, 700);

    return () => {
      clearInterval(interval);
      clearInterval(flashInterval);
      if (volumeGuardInterval) clearInterval(volumeGuardInterval);
      gingAudio.stop();
      stopCamera();

      // Release native lock when alarm is successfully dismissed
      if (Capacitor.isNativePlatform()) {
        GingAndroid.setAlarmActive({ active: false }).catch(err => console.error(err));
      }
    };
  }, [alarm]);

  // Handle bootstrap camera feed
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setErrorText(null);
      // Stop anything running
      stopCamera();

      let stream: MediaStream;
      try {
        // First choice: High Quality back camera constraints suitable for QR scan
        const constraints: MediaStreamConstraints = {
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        console.warn("High-quality back camera failed, trying simple video: true fallback. Info:", firstErr);
        // Fallback to simple generic video constraints
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // helpful for mobile browsers
        videoRef.current.play();
        setIsCameraActive(true);

        // Find human readable camera name
        try {
          const tracks = stream.getVideoTracks();
          if (tracks.length > 0) {
            setCameraLabel(tracks[0].label || 'Default Camera');
            console.log('Using camera device:', tracks[0].label);
          }
        } catch (e) { }

        // Launch QR analytical loop
        loopRef.current = requestAnimationFrame(qrScanTick);
      }
    } catch (err: any) {
      console.error("Camera startup fully failed:", err);
      setErrorText(
        `Unable to start camera: ${err?.message || err?.name || 'Could not start video source'}. Please allow camera access in your device settings.`
      );
    }
  };

  const stopCamera = () => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Safety net: reattach the media stream to the video element if it gets disconnected
  // This handles edge cases like React re-renders, AnimatePresence transitions, etc.
  const ensureVideoStreamConnected = () => {
    if (videoRef.current && mediaStreamRef.current && !videoRef.current.srcObject) {
      console.warn('[GING] Video element lost stream connection — reattaching.');
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(e => console.error('[GING] Video play failed on reattach:', e));
      if (!isCameraActive) setIsCameraActive(true);
    }
  };

  // Whenever scan status transitions back to 'scanning', ensure the video stream is live
  useEffect(() => {
    if (scanStatus === 'scanning') {
      ensureVideoStreamConnected();

      // Also restart the scan loop if it died for any reason
      if (!loopRef.current && mediaStreamRef.current) {
        console.log('[GING] Restarting QR scan loop after status reset to scanning.');
        loopRef.current = requestAnimationFrame(qrScanTick);
      }
    }
  }, [scanStatus]);

  // QR scanning recursive routine using off-screen canvas rendering + jsQR decoding
  const qrScanTick = () => {
    // If we've been authenticated, stop the loop permanently
    if (scanStatusRef.current === 'authenticated') {
      return;
    }

    if (!videoRef.current || !canvasRef.current || !mediaStreamRef.current) {
      loopRef.current = requestAnimationFrame(qrScanTick);
      return;
    }

    // Safety: reattach stream if video element lost its source (e.g., after React remount)
    if (!videoRef.current.srcObject && mediaStreamRef.current) {
      console.warn('[GING] qrScanTick detected disconnected video — reattaching stream.');
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(e => console.error('[GING] Video play failed:', e));
      if (!isCameraActive) setIsCameraActive(true);
    }

    // Pause frame decoding while showing incorrect-code error (but keep the loop alive!)
    if (scanStatusRef.current !== 'scanning') {
      loopRef.current = requestAnimationFrame(qrScanTick);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      // Scale canvas to match source video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw active frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Perform pixel mapping analysis
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code) {
        const decodedVal = code.data.trim();
        console.log('Decoded code:', decodedVal, 'Expected secret:', alarm.qrSecret);
        setCurrentScannedVal(decodedVal);

        if (decodedVal === alarm.qrSecret.trim()) {
          // CORRECT QR CODE MATCHED!
          updateScanStatus('authenticated');
          stopCamera();

          // Sound off!
          gingAudio.stop();

          // Play high success sound chime or TTS
          try {
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
              const authUtterance = new SpeechSynthesisUtterance("Wake up authenticated! Good job getting out of bed!");
              authUtterance.lang = 'en-US';
              authUtterance.volume = 1.0;
              window.speechSynthesis.speak(authUtterance);
            }
          } catch (e) { }

          // End the loop and trigger success callback to parent
          setTimeout(() => {
            onDismiss(true);
          }, 2400);
          return;
        } else {
          // Wrong QR code (like a cereal box, product code, etc.)
          updateScanStatus('wrong-code');

          // Reset warning status after a short delay so scanning can proceed
          setTimeout(() => {
            if (scanStatusRef.current === 'wrong-code') {
              updateScanStatus('scanning');
            }
          }, 2500);
        }
      }
    }

    loopRef.current = requestAnimationFrame(qrScanTick);
  };

  return (
    <div
      className={`relative min-h-screen text-white select-none flex flex-col justify-between p-6 overflow-x-hidden font-sans transition-colors duration-500 ${
        scanStatus === 'authenticated'
          ? 'ambient-glow-bg'
          : flashToggle
            ? 'bg-[#1a0406]'
            : 'ambient-glow-bg'
      }`}
    >
      {/* Hidden processing canvas used for frame analysis */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Soft pulsing accent while scanning */}
      {scanStatus !== 'authenticated' && (
        <div className="glow-sphere-red top-[-10%] left-[-15%] opacity-70" />
      )}

      {/* Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between pb-3 border-b border-white/[0.06] z-10">
        <span className="font-sans font-semibold text-[17px] text-white tracking-tight">
          {alarm.label || 'Alarm'}
        </span>
        <div className="flex items-center gap-1.5 glass-badge-red px-3 py-1 rounded-full text-[12px] font-medium">
          <span className={`w-1.5 h-1.5 rounded-full bg-[#FF453A] ${flashToggle ? 'opacity-100' : 'opacity-40'} transition-opacity`} />
          <span>Ringing</span>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 max-w-md w-full mx-auto py-6 flex flex-col justify-center items-center z-10 space-y-6">

        {/* Big clock */}
        <div className="text-center">
          <span className="text-[13px] text-zinc-400 block mb-1">
            {alarm.label || 'Alarm'}
          </span>
          <h2 className="text-[56px] font-semibold tracking-tight text-white">
            {currentTimeStr || '--:--'}
          </h2>
        </div>

        {/* Camera viewport — always mounted so the stream is never disconnected */}
        <div
          className={`w-full relative rounded-3xl border border-white/10 shadow-2xl bg-black overflow-hidden ${scanStatus === 'scanning' ? 'soft-pulse' : ''}`}
        >
          <div className="aspect-[4/3] relative">
            {!isCameraActive && !errorText && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 p-4 text-center z-10">
                <RefreshCw className="w-7 h-7 animate-spin text-zinc-400" />
                <span className="text-[13px] text-zinc-400 font-medium">Starting camera…</span>
              </div>
            )}

            {errorText && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/90 text-red-300 gap-3 overflow-y-auto z-20">
                <Ban className="w-8 h-8 shrink-0 text-red-400" />
                <span className="text-[13px] text-zinc-300 leading-relaxed font-medium">{errorText}</span>

                <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
                  <button
                    onClick={startCamera}
                    className="w-full text-[14px] glass-button font-medium py-2.5 rounded-xl transition-transform active:scale-95"
                  >
                    Retry camera
                  </button>
                </div>
              </div>
            )}

            {/* Always-mounted video stream */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Scanner overlay during active scanning */}
            {isCameraActive && scanStatus === 'scanning' && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Animated scan line */}
                <div className="absolute inset-x-10 h-0.5 bg-[#FF8A42]/80 scan-line" />

                {/* Viewfinder corners */}
                <div className="absolute top-5 left-5 w-7 h-7 border-t-2 border-l-2 border-[#FF8A42]/70 rounded-tl-lg" />
                <div className="absolute top-5 right-5 w-7 h-7 border-t-2 border-r-2 border-[#FF8A42]/70 rounded-tr-lg" />
                <div className="absolute bottom-5 left-5 w-7 h-7 border-b-2 border-l-2 border-[#FF8A42]/70 rounded-bl-lg" />
                <div className="absolute bottom-5 right-5 w-7 h-7 border-b-2 border-r-2 border-[#FF8A42]/70 rounded-br-lg" />

                {/* Center frame */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 relative">
                    <div className="absolute inset-0 border border-[#FF8A42]/40 rounded-2xl" />
                  </div>
                </div>

                {/* Bottom hint */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-8 pb-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-[#FFB37A]">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Point at your QR code</span>
                  </div>
                </div>
              </div>
            )}

            {/* Status overlays */}
            <AnimatePresence mode="wait">
              {scanStatus === 'authenticated' && (
                <motion.div
                  key="authenticated"
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  className="absolute inset-0 z-30 flex items-center justify-center"
                >
                  <div className="glass-card border-emerald-500/30 p-6 text-center w-[90%]">
                    <div className="p-3 bg-emerald-500/15 max-w-fit mx-auto rounded-full mb-3 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-[20px] font-semibold text-emerald-300">Wake up verified</h3>
                    <p className="text-[13px] text-zinc-300 mt-2 leading-relaxed">
                      Code matches. Great start to your morning.
                    </p>
                  </div>
                </motion.div>
              )}
              {scanStatus === 'wrong-code' && (
                <motion.div
                  key="wrong-code"
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  className="absolute inset-0 z-30 flex items-center justify-center"
                >
                  <div className="glass-card border-red-500/30 p-6 text-center w-[90%]">
                    <div className="p-3 bg-red-500/15 max-w-fit mx-auto rounded-full mb-3 text-red-300 border border-red-500/30">
                      <Ban className="w-8 h-8" />
                    </div>
                    <h3 className="text-[18px] font-semibold text-red-300">Wrong code</h3>
                    <p className="text-[13px] text-zinc-300 mt-2 leading-relaxed">
                      That isn't your wake-up code. Walk to it and scan the correct one.
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-3 font-medium">
                      Resuming scan…
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Camera status strip */}
          <div className="bg-black/60 backdrop-blur-md border-t border-white/[0.06] px-4 py-2.5 flex justify-between items-center text-[11px] text-zinc-400">
            <span className="truncate max-w-[200px]">{cameraLabel}</span>
            <span className={`font-medium ${scanStatus === 'wrong-code' ? 'text-red-400' : scanStatus === 'authenticated' ? 'text-emerald-400' : 'text-[#FF8A42]'}`}>
              {scanStatus === 'wrong-code' ? 'Retrying' : scanStatus === 'authenticated' ? 'Verified' : 'Scanning'}
            </span>
          </div>
        </div>

        {/* Shouter notice */}
        {scanStatus === 'scanning' && alarm.soundType === 'filipino-shout' && (
          <div className="glass-card border-red-500/20 p-3 rounded-2xl text-[12.5px] text-center w-full max-w-sm text-zinc-300 font-medium">
            Shouter voice is on — scan your code to stop it.
          </div>
        )}
      </div>

      {/* Help footer */}
      <div className="max-w-md w-full mx-auto mt-4 text-center z-10">
        <div className="glass-card p-4">
          <p className="text-[13px] font-semibold text-white">How do I turn this off?</p>
          <p className="text-[12px] text-zinc-400 mt-1.5 leading-relaxed">
            Walk to your printed QR code and point this camera at it. There's no other way.
          </p>
        </div>
      </div>
    </div>
  );
}
