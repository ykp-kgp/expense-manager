import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/theme/tokens';
import { AppText } from './Text';

/**
 * iOS-style Large Title that leads a top-level screen
 * (`typography.md`: Large Title 34/Bold). Optional trailing accessory.
 */
export function LargeTitle({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        <View style={styles.titleCol}>
          <AppText variant="largeTitle">{title}</AppText>
          {subtitle ? (
            <AppText variant="subhead" tone="secondary" style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleCol: { flex: 1 },
  subtitle: { marginTop: 2 },
  trailing: { marginLeft: spacing.md },
});
