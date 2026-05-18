import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PaymentMethod } from '@/db/schema';

export function PaymentMethodChips({
  items,
  selectedId,
  onSelect,
}: {
  items: PaymentMethod[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((p) => {
        const selected = p.id === selectedId;
        return (
          <Pressable
            key={p.id}
            onPress={() => onSelect(p.id)}
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
            <MaterialCommunityIcons
              name={p.icon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={22}
              color={selected ? theme.colors.onPrimary : theme.colors.primary}
            />
            <Text
              style={[
                styles.label,
                {
                  color: selected ? theme.colors.onPrimary : theme.colors.onSurface,
                  fontWeight: selected ? '700' : '500',
                },
              ]}
            >
              {p.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    marginRight: 8,
  },
  label: { marginLeft: 6 },
});
