import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Category } from '@/db/schema';
import { AppText } from '@/components/ui';
import { useAppTheme } from '@/theme';

export function CategoryGrid({
  items,
  selectedId,
  onSelect,
}: {
  items: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { ios } = useAppTheme();
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
              { backgroundColor: selected ? c.color : ios.palette.fill },
            ]}
          >
            <MaterialCommunityIcons
              name={c.icon as any}
              size={18}
              color={selected ? '#fff' : c.color}
            />
            <AppText
              variant="subhead"
              weight="600"
              color={selected ? '#fff' : ios.palette.label}
            >
              {c.name}
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
