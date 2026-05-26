/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Alarm {
  id: string;
  time: string; // "HH:MM"
  label: string;
  active: boolean;
  days: number[]; // 0 = Sunday, 1 = Monday, etc.
  volume: number; // 0 to 1
  soundType: 'industrial' | 'classic-beep' | 'air-horn' | 'filipino-shout';
  qrSecret: string; // The specific QR code secret this alarm requires to turn off
}

export interface PermissionItem {
  id: string;
  key: 'camera' | 'audio' | 'overlay' | 'battery' | 'lockscreen' | 'notification';
  title: string;
  description: string;
  urgency: 'CRITICAL & MANDATORY' | 'RECOMMENDED' | 'HIGH PRIOR';
  isSimulated: boolean;
  granted: boolean;
}

export interface AppState {
  currentView: 'splash' | 'permissions' | 'setup-qr' | 'dashboard' | 'ringing';
  hasCompletedOnboarding: boolean;
  activeRingingAlarm: Alarm | null;
  alarms: Alarm[];
  permissions: PermissionItem[];
  userQRSecret: string; // The primary persistent QR code value (generated randomized)
  streak: number; // Wake up streak
  lastWakeUpTime: string | null;
}
