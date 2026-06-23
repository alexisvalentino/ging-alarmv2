/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera, Music, Rows, BatteryCharging,
  Lock, BellRing, Info, ChevronRight
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
  const grantedCount = permissions.filter(p => p.granted).length;

  return (
    <div className="relative min-h-screen ambient-glow-bg text-white flex flex-col justify-between p-6 overflow-x-hidden font-sans">
      {/* Ambient haze */}
      <div className="glow-sphere-orange top-[-10%] left-[-15%]" />
      <div className="glow-sphere-red bottom-[-15%] right-[-10%]" />

      {/* Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between py-3 border-b border-white/[0.06] z-10">
        <div className="flex items-center gap-2">
          <GingLogo size={32} />
        </div>
        <span className="text-[13px] font-medium text-zinc-400">
          {grantedCount}/{permissions.length}
        </span>
      </div>

      {/* Main */}
      <div className="flex-1 max-w-md w-full mx-auto py-6 z-10 space-y-4">
        {/* Section title + intro (iOS Settings style) */}
        <div className="px-2">
          <h1 className="text-[28px] font-bold text-white tracking-tight">Permissions</h1>
          <p className="text-[13px] text-zinc-400 mt-1.5 leading-relaxed">
            These let your alarm ring at full volume, even through Android sleep modes.
          </p>
        </div>

        {/* Permissions grouped list (iOS Settings look) */}
        <div className="glass-card divide-y divide-white/[0.06] overflow-hidden">
          {permissions.map((p) => {
            const Icon = {
              camera: Camera,
              audio: Music,
              overlay: Rows,
              battery: BatteryCharging,
              lockscreen: Lock,
              notification: BellRing
            }[p.key];

            const expanded = activeInfoKey === p.key;

            return (
              <div key={p.id} className={p.granted ? '' : ''}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Icon tile */}
                  <div className={`w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0 ${p.granted
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-white/[0.08] text-zinc-300'
                  }`}>
                    <Icon className="w-[16px] h-[16px]" />
                  </div>

                  {/* Title + description */}
                  <button
                    onClick={() => setActiveInfoKey(expanded ? null : p.key)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <span className="font-medium text-[15px] text-white block truncate">{p.title}</span>
                    <span className="text-[12.5px] text-zinc-400 block truncate">{p.description}</span>
                  </button>

                  {/* Toggle */}
                  <button
                    onClick={() => handleTogglePermission(p.key, p.granted)}
                    className={`ios-toggle ${p.granted ? 'is-on' : 'is-off'} shrink-0`}
                    aria-pressed={p.granted}
                    aria-label={p.title}
                  >
                    <span className="ios-toggle__knob" />
                  </button>

                  {/* Info chevron */}
                  <button
                    onClick={() => setActiveInfoKey(expanded ? null : p.key)}
                    className="shrink-0 text-zinc-500 p-1"
                    aria-label="More info"
                  >
                    <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  </button>
                </div>

                {/* Info drawer (content preserved verbatim) */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/25"
                    >
                      <div className="px-4 py-3.5 pl-14 flex gap-2.5">
                        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0 break-words space-y-2 select-text">
                          <div className="text-zinc-300 font-medium text-[12.5px] leading-relaxed w-full break-words whitespace-normal">
                            {p.key === 'camera' && "Ging reads your QR code with a secure, on-device camera pipeline. Your video is analyzed locally and never sent anywhere."}
                            {p.key === 'audio' && "Unlocks the audio channel so your alarm sounds immediately at full volume, without browser autoplay blocks."}
                            {p.key === 'overlay' && (
                              <div className="space-y-2 w-full break-words">
                                <p className="whitespace-normal leading-relaxed">Lets the alarm appear over your lock screen and other apps, so you can't swipe it away or skip the QR scan.</p>

                                <div className="mt-2.5 p-3.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-zinc-300 space-y-2 w-full break-words">
                                  <span className="font-semibold text-[11px] text-zinc-200 block leading-relaxed whitespace-normal">
                                    If Android shows "restricted settings":
                                  </span>
                                  <ol className="list-decimal list-inside space-y-1.5 text-[12px] font-medium leading-relaxed break-words whitespace-normal text-zinc-400">
                                    <li>Open your phone's <span className="text-white">Settings</span> app.</li>
                                    <li>Go to <span className="text-white">Apps</span> and select <span className="text-white">Ging</span>.</li>
                                    <li>Tap the <span className="text-white">three dots (⋮)</span> in the top-right.</li>
                                    <li>Tap <span className="text-[#FFB37A] font-semibold">Allow restricted settings</span>.</li>
                                    <li>Confirm with your PIN, pattern, or fingerprint.</li>
                                  </ol>
                                  <span className="block text-[11px] text-zinc-500 italic mt-1 leading-normal font-medium whitespace-normal">
                                    Come back to Ging and toggle Display Over Other Windows again.
                                  </span>
                                </div>
                              </div>
                            )}
                            {p.key === 'battery' && "Tells Android to keep Ging's timer running during deep sleep so your alarm fires on time."}
                            {p.key === 'lockscreen' && "Wakes your screen and turns on the backlight when the alarm fires, even if your phone is locked."}
                            {p.key === 'notification' && "Keeps a lightweight background service alive so Android's memory cleaner doesn't kill your alarm."}
                          </div>
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
          <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-[12.5px] text-red-300 flex items-start gap-2 font-medium">
            <Camera className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{cameraError}</span>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="max-w-md w-full mx-auto mt-6 flex flex-col gap-3 z-10">
        {!allReady && (
          <div className="text-center text-[13px] text-zinc-400 font-medium px-2">
            Enable all {permissions.length} permissions to continue
          </div>
        )}

        <button
          onClick={allReady ? onComplete : undefined}
          disabled={!allReady}
          className={`w-full py-4 rounded-2xl font-sans font-semibold text-[15px] flex items-center justify-center gap-2 transition-all ${allReady
              ? 'glass-button-glow cursor-pointer'
              : 'bg-white/[0.04] text-zinc-500 border border-dashed border-white/[0.08] cursor-not-allowed'
            }`}
        >
          {allReady ? (
            <>
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </>
          ) : (
            <span>{grantedCount} of {permissions.length} enabled</span>
          )}
        </button>
      </div>
    </div>
  );
}
