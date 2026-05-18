import { useState } from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Button, SegmentedButtons, Switch, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinKeypad } from '@/components/PinKeypad';
import { PinDots } from '@/components/PinDots';
import { setPin, setBiometricEnabled, isBiometricAvailable } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import { CURRENCY_SYMBOLS } from '@/lib/format';
import { scheduleDailyReminder, ensureNotificationPermission } from '@/lib/notifications';

type Step = 'welcome' | 'pin' | 'confirm' | 'preferences';

export default function Onboarding() {
  const theme = useTheme();
  const { refresh, markUnlocked } = useAuth();
  const { update } = useSettings();
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
      if (pin.length + 1 >= 4) {
        // user can press Continue
      }
    } else if (step === 'confirm') {
      if (confirm.length < 6) setConfirm(confirm + d);
    }
  };

  const handleBack = () => {
    if (step === 'pin') setPinValue((p) => p.slice(0, -1));
    if (step === 'confirm') setConfirm((c) => c.slice(0, -1));
  };

  const submitPinStep = () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.');
      return;
    }
    setStep('confirm');
  };

  const submitConfirmStep = async () => {
    if (pin !== confirm) {
      setError('PINs do not match. Try again.');
      setConfirm('');
      return;
    }
    setStep('preferences');
  };

  const finish = async () => {
    setBusy(true);
    try {
      await setPin(pin);
      await update('currency', currency);
      const bioAvail = await isBiometricAvailable();
      const bioOn = enableBiometric && bioAvail;
      await setBiometricEnabled(bioOn);
      await update('biometricEnabled', bioOn);
      await update('reminderEnabled', enableReminder);
      const time = `${String(reminderHour).padStart(2, '0')}:00`;
      await update('reminderTime', time);
      if (enableReminder) {
        const ok = await ensureNotificationPermission();
        if (ok) await scheduleDailyReminder(reminderHour, 0);
      }
      await refresh();
      markUnlocked();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {step === 'welcome' && (
            <>
              <Text variant="headlineLarge" style={styles.title}>
                Welcome
              </Text>
              <Text variant="bodyLarge" style={styles.subtitle}>
                Track your spending privately. All data stays on your device unless
                you choose to back it up.
              </Text>
              <Button mode="contained" onPress={() => setStep('pin')} style={styles.cta}>
                Get Started
              </Button>
            </>
          )}

          {(step === 'pin' || step === 'confirm') && (
            <>
              <Text variant="headlineSmall" style={styles.title}>
                {step === 'pin' ? 'Set a 4–6 digit PIN' : 'Confirm your PIN'}
              </Text>
              <Text variant="bodyMedium" style={styles.subtitle}>
                You will use this PIN to unlock the app.
              </Text>
              <PinDots
                length={6}
                filled={step === 'pin' ? pin.length : confirm.length}
                error={!!error}
              />
              {error && (
                <Text style={{ color: theme.colors.error, textAlign: 'center' }}>
                  {error}
                </Text>
              )}
              <PinKeypad onDigit={handleDigit} onBackspace={handleBack} />
              <Button
                mode="contained"
                onPress={step === 'pin' ? submitPinStep : submitConfirmStep}
                disabled={(step === 'pin' ? pin.length : confirm.length) < 4}
                style={styles.cta}
              >
                Continue
              </Button>
            </>
          )}

          {step === 'preferences' && (
            <>
              <Text variant="headlineSmall" style={styles.title}>
                Preferences
              </Text>
              <Text variant="labelLarge" style={styles.label}>
                Currency
              </Text>
              <SegmentedButtons
                value={currency}
                onValueChange={setCurrency}
                buttons={Object.keys(CURRENCY_SYMBOLS).slice(0, 5).map((c) => ({
                  value: c,
                  label: c,
                }))}
                style={{ marginBottom: 16 }}
              />
              <View style={styles.switchRow}>
                <Text variant="bodyLarge">Enable biometric unlock</Text>
                <Switch value={enableBiometric} onValueChange={setEnableBiometric} />
              </View>
              <View style={styles.switchRow}>
                <Text variant="bodyLarge">Daily reminder to log expenses</Text>
                <Switch value={enableReminder} onValueChange={setEnableReminder} />
              </View>
              {enableReminder && (
                <>
                  <Text variant="labelLarge" style={styles.label}>
                    Reminder time
                  </Text>
                  <SegmentedButtons
                    value={String(reminderHour)}
                    onValueChange={(v) => setReminderHour(parseInt(v, 10))}
                    buttons={[
                      { value: '9', label: '9 AM' },
                      { value: '13', label: '1 PM' },
                      { value: '18', label: '6 PM' },
                      { value: '21', label: '9 PM' },
                    ]}
                  />
                </>
              )}
              <Button
                mode="contained"
                onPress={finish}
                loading={busy}
                disabled={busy}
                style={styles.cta}
              >
                Finish
              </Button>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, gap: 12, flexGrow: 1 },
  title: { textAlign: 'center', marginTop: 32 },
  subtitle: { textAlign: 'center', marginBottom: 16, opacity: 0.8 },
  cta: { marginTop: 24, alignSelf: 'center', minWidth: 200 },
  label: { marginTop: 8, marginBottom: 8 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
});
