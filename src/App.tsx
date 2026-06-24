/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Alarm, PermissionItem, AppState } from './types';
import Splash from './components/Splash';
import PermissionsSetup from './components/PermissionsSetup';
import QRCodeManager from './components/QRCodeManager';
import Dashboard from './components/Dashboard';
import AlarmRinger from './components/AlarmRinger';

// Helper to generate a random high-entropy human-readable wake up secret
const generateRandomSecret = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid easily mistaken chars like I, O, 1, 0
  let code = 'GING_';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const initialPermissions: PermissionItem[] = [
  {
    id: 'p1',
    key: 'camera',
    title: 'Camera Device Ingress',
    description: 'Bridges to local browser stream handles. Decodes QR matrix pixel blocks in under 15 milliseconds.',
    urgency: 'CRITICAL & MANDATORY',
    isSimulated: false,
    granted: false
  },
  {
    id: 'p2',
    key: 'audio',
    title: 'Web Audio Autoplay Engine',
    description: 'Initializes AudioContext audio bands. Forces the speaker buffer to sound on high persistent gains.',
    urgency: 'CRITICAL & MANDATORY',
    isSimulated: false,
    granted: false
  },
  {
    id: 'p3',
    key: 'overlay',
    title: 'Display Over Other Windows',
    description: 'Pops alarm screen explicitly over other browser drawers to disable swipe-away or sleep actions.',
    urgency: 'HIGH PRIOR',
    isSimulated: false,
    granted: false
  },
  {
    id: 'p4',
    key: 'battery',
    title: 'Ignore Battery Optimizations',
    description: 'Bypasses standard Doze parameters. Retains CPU wake schedules so alarms trigger precisely.',
    urgency: 'CRITICAL & MANDATORY',
    isSimulated: false,
    granted: false
  },
  {
    id: 'p5',
    key: 'lockscreen',
    title: 'Wake Up Lock Screen System',
    description: 'Bypasses black backlight standby grids to force illuminate screen matrices in high danger flashes.',
    urgency: 'RECOMMENDED',
    isSimulated: false,
    granted: false
  },
  {
    id: 'p6',
    key: 'notification',
    title: 'Permanent Foreground Service',
    description: 'Anchors a resident tracking loop. Prevents Android Low Memory Daemons from purging sleep alarms.',
    urgency: 'CRITICAL & MANDATORY',
    isSimulated: false,
    granted: false
  }
];

export default function App() {
  const lastTriggeredMinuteRef = useRef<string>('');
  const [state, setState] = useState<AppState>(() => {
    // Attempt local storage cache retrieval
    const cached = localStorage.getItem('GING_WAKEUPS_APPSTORE_STATE');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Ensure properties exist
        const hasOnboarded = parsed.hasCompletedOnboarding || false;
        const rawPermissions = parsed.permissions || initialPermissions;

        // Force reset to false if onboarding is not completed to ensure they are prompted
        const freshPermissions = hasOnboarded
          ? rawPermissions
          : initialPermissions.map(p => ({ ...p, granted: false }));

        return {
          currentView: hasOnboarded ? 'dashboard' : 'splash',
          hasCompletedOnboarding: hasOnboarded,
          activeRingingAlarm: null,
          alarms: parsed.alarms || [],
          permissions: freshPermissions,
          userQRSecret: parsed.userQRSecret || generateRandomSecret(),
          streak: parsed.streak || 0,
          lastWakeUpTime: parsed.lastWakeUpTime || null
        };
      } catch (e) {
        console.error('Failed parsing state cache', e);
      }
    }

    // Default pristine state
    const defaultSecret = generateRandomSecret();
    const defaultAlarms: Alarm[] = [
      {
        id: 'default-morning',
        time: '06:00',
        label: 'Bathroom Mirror Session',
        active: true,
        days: [1, 2, 3, 4, 5], // Monday through Friday
        volume: 0.9,
        soundType: 'industrial',
        qrSecret: defaultSecret
      }
    ];

    return {
      currentView: 'splash',
      hasCompletedOnboarding: false,
      activeRingingAlarm: null,
      alarms: defaultAlarms,
      permissions: initialPermissions,
      userQRSecret: defaultSecret,
      streak: 5, // give them a nice initial momentum streak to cherish!
      lastWakeUpTime: null
    };
  });

  // Keep state synchronized with local storage for persistence
  useEffect(() => {
    localStorage.setItem('GING_WAKEUPS_APPSTORE_STATE', JSON.stringify({
      hasCompletedOnboarding: state.hasCompletedOnboarding,
      alarms: state.alarms,
      permissions: state.permissions,
      userQRSecret: state.userQRSecret,
      streak: state.streak,
      lastWakeUpTime: state.lastWakeUpTime
    }));
  }, [state]);

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

      if (triggeredAlarm) {
        lastTriggeredMinuteRef.current = currentAlarmKey;
        console.log('SCHEDULED WAKE TRIGGERED:', triggeredAlarm);
        setState(prev => ({
          ...prev,
          activeRingingAlarm: triggeredAlarm,
          currentView: 'ringing'
        }));
      }
    };

    // Evaluate once on mount and check periodically
    checkAlarms();
    const interval = setInterval(checkAlarms, 12000);
    return () => clearInterval(interval);
  }, [state.alarms, state.activeRingingAlarm, state.currentView]);

  // Onboarding workflow navigation triggers
  const handleCompleteSplash = () => {
    setState(prev => ({
      ...prev,
      currentView: prev.hasCompletedOnboarding ? 'dashboard' : 'permissions'
    }));
  };

  const handleUpdatePermission = (key: PermissionItem['key'], granted: boolean) => {
    setState(prev => ({
      ...prev,
      permissions: prev.permissions.map(p => p.key === key ? { ...p, granted } : p)
    }));
  };

  const handleCompletePermissions = () => {
    setState(prev => ({ ...prev, currentView: 'setup-qr' }));
  };

  const handleCompleteQRSetup = () => {
    setState(prev => ({
      ...prev,
      hasCompletedOnboarding: true,
      currentView: 'dashboard'
    }));
  };

  const handleRegenerateSecret = () => {
    const newSecret = generateRandomSecret();
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
  const handleAlarmDismissed = (success: boolean) => {
    if (success) {
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
    } else {
      // Just in case of failure or bypass, return
      setState(prev => ({
        ...prev,
        activeRingingAlarm: null,
        currentView: 'dashboard'
      }));
    }
  };

  const handleNavigateToQR = () => {
    setState(prev => ({ ...prev, currentView: 'setup-qr' }));
  };

  return (
    <div className="min-h-screen bg-black select-none">
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
    </div>
  );
}
