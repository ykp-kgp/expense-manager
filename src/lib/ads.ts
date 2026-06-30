import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type AdsModule = typeof import('react-native-google-mobile-ads');

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let adsModule: AdsModule | null | undefined;
let initialized = false;
let privacyOptionsRequired = false;

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

/**
 * Applies global ad request settings required by Play / AdMob policy:
 * the app is general-audience and not directed at children, so we cap ad
 * content at "G" and explicitly opt out of child-directed treatment.
 */
async function configureAdRequests(ads: AdsModule): Promise<void> {
  try {
    await ads.default().setRequestConfiguration({
      maxAdContentRating: ads.MaxAdContentRating.G,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
  } catch {
    // Non-fatal: fall back to AdMob defaults.
  }
}

/**
 * Runs the Google UMP (User Messaging Platform) consent flow. This is required
 * before requesting ads for users in the EEA / UK / Switzerland and regulated
 * US states. It is a no-op for users where consent isn't required.
 *
 * Returns whether ads may be requested given the user's consent choices.
 */
async function gatherConsent(ads: AdsModule): Promise<boolean> {
  try {
    const info = await ads.AdsConsent.gatherConsent();
    privacyOptionsRequired =
      info.privacyOptionsRequirementStatus ===
      ads.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
    return info.canRequestAds;
  } catch {
    // If the consent flow can't complete, let the SDK fall back to its own
    // (restricted, non-personalized) behavior rather than blocking the app.
    return true;
  }
}

export async function initAds(): Promise<void> {
  if (initialized) return;
  const ads = await getAds();
  if (!ads) return;
  try {
    await configureAdRequests(ads);
    // Consent must be gathered before initializing / requesting ads.
    await gatherConsent(ads);
    await ads.default().initialize();
    initialized = true;
  } catch {
    // ignore — ads simply won't be available
  }
}

/** Whether the privacy options ("manage ad consent") entry should be shown. */
export function adsPrivacyOptionsRequired(): boolean {
  return privacyOptionsRequired;
}

/**
 * Re-presents the consent / privacy options form so users (e.g. in the EEA) can
 * change their ad-personalization choices at any time. Returns false when ads
 * aren't supported or the form can't be shown.
 */
export async function presentAdsPrivacyOptions(): Promise<boolean> {
  const ads = await getAds();
  if (!ads) return false;
  try {
    await ads.AdsConsent.showPrivacyOptionsForm();
    return true;
  } catch {
    return false;
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
