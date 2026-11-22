/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Alarm, PermissionItem, AppState } from './types';
import Splash from './components/Splash';
import StartupScreen from './components/StartupScreen';
import { generateWakeUpSecret } from './utils/qrSecret';
import { mergePermissionsWithDefaults } from './utils/permissionState';
import {
  checkAlarmNotificationReadiness,
  clearDeliveredAlarmNotifications,
  syncAlarmNotifications
} from './utils/nativeAlarmNotifications';
import { getAlarmNotificationMetadata, handleAlarmNotification } from './utils/alarmNotificationSchedule';

const PermissionsSetup = lazy(() => import('./components/PermissionsSetup'));
const QRCodeManager = lazy(() => import('./components/QRCodeManager'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const AlarmRinger = lazy(() => import('./components/AlarmRinger'));

const initialPermissions: PermissionItem[] = [
  {
    id: 'p1',
    key: 'camera',
    title: 'Camera access',
    description: 'Scan QR to stop your alarm.',
    urgency: 'CRITICAL & MANDATORY',
    isSimulated: false,
    granted: false
  },
  {
    id: 'p2',
    key: 'audio',
    title: 'Alarm audio',
    description: 'Play sound when it rings.',
    urgency: 'CRITICAL & MANDATORY',
    isSimulated: false,
    granted: false
  },
  {
    id: 'p3',
    key: 'overlay',
    title: 'Show over other apps',
    description: 'Keep alarm above other apps.',
    urgency: 'HIGH PRIOR',
    isSimulated: false,
    granted: false
  },
  {
    id: 'p4',
    key: 'battery',
    title: 'Background activity',
    description: 'Keep alarms on schedule.',
    urgency: 'CRITICAL & MANDATORY',
    isSimulated: false,
    granted: false
  },
  {
    id: 'p5',
    key: 'lockscreen',
    title: 'Wake screen',
    description: 'Wake screen at alarm time.',
    urgency: 'RECOMMENDED',
    isSimulated: false,
    granted: false
  },
  {
    id: 'p6',
    key: 'notification',
    title: 'Alarm notification',
    description: 'Let Ging alert you at each alarm time.',
    urgency: 'CRITICAL & MANDATORY',
    isSimulated: false,
    granted: false
  }
];

const applyPlatformPermissionDefaults = (permissions: PermissionItem[]) => {
  if (Capacitor.getPlatform() !== 'ios') return permissions;
  return permissions.map(permission => ['overlay', 'battery', 'lockscreen'].includes(permission.key)
    ? { ...permission, granted: true, isSimulated: true }
    : permission);
};

export default function App() {
  const lastTriggeredMinuteRef = useRef<string>('');
  const qrReturnViewRef = useRef<AppState['currentView']>('permissions');
  const [state, setState] = useState<AppState>(() => {
    // Attempt local storage cache retrieval
    const cached = localStorage.getItem('GING_WAKEUPS_APPSTORE_STATE');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Ensure properties exist
        const hasOnboarded = parsed.hasCompletedOnboarding || false;
        const rawPermissions = applyPlatformPermissionDefaults(
          mergePermissionsWithDefaults(initialPermissions, parsed.permissions)
        );
        const pendingAlarm: Alarm | null = hasOnboarded ? parsed.activeRingingAlarm || null : null;

        // Force reset to false if onboarding is not completed to ensure they are prompted
        const freshPermissions = hasOnboarded
          ? rawPermissions
          : applyPlatformPermissionDefaults(initialPermissions.map(p => ({ ...p, granted: false })));

        return {
          currentView: pendingAlarm ? 'ringing' : hasOnboarded ? 'dashboard' : 'splash',
          hasCompletedOnboarding: hasOnboarded,
          activeRingingAlarm: pendingAlarm,
          alarms: parsed.alarms || [],
          permissions: freshPermissions,
          userQRSecret: parsed.userQRSecret || generateWakeUpSecret(),
          streak: parsed.streak || 0,
          lastWakeUpTime: parsed.lastWakeUpTime || null
        };
      } catch (e) {
        console.error('Failed parsing state cache', e);
      }
    }

    // Default pristine state
    const defaultSecret = generateWakeUpSecret();
    const defaultAlarms: Alarm[] = [
      {
        id: 'default-morning',
        time: '06:00',
        label: 'Morning alarm',
        active: true,
        days: [1, 2, 3, 4, 5], // Monday through Friday
        volume: 1.0,
        soundType: 'industrial',
        qrSecret: defaultSecret
      }
    ];

    return {
      currentView: 'splash',
      hasCompletedOnboarding: false,
      activeRingingAlarm: null,
      alarms: defaultAlarms,
      permissions: applyPlatformPermissionDefaults(initialPermissions),
      userQRSecret: defaultSecret,
      streak: 5, // give them a nice initial momentum streak to cherish!
      lastWakeUpTime: null
    };
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [isStartupLoading, setIsStartupLoading] = useState(true);

  const activateAlarm = useCallback((alarm: Alarm) => {
    const alarmKey = `${new Date().getDay()}-${alarm.time}`;
    if (lastTriggeredMinuteRef.current === alarmKey) return;
    lastTriggeredMinuteRef.current = alarmKey;

    setState(prev => {
      if (prev.activeRingingAlarm || prev.currentView === 'ringing') return prev;
      const currentAlarm = prev.alarms.find(candidate => candidate.id === alarm.id && candidate.active);
      if (!currentAlarm) return prev;
      return { ...prev, activeRingingAlarm: currentAlarm, currentView: 'ringing' };
    });
  }, []);

  useEffect(() => {
    if (state.currentView === 'ringing' && state.activeRingingAlarm) {
      setIsStartupLoading(false);
      return;
    }

    const startupTimer = window.setTimeout(() => setIsStartupLoading(false), 700);
    return () => window.clearTimeout(startupTimer);
  }, [state.activeRingingAlarm, state.currentView]);

  // Keep state synchronized with local storage for persistence
  useEffect(() => {
    localStorage.setItem('GING_WAKEUPS_APPSTORE_STATE', JSON.stringify({
      hasCompletedOnboarding: state.hasCompletedOnboarding,
      alarms: state.alarms,
      permissions: state.permissions,
      userQRSecret: state.userQRSecret,
      streak: state.streak,
      lastWakeUpTime: state.lastWakeUpTime,
      activeRingingAlarm: state.activeRingingAlarm
    }));
  }, [state]);

  // Re-check OS notification access on launch and when returning from Settings.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    const refreshAlarmNotificationPermission = async () => {
      try {
        const readiness = await checkAlarmNotificationReadiness();
        if (disposed) return;

        setState(prev => {
          const currentPermission = prev.permissions.find(permission => permission.key === 'notification');
          const needsPermissionScreen = prev.hasCompletedOnboarding
            && !readiness.ready
            && prev.currentView !== 'ringing';
          if (currentPermission?.granted === readiness.ready
            && (!needsPermissionScreen || prev.currentView === 'permissions')) return prev;

          return {
            ...prev,
            currentView: needsPermissionScreen ? 'permissions' : prev.currentView,
            permissions: prev.permissions.map(permission => permission.key === 'notification'
              ? { ...permission, granted: readiness.ready }
              : permission)
          };
        });
      } catch (error) {
        console.error('Could not check native alarm notification access:', error);
      }
    };

    void refreshAlarmNotificationPermission();
    window.addEventListener('focus', refreshAlarmNotificationPermission);
    document.addEventListener('visibilitychange', refreshAlarmNotificationPermission);

    return () => {
      disposed = true;
      window.removeEventListener('focus', refreshAlarmNotificationPermission);
      document.removeEventListener('visibilitychange', refreshAlarmNotificationPermission);
    };
  }, []);

  // Native notifications remain scheduled by the OS when the app is backgrounded.
  const alarmNotificationsReady = state.permissions.find(permission => permission.key === 'notification')?.granted ?? false;
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !state.hasCompletedOnboarding) return;

    let disposed = false;
    void syncAlarmNotifications(alarmNotificationsReady ? state.alarms : []).catch(error => {
      if (disposed) return;
      console.error('Could not sync native wake-up alerts:', error);
      setState(prev => ({
        ...prev,
        permissions: prev.permissions.map(permission => permission.key === 'notification'
          ? { ...permission, granted: false }
          : permission),
        currentView: prev.currentView === 'ringing' ? 'ringing' : 'permissions'
      }));
    });

    return () => { disposed = true; };
  }, [alarmNotificationsReady, state.alarms, state.hasCompletedOnboarding]);

  // A scheduled native alert opens the exact alarm flow and still requires the QR scan.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    const openAlarmFromNotification = async (notification: { extra?: unknown; id: number }) => {
      try {
        await handleAlarmNotification(
          notification,
          stateRef.current.alarms,
          activateAlarm,
          id => LocalNotifications.removeDeliveredNotificationsById({ ids: [id] })
        );
      } catch (error) {
        console.warn('Could not clear the opened wake-up alert:', error);
      }
    };

    const registerListeners = async () => {
      const received = await LocalNotifications.addListener('localNotificationReceived', openAlarmFromNotification);
      const opened = await LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
        void openAlarmFromNotification(notification);
      });
      if (disposed) {
        await received.remove();
        await opened.remove();
      } else {
        handles.push(received, opened);
      }

      const delivered = await LocalNotifications.getAll({ state: 'TRIGGERED' });
      for (const notification of delivered.notifications) {
        if (getAlarmNotificationMetadata(notification)) {
          await openAlarmFromNotification(notification);
        }
      }
    };

    void registerListeners().catch(error => console.error('Could not register native alarm listeners:', error));

    return () => {
      disposed = true;
      for (const handle of handles) void handle.remove();
    };
  }, [activateAlarm]);

  useEffect(() => {
    const handleNativeBack = (event: Event) => {
      if (event.defaultPrevented) return;

      if (state.currentView === 'ringing') {
        event.preventDefault();
        return;
      }

      if (state.currentView === 'permissions') {
        event.preventDefault();
        setState(prev => ({ ...prev, currentView: 'splash' }));
      } else if (state.currentView === 'setup-qr') {
        event.preventDefault();
        setState(prev => ({ ...prev, currentView: qrReturnViewRef.current }));
      }
    };

    window.addEventListener('ging:back', handleNativeBack);
    return () => window.removeEventListener('ging:back', handleNativeBack);
  }, [state.currentView]);

  // Persistent Alarm Evaluator Tick
  // Evaluates scheduled alarms every 10 seconds to matching current device minute
  useEffect(() => {
    const checkAlarms = () => {
      // Don't ring if already ringing
      if (state.activeRingingAlarm || state.currentView === 'ringing') return;

      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const todayTimeStr = `${currentHours}:${currentMinutes}`;
      const todayDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Unique key for today's minute: "dayIndex-HH:MM"
      const currentAlarmKey = `${todayDayOfWeek}-${todayTimeStr}`;

      // Prevent same-minute re-triggering if already triggered/dismissed
      if (lastTriggeredMinuteRef.current === currentAlarmKey) return;

      // Search matching active alarm
      const triggeredAlarm = state.alarms.find(a => {
        return (
          a.active &&
          a.time === todayTimeStr &&
          a.days.includes(todayDayOfWeek)
        );
      });

      if (triggeredAlarm) activateAlarm(triggeredAlarm);
    };

    // Evaluate once on mount and check periodically
    checkAlarms();
    const interval = setInterval(checkAlarms, 12000);
    return () => clearInterval(interval);
  }, [activateAlarm, state.alarms, state.activeRingingAlarm, state.currentView]);

  // Onboarding workflow navigation triggers
  const handleCompleteSplash = () => {
    setState(prev => ({
      ...prev,
      currentView: prev.hasCompletedOnboarding ? 'dashboard' : 'permissions'
    }));
  };

  const handleUpdatePermission = useCallback((key: PermissionItem['key'], granted: boolean) => {
    setState(prev => {
      if (prev.permissions.every(p => p.key !== key || p.granted === granted)) return prev;
      return {
        ...prev,
        permissions: prev.permissions.map(p => p.key === key ? { ...p, granted } : p)
      };
    });
  }, []);

  const handleCompletePermissions = () => {
    qrReturnViewRef.current = 'permissions';
    setState(prev => ({ ...prev, currentView: prev.hasCompletedOnboarding ? 'dashboard' : 'setup-qr' }));
  };

  const handleCompleteQRSetup = () => {
    setState(prev => ({
      ...prev,
      hasCompletedOnboarding: true,
      currentView: 'dashboard'
    }));
  };

  const handleRegenerateSecret = () => {
    const newSecret = generateWakeUpSecret();
    setState(prev => ({
      ...prev,
      userQRSecret: newSecret,
      alarms: prev.alarms.map(a => ({ ...a, qrSecret: newSecret }))
    }));
  };

  // Alarm management
  const handleAddAlarm = (newAlarmData: Omit<Alarm, 'id'>) => {
    const newAlarm: Alarm = {
      ...newAlarmData,
      id: `alarm-${Date.now()}`
    };
    setState(prev => ({
      ...prev,
      alarms: [...prev.alarms, newAlarm].sort((a, b) => a.time.localeCompare(b.time))
    }));
  };

  const handleToggleAlarm = (id: string) => {
    setState(prev => ({
      ...prev,
      alarms: prev.alarms.map(a => a.id === id ? { ...a, active: !a.active } : a)
    }));
  };

  const handleDeleteAlarm = (id: string) => {
    setState(prev => ({
      ...prev,
      alarms: prev.alarms.filter(a => a.id !== id)
    }));
  };



  // Successfully waking up and scanning the QR code
  const handleAlarmDismissed = () => {
    // AlarmRinger only calls this after the matching QR code is scanned.
    setState(prev => {
      const todayStr = new Date().toLocaleDateString();
      const streakUpdated = prev.lastWakeUpTime === todayStr ? prev.streak : prev.streak + 1;
      return {
        ...prev,
        activeRingingAlarm: null,
        currentView: 'dashboard',
        streak: streakUpdated,
        lastWakeUpTime: todayStr
      };
    });
    void clearDeliveredAlarmNotifications().catch(error => {
      console.warn('Could not clear delivered wake-up alerts:', error);
    });
  };

  const handleNavigateToQR = () => {
    qrReturnViewRef.current = 'dashboard';
    setState(prev => ({ ...prev, currentView: 'setup-qr' }));
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="ging-app min-h-dvh select-none">
        <Suspense fallback={<StartupScreen />}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isStartupLoading ? 'startup' : state.currentView}
              className="min-h-dvh"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {isStartupLoading ? (
                <StartupScreen />
              ) : (
                <>
                  {state.currentView === 'splash' && (
                    <Splash onContinue={handleCompleteSplash} />
                  )}

                  {state.currentView === 'permissions' && (
                    <PermissionsSetup
                      permissions={state.permissions}
                      onUpdatePermission={handleUpdatePermission}
                      onComplete={handleCompletePermissions}
                    />
                  )}

                  {state.currentView === 'setup-qr' && (
                    <QRCodeManager
                      userQRSecret={state.userQRSecret}
                      hasAlarms={state.alarms.length > 0}
                      onRegenerateSecret={handleRegenerateSecret}
                      onComplete={handleCompleteQRSetup}
                    />
                  )}

                  {state.currentView === 'dashboard' && (
                    <Dashboard
                      alarms={state.alarms}
                      userQRSecret={state.userQRSecret}
                      onAddAlarm={handleAddAlarm}
                      onToggleAlarm={handleToggleAlarm}
                      onDeleteAlarm={handleDeleteAlarm}
                      onNavigateToQR={handleNavigateToQR}
                    />
                  )}

                  {state.currentView === 'ringing' && state.activeRingingAlarm && (
                    <AlarmRinger
                      alarm={state.activeRingingAlarm}
                      onDismiss={handleAlarmDismissed}
                    />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </div>
    </MotionConfig>
  );
}
