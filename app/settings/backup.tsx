import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  Dialog,
  Portal,
  TextInput,
  useTheme,
  ActivityIndicator,
  Banner,
} from 'react-native-paper';
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

export default function BackupScreen() {
  const theme = useTheme();
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
      const ok = await connectDrive();
      if (ok) await refresh();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to connect Drive.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect Drive?',
      'Your backup file in Drive will remain. You can delete it from Drive\'s app data manager if desired.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnectDrive();
            refresh();
          },
        },
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
          `${r.expenseCount} expenses restored from backup taken ${format(
            parseISO(r.exportedAt),
            'd MMM yyyy, HH:mm'
          )}.`
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
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Banner
        visible
        actions={[]}
        icon="shield-lock-outline"
      >
        Backups are end-to-end encrypted with a key derived from your PIN. Only
        you can decrypt them. They are stored in a hidden app folder of your
        own Google Drive.
      </Banner>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Google Drive</Text>
          <Text style={{ opacity: 0.7, marginTop: 4 }}>
            {connected ? 'Connected' : 'Not connected'}
          </Text>
          {lastBackup && (
            <Text style={{ marginTop: 4 }}>
              Last backup: {format(parseISO(lastBackup), 'd MMM yyyy, HH:mm')}
            </Text>
          )}

          <View style={styles.row}>
            {!connected ? (
              <Button mode="contained" onPress={handleConnect} loading={busy} disabled={busy}>
                Connect Google Drive
              </Button>
            ) : (
              <>
                <Button
                  mode="contained"
                  onPress={() => setPinDialog('backup')}
                  disabled={busy}
                  style={{ marginRight: 8 }}
                >
                  Backup now
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setPinDialog('restore')}
                  disabled={busy}
                >
                  Restore
                </Button>
              </>
            )}
          </View>

          {connected && (
            <Button mode="text" onPress={handleDisconnect} style={{ marginTop: 8 }}>
              Disconnect
            </Button>
          )}
          {error && (
            <Text style={{ color: theme.colors.error, marginTop: 8 }}>{error}</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="How backup works" />
        <Card.Content>
          <Text style={{ marginBottom: 8 }}>
            1. App creates a snapshot of your expenses.
          </Text>
          <Text style={{ marginBottom: 8 }}>
            2. The snapshot is encrypted with a key derived from your PIN.
          </Text>
          <Text style={{ marginBottom: 8 }}>
            3. The encrypted file is uploaded to your Google Drive&apos;s
            hidden app data folder.
          </Text>
          <Text>
            To restore on a new device, install the app, set the SAME PIN, then
            connect Drive and tap Restore.
          </Text>
          <Text style={{ marginTop: 8, opacity: 0.7 }}>
            Tip: a 6-digit PIN makes your encrypted backup much harder to crack
            than a 4-digit one. If you forget your PIN, the backup cannot be
            recovered — that is what keeps it private.
          </Text>
        </Card.Content>
      </Card>

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
            <Text style={{ marginBottom: 12 }}>
              {pinDialog === 'backup'
                ? 'Your PIN encrypts the backup before it leaves your device.'
                : 'Enter the PIN that was used when the backup was created.'}
            </Text>
            <TextInput
              mode="outlined"
              keyboardType="number-pad"
              secureTextEntry
              value={pinInput}
              onChangeText={setPinInput}
              maxLength={6}
              autoFocus
            />
            {busy && <ActivityIndicator style={{ marginTop: 12 }} />}
            {error && (
              <Text style={{ color: theme.colors.error, marginTop: 8 }}>{error}</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPinDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onPress={submitPin} disabled={busy || pinInput.length < 4}>
              {pinDialog === 'backup' ? 'Backup' : 'Restore'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 12, paddingBottom: 32 },
  card: { borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap' },
});
