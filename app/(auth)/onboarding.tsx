import { useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinKeypad } from '@/components/PinKeypad';
import { PinDots } from '@/components/PinDots';
import { setPin, setBiometricEnabled, isBiometricAvailable } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import { CurrencyChips } from '@/components/CurrencyChips';
import {
  scheduleDailyReminder,
  ensureNotificationPermission,
  notificationsSupported,
} from '@/lib/notifications';
import { AppText, Segmented } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

type Step = 'welcome' | 'pin' | 'confirm' | 'preferences';

export default function Onboarding() {
  const { ios } = useAppTheme();
  const p = ios.palette;
  const { refresh, markUnlocked } = useAuth();
  const { updateMany } = useSettings();
  const [step, setStep] = useState<Step>('welcome');
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [enableBiometric, setEnableBiometric] = useState(true);
  const [enableReminder, setEnableReminder] = useState(true);
  const [reminderHour, setReminderHour] = useState(21);
  const [busy, setBusy] = useState(false);

  const handleDigit = (d: string) => {
    setError(null);
    if (step === 'pin') {
      if (pin.length < 6) setPinValue(pin + d);
    } else if (step === 'confirm') {
      if (confirm.length < 6) setConfirm(confirm + d);
    }
  };

  const handleBack = () => {
    if (step === 'pin') setPinValue((v) => v.slice(0, -1));
    if (step === 'confirm') setConfirm((c) => c.slice(0, -1));
  };

  const submitPinStep = () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.');
      return;
    }
    setStep('confirm');
  };

  const submitConfirmStep = () => {
    if (pin !== confirm) {
      setError('PINs do not match. Try again.');
      setConfirm('');
      return;
    }
    setError(null);
    setStep('preferences');
  };

  const finish = async () => {
    setBusy(true);
    try {
      const time = `${String(reminderHour).padStart(2, '0')}:00`;
      const [, bioAvail] = await Promise.all([setPin(pin), isBiometricAvailable()]);
      const bioOn = enableBiometric && bioAvail;
      await Promise.all([
        updateMany({ currency, biometricEnabled: bioOn, reminderEnabled: enableReminder, reminderTime: time }),
        setBiometricEnabled(bioOn),
      ]);
      await refresh();
      markUnlocked();
      if (enableReminder && notificationsSupported()) {
        void ensureNotificationPermission().then((ok) => {
          if (ok) return scheduleDailyReminder(reminderHour, 0);
        });
      }
    } catch {
      setError('Could not save your PIN. Please try again.');
      setStep('confirm');
      setConfirm('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {step === 'welcome' ? (
            <View style={styles.welcome}>
              <View style={[styles.hero, { backgroundColor: p.tint }]}>
                <MaterialCommunityIcons name="wallet-outline" size={40} color={p.onTint} />
              </View>
              <AppText variant="largeTitle" weight="700" style={styles.center}>
                Welcome
              </AppText>
              <AppText variant="body" tone="secondary" style={styles.center}>
                Track your spending privately. Everything stays on your device unless you choose to back it up.
              </AppText>
            </View>
          ) : null}

          {step === 'pin' || step === 'confirm' ? (
            <View style={styles.pinStep}>
              <AppText variant="title2" weight="700" style={styles.center}>
                {step === 'pin' ? 'Create a Passcode' : 'Confirm Passcode'}
              </AppText>
              <AppText variant="subhead" tone="secondary" style={styles.center}>
                You'll use this 4–6 digit passcode to unlock the app.
              </AppText>
              <PinDots length={6} filled={step === 'pin' ? pin.length : confirm.length} error={!!error} />
              <View style={styles.statusWrap}>
                {error ? (
                  <AppText variant="footnote" tone="negative" style={styles.center}>
                    {error}
                  </AppText>
                ) : null}
              </View>
              <PinKeypad onDigit={handleDigit} onBackspace={handleBack} />
            </View>
          ) : null}

          {step === 'preferences' ? (
            <View style={styles.prefs}>
              <AppText variant="title2" weight="700" style={styles.center}>
                Preferences
              </AppText>
              <AppText variant="footnote" tone="secondary" style={styles.prefLabel}>
                CURRENCY
              </AppText>
              <CurrencyChips
                value={currency}
                onChange={setCurrency}
                style={styles.currency}
                contentPadding={spacing.lg}
              />

              <View style={[styles.card, { backgroundColor: p.groupedCard }]}>
                <ToggleRow
                  label="Biometric unlock"
                  value={enableBiometric}
                  onChange={setEnableBiometric}
                  separator
                />
                <ToggleRow
                  label="Daily reminder to log expenses"
                  value={enableReminder}
                  onChange={setEnableReminder}
                />
              </View>

              {enableReminder ? (
                <>
                  <AppText variant="footnote" tone="secondary" style={styles.prefLabel}>
                    REMINDER TIME
                  </AppText>
                  <Segmented
                    options={[
                      { value: '9', label: '9 AM' },
                      { value: '13', label: '1 PM' },
                      { value: '18', label: '6 PM' },
                      { value: '21', label: '9 PM' },
                    ]}
                    value={String(reminderHour)}
                    onChange={(v) => setReminderHour(parseInt(v, 10))}
                  />
                </>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {step !== 'pin' && step !== 'confirm' ? (
          <View style={styles.footer}>
            <Button
              mode="contained"
              onPress={step === 'welcome' ? () => setStep('pin') : finish}
              loading={busy}
              disabled={busy}
              style={styles.cta}
              contentStyle={styles.ctaContent}
            >
              {step === 'welcome' ? 'Get Started' : 'Finish'}
            </Button>
          </View>
        ) : (
          <View style={styles.footer}>
            <Button
              mode="contained"
              onPress={step === 'pin' ? submitPinStep : submitConfirmStep}
              disabled={(step === 'pin' ? pin.length : confirm.length) < 4}
              style={styles.cta}
              contentStyle={styles.ctaContent}
            >
              Continue
            </Button>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  separator,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  separator?: boolean;
}) {
  const { ios } = useAppTheme();
  const p = ios.palette;
  return (
    <View>
      <View style={styles.toggleRow}>
        <AppText variant="body" style={{ flex: 1 }}>{label}</AppText>
        <Switch value={value} onValueChange={onChange} color={p.toggleOn} />
      </View>
      {separator ? <View style={[styles.sep, { backgroundColor: p.separator }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xxxl },
  center: { textAlign: 'center' },

  welcome: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  hero: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },

  pinStep: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
  statusWrap: { minHeight: 20, justifyContent: 'center', marginBottom: spacing.sm },

  prefs: { gap: spacing.md },
  prefLabel: { marginLeft: spacing.xs, marginTop: spacing.md, letterSpacing: 0.5 },
  currency: { marginHorizontal: -spacing.lg },
  card: { borderRadius: radius.lg, paddingHorizontal: spacing.lg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, gap: spacing.md },
  sep: { height: StyleSheet.hairlineWidth },

  footer: { padding: spacing.lg },
  cta: { borderRadius: radius.md },
  ctaContent: { paddingVertical: spacing.xs },
});
