import { View, type ViewProps, StyleSheet } from 'react-native';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

/** A flat, rounded iOS grouped surface. No Material elevation shadow. */
export function Card({ style, ...rest }: ViewProps) {
  const { ios } = useAppTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        { backgroundColor: ios.palette.groupedCard },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
