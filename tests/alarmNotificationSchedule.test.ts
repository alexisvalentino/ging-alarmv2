import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildAlarmNotifications, handleAlarmNotification, NOTIFICATION_SOURCE } from '../src/utils/alarmNotificationSchedule';
import { ALARM_SOUND_OPTIONS } from '../src/constants/alarmSounds';
import type { Alarm } from '../src/types';

const activeAlarm: Alarm = {
  id: 'weekday-morning',
  time: '06:30',
  label: 'Morning alarm',
  active: true,
  days: [1, 3, 5],
  volume: 1,
  soundType: 'industrial',
  qrSecret: 'GING_TEST'
};

test('builds precise native notifications only for active alarm days', () => {
  const notifications = buildAlarmNotifications([
    activeAlarm,
    { ...activeAlarm, id: 'disabled', active: false, days: [0, 1, 2, 3, 4, 5, 6] }
  ]);

  assert.equal(notifications.length, 3);
  assert.deepEqual(notifications.map(notification => notification.schedule?.on?.weekday), [2, 4, 6]);
  assert.deepEqual(notifications.map(notification => [notification.schedule?.on?.hour, notification.schedule?.on?.minute]), [
    [6, 30], [6, 30], [6, 30]
  ]);
  assert.ok(notifications.every(notification => notification.isExactNotification));
  assert.ok(notifications.every(notification => notification.isExactMandatory));
  assert.ok(notifications.every(notification => notification.ongoing));
  assert.ok(notifications.every(notification => notification.autoCancel === false));
  assert.ok(notifications.every(notification => notification.extra?.alarmId === activeAlarm.id));
  assert.ok(notifications.every(notification => notification.sound === 'ging-industrial.wav'));
  assert.equal(new Set(notifications.map(notification => notification.id)).size, notifications.length);
});

test('uses the selected notification sound for each of the three alarm options', () => {
  const notifications = buildAlarmNotifications(([
    ['industrial', 'ging-industrial.wav'],
    ['classic-beep', 'ging-classic-beep.wav'],
    ['air-horn', 'ging-air-horn.wav']
  ] as const).map(([soundType]) => ({ ...activeAlarm, days: [1], soundType })));

  assert.deepEqual(notifications.map(notification => notification.sound), [
    'ging-industrial.wav',
    'ging-classic-beep.wav',
    'ging-air-horn.wav'
  ]);
});

test('bundles a valid notification audio clip for each selectable alarm sound', () => {
  for (const option of ALARM_SOUND_OPTIONS) {
    const clip = readFileSync(new URL(`../public/${option.notificationFile}`, import.meta.url));
    assert.equal(clip.toString('ascii', 0, 4), 'RIFF');
    assert.equal(clip.toString('ascii', 8, 12), 'WAVE');
  }
});

test('removes an old delivered notification even after its alarm is disabled', async () => {
  const removedIds: number[] = [];
  const activatedAlarms: Alarm[] = [];

  await handleAlarmNotification(
    { id: 77, extra: { source: NOTIFICATION_SOURCE, alarmId: activeAlarm.id } },
    [{ ...activeAlarm, active: false }],
    alarm => activatedAlarms.push(alarm),
    async id => { removedIds.push(id); }
  );

  assert.deepEqual(removedIds, [77]);
  assert.deepEqual(activatedAlarms, []);
});

test('opens a ringing flow for an active alarm and removes its alert', async () => {
  const removedIds: number[] = [];
  const activatedAlarms: Alarm[] = [];

  await handleAlarmNotification(
    { id: 78, extra: { source: NOTIFICATION_SOURCE, alarmId: activeAlarm.id } },
    [activeAlarm],
    alarm => activatedAlarms.push(alarm),
    async id => { removedIds.push(id); }
  );

  assert.deepEqual(removedIds, [78]);
  assert.deepEqual(activatedAlarms, [activeAlarm]);
});

test('reads Android delivered-notification metadata from data', async () => {
  const removedIds: number[] = [];
  const activatedAlarms: Alarm[] = [];

  await handleAlarmNotification(
    { id: 80, data: { source: NOTIFICATION_SOURCE, alarmId: activeAlarm.id } },
    [activeAlarm],
    alarm => activatedAlarms.push(alarm),
    async id => { removedIds.push(id); }
  );

  assert.deepEqual(removedIds, [80]);
  assert.deepEqual(activatedAlarms, [activeAlarm]);
});

test('leaves notifications owned by other features untouched', async () => {
  const removedIds: number[] = [];
  const activatedAlarms: Alarm[] = [];

  await handleAlarmNotification(
    { id: 79, extra: { source: 'other-feature', alarmId: activeAlarm.id } },
    [activeAlarm],
    alarm => activatedAlarms.push(alarm),
    async id => { removedIds.push(id); }
  );

  assert.deepEqual(removedIds, []);
  assert.deepEqual(activatedAlarms, []);
});
