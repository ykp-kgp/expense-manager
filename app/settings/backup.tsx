import { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import {
  Button,
  Dialog,
  Portal,
  TextInput,
  ActivityIndicator,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import {
  isDriveConnected,
  connectDrive,
  disconnectDrive,
  backupNow,
  restoreFromDrive,
  getLastBackupAt,
} from '@/lib/drive';
import { useDb } from '@/lib/db-context';
import { AppText, Screen, Card } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

export default function BackupScreen() {
  const { ios } = useAppTheme();
  const p = ios.palette;
  const { bump } = useDb();
  const [connected, setConnected] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinDialog, setPinDialog] = useState<null | 'backup' | 'restore'>(null);
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setConnected(await isDriveConnected());
    setLastBackup(await getLastBackupAt());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      if (await connectDrive()) await refresh();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to connect Drive.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Drive?',
      "Your backup file in Drive will remain. You can delete it from Drive's app data manager if desired.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: async () => { await disconnectDrive(); refresh(); } },
      ]
    );
  };

  const submitPin = async () => {
    setError(null);
    setBusy(true);
    try {
      if (pinDialog === 'backup') {
        await backupNow(pinInput);
        await refresh();
        Alert.alert('Backup uploaded');
      } else if (pinDialog === 'restore') {
        const r = await restoreFromDrive(pinInput);
        bump();
        Alert.alert(
          'Restore complete',
          `${r.expenseCount} expenses restored from backup taken ${format(parseISO(r.exportedAt), 'd MMM yyyy, HH:mm')}.`
        );
      }
      setPinDialog(null);
      setPinInput('');
    } catch (e: any) {
      setError(e?.message ?? 'Operation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll contentStyle={{ gap: spacing.lg }}>
      <View style={[styles.banner, { backgroundColor: p.tint + '14' }]}>
        <MaterialCommunityIcons name="shield-lock-outline" size={22} color={p.tint} />
        <AppText variant="footnote" style={{ flex: 1 }} tone="secondary">
          Backups are end-to-end encrypted with a key derived from your PIN. Only you can decrypt them. They are
          stored in a hidden app folder of your own Google Drive.
        </AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="footnote" tone="secondary" style={styles.groupTitle}>GOOGLE DRIVE</AppText>
        <Card style={{ gap: spacing.md }}>
          <View style={styles.statusRow}>
            <View style={{ flex: 1 }}>
              <AppText variant="body" weight="600">
                {connected ? 'Connected' : 'Not connected'}
              </AppText>
              {lastBackup ? (
                <AppText variant="footnote" tone="secondary">
                  Last backup {format(parseISO(lastBackup), 'd MMM yyyy, HH:mm')}
                </AppText>
              ) : null}
            </View>
            <MaterialCommunityIcons
              name={connected ? 'check-circle' : 'cloud-off-outline'}
              size={22}
              color={connected ? p.positive : p.tertiaryLabel}
            />
          </View>

          {!connected ? (
            <Button mode="contained" onPress={handleConnect} loading={busy} disabled={busy} style={styles.btn}>
              Connect Google Drive
            </Button>
          ) : (
            <View style={styles.actions}>
              <Button mode="contained" onPress={() => setPinDialog('backup')} disabled={busy} style={styles.flexBtn}>
                Back up now
              </Button>
              <Button mode="outlined" onPress={() => setPinDialog('restore')} disabled={busy} style={styles.flexBtn}>
                Restore
              </Button>
            </View>
          )}
          {connected ? (
            <Button mode="text" textColor={p.negative} onPress={handleDisconnect}>
              Disconnect
            </Button>
          ) : null}
          {error ? (
            <AppText variant="footnote" tone="negative">{error}</AppText>
          ) : null}
        </Card>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="footnote" tone="secondary" style={styles.groupTitle}>HOW BACKUP WORKS</AppText>
        <Card style={{ gap: spacing.md }}>
          <Step n="1" text="The app creates a snapshot of your expenses." />
          <Step n="2" text="The snapshot is encrypted with a key derived from your PIN." />
          <Step n="3" text="The encrypted file is uploaded to your Google Drive's hidden app data folder." />
          <AppText variant="subhead" tone="secondary">
            To restore on a new device, install the app, set the same PIN, then connect Drive and tap Restore.
          </AppText>
          <AppText variant="footnote" tone="secondary">
            Tip: a 6-digit PIN makes your encrypted backup much harder to crack than a 4-digit one. If you forget
            your PIN the backup cannot be recovered — that is what keeps it private.
          </AppText>
        </Card>
      </View>

      <Portal>
        <Dialog
          visible={pinDialog !== null}
          onDismiss={() => {
            if (!busy) {
              setPinDialog(null);
              setPinInput('');
              setError(null);
            }
          }}
        >
          <Dialog.Title>Enter your PIN</Dialog.Title>
          <Dialog.Content>
            <AppText variant="subhead" tone="secondary" style={{ marginBottom: spacing.md }}>
              {pinDialog === 'backup'
                ? 'Your PIN encrypts the backup before it leaves your device.'
                : 'Enter the PIN that was used when the backup was created.'}
            </AppText>
            <TextInput
              mode="outlined"
              keyboardType="number-pad"
              secureTextEntry
              value={pinInput}
              onChangeText={setPinInput}
              maxLength={6}
              autoFocus
            />
            {busy ? <ActivityIndicator style={{ marginTop: spacing.md }} /> : null}
            {error ? (
              <AppText variant="footnote" tone="negative" style={{ marginTop: spacing.sm }}>{error}</AppText>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPinDialog(null)} disabled={busy}>Cancel</Button>
            <Button onPress={submitPin} disabled={busy || pinInput.length < 4}>
              {pinDialog === 'backup' ? 'Back up' : 'Restore'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  const { ios } = useAppTheme();
  const p = ios.palette;
  return (
    <View style={styles.step}>
      <View style={[styles.stepNum, { backgroundColor: p.fill }]}>
        <AppText variant="footnote" weight="600" tone="tint">{n}</AppText>
      </View>
      <AppText variant="subhead" tone="secondary" style={{ flex: 1 }}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  groupTitle: { marginLeft: spacing.xs, letterSpacing: 0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  btn: { borderRadius: radius.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flexBtn: { flex: 1, borderRadius: radius.md },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
