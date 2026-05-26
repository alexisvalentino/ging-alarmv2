/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, ShieldAlert, Camera, Music, Rows, BatteryCharging,
  Lock, BellRing, Info, AlertTriangle, ArrowRight, CheckCircle2
} from 'lucide-react';
import { PermissionItem } from '../types';
import GingLogo from './GingLogo';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface GingAndroidPlugin {
  setAlarmActive(options: { active: boolean }): Promise<void>;
  checkBatteryBypass(): Promise<{ granted: boolean }>;
  requestBatteryBypass(): Promise<{ requested: boolean }>;
  checkOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<{ requested: boolean }>;
}

const GingAndroid = registerPlugin<GingAndroidPlugin>('GingAndroid');

interface PermissionsSetupProps {
  permissions: PermissionItem[];
  onUpdatePermission: (key: PermissionItem['key'], granted: boolean) => void;
  onComplete: () => void;
}

export default function PermissionsSetup({ permissions, onUpdatePermission, onComplete }: PermissionsSetupProps) {
  const [activeInfoKey, setActiveInfoKey] = useState<PermissionItem['key'] | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [audioTesting, setAudioTesting] = useState(false);

  // Automatically re-evaluate native permissions when the user returns to the app from system settings
  React.useEffect(() => {
    const checkNativePermissions = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const { granted: overlayGranted } = await GingAndroid.checkOverlayPermission();
          onUpdatePermission('overlay', overlayGranted);

          const { granted: batteryGranted } = await GingAndroid.checkBatteryBypass();
          onUpdatePermission('battery', batteryGranted);
        } catch (e) {
          console.error("Failed re-checking native permissions on resume:", e);
        }
      }
    };

    // Recheck immediately on mount
    checkNativePermissions();

    const handleFocus = () => {
      // Recheck when user returns to app focus
      checkNativePermissions();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    // Also run a small polling interval every 2.5 seconds just in case visibility events are delayed
    const interval = setInterval(checkNativePermissions, 2500);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      clearInterval(interval);
    };
  }, [onUpdatePermission]);

  // Toggle system permission confirmation
  const handleTogglePermission = async (key: PermissionItem['key'], currentVal: boolean) => {
    if (currentVal) {
      onUpdatePermission(key, false);
      return;
    }

    if (key === 'camera') {
      try {
        setCameraError(null);
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
          onUpdatePermission('camera', true);
        } else {
          throw new Error("navigator.mediaDevices.getUserMedia is not supported on this context/device.");
        }
      } catch (err: any) {
        console.warn("Camera grant failed:", err);
        setCameraError(
          `Camera request failed: ${err?.message || 'Access blocked'}. Please check settings.`
        );
        if (Capacitor.isNativePlatform()) {
          onUpdatePermission('camera', false);
        } else {
          onUpdatePermission('camera', true);
        }
      }
    } else if (key === 'audio') {
      setAudioTesting(true);
      try {
        // @ts-ignore
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.frequency.setValueAtTime(1000, ctx.currentTime);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        }
      } catch (e) {
        console.warn("Audio Context init failed:", e);
      }
      onUpdatePermission('audio', true);
      setTimeout(() => setAudioTesting(false), 400);
    } else if (key === 'overlay') {
      if (Capacitor.isNativePlatform()) {
        try {
          // Open overlay manage page. Focus listener will pick up the result when they return.
          await GingAndroid.requestOverlayPermission();
        } catch (e) {
          console.error("Overlay native request failed:", e);
        }
      } else {
        onUpdatePermission('overlay', true);
      }
    } else if (key === 'battery') {
      if (Capacitor.isNativePlatform()) {
        try {
          // Open battery optimization bypass prompt. Focus listener will pick up the result when they return.
          await GingAndroid.requestBatteryBypass();
        } catch (e) {
          console.error("Battery native request failed:", e);
        }
      } else {
        onUpdatePermission('battery', true);
      }
    } else if (key === 'notification') {
      try {
        if ('Notification' in window) {
          const res = await Notification.requestPermission();
          onUpdatePermission('notification', res === 'granted');
        } else {
          onUpdatePermission('notification', true);
        }
      } catch (e) {
        console.warn("Notification request failed:", e);
        onUpdatePermission('notification', true);
      }
    } else {
      onUpdatePermission(key, true);
    }
  };

  const allReady = permissions.every(p => p.granted);

  return (
    <div className="relative min-h-screen bg-gray-50 text-black flex flex-col justify-between p-6 overflow-x-hidden font-sans">

      {/* Upper Brand Badge */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between py-3 border-b-2 border-black">
        <div className="flex items-center gap-2">
          <GingLogo size={36} />
          <span className="font-sans font-black text-xl tracking-wider text-black uppercase">Ging Setup</span>
        </div>
        <span className="text-[10px] font-mono font-black text-black uppercase tracking-widest bg-zinc-200 px-3 py-1 rounded border-2 border-black polish-shadow-sm">
          SUPERUSERS ONLY
        </span>
      </div>

      {/* Main Core Form */}
      <div className="flex-1 max-w-md w-full mx-auto py-8">
        <div className="mb-6 bg-white border-2 border-black p-5 rounded-2xl polish-shadow">
          <h2 className="text-xl font-black tracking-tight text-black flex items-center gap-2 uppercase">
            1. The Protocol
            <ShieldAlert className="w-5 h-5 text-orange-600" />
          </h2>
          <p className="text-zinc-600 text-xs mt-2 leading-relaxed italic font-medium">
            Ging requires total system authorization override to bypass mobile sleep limits. Enable these superpermissions to build your wake-up shield:
          </p>
        </div>

        {/* Permissions list */}
        <div className="space-y-3">
          {permissions.map((p) => {
            const Icon = {
              camera: Camera,
              audio: Music,
              overlay: Rows,
              battery: BatteryCharging,
              lockscreen: Lock,
              notification: BellRing
            }[p.key];

            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border-2 border-black transition-all ${p.granted
                    ? 'bg-green-50 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white text-black polish-shadow'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl mt-0.5 border-2 border-black ${p.granted ? 'bg-green-200 text-green-950' : 'bg-gray-100 text-zinc-700'
                      }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm tracking-tight">{p.title}</span>
                        <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-black ${p.granted ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                          {p.urgency}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-650 mt-1 mr-4 font-medium leading-relaxed">{p.description}</p>
                    </div>
                  </div>

                  {/* Interactive toggle / button */}
                  <div className="flex flex-col items-end gap-1.5 pt-0.5 shrink-0">
                    <button
                      onClick={() => handleTogglePermission(p.key, p.granted)}
                      className={`relative w-12 h-6 flex items-center rounded-full border-2 border-black cursor-pointer transition-colors duration-205 ${p.granted ? 'bg-green-400' : 'bg-gray-200'
                        }`}
                    >
                      <span
                        className={`w-4.5 h-4.5 rounded-full bg-white border border-black transition-transform duration-200 shadow-sm ${p.granted ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>

                    <button
                      onClick={() => setActiveInfoKey(activeInfoKey === p.key ? null : p.key)}
                      className="p-1 px-2 text-zinc-500 hover:text-black hover:bg-gray-100 rounded border border-transparent hover:border-black/10 transition-colors"
                      title="Why GING needs this"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Drawer containing Android specifications */}
                <AnimatePresence>
                  {activeInfoKey === p.key && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-3 text-xs text-zinc-700 bg-zinc-50 border-t-2 border-dashed border-black/20 pt-3 flex gap-2 w-full"
                    >
                      <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0 break-words space-y-2 select-text">
                        <span className="text-orange-600 font-extrabold font-mono block">GING SPEC INFO:</span>

                        <div className="text-zinc-600 font-bold text-xs leading-relaxed w-full break-words whitespace-normal">
                          {p.key === 'camera' && "Utilizes a secure, local camera pipeline to read your QR code. Your video stream is analyzed entirely on your device and is never sent to the internet."}
                          {p.key === 'audio' && "Initializes a highly reliable audio channel so your ringtone sounds immediately at the perfect wake-up volume without browser audio blockages."}
                          {p.key === 'overlay' && (
                            <div className="space-y-2 w-full break-words">
                              <p className="whitespace-normal leading-relaxed text-zinc-650">Allows the alarm screen to launch directly over your lock screen and other open apps. This ensures you can't swipe it away or bypass the QR scan.</p>

                              <div className="mt-2.5 p-3.5 bg-orange-50 border-2 border-black rounded-xl text-black space-y-2 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] w-full break-words">
                                <span className="font-black text-[10px] text-orange-750 block uppercase tracking-wider font-mono break-words leading-relaxed whitespace-normal">
                                  🔓 How to Bypass Android's Restricted Settings (10-Second Fix):
                                </span>
                                <ol className="list-decimal list-inside space-y-1.5 text-[11px] font-bold text-zinc-800 leading-relaxed break-words whitespace-normal">
                                  <li>Open your phone's general <span className="underline">Settings</span> app.</li>
                                  <li>Go to <span className="underline">Apps ➔ App Management</span> (or search for <span className="font-mono text-black">Ging</span>) ➔ select the <span className="font-mono text-black">Ging</span> app info page.</li>
                                  <li>In the top-right corner, tap the **three vertical dots (⋮)** menu button.</li>
                                  <li>Tap <span className="text-orange-750 font-black">"Allow restricted settings"</span>.</li>
                                  <li>Confirm using your phone's **PIN, Pattern, or Fingerprint** lock.</li>
                                </ol>
                                <span className="block text-[10px] text-zinc-650 italic mt-1 leading-normal font-semibold whitespace-normal">
                                  You are now unlocked! Go back into the Ging app, toggle the Display Over Other Windows switch again, and Android will let you turn it on perfectly!
                                </span>
                              </div>
                            </div>
                          )}
                          {p.key === 'battery' && "Tells Android to keep Ging's background timer active even during deep phone sleep. This prevents your phone from putting the alarm to sleep to save battery."}
                          {p.key === 'lockscreen' && "Forcibly wakes up your screen and turns on your screen backlight when the alarm goes off, even if your phone is locked."}
                          {p.key === 'notification' && "Runs a lightweight background service to anchor your scheduled alarms. This prevents Android's system memory cleaner from shutting down your alarm timers."}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {cameraError && (
          <div className="mt-4 p-3.5 bg-red-50 border-2 border-red-500 rounded-xl text-xs text-red-700 flex items-start gap-2 polish-shadow-sm font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{cameraError}</span>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="max-w-md w-full mx-auto mt-6 flex flex-col gap-3">
        {!allReady && (
          <div className="text-center p-3 w-full bg-orange-100 rounded-2xl border-2 border-orange-500 text-xs text-orange-850 font-bold uppercase tracking-wider">
            🚨 REQUIREMENT CHECKPOINT
            <p className="text-[10px] font-medium text-zinc-700 normal-case mt-0.5">
              Activate all system superpermissions in the column above to boot Ging.
            </p>
          </div>
        )}

        <button
          onClick={allReady ? onComplete : undefined}
          disabled={!allReady}
          className={`w-full py-4 rounded-2xl font-sans font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all border-2 border-black ${allReady
              ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-red-700 text-white shadow-lg polish-shadow active:translate-y-1 active:shadow-none'
              : 'bg-zinc-250 text-zinc-400 cursor-not-allowed border-dashed'
            }`}
        >
          {allReady ? (
            <>
              <span>Generate My Anti-Sleep QR Code</span>
              <ArrowRight className="w-4 h-4 animate-pulse" />
            </>
          ) : (
            <span>SYSTEM SUPERPERMISSIONS ({permissions.filter(p => p.granted).length}/6)</span>
          )}
        </button>
      </div>

    </div>
  );
}
