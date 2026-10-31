# Expense Manager

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
**authenticated-encrypted** (AES-256 + HMAC-SHA256) with a key derived from your
PIN before it leaves the device, and is stored in a hidden `appDataFolder` of
your own Drive.

> **Note on data at rest:** the PIN gates the app UI; it does not (yet) encrypt
> the on-device database itself. On a rooted/jailbroken or physically-extracted
> device the local data is readable. Encrypting the database with SQLCipher is
> tracked on the [roadmap](docs/MONETIZATION.md#future-roadmap) and in
> [SECURITY.md](SECURITY.md). Choose a 6-digit PIN for stronger backups.

## Security & documentation

- [SECURITY.md](SECURITY.md) — threat model, audit findings & fixes, hardening backlog
- [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) — pre-launch checklist for 10k+ users
- [docs/SCALING.md](docs/SCALING.md) — how a local-first app scales (and an optional sync backend)
- [docs/MONETIZATION.md](docs/MONETIZATION.md) — revenue models and the feature roadmap

## Stack

- **Framework:** Expo SDK 54 (React Native 0.81)
- **Language:** TypeScript
- **Routing:** expo-router (file-based)
- **UI:** react-native-paper (Material 3) + @pchmn/expo-material3-theme
- **DB:** expo-sqlite + drizzle-orm
- **Charts:** react-native-gifted-charts
- **Crypto:** expo-crypto + crypto-js (PBKDF2-SHA256, AES-256-CBC + HMAC-SHA256 encrypt-then-MAC)
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

- **Data collected:** None (default usage).
- **Data shared:** None.
- **Optional backup:** When the user enables Drive backup, an encrypted file is
  written to the user's own Google Drive `appDataFolder`. The developer has no
  access to it. Declare under "User-generated content -> Other user-generated
  content", purpose: "App functionality / Account management", optional, user
  initiated, not collected by the developer.
- **Encryption in transit:** Yes (HTTPS to Google Drive).
- **Encryption at rest:** The **Drive backup file** is encrypted client-side
  (AES-256 + HMAC-SHA256, key derived from the user's PIN). The **on-device
  database is not yet encrypted at rest** — do not claim otherwise on the Data
  Safety form until SQLCipher lands (see [SECURITY.md](SECURITY.md)).
- **Data deletion:** Disconnect Drive in Settings; delete the file from
  Drive's manage-app-data screen.

## License

MIT.
