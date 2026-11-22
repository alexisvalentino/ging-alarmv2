/// <reference types="@capacitor/local-notifications" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ging.alarm',
  appName: 'Ging',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_ging',
      iconColor: '#A43E00',
      presentationOptions: ['badge', 'sound', 'banner', 'list']
    }
  }
};

export default config;
