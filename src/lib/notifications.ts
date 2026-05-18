import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const REMINDER_ID_KEY = 'em.reminder.daily';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null | undefined;

async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo) return null;
  if (notificationsModule !== undefined) return notificationsModule;
  try {
    const mod = await import('expo-notifications');
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationsModule = mod;
    return mod;
  } catch {
    notificationsModule = null;
    return null;
  }
}

export function notificationsSupported(): boolean {
  return !isExpoGo;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function ensureAndroidChannel() {
  const Notifications = await getNotifications();
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Daily Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('recurring', {
    name: 'Recurring Expense Logs',
    importance: Notifications.AndroidImportance.LOW,
  });
}

export async function scheduleDailyReminder(hour: number, minute: number) {
  const Notifications = await getNotifications();
  if (!Notifications) return null;
  await cancelDailyReminder();
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  await ensureAndroidChannel();
  const id = await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID_KEY,
    content: {
      title: "Log today's expenses",
      body: 'Take a moment to record what you spent today.',
      data: { kind: 'reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: 'reminders',
    },
  });
  return id;
}

export async function cancelDailyReminder() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID_KEY);
  } catch {
    // ignore
  }
}

export async function notifyRecurringMaterialized(count: number) {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Recurring expenses logged',
      body: `${count} recurring expense${count === 1 ? '' : 's'} were auto-added.`,
      data: { kind: 'recurring' },
    },
    trigger: null,
  });
}
