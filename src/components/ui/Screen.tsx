import type { ReactNode } from 'react';
import { ScrollView, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { RefreshControlProps } from 'react-native';
import { useAppTheme } from '@/theme';
import { spacing } from '@/theme/tokens';

/**
 * Base screen on the iOS grouped background. Horizontal inset defaults to the
 * 16pt system margin; pass `scroll` for scrolling content.
 */
export function Screen({
  children,
  scroll = false,
  contentStyle,
  refreshControl,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const { ios } = useAppTheme();
  const bg = { backgroundColor: ios.palette.background };
  const pad = padded ? { padding: spacing.lg } : null;

  if (scroll) {
    return (
      <ScrollView
        style={[styles.flex, bg]}
        contentContainerStyle={[pad, { paddingBottom: spacing.xxxl }, contentStyle]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.flex, bg, pad, contentStyle]}>{children}</View>;
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
