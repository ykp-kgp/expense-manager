import { useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import {
  Switch,
  Dialog,
  Portal,
  Button,
  TextInput,
  RadioButton,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSettings, type ThemePref } from '@/lib/settings-context';
import { CURRENCY_SYMBOLS } from '@/lib/format';
import {
  cancelDailyReminder,
  scheduleDailyReminder,
  ensureNotificationPermission,
} from '@/lib/notifications';
import { setBiometricEnabled, isBiometricAvailable, setPin, verifyPin } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { exportExpensesCsv, exportExpensesJson, shareFile } from '@/lib/export';
import { AppText, Screen, Section, Row, LargeTitle, Segmented } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

export default function Settings() {
  const { ios } = useAppTheme();
  const p = ios.palette;
  const router = useRouter();
  const { settings, update } = useSettings();
  const { lock } = useAuth();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [autoLockOpen, setAutoLockOpen] = useState(false);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [reminderHour, setReminderHour] = useState(
    parseInt(settings.reminderTime.split(':')[0] ?? '21', 10)
  );

  const toggleReminder = async (enabled: boolean) => {
    if (enabled) {
      const ok = await ensureNotificationPermission();
      if (!ok) {
        Alert.alert('Permission denied', 'Enable notifications in system settings.');
        return;
      }
      const [h] = settings.reminderTime.split(':');
      await scheduleDailyReminder(parseInt(h, 10), 0);
    } else {
      await cancelDailyReminder();
    }
    await update('reminderEnabled', enabled);
  };

  const toggleBiometric = async (enabled: boolean) => {
    if (enabled) {
      const ok = await isBiometricAvailable();
      if (!ok) {
        Alert.alert(
          'Biometrics unavailable',
          'Set up fingerprint or face unlock in your device settings first.'
        );
        return;
      }
    }
    await setBiometricEnabled(enabled);
    await update('biometricEnabled', enabled);
  };

  const saveReminderTime = async () => {
    await update('reminderTime', `${String(reminderHour).padStart(2, '0')}:00`);
    if (settings.reminderEnabled) await scheduleDailyReminder(reminderHour, 0);
    setReminderOpen(false);
  };

  const changePin = async () => {
    setPinError(null);
    if (!(await verifyPin(currentPin))) {
      setPinError('Current PIN is incorrect.');
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError('New PIN must be 4–6 digits.');
      return;
    }
    await setPin(newPin);
    setPinOpen(false);
    setCurrentPin('');
    setNewPin('');
    Alert.alert('PIN updated');
  };

  const exportCsv = async () => {
    try {
      await shareFile(await exportExpensesCsv(), 'text/csv');
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? String(e));
    }
  };

  const exportJson = async () => {
    try {
      await shareFile(await exportExpensesJson(), 'application/json');
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? String(e));
    }
  };

  const iosSwitch = (value: boolean, onValueChange: (v: boolean) => void) => (
    <Switch value={value} onValueChange={onValueChange} color={p.toggleOn} />
  );

  return (
    <Screen scroll padded={false}>
      <LargeTitle title="Settings" />
      <View style={styles.body}>
        <Section header="Appearance">
          <View style={styles.segmentRow}>
            <Segmented
              options={[
                { value: 'light', label: 'Light' },
                { value: 'system', label: 'System' },
                { value: 'dark', label: 'Dark' },
              ]}
              value={settings.theme}
              onChange={(v) => update('theme', v as ThemePref)}
            />
          </View>
          <Row
            title="Currency"
            value={settings.currency}
            icon="currency-usd"
            iconBackground={p.toggleOn}
            accessory="chevron"
            onPress={() => setCurrencyOpen(true)}
          />
        </Section>

        <Section header="Security">
          <Row
            title="Biometric unlock"
            icon="fingerprint"
            iconBackground={p.tint}
            accessory={iosSwitch(settings.biometricEnabled, toggleBiometric)}
          />
          <Row
            title="Change PIN"
            icon="lock-reset"
            iconBackground="#8E8E93"
            accessory="chevron"
            onPress={() => setPinOpen(true)}
          />
          <Row
            title="Auto-lock"
            value={`${settings.autoLockMinutes} min`}
            icon="timer-outline"
            iconBackground="#FF9500"
            accessory="chevron"
            onPress={() => setAutoLockOpen(true)}
          />
          <Row title="Lock now" icon="lock" iconBackground="#FF3B30" onPress={lock} />
        </Section>

        <Section header="Reminders">
          <Row
            title="Daily reminder"
            subtitle={settings.reminderEnabled ? `Every day at ${settings.reminderTime}` : 'Off'}
            icon="bell-outline"
            iconBackground="#FF3B30"
            accessory={iosSwitch(settings.reminderEnabled, toggleReminder)}
          />
          <Row
            title="Reminder time"
            value={settings.reminderTime}
            icon="clock-outline"
            iconBackground="#5856D6"
            accessory="chevron"
            onPress={() => setReminderOpen(true)}
            disabled={!settings.reminderEnabled}
          />
        </Section>

        <Section header="Money">
          <Row
            title="Budgets"
            icon="chart-donut"
            iconBackground={p.toggleOn}
            accessory="chevron"
            onPress={() => router.push('/settings/budgets')}
          />
          <Row
            title="Recurring expenses"
            icon="repeat"
            iconBackground="#5856D6"
            accessory="chevron"
            onPress={() => router.push('/settings/recurring')}
          />
          <Row
            title="Categories"
            icon="tag-multiple-outline"
            iconBackground="#FF9500"
            accessory="chevron"
            onPress={() => router.push('/settings/categories')}
          />
        </Section>

        <Section header="Data" footer="Back up an encrypted copy to your own Google Drive. Your data never leaves your control.">
          <Row
            title="Export to CSV"
            icon="file-delimited-outline"
            iconBackground="#34C759"
            accessory="chevron"
            onPress={exportCsv}
          />
          <Row
            title="Export to JSON"
            icon="code-json"
            iconBackground="#8E8E93"
            accessory="chevron"
            onPress={exportJson}
          />
          <Row
            title="Backup & Restore"
            icon="cloud-outline"
            iconBackground={p.tint}
            accessory="chevron"
            onPress={() => router.push('/settings/backup')}
          />
        </Section>

        <Section>
          <Row
            title="About & Privacy"
            icon="information-outline"
            iconBackground="#8E8E93"
            accessory="chevron"
            onPress={() => router.push('/settings/about')}
          />
        </Section>
      </View>

      <Portal>
        <Dialog visible={currencyOpen} onDismiss={() => setCurrencyOpen(false)}>
          <Dialog.Title>Currency</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={settings.currency}
              onValueChange={(v) => {
                update('currency', v);
                setCurrencyOpen(false);
              }}
            >
              {Object.keys(CURRENCY_SYMBOLS).map((c) => (
                <RadioButton.Item key={c} label={`${c} (${CURRENCY_SYMBOLS[c]})`} value={c} />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
        </Dialog>

        <Dialog visible={reminderOpen} onDismiss={() => setReminderOpen(false)}>
          <Dialog.Title>Reminder time</Dialog.Title>
          <Dialog.Content>
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
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setReminderOpen(false)}>Cancel</Button>
            <Button onPress={saveReminderTime}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={autoLockOpen} onDismiss={() => setAutoLockOpen(false)}>
          <Dialog.Title>Auto-lock after</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={String(settings.autoLockMinutes)}
              onValueChange={(v) => {
                update('autoLockMinutes', parseInt(v, 10));
                setAutoLockOpen(false);
              }}
            >
              {['1', '2', '5', '15', '60'].map((m) => (
                <RadioButton.Item key={m} value={m} label={`${m} minute${m === '1' ? '' : 's'}`} />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
        </Dialog>

        <Dialog visible={pinOpen} onDismiss={() => setPinOpen(false)}>
          <Dialog.Title>Change PIN</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Current PIN"
              mode="outlined"
              keyboardType="number-pad"
              secureTextEntry
              value={currentPin}
              onChangeText={setCurrentPin}
              maxLength={6}
              style={styles.input}
            />
            <TextInput
              label="New PIN (4-6 digits)"
              mode="outlined"
              keyboardType="number-pad"
              secureTextEntry
              value={newPin}
              onChangeText={setNewPin}
              maxLength={6}
            />
            {pinError ? (
              <AppText variant="footnote" tone="negative" style={{ marginTop: spacing.sm }}>
                {pinError}
              </AppText>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPinOpen(false)}>Cancel</Button>
            <Button onPress={changePin}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  segmentRow: { padding: spacing.md },
  input: { marginBottom: spacing.sm },
});
