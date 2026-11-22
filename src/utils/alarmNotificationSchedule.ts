import { Weekday, type LocalNotificationSchema } from '@capacitor/local-notifications';
import type { Alarm } from '../types';
import { ALARM_SOUND_OPTIONS } from '../constants/alarmSounds';

const NOTIFICATION_SOURCE = 'ging-alarm';

export function getAlarmNotificationMetadata(notification: { extra?: unknown; data?: unknown }) {
  const candidates = [notification.extra, notification.data];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    const nested = record.extra;
    const possibleMetadata = nested && typeof nested === 'object'
      ? nested as Record<string, unknown>
      : record;

    if (possibleMetadata.source === NOTIFICATION_SOURCE && typeof possibleMetadata.alarmId === 'string') {
      return { alarmId: possibleMetadata.alarmId };
    }
  }

  return null;
}

export async function handleAlarmNotification(
  notification: { id: number; extra?: unknown; data?: unknown },
  alarms: Alarm[],
  activate: (alarm: Alarm) => void,
  removeDelivered: (id: number) => Promise<void>
) {
  const metadata = getAlarmNotificationMetadata(notification);
  if (!metadata) return;

  const alarm = alarms.find(candidate => candidate.id === metadata.alarmId && candidate.active);
  if (alarm) activate(alarm);

  // Clear owned alerts even when their alarm was disabled or deleted after delivery.
  await removeDelivered(notification.id);
}

function notificationId(alarmId: string, day: number) {
  let hash = 0x811c9dc5;
  const value = `${alarmId}:${day}`;

  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }

  return (hash >>> 0) & 0x7fffffff || 1;
}

export function buildAlarmNotifications(alarms: Alarm[]): LocalNotificationSchema[] {
  const usedIds = new Set<number>();
  const notifications: LocalNotificationSchema[] = [];

  for (const alarm of alarms) {
    if (!alarm.active) continue;

    const timeParts = /^(\d{2}):(\d{2})$/.exec(alarm.time);
    if (!timeParts) continue;

    const hour = Number(timeParts[1]);
    const minute = Number(timeParts[2]);
    if (hour > 23 || minute > 59) continue;

    for (const day of new Set(alarm.days)) {
      if (!Number.isInteger(day) || day < 0 || day > 6) continue;

      let id = notificationId(alarm.id, day);
      while (usedIds.has(id)) id = id === 0x7fffffff ? 1 : id + 1;
      usedIds.add(id);

      notifications.push({
        id,
        title: 'Ging alarm',
        body: 'It is time to wake up. Open Ging and scan your wake-up code to stop the alarm.',
        sound: ALARM_SOUND_OPTIONS.find(option => option.key === alarm.soundType)?.notificationFile
          ?? ALARM_SOUND_OPTIONS[0].notificationFile,
        ongoing: true,
        autoCancel: false,
        foreground: false,
        isExactNotification: true,
        isExactMandatory: true,
        schedule: {
          on: {
            weekday: (day + 1) as Weekday,
            hour,
            minute
          },
          allowWhileIdle: true
        },
        extra: {
          source: NOTIFICATION_SOURCE,
          alarmId: alarm.id
        }
      });
    }
  }

  return notifications;
}

export { NOTIFICATION_SOURCE };
