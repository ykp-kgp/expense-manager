import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type AdsModule = typeof import('react-native-google-mobile-ads');

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let adsModule: AdsModule | null | undefined;
let initialized = false;

/** Whether rewarded ads can run in this runtime (native build, not Expo Go/web). */
export function adsSupported(): boolean {
  return !isExpoGo && Platform.OS !== 'web';
}

async function getAds(): Promise<AdsModule | null> {
  if (!adsSupported()) return null;
  if (adsModule !== undefined) return adsModule;
  try {
    adsModule = await import('react-native-google-mobile-ads');
  } catch {
    adsModule = null;
  }
  return adsModule;
}

export async function initAds(): Promise<void> {
  if (initialized) return;
  const ads = await getAds();
  if (!ads) return;
  try {
    await ads.default().initialize();
    initialized = true;
  } catch {
    // ignore — ads simply won't be available
  }
}

function resolveRewardedUnitId(ads: AdsModule): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, any>;
  const adsExtra = (extra.ads ?? {}) as Record<string, string | null>;
  const configured =
    Platform.OS === 'ios' ? adsExtra.rewardedAdUnitIdIos : adsExtra.rewardedAdUnitIdAndroid;
  if (!__DEV__ && configured) return configured;
  return ads.TestIds.REWARDED;
}

/**
 * Outcome of attempting to show a rewarded ad:
 * - `earned`: user watched it through and earned the reward.
 * - `dismissed`: ad showed but the user closed it before earning.
 * - `unavailable`: ads aren't supported, or the ad failed to load/show.
 */
export type RewardedAdResult = 'earned' | 'dismissed' | 'unavailable';

/**
 * Loads and shows a single rewarded ad and reports the outcome.
 *
 * Callers should treat `unavailable` as an infrastructure failure (and may
 * choose to fail open) versus `dismissed`, which is a deliberate user choice.
 */
export async function showRewardedAd(): Promise<RewardedAdResult> {
  const ads = await getAds();
  if (!ads) return 'unavailable';
  await initAds();

  const { RewardedAd, RewardedAdEventType, AdEventType } = ads;
  const adUnitId = resolveRewardedUnitId(ads);

  return new Promise<RewardedAdResult>((resolve) => {
    let earned = false;
    let shown = false;
    let settled = false;
    const unsubscribers: Array<() => void> = [];

    const cleanup = () => {
      for (const u of unsubscribers) {
        try {
          u();
        } catch {
          // ignore
        }
      }
    };

    const settle = (value: RewardedAdResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      cleanup();
      resolve(value);
    };

    const rewarded = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    // Safety net in case no terminal event fires.
    const timeout = setTimeout(
      () => settle(earned ? 'earned' : shown ? 'dismissed' : 'unavailable'),
      60_000
    );

    unsubscribers.push(
      rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        try {
          shown = true;
          rewarded.show();
        } catch {
          settle('unavailable');
        }
      })
    );
    unsubscribers.push(
      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      })
    );
    unsubscribers.push(
      rewarded.addAdEventListener(AdEventType.CLOSED, () =>
        settle(earned ? 'earned' : 'dismissed')
      )
    );
    unsubscribers.push(
      rewarded.addAdEventListener(AdEventType.ERROR, () =>
        // An error before the ad was shown means it never loaded.
        settle(shown ? 'dismissed' : 'unavailable')
      )
    );

    try {
      rewarded.load();
    } catch {
      settle('unavailable');
    }
  });
}
