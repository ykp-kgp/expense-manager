# Pockit

A privacy-first, offline-only Android expense tracker built with React Native + Expo.

## Features

- Add / edit / delete expenses (amount, category, payment method, date, note, receipt photo)
- 11 predefined categories and 6 payment methods
- Monthly budgets (overall + per category) with progress bars
- Recurring expenses (daily / weekly / monthly / yearly), auto-logged on app open
- Dashboard with month-over-month delta
- Transactions list with filters (date range, category, payment method) and search
- Reports with pie chart by category and bar chart of last 6 months
- Daily reminder notifications
- Local PIN + biometric unlock with auto-lock
- Material 3 with dynamic color (Android 12+) and light/dark/system themes
- CSV / JSON export
- Optional end-to-end encrypted backup to your own Google Drive (`drive.appdata` scope)

## Privacy

All data lives in app-private SQLite storage on your device. Nothing is collected
or transmitted to a developer server. The optional Google Drive backup is
encrypted with a key derived from your PIN before it leaves the device, and is
stored in a hidden folder of your own Drive.

## Stack

- **Framework:** Expo SDK 54 (React Native 0.81)
- **Language:** TypeScript
- **Routing:** expo-router (file-based)
- **UI:** react-native-paper (Material 3) + @pchmn/expo-material3-theme
- **DB:** expo-sqlite + drizzle-orm
- **Charts:** react-native-gifted-charts
- **Crypto:** expo-crypto + crypto-js (PBKDF2-SHA256, AES)
- **Auth:** expo-secure-store + expo-local-authentication

## Project layout

```
app/                       # expo-router routes
  _layout.tsx              # providers + auth gate
  (auth)/onboarding.tsx
  (auth)/lock.tsx
  (tabs)/index.tsx         # Dashboard
  (tabs)/transactions.tsx
  (tabs)/reports.tsx
  (tabs)/settings.tsx
  modal/add-expense.tsx
  settings/budgets.tsx
  settings/recurring.tsx
  settings/recurring-edit.tsx
  settings/categories.tsx
  settings/backup.tsx
  settings/about.tsx
src/
  db/                      # schema, migrations, seeds
  lib/                     # auth, crypto, queries, recurring, drive, export, notifications
  components/              # shared UI (PinKeypad, ExpenseRow, etc.)
  theme/                   # MD3 theme provider
```

## Getting started

```bash
npm install
npm run start            # opens Expo dev tools
npm run android          # build and run on a connected Android device or emulator
```

A development build (Expo Dev Client) is recommended because the app uses
several native modules (`expo-sqlite`, `expo-secure-store`, `expo-notifications`,
`expo-local-authentication`, etc.). Run:

```bash
npx eas build --profile development --platform android
```

## Setting up Google AdMob (ads)

The app shows a **rewarded ad** that lets users earn extra daily transactions
once they hit the free limit. Out of the box it uses Google's official **test**
IDs, so ads work in development without an AdMob account. To serve real ads you
need to create your own credentials and plug them in.

### 1. Create an AdMob account and app

