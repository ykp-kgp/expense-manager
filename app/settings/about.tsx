import { View, StyleSheet, Linking, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { AppText, Screen, Card } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

export default function About() {
  const { ios } = useAppTheme();
  const p = ios.palette;
  return (
    <Screen scroll contentStyle={{ gap: spacing.lg }}>
      <View style={styles.hero}>
        <View style={[styles.appIcon, { backgroundColor: p.tint }]}>
          <MaterialCommunityIcons name="wallet-outline" size={34} color={p.onTint} />
        </View>
        <AppText variant="title2" weight="700">Expense Manager</AppText>
        <AppText variant="subhead" tone="secondary">
          Version {Constants.expoConfig?.version ?? '1.0.0'}
        </AppText>
        <AppText variant="subhead" tone="secondary" style={styles.center}>
          A privacy-first, offline-only expense tracker. Your data lives on your device and is never
          sent to any server unless you explicitly enable backup to your own Google Drive.
        </AppText>
      </View>

      <Block title="Privacy Policy">
        <P label="What we collect: ">
          Nothing. Expense Manager does not collect, transmit, or share any personal information by default.
        </P>
        <P label="Where data is stored: ">
          All expenses, budgets, recurring rules, and receipt images are stored in app-private storage on your device.
        </P>
        <P label="Optional Google Drive backup: ">
          If you enable it, the app stores an end-to-end encrypted backup file in a hidden “app data” folder of your
          own Google Drive (scope: drive.appdata). The encryption key is derived from your PIN; we never see it. You
          can disconnect at any time, which revokes the OAuth token and deletes the local copy.
        </P>
        <P label="Permissions: ">
          Photos — only when you attach a receipt. Notifications — for daily reminders and recurring logs.
          Biometrics — for app unlock.
        </P>
        <P label="Children: ">
          The app is general-audience and not directed at children under 13.
        </P>
      </Block>

      <Block title="Open Source Notices">
        <AppText variant="subhead" tone="secondary">
          Built with React Native, Expo, react-native-paper, drizzle-orm, and other open-source libraries. Their
          licenses are available in the project repository.
        </AppText>
      </Block>

      <Pressable
        onPress={() => Linking.openURL('mailto:support@example.com')}
        style={({ pressed }) => [styles.contact, pressed && { opacity: 0.6 }]}
      >
        <MaterialCommunityIcons name="email-outline" size={18} color={p.tint} />
        <AppText variant="body" tone="tint">Contact support</AppText>
      </Pressable>
    </Screen>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="footnote" tone="secondary" style={styles.blockTitle}>
        {title.toUpperCase()}
      </AppText>
      <Card style={{ gap: spacing.md }}>{children}</Card>
    </View>
  );
}

function P({ label, children }: { label: string; children: string }) {
  return (
    <AppText variant="subhead" tone="secondary">
      <AppText variant="subhead" weight="600" tone="primary">{label}</AppText>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  appIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center', marginTop: spacing.sm },
  blockTitle: { marginLeft: spacing.xs, letterSpacing: 0.5 },
  contact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
});
