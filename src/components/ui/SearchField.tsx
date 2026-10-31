import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/theme';
import { radius, spacing, typography } from '@/theme/tokens';

/** iOS search field: rounded fill, leading magnifier, inline clear button. */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  const { ios } = useAppTheme();
  const p = ios.palette;
  return (
    <View style={[styles.wrap, { backgroundColor: p.fill }]}>
      <MaterialCommunityIcons name="magnify" size={18} color={p.secondaryLabel} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={p.secondaryLabel}
        style={[styles.input, { color: p.label }]}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <MaterialCommunityIcons name="close-circle" size={17} color={p.tertiaryLabel} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 36,
  },
  input: {
    flex: 1,
    fontSize: typography.body.fontSize,
    letterSpacing: typography.body.letterSpacing,
    padding: 0,
  },
});
