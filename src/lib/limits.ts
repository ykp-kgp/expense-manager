import Constants from 'expo-constants';
import { getSetting, setSettingsBatch } from '@/db';
import { todayISO } from './format';

const KEY_DATE = 'em.limit.date';
const KEY_USED = 'em.limit.used';
const KEY_BONUS = 'em.limit.bonus';

function extraLimits(): { dailyFreeTransactions: number; rewardPerAd: number } {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const limits = (extra.limits ?? {}) as Record<string, unknown>;
  const daily = Number(limits.dailyFreeTransactions);
  const reward = Number(limits.rewardPerAd);
  return {
    dailyFreeTransactions: Number.isFinite(daily) && daily > 0 ? daily : 5,
    rewardPerAd: Number.isFinite(reward) && reward > 0 ? reward : 5,
  };
}

export function getDailyFreeLimit(): number {
  return extraLimits().dailyFreeTransactions;
}

export function getRewardPerAd(): number {
  return extraLimits().rewardPerAd;
}

export type TransactionUsage = {
  used: number;
  bonus: number;
  /** Total entries allowed today (free limit + ad-earned bonus). */
  allowed: number;
  /** Entries the user can still add for free right now. */
  remaining: number;
  canAdd: boolean;
};

/**
 * Reads today's usage, resetting the counters when the stored date is not
 * today. Returns the (possibly reset) raw counters.
 */
async function readTodayCounters(): Promise<{ used: number; bonus: number; reset: boolean }> {
  const today = todayISO();
  const storedDate = await getSetting(KEY_DATE);
  if (storedDate !== today) {
    await setSettingsBatch({ [KEY_DATE]: today, [KEY_USED]: '0', [KEY_BONUS]: '0' });
    return { used: 0, bonus: 0, reset: true };
  }
  const used = parseInt((await getSetting(KEY_USED)) ?? '0', 10) || 0;
  const bonus = parseInt((await getSetting(KEY_BONUS)) ?? '0', 10) || 0;
  return { used, bonus, reset: false };
}

export async function getTransactionUsage(): Promise<TransactionUsage> {
  const { used, bonus } = await readTodayCounters();
  const allowed = getDailyFreeLimit() + bonus;
  const remaining = Math.max(allowed - used, 0);
  return { used, bonus, allowed, remaining, canAdd: used < allowed };
}

/** True when the user still has free/earned entries left today. */
export async function canAddTransaction(): Promise<boolean> {
  return (await getTransactionUsage()).canAdd;
}

/** Records one manual transaction against today's allowance. */
export async function recordTransactionAdded(): Promise<void> {
  const { used } = await readTodayCounters();
  await setSettingsBatch({ [KEY_DATE]: todayISO(), [KEY_USED]: String(used + 1) });
}

/** Grants the per-ad bonus after a rewarded ad is completed. */
export async function grantAdReward(): Promise<TransactionUsage> {
  const { bonus } = await readTodayCounters();
  await setSettingsBatch({
    [KEY_DATE]: todayISO(),
    [KEY_BONUS]: String(bonus + getRewardPerAd()),
  });
  return getTransactionUsage();
}
