import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Alarm } from '../types';
import { buildAlarmNotifications, NOTIFICATION_SOURCE } from './alarmNotificationSchedule';

export interface AlarmNotificationReadiness {
  available: boolean;
  displayGranted: boolean;
  exactAlarmGranted: boolean;
  ready: boolean;
}

export async function checkAlarmNotificationReadiness(): Promise<AlarmNotificationReadiness> {
  if (!Capacitor.isNativePlatform()) {
    return { available: false, displayGranted: false, exactAlarmGranted: false, ready: false };
  }

  const { display } = await LocalNotifications.checkPermissions();
  const displayGranted = display === 'granted';
  const exactAlarmGranted = Capacitor.getPlatform() !== 'android'
    || (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';

  return {
    available: true,
    displayGranted,
    exactAlarmGranted,
    ready: displayGranted && exactAlarmGranted
  };
}

export async function requestAlarmNotificationReadiness(): Promise<AlarmNotificationReadiness> {
  if (!Capacitor.isNativePlatform()) {
    return { available: false, displayGranted: false, exactAlarmGranted: false, ready: false };
  }

  let { display } = await LocalNotifications.checkPermissions();
  if (display !== 'granted') {
    ({ display } = await LocalNotifications.requestPermissions());
  }

  if (display !== 'granted') {
    return {
      available: true,
      displayGranted: false,
      exactAlarmGranted: Capacitor.getPlatform() !== 'android',
      ready: false
    };
  }

  if (Capacitor.getPlatform() === 'android') {
    const exactAlarm = await LocalNotifications.checkExactNotificationSetting();
    if (exactAlarm.exact_alarm !== 'granted') {
      await LocalNotifications.changeExactNotificationSetting();
    }
  }

  return checkAlarmNotificationReadiness();
}

async function syncAlarmNotificationsNow(alarms: Alarm[]) {
  if (!Capacitor.isNativePlatform()) return;

  const pending = await LocalNotifications.getPending();
  const ownedNotifications = pending.notifications
    .filter(notification => notification.extra?.source === NOTIFICATION_SOURCE)
    .map(({ id }) => ({ id }));

  if (ownedNotifications.length > 0) {
    await LocalNotifications.cancel({ notifications: ownedNotifications });
  }

  const notifications = buildAlarmNotifications(alarms);
  if (notifications.length === 0) return;

  const readiness = await checkAlarmNotificationReadiness();
  if (!readiness.ready) {
    throw new Error('Ging alarm notifications are not enabled for this device.');
  }

  const result = await LocalNotifications.schedule({ notifications });
  if (result.warning) {
    throw new Error(result.warning.message || 'The device could not schedule an exact wake-up alert.');
  }
}

let syncQueue: Promise<void> = Promise.resolve();

export function syncAlarmNotifications(alarms: Alarm[]) {
  const snapshot = alarms.map(alarm => ({ ...alarm, days: [...alarm.days] }));
  syncQueue = syncQueue.catch(() => undefined).then(() => syncAlarmNotificationsNow(snapshot));
  return syncQueue;
}

export async function clearDeliveredAlarmNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  const { notifications } = await LocalNotifications.getDeliveredNotifications();
  const ownedNotificationIds = notifications
    .filter(notification => notification.extra?.source === NOTIFICATION_SOURCE)
    .map(({ id }) => id);

  if (ownedNotificationIds.length > 0) {
    await LocalNotifications.removeDeliveredNotificationsById({ ids: ownedNotificationIds });
  }
}
