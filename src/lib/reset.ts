import * as FileSystem from 'expo-file-system/legacy';
import { getRawDb } from '@/db';
import { PREDEFINED_CATEGORIES, PREDEFINED_PAYMENT_METHODS } from '@/db/seeds';
import { clearPin } from './auth';
import { disconnectDrive } from './drive';
import { cancelDailyReminder } from './notifications';

const RECEIPTS_DIR = FileSystem.documentDirectory + 'receipts/';

/**
 * Permanently erases all user data: expenses, budgets, recurring rules,
 * app settings, receipt images, the PIN, biometric flag, and any Drive
 * connection. Default categories and payment methods are re-seeded so the
 * app is usable again after the user sets up a new PIN.
 *
 * After this resolves the caller should refresh auth/db state, which sends
 * the user back to onboarding.
 */
export async function wipeAllData(): Promise<void> {
  const sqlite = getRawDb();

  await sqlite.withTransactionAsync(async () => {
    await sqlite.runAsync('DELETE FROM expenses');
    await sqlite.runAsync('DELETE FROM budgets');
    await sqlite.runAsync('DELETE FROM recurring_rules');
    await sqlite.runAsync('DELETE FROM settings');
    await sqlite.runAsync('DELETE FROM categories');
    await sqlite.runAsync('DELETE FROM payment_methods');

    for (let i = 0; i < PREDEFINED_CATEGORIES.length; i++) {
      const c = PREDEFINED_CATEGORIES[i];
      await sqlite.runAsync(
        'INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)',
        [c.name, c.icon, c.color, i]
      );
    }
    for (let i = 0; i < PREDEFINED_PAYMENT_METHODS.length; i++) {
      const p = PREDEFINED_PAYMENT_METHODS[i];
      await sqlite.runAsync(
        'INSERT INTO payment_methods (name, icon, sort_order) VALUES (?, ?, ?)',
        [p.name, p.icon, i]
      );
    }
  });

  try {
    const info = await FileSystem.getInfoAsync(RECEIPTS_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(RECEIPTS_DIR, { idempotent: true });
    }
  } catch {
    // ignore — receipts are best-effort cleanup
  }

  await cancelDailyReminder().catch(() => undefined);
  try {
    await disconnectDrive();
  } catch {
    // ignore — Drive may not be connected
  }
  await clearPin();
}
