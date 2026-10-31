import { View, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ExpenseWithRefs } from '@/lib/queries';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from '@/components/ui';

export function ExpenseRow({
  item,
  currency,
  onPress,
  onLongPress,
  selected,
  showDate = false,
}: {
  item: ExpenseWithRefs;
  currency: string;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  showDate?: boolean;
}) {
  const { ios } = useAppTheme();
  const p = ios.palette;
  const color = item.categoryColor ?? p.tint;
  const subtitle =
    [item.note || item.paymentMethodName, showDate ? formatDate(item.date, 'd MMM') : null]
      .filter(Boolean)
      .join('  •  ');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: p.fill }}
      style={({ pressed }) => [
        styles.row,
        selected ? { backgroundColor: p.selection } : null,
        pressed && onPress ? { backgroundColor: p.fill } : null,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: color + '1F' }]}>
        <MaterialCommunityIcons name={item.categoryIcon as any} size={19} color={color} />
      </View>
      <View style={styles.text}>
        <AppText variant="body" weight="600" numberOfLines={1}>
          {item.categoryName}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" tone="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <AppText variant="headline" numberOfLines={1}>
        {formatCurrency(item.amount, currency)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 1,
    gap: spacing.md,
    minHeight: 56,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 1 },
});
