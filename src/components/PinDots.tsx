import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';

export function PinDots({
  length,
  filled,
  error,
}: {
  length: number;
  filled: number;
  error?: boolean;
}) {
  const theme = useTheme();
  const dots = Array.from({ length }, (_, i) => i < filled);
  return (
    <View style={styles.row}>
      {dots.map((on, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              borderColor: error ? theme.colors.error : theme.colors.outline,
              backgroundColor: on
                ? error
                  ? theme.colors.error
                  : theme.colors.primary
                : 'transparent',
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginVertical: 24 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
});
