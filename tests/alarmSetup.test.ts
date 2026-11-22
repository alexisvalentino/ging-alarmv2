import assert from 'node:assert/strict';
import test from 'node:test';
import type { Alarm } from '../src/types';
import { ALARM_SOUND_TYPES } from '../src/types';
import { restoreAlarmSound, restoreSavedAlarms } from '../src/utils/restoreSavedAlarms';

const makeAlarm = (id: string, overrides: Partial<Alarm> = {}): Alarm => ({
  id,
  time: '06:00',
  label: 'Morning alarm',
  active: true,
  days: [1, 2, 3, 4, 5],
  volume: 1,
  soundType: 'industrial',
  qrSecret: 'GING_TEST',
  ...overrides
});

test('fresh installs restore an empty alarm list', () => {
  assert.deepEqual(restoreSavedAlarms(undefined), []);
  assert.deepEqual(restoreSavedAlarms(null), []);
});

test('migration removes only the old seeded 6 AM alarm and preserves user alarms', () => {
  const userAlarm = makeAlarm('alarm-user-1');
  const restored = restoreSavedAlarms([
    makeAlarm('default-morning'),
    userAlarm
  ]);

  assert.deepEqual(restored, [userAlarm]);
});

test('the supported alarm sounds remain exactly the three selectable options', () => {
  assert.deepEqual(ALARM_SOUND_TYPES, ['industrial', 'classic-beep', 'air-horn']);
});

test('invalid stored sound keys restore as the industrial sound', () => {
  const [restored] = restoreSavedAlarms([
    makeAlarm('alarm-user-2', { soundType: 'unlisted-sound' as Alarm['soundType'] })
  ]);

  assert.equal(restored.soundType, 'industrial');
});

test('a restored in-progress alarm keeps a supported sound and repairs an invalid one', () => {
  assert.equal(restoreAlarmSound(makeAlarm('active-alarm', { soundType: 'air-horn' }))?.soundType, 'air-horn');
  assert.equal(restoreAlarmSound({ ...makeAlarm('active-alarm'), soundType: 'unknown' })?.soundType, 'industrial');
});
