import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAlarmNotifications } from '../src/utils/alarmNotificationSchedule';
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
  assert.equal(new Set(notifications.map(notification => notification.id)).size, notifications.length);
});
