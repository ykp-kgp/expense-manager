import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_ID_KEY = 'em.reminder.daily';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
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
  await cancelDailyReminder();
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  await ensureAndroidChannel();
  const id = await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID_KEY,
    content: {
      title: 'Log today\'s expenses',
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
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID_KEY);
  } catch {
    // ignore
  }
}

export async function notifyRecurringMaterialized(count: number) {
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
