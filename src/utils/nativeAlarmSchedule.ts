import type { Alarm } from '../types';

export interface NativeAlarmSchedule {
  id: string;
  time: string;
  days: number[];
  active: true;
  soundType: Alarm['soundType'];
}

/** The Android AlarmManager bridge only needs active alarms and their ring sound. */
export function buildNativeAlarmSchedules(alarms: Alarm[]): NativeAlarmSchedule[] {
  return alarms
    .filter(alarm => alarm.active)
    .map(({ id, time, days, soundType }) => ({
      id,
      time,
      days: [...days],
      active: true,
      soundType
    }));
}
