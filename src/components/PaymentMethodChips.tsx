import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PaymentMethod } from '@/db/schema';
import { AppText } from '@/components/ui';
import { useAppTheme } from '@/theme';

export function PaymentMethodChips({
  items,
  selectedId,
  onSelect,
}: {
  items: PaymentMethod[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { ios } = useAppTheme();
  const t = ios.palette;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((pm) => {
        const selected = pm.id === selectedId;
        return (
          <Pressable
            key={pm.id}
            onPress={() => onSelect(pm.id)}
            style={[
              styles.chip,
              { backgroundColor: selected ? t.tint : t.fill },
            ]}
          >
            <MaterialCommunityIcons
              name={pm.icon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={18}
              color={selected ? t.onTint : t.tint}
            />
            <AppText
              variant="subhead"
              weight="600"
              color={selected ? t.onTint : t.label}
            >
              {pm.name}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 4, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
});
