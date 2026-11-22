import { registerPlugin } from '@capacitor/core';
import type { AlarmSoundType } from '../constants/alarmSounds';

export interface GingAndroidPlugin {
  setAlarmActive(options: { active: boolean; alarmId?: string; soundType?: AlarmSoundType }): Promise<void>;
  syncAlarmSchedules(options: { alarms: Array<{
    id: string;
    time: string;
    days: number[];
    active: boolean;
    soundType: AlarmSoundType;
  }> }): Promise<void>;
  consumePendingAlarmTrigger(): Promise<{ alarmId?: string | null }>;
  forceMaxVolume(): Promise<void>;
  checkBatteryBypass(): Promise<{ granted: boolean }>;
  requestBatteryBypass(): Promise<{ requested: boolean }>;
  checkOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<{ requested: boolean }>;
  saveBase64File(options: {
    base64Data: string;
    filename: string;
    mimeType: string;
  }): Promise<{ success: boolean; path: string }>;
}

// Register the native bridge once so all screens share the same plugin instance.
export const GingAndroid = registerPlugin<GingAndroidPlugin>('GingAndroid');
