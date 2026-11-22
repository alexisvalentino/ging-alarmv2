import type { Alarm } from '../types';
import { isAlarmSoundType } from '../constants/alarmSounds';

export const LEGACY_DEFAULT_ALARM_ID = 'default-morning';

export function restoreAlarmSound(savedAlarm: unknown): Alarm | null {
  if (!savedAlarm || typeof savedAlarm !== 'object') return null;
  const alarm = savedAlarm as Partial<Alarm> & { id?: unknown; soundType?: unknown };
  if (typeof alarm.id !== 'string') return null;

  return {
    ...alarm,
    soundType: isAlarmSoundType(alarm.soundType) ? alarm.soundType : 'industrial'
  } as Alarm;
}

/** Drop the old seeded alarm during restore while preserving user-created alarms. */
export function restoreSavedAlarms(savedAlarms: unknown): Alarm[] {
  if (!Array.isArray(savedAlarms)) return [];

  return savedAlarms
    .map(restoreAlarmSound)
    .filter((alarm): alarm is Alarm => alarm !== null && alarm.id !== LEGACY_DEFAULT_ALARM_ID);
}
