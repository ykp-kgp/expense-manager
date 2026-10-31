import {
  StyleSheet,
  Pressable,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { CURRENCY_SYMBOLS } from '@/lib/format';
import { AppText } from '@/components/ui';
import { useAppTheme } from '@/theme';

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
  const { ios } = useAppTheme();
  const t = ios.palette;
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
              { backgroundColor: selected ? t.tint : t.fill },
            ]}
          >
            <AppText variant="subhead" weight="700" color={selected ? t.onTint : t.label}>
              {code}
            </AppText>
            <AppText variant="footnote" weight="600" color={selected ? t.onTint : t.secondaryLabel}>
              {symbol}
            </AppText>
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
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    gap: 1,
  },
});