1. Go to the [Google AdMob console](https://apps.admob.com/) and sign in.
2. **Apps -> Add app.** Choose the platform (Android), and select whether the
   app is already on the Play Store or not.
3. After it's created, open the app and copy its **App ID**. It looks like:
   ```
   ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
   ```
   (Note the `~` separator — this is the *App* ID, not an ad unit ID.)

### 2. Create a Rewarded ad unit

1. In your app, go to **Ad units -> Add ad unit**.
2. Choose **Rewarded** as the format.
3. Give it a name (e.g. "Extra transactions") and set the reward (the value here
   is informational; the app grants `rewardPerAd` transactions regardless).
4. Copy the **Ad unit ID**. It looks like:
   ```
   ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ
   ```
   (Note the `/` separator — this is the *ad unit* ID.)

### 3. Plug the credentials into the app

Both values go into `app.json`:

1. **App ID** -> the `react-native-google-mobile-ads` plugin config:
   ```json
   [
     "react-native-google-mobile-ads",
     {
       "androidAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY",
       "iosAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"
     }
   ]
   ```
2. **Rewarded ad unit ID** -> `expo.extra.ads`:
   ```json
   "extra": {
     "ads": {
       "rewardedAdUnitIdAndroid": "ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ",
       "rewardedAdUnitIdIos": "ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ"
     }
   }
   ```

You usually only need the Android values for this app. Leave the iOS fields as
`null` (or set them) if you aren't shipping to iOS.

### 4. (Optional) Tune the free limit and reward

In `app.json` under `expo.extra.limits`:

```json
"limits": {
  "dailyFreeTransactions": 5,
  "rewardPerAd": 5
}
```

- `dailyFreeTransactions` — how many expenses a user can add per day before an ad
  is required.
- `rewardPerAd` — how many extra transactions one watched ad grants.

### How it wires together (no code changes needed)

You don't need to edit any source to switch from test to live IDs — the logic in
`src/lib/ads.ts` reads the values from `app.json` at runtime:

- `resolveRewardedUnitId()` reads `expo.extra.ads.rewardedAdUnitId*` and uses it
  **only in production builds** (`!__DEV__`). In development it always uses
  `TestIds.REWARDED` so you never risk your account.
- If the configured ad unit ID is `null`, it also falls back to the test ad unit.
- The App ID from the plugin config is baked into the native build during
  `prebuild` / EAS build, so changing it **requires a rebuild** (a JS reload is
  not enough).

```44:46:src/lib/ads.ts
  if (!__DEV__ && configured) return configured;
  return ads.TestIds.REWARDED;
```

### 5. Rebuild

Because the App ID is native config, create a fresh build after changing it:

```bash
eas build --profile production --platform android
```

> **Important:** Never ship the test IDs in a production build, and never click
> your own live ads — both can get your AdMob account suspended. If you target
> the EEA / UK, add a consent (UMP) flow before requesting ads.

## Before shipping to Play Store

A few things must be handled before a public release, mainly because of the
ads integration and native modules:

1. **Rebuild native code.** Both `react-native-google-mobile-ads` and
   `expo-document-picker` are native modules, so a JS-only reload will not pick
   them up. Create a fresh development/EAS build and install it on the device.
2. **Replace the AdMob test IDs with your real ones.** The repo ships with
   Google's official **test** IDs so you never risk account suspension during
   development. Before publishing:
   - Set your real AdMob **App ID** in `app.json` under the
     `react-native-google-mobile-ads` plugin (`androidAppId` / `iosAppId`).
   - Set your real **rewarded ad unit ID** in `app.json` under
     `expo.extra.ads.rewardedAdUnitIdAndroid` (and `...Ios`). When left `null`,
     the app falls back to the test ad unit.
   - You can also tune the limit in `expo.extra.limits`
     (`dailyFreeTransactions`, `rewardPerAd`).
   - Never ship the test IDs, and never click your own live ads.
3. **Set the support email and privacy policy URL.** Add both under
   `expo.extra` in `app.json`:
   ```json
   "extra": {
     "supportEmail": "you@yourdomain.com",
     "privacyPolicyUrl": "https://yourdomain.com/expense-manager/privacy"
   }
   ```
   The About & Privacy screen wires the "Contact support" and "View full privacy
   policy" links to these, and Play Console requires a publicly hosted privacy
   policy URL (mandatory once the app serves ads / uses the advertising ID).
4. **Play Console declarations.** Complete the Data safety form (see the
   checklist below), the content rating questionnaire (declare that the app
   contains ads), and the ads declaration.

### User consent for ads (UMP / GDPR) — already wired

The Google **UMP (User Messaging Platform)** consent flow is implemented in
`src/lib/ads.ts` and runs automatically on app start (`initAds`) before any ad
is requested:

- `AdsConsent.gatherConsent()` requests the consent info and shows the
  Google-rendered form when required (EEA / UK / Switzerland / regulated US
  states). It's a no-op everywhere consent isn't required.
- A **"Manage ad consent"** entry appears in Settings (only where the privacy
  options form is required) so users can change their choice at any time via
  `presentAdsPrivacyOptions()`.
- Ad requests are configured as general-audience: `maxAdContentRating: G`,
  `tagForChildDirectedTreatment: false`, and rewarded ads use
  `requestNonPersonalizedAdsOnly: true`.

To make this work you must still set up your messaging/consent form in the
**AdMob console → Privacy & messaging** (create a GDPR/EU consent message and,
if desired, a US states message) for your app. Without a published message the
form simply won't show.

You can locally test the EEA flow with `AdsConsentDebugGeography.EEA` and your
device's test ID.

## Production build (Play Store)

1. Install EAS CLI: `npm i -g eas-cli`.
2. Log in: `eas login`.
3. Configure your project: `eas init`.
4. Set the app's package name and signing in `app.json` (already set to
   `com.yogesh.expensemanager` — change it before publishing).
5. Build the AAB:
   ```bash
   eas build --profile production --platform android
   ```
6. Submit:
   ```bash
   eas submit --platform android
   ```

### Google Drive backup (optional, configurable)

The Drive backup feature is disabled until you configure an OAuth client:

1. Create an Android OAuth client ID in Google Cloud Console.
2. Use the Android package name `com.yogesh.expensemanager` and your release
   keystore SHA-1.
3. Add the client ID to `app.json` under `expo.extra.googleAndroidClientId`:
   ```json
   "extra": {
     "googleAndroidClientId": "YOUR_CLIENT_ID.apps.googleusercontent.com"
   }
   ```
4. Rebuild.

If you ship the app without configuring a client ID, the Backup screen will
show a clear error when the user taps Connect. All other features work
without it.

## Play Store Data Safety answers

The app itself collects nothing, but the bundled **Google AdMob SDK** does
collect data to serve ads, so the Data safety form must reflect that. Don't
answer "collects nothing" while ads are enabled — it will be rejected.

- **Data collected by the app:** None.
- **Data collected by the AdMob SDK (declare these):**
  - **Device or other IDs** — collected, shared with Google, purpose:
    Advertising or marketing. (The library adds the
    `com.google.android.gms.permission.AD_ID` permission.)
  - **Approximate location** (non-precise) and **app activity/interactions** —
    if your AdMob configuration uses them; declare as collected/shared for
    Advertising. When in doubt, consult AdMob's
    [Data safety guidance](https://support.google.com/admob/answer/11150250).
- **Data shared:** With Google for advertising (per above). No other sharing.
- **Optional backup:** When the user enables Drive backup, an encrypted file is
  written to the user's own Google Drive `appDataFolder`. The developer has no
  access to it. Declare under "User-generated content -> Other user-generated
  content", purpose: "App functionality / Account management", optional, user
  initiated, not collected by the developer.
- **Encryption in transit:** Yes (HTTPS to Google Drive and ad networks).
- **Encryption at rest:** Yes (AES via PBKDF2 from the user's PIN).
- **Data deletion:** All app data can be erased in-app via Settings → Danger
  zone → Delete all data. For backup, disconnect Drive in Settings (revokes the
  OAuth token) and delete the file from Drive's manage-app-data screen.
- **Advertising ID:** Yes — declare advertising-ID usage. If you remove ads,
  also remove the `AD_ID` permission and update this form.
- **Privacy policy URL:** Required — host one and set it in
  `expo.extra.privacyPolicyUrl` (also enter it in the Play Console).

## License

MIT.
