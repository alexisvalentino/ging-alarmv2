export const ALARM_SOUND_OPTIONS = [
  { key: 'industrial', label: 'Industrial', notificationFile: 'ging-industrial.wav' },
  { key: 'classic-beep', label: 'Beep', notificationFile: 'ging-classic-beep.wav' },
  { key: 'air-horn', label: 'Air Horn', notificationFile: 'ging-air-horn.wav' }
] as const;

export type AlarmSoundType = (typeof ALARM_SOUND_OPTIONS)[number]['key'];
export const ALARM_SOUND_TYPES: readonly AlarmSoundType[] = ALARM_SOUND_OPTIONS.map(({ key }) => key);

export function isAlarmSoundType(value: unknown): value is AlarmSoundType {
  return typeof value === 'string' && ALARM_SOUND_TYPES.some(soundType => soundType === value);
}
