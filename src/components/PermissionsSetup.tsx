/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera, Music, Rows, BatteryCharging,
  Lock, BellRing, Info, ChevronRight
} from 'lucide-react';
import { PermissionItem } from '../types';
import GingLogo from './GingLogo';
import { Capacitor } from '@capacitor/core';
import { GingAndroid } from '../native/GingAndroid';

interface PermissionsSetupProps {
  permissions: PermissionItem[];
  onUpdatePermission: (key: PermissionItem['key'], granted: boolean) => void;
  onComplete: () => void;
}

export default function PermissionsSetup({ permissions, onUpdatePermission, onComplete }: PermissionsSetupProps) {
  const [activeInfoKey, setActiveInfoKey] = useState<PermissionItem['key'] | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Automatically re-evaluate native permissions when the user returns to the app from system settings
  useEffect(() => {
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
    // Permission grants are managed by the OS; tapping an already granted row
    // cannot revoke them from inside the app.
    if (currentVal) return;

    if (key === 'camera') {
      try {
        setSetupError(null);
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
          onUpdatePermission('camera', true);
        } else {
          throw new Error("navigator.mediaDevices.getUserMedia is not supported on this context/device.");
        }
      } catch (err: any) {
        console.warn("Camera grant failed:", err);
        setSetupError("Couldn't access the camera. Check camera permission or close another app using it, then try again.");
        onUpdatePermission('camera', false);
      }
    } else if (key === 'audio') {
      try {
        // @ts-ignore
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Web Audio is unavailable.');

        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        await ctx.resume();
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.onended = () => { void ctx.close(); };
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        onUpdatePermission('audio', true);
      } catch (e) {
        console.warn("Audio Context init failed:", e);
        setSetupError('Ging could not play the audio check. Check your sound settings and try again.');
      }
    } else if (key === 'overlay') {
      if (Capacitor.isNativePlatform()) {
        try {
          // Open overlay manage page. Focus listener will pick up the result when they return.
          await GingAndroid.requestOverlayPermission();
        } catch (e) {
          console.error("Overlay native request failed:", e);
          setSetupError('Could not open Display over other apps settings. Try again from this screen.');
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
          setSetupError('Could not open background activity settings. Try again from this screen.');
        }
      } else {
        onUpdatePermission('battery', true);
      }
    } else if (key === 'notification') {
      try {
        if ('Notification' in window) {
          const res = await Notification.requestPermission();
          onUpdatePermission('notification', res === 'granted');
          if (res !== 'granted') setSetupError('Allow Ging notifications in your device settings to finish setup.');
        } else {
          onUpdatePermission('notification', false);
          setSetupError('Notifications are not available in this browser. Use the Ging app to finish setup.');
        }
      } catch (e) {
        console.warn("Notification request failed:", e);
        onUpdatePermission('notification', false);
        setSetupError('Ging could not request notifications. Check your device settings and try again.');
      }
    } else {
      onUpdatePermission(key, true);
    }
  };

  const allReady = permissions.every(p => p.granted);
  const grantedCount = permissions.filter(p => p.granted).length;

  return (
    <div className="relative min-h-dvh ambient-glow-bg ging-screen ging-screen--permissions text-white flex flex-col justify-between p-6 overflow-x-hidden font-sans">
      {/* Ambient haze */}
      <div className="glow-sphere-orange top-[-10%] left-[-15%]" />
      <div className="glow-sphere-red bottom-[-15%] right-[-10%]" />

      {/* Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between py-3 border-b border-white/[0.06] z-10 permissions-header">
        <div className="flex items-center gap-2">
          <GingLogo size={32} />
        </div>
        <span className="glass-badge rounded-full px-3 py-1.5 text-[13px] font-medium tabular-nums" role="status" aria-live="polite">
          {grantedCount} of {permissions.length} ready
        </span>
      </div>

      {/* Main */}
      <div className="flex-1 max-w-md w-full mx-auto py-6 z-10 space-y-4 permissions-main">
        {/* Section title + intro (iOS Settings style) */}
        <div className="px-2 permissions-intro">
          <h1 className="text-[28px] font-bold text-white tracking-tight">Permissions</h1>
          <p className="text-[13px] text-zinc-400 mt-1.5 leading-relaxed">
            Set up access to scan your QR code and keep alarms on schedule.
          </p>
        </div>

        {/* Permissions grouped list (iOS Settings look) */}
        <div className="glass-card divide-y divide-white/[0.06] overflow-hidden permissions-rows">
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
              <div key={p.id} className="permission-row">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Icon tile */}
                  <div className={`permission-icon-tile w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0 ${p.granted
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-white/[0.08] text-zinc-300'
                  }`}>
                    <Icon className="w-[16px] h-[16px]" />
                  </div>

                  {/* Title + description */}
                  <button
                    onClick={() => setActiveInfoKey(expanded ? null : p.key)}
                    aria-expanded={expanded}
                    className="flex-1 min-w-0 flex items-center gap-2 text-left"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-[15px] text-white block leading-snug break-words">{p.title}</span>
                      <span className="text-[12.5px] text-zinc-400 block leading-snug break-words">{p.description}</span>
                    </span>
                    <ChevronRight className={`w-4 h-4 shrink-0 text-zinc-500 transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden="true" />
                  </button>

                  {/* Toggle */}
                  <button
                    onClick={() => handleTogglePermission(p.key, p.granted)}
                    className={`ios-toggle ${p.granted ? 'is-on' : 'is-off'} shrink-0`}
                    aria-pressed={p.granted}
                    aria-label={p.title}
                    disabled={p.granted}
                  >
                    <span className="ios-toggle__knob" />
                  </button>

                </div>

                {/* Additional permission details */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden permission-info"
                    >
                      <div className="px-4 py-3.5 pl-8 flex items-start gap-2">
                        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0 break-words space-y-2 select-text">
                          <div className="text-zinc-300 font-medium text-[12.5px] leading-relaxed w-full break-words whitespace-normal">
                            {p.key === 'camera' && "Your camera feed stays on your device. Ging reads the QR locally and never uploads video."}
                            {p.key === 'audio' && "Lets Ging start alarm audio immediately, without waiting for another tap."}
                            {p.key === 'overlay' && (
                              <div className="space-y-2 w-full break-words">
                                <div className="p-3.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-zinc-300 space-y-2 w-full break-words">
                                  <span className="font-semibold text-[11px] text-zinc-200 block leading-relaxed whitespace-normal">
                                    If Android shows "restricted settings":
                                  </span>
                                  <ol className="list-decimal list-inside space-y-1.5 text-[12px] font-medium leading-relaxed break-words whitespace-normal text-zinc-400">
                                    <li>Open your phone's <span className="text-white">Settings</span> app.</li>
                                    <li>Go to <span className="text-white">Apps</span> and select <span className="text-white">Ging</span>.</li>
                                    <li>Tap the <span className="text-white">three dots (⋮)</span> in the top-right.</li>
                                    <li>Tap <span className="text-ging-burnt font-semibold">Allow restricted settings</span>.</li>
                                    <li>Confirm with your PIN, pattern, or fingerprint.</li>
                                  </ol>
                                  <span className="block text-[11px] text-zinc-500 italic mt-1 leading-normal font-medium whitespace-normal">
                                    Come back to Ging and toggle Display Over Other Windows again.
                                  </span>
                                </div>
                              </div>
                            )}
                            {p.key === 'battery' && "Android may pause background apps to save power. This access helps Ging keep its timer active."}
                            {p.key === 'lockscreen' && "This wakes the display without unlocking your phone."}
                            {p.key === 'notification' && "Android may show an ongoing Ging notification while alarms are scheduled."}
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

        <AnimatePresence initial={false}>
          {setupError && (
            <motion.div
              key="permission-error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-[12.5px] text-red-300 flex items-start gap-2 font-medium"
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span role="alert">{setupError}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer CTA */}
      <div className="max-w-md w-full mx-auto mt-6 flex flex-col gap-3 z-10 permissions-footer">
        <button
          onClick={allReady ? onComplete : undefined}
          disabled={!allReady}
          className={`w-full py-4 rounded-2xl font-sans font-semibold text-[15px] flex items-center justify-center gap-2 transition-colors ${allReady
              ? 'glass-button-glow cursor-pointer'
              : 'permission-continue-disabled cursor-not-allowed'
            }`}
        >
          <span>Continue</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
