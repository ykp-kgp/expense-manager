import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Category } from '@/db/schema';

export function CategoryGrid({
  items,
  selectedId,
  onSelect,
}: {
  items: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((c) => {
        const selected = c.id === selectedId;
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.id)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? c.color : theme.colors.surfaceVariant,
                borderColor: selected ? c.color : 'transparent',
              },
            ]}
          >
            <MaterialCommunityIcons
              name={c.icon as any}
              size={22}
              color={selected ? '#fff' : c.color}
            />
            <Text
              style={{
                color: selected ? '#fff' : theme.colors.onSurface,
                marginLeft: 6,
                fontWeight: '600',
              }}
            >
              {c.name}
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
});
