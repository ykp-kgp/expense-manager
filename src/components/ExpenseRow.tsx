import { View, StyleSheet, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ExpenseWithRefs } from '@/lib/queries';
import { formatCurrency, formatDate } from '@/lib/format';

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
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: theme.colors.surfaceVariant }}
      style={[
        styles.row,
        selected && { backgroundColor: theme.colors.secondaryContainer },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.categoryColor + '22' }]}>
        <MaterialCommunityIcons
          name={item.categoryIcon as any}
          size={22}
          color={item.categoryColor}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
          {item.categoryName}
        </Text>
        <Text variant="bodySmall" style={{ opacity: 0.7 }} numberOfLines={1}>
          {item.note || item.paymentMethodName}
          {showDate ? `  •  ${formatDate(item.date, 'd MMM')}` : ''}
        </Text>
      </View>
      <Text variant="titleMedium" style={{ fontWeight: '600' }}>
        {formatCurrency(item.amount, currency)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
