import { ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import { Text, Card, useTheme, Button } from 'react-native-paper';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const SUPPORT_EMAIL = (extra.supportEmail as string) || '';
const PRIVACY_POLICY_URL = (extra.privacyPolicyUrl as string) || '';

export default function About() {
  const theme = useTheme();

  const openSupport = () => {
    if (!SUPPORT_EMAIL) {
      Alert.alert('Support', 'No support contact is configured for this build.');
      return;
    }
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  const openPrivacyPolicy = () => {
    if (!PRIVACY_POLICY_URL) {
      Alert.alert('Privacy policy', 'No privacy policy URL is configured for this build.');
      return;
    }
    Linking.openURL(PRIVACY_POLICY_URL);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <Card.Title title="Expense Manager" subtitle={`v${Constants.expoConfig?.version ?? '1.0.0'}`} />
        <Card.Content>
          <Text>
            A privacy-first, offline-only expense tracker. Your data lives on
            your device and is never sent to any server unless you explicitly
            enable backup to your own Google Drive.
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Privacy Policy" />
        <Card.Content>
          <Text style={styles.p}>
            <Text style={styles.b}>What we collect: </Text>
            Nothing. Expense Manager does not collect, transmit, or share any
            personal information by default.
          </Text>
          <Text style={styles.p}>
            <Text style={styles.b}>Where data is stored: </Text>
            All expenses, budgets, recurring rules, and receipt images are
            stored in app-private storage on your device.
          </Text>
          <Text style={styles.p}>
            <Text style={styles.b}>Optional Google Drive backup: </Text>
            If you choose to enable it, the app stores an end-to-end encrypted
            backup file in a hidden &quot;app data&quot; folder of your own
            Google Drive (scope: drive.appdata). The encryption key is derived
            from your PIN; we never see it. You can disconnect at any time;
            doing so revokes the OAuth token and deletes the local copy.
          </Text>
          <Text style={styles.p}>
            <Text style={styles.b}>Advertising: </Text>
            The app shows occasional rewarded ads via Google AdMob. To serve
            ads, Google may collect device identifiers (including the advertising
            ID) and approximate, non-precise location. In regions that require it
            (such as the EEA and UK) you&apos;ll be asked for consent, and you can
            change your choice anytime from Settings → Manage ad consent. Ads are
            requested as non-personalized by default.
          </Text>
          <Text style={styles.p}>
            <Text style={styles.b}>Permissions: </Text>
            Photos – only when you attach a receipt. Notifications – for daily
            reminders and recurring expense logs. Biometrics – for app unlock.
            Files – only when you import or export your own data.
          </Text>
          <Text style={styles.p}>
            <Text style={styles.b}>Deleting your data: </Text>
            You can permanently erase everything at any time from Settings →
            Danger zone → Delete all data. This wipes all expenses, settings,
            receipts, and your PIN from the device.
          </Text>
          <Text style={styles.p}>
            <Text style={styles.b}>Children: </Text>
            The app is general-audience and not directed at children under 13.
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Open Source Notices" />
        <Card.Content>
          <Text>
            This app is built with React Native, Expo, react-native-paper,
            drizzle-orm, and other open-source libraries. Their licenses are
            available in the project repository.
          </Text>
        </Card.Content>
      </Card>

      {!!PRIVACY_POLICY_URL && (
        <Button mode="text" icon="shield-lock-outline" onPress={openPrivacyPolicy}>
          View full privacy policy
        </Button>
      )}
      <Button mode="text" icon="email-outline" onPress={openSupport}>
        Contact support
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 12, paddingBottom: 32 },
  card: { borderRadius: 16 },
  p: { marginTop: 8 },
  b: { fontWeight: '700' },
});
