import { ScrollView, View, StyleSheet } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDb } from '@/lib/db-context';

export default function Categories() {
  const theme = useTheme();
  const { categories } = useDb();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={{ opacity: 0.7, marginBottom: 8 }}>
        Categories are predefined to keep things simple. Custom categories may
        come in a future update.
      </Text>
      {categories.map((c) => (
        <Card key={c.id} style={styles.card}>
          <Card.Content style={styles.row}>
            <View style={[styles.icon, { backgroundColor: c.color + '22' }]}>
              <MaterialCommunityIcons name={c.icon as any} size={22} color={c.color} />
            </View>
            <Text variant="titleMedium" style={{ flex: 1 }}>
              {c.name}
            </Text>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 8 },
  card: { borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
