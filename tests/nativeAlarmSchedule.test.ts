import assert from 'node:assert/strict';
import test from 'node:test';
import type { Alarm } from '../src/types';
import { buildNativeAlarmSchedules } from '../src/utils/nativeAlarmSchedule';

const alarms: Alarm[] = [
  {
    id: 'weekday-morning',
    time: '06:30',
    label: 'Morning alarm',
    active: true,
    days: [1, 2, 3, 4, 5],
    volume: 1,
    soundType: 'industrial',
    qrSecret: 'GING_TEST'
  },
  {
    id: 'disabled-weekend',
    time: '09:00',
    label: 'Weekend alarm',
    active: false,
    days: [0, 6],
    volume: 1,
    soundType: 'classic-beep',
    qrSecret: 'GING_TEST'
  }
];

test('passes only active alarms and their selected sounds to Android AlarmManager', () => {
  const schedules = buildNativeAlarmSchedules(alarms);

  assert.deepEqual(schedules, [{
    id: 'weekday-morning',
    time: '06:30',
    days: [1, 2, 3, 4, 5],
    active: true,
    soundType: 'industrial'
  }]);
  assert.notEqual(schedules[0].days, alarms[0].days);
});

test('preserves each of the three selected sounds in native schedules', () => {
  const selectedSounds: Alarm['soundType'][] = ['industrial', 'classic-beep', 'air-horn'];
  const schedules = buildNativeAlarmSchedules(selectedSounds.map((soundType, index) => ({
    ...alarms[0],
    id: `sound-${index}`,
    soundType
  })));

  assert.deepEqual(schedules.map(schedule => schedule.soundType), selectedSounds);
});
