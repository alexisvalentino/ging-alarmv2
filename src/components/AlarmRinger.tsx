/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera, Volume2, AlertOctagon, Flame, CheckCircle,
  RefreshCw, Info, Lock, Clock, Smile, Ban
} from 'lucide-react';
import { Alarm } from '../types';
import { gingAudio } from '../utils/audio';
import GingLogo from './GingLogo';
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

  // Keep a flash/color toggle state for stressful background visual
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

    // Strobe background color every 150ms for alarming stress factor!
    const flashInterval = setInterval(() => {
      setFlashToggle(prev => !prev);
    }, 180);

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
        `Unable to start video source: ${err?.message || err?.name || 'Could not start video source'}. Please ensure camera permissions are allowed in your device settings.`
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

  // QR scanning recursive routine using off-screen canvas rendering + jsQR decoding
  const qrScanTick = () => {
    if (!videoRef.current || !canvasRef.current || !mediaStreamRef.current) {
      loopRef.current = requestAnimationFrame(qrScanTick);
      return;
    }

    // Pause frame decoding while showing incorrect-code error or authenticated animations
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
      className={`min-h-screen text-black select-none flex flex-col justify-between p-6 overflow-x-hidden font-sans transition-all duration-200 ${scanStatus === 'authenticated'
          ? 'bg-green-100 text-black'
          : flashToggle
            ? 'bg-red-500 text-white'
            : 'bg-zinc-50'
        }`}
    >
      {/* Hidden processing canvas used for frame analysis */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Header Info */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between pb-3 border-b-2 border-black">
        <div className="flex items-center gap-2">
          <GingLogo size={36} />
          <span className="font-sans font-black text-xl tracking-wider text-black uppercase">Ging Ringing</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest bg-zinc-200 text-black px-2.5 py-1 rounded border-2 border-black font-black polish-shadow-sm">
          <Volume2 className="w-3.5 h-3.5 animate-pulse" />
          <span>ALARM RINGING</span>
        </div>
      </div>

      {/* Main Core Section */}
      <div className="flex-1 max-w-md w-full mx-auto py-6 flex flex-col justify-center items-center">

        {/* Giant Flashing Clock display to match alarm tone */}
        <div className="text-center mb-6">
          <span className="text-[10px] uppercase tracking-widest font-mono text-zinc-600 font-black block mb-1">
            {alarm.label || 'Wake Up Challenge'}
          </span>
          <h2 className="text-5xl font-black tracking-widest font-mono text-black filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
            {currentTimeStr || '--:--'}
          </h2>
        </div>

        {/* Big Alert Matrix */}
        <AnimatePresence mode="wait">
          {scanStatus === 'authenticated' ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="p-6 bg-white border-2 border-black rounded-3xl text-center shadow-2xl relative w-full overflow-hidden polish-shadow"
            >
              <div className="p-3 bg-green-100 max-w-fit mx-auto rounded-full mb-3 text-green-950 border-2 border-black">
                <CheckCircle className="w-8 h-8 animate-bounce" />
              </div>
              <h3 className="text-xl font-black font-sans uppercase">Wake Up Verified!</h3>
              <p className="text-xs text-zinc-700 mt-2 font-semibold leading-relaxed">
                Auth code matches current schedule. Standby... updating sleep tracker and restoring volume controls. Awesome start to your morning! ☕
              </p>
            </motion.div>
          ) : scanStatus === 'wrong-code' ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="p-6 bg-red-100 border-2 border-black rounded-3xl text-center shadow-2xl relative w-full overflow-hidden polish-shadow"
            >
              <div className="p-3 bg-red-200 max-w-fit mx-auto rounded-full mb-3 text-red-950 border-2 border-black">
                <Ban className="w-8 h-8 animate-bounce" />
              </div>
              <h3 className="text-lg font-black font-sans text-red-950 uppercase">INCORRECT CODE SCANNED</h3>
              <p className="text-xs text-red-900 mt-2 font-bold leading-relaxed">
                Ging detected code: <span className="font-mono font-black bg-white px-2 py-0.5 border border-black rounded">{currentScannedVal || "UNKNOWN"}</span>.
                This does NOT match your alarm key! Stand up, go to your bathroom, and scan the correct physical QR poster.
              </p>
            </motion.div>
          ) : (
            /* ACTIVE CAMERA SCAN VIEWPORT OVERLAY */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full relative rounded-3xl border-2 border-black shadow-2xl bg-zinc-950 overflow-hidden polish-shadow"
            >
              {/* Camera view screen */}
              <div className="aspect-[4/3] relative">
                {!isCameraActive && !errorText && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 p-4 text-center">
                    <RefreshCw className="w-7 h-7 animate-spin text-orange-600" />
                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Booting Secure Camera Pipeline...</span>
                  </div>
                )}

                {errorText && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/95 text-red-400 gap-3 overflow-y-auto">
                    <AlertOctagon className="w-8 h-8 shrink-0 text-red-500 animate-bounce" />
                    <span className="text-xs text-zinc-300 leading-relaxed font-bold">{errorText}</span>

                    <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
                      <button
                        onClick={startCamera}
                        className="w-full text-xs bg-white text-black font-black uppercase tracking-wider py-2.5 border-2 border-black rounded-xl active:scale-95 transition-transform hover:bg-zinc-100"
                      >
                        Retry Camera Request
                      </button>
                    </div>
                  </div>
                )}

                {/* Living video scanner stream */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* Laser scan lines */}
                {isCameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
                    <div className="absolute inset-x-8 h-1 bg-orange-500 opacity-90 scan-line filter drop-shadow-[0_0_8px_#FF6C35]" />

                    {/* Retro viewfinder corner graphics */}
                    <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-white" />
                    <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-white" />
                    <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-white" />
                    <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-white" />
                  </div>
                )}
              </div>

              {/* Bottom camera specs strip */}
              <div className="bg-zinc-900 border-t border-zinc-800/80 p-3 flex justify-between items-center text-[10px] font-mono text-zinc-400">
                <span className="truncate max-w-[200px]">{cameraLabel}</span>
                <span className="text-orange-500 font-extrabold animate-pulse">DECODER ACTIVE</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>



        {/* Shouting Voice reminder caption */}
        {scanStatus === 'scanning' && alarm.soundType === 'filipino-shout' && (
          <div className="mt-4 p-3 bg-white border-2 border-black rounded-xl text-xs italic text-center w-full max-w-sm font-bold tracking-wide polish-shadow-sm text-black">
            💬 Filipino voice shouting activated! Turn off before the neighbors complain!
          </div>
        )}
      </div>

      {/* Escapeless Action Instructions Footer */}
      <div className="max-w-md w-full mx-auto mt-4 text-center">
        <div className="p-4 bg-white border-2 border-black rounded-2xl polish-shadow">
          <p className="text-xs font-black text-black uppercase tracking-tight">How do I shut this off?</p>
          <p className="text-[11px] text-zinc-700 mt-1 font-semibold leading-relaxed">
            Physical exercise stops sleep loops: walk to the bathroom, hold your phone up, and focus this camera viewport directly at your printed custom QR poster!
          </p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase tracking-widest font-bold">
          <Lock className="w-3.5 h-3.5 text-zinc-650" />
          <span>Escapes disabled • Hard shutdown locked</span>
        </div>
      </div>

    </div>
  );
}
