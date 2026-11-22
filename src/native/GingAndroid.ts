import { registerPlugin } from '@capacitor/core';

export interface GingAndroidPlugin {
  setAlarmActive(options: { active: boolean }): Promise<void>;
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
