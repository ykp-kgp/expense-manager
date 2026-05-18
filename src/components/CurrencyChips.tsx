import {
  StyleSheet,
  Pressable,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { CURRENCY_SYMBOLS } from '@/lib/format';

const CURRENCY_CODES = Object.keys(CURRENCY_SYMBOLS);

export function CurrencyChips({
  value,
  onChange,
  style,
  contentPadding = 4,
}: {
  value: string;
  onChange: (code: string) => void;
  style?: StyleProp<ViewStyle>;
  contentPadding?: number;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, style]}
      contentContainerStyle={[styles.row, { paddingHorizontal: contentPadding }]}
    >
      {CURRENCY_CODES.map((code) => {
        const selected = code === value;
        const symbol = CURRENCY_SYMBOLS[code];
        return (
          <Pressable
            key={code}
            onPress={() => onChange(code)}
            style={[
              styles.chip,
              {
                backgroundColor: selected
                  ? theme.colors.primary
                  : theme.colors.surfaceVariant,
                borderColor: selected ? theme.colors.primary : theme.colors.outline,
              },
            ]}
          >
            <Text
              style={[
                styles.code,
                { color: selected ? theme.colors.onPrimary : theme.colors.onSurface },
              ]}
            >
              {code}
            </Text>
            <Text
              style={[
                styles.symbol,
                { color: selected ? theme.colors.onPrimary : theme.colors.primary },
              ]}
            >
              {symbol}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  chip: {
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
  },
  code: { fontSize: 14, fontWeight: '700' },
  symbol: { fontSize: 15, marginTop: 2, fontWeight: '600' },
});
