import { View, StyleSheet, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onBiometric?: () => void;
  showBiometric?: boolean;
  disabled?: boolean;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinKeypad({ onDigit, onBackspace, onBiometric, showBiometric, disabled }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {KEYS.map((k) => (
        <PadButton key={k} onPress={() => onDigit(k)} disabled={disabled}>
          <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
            {k}
          </Text>
        </PadButton>
      ))}
      <PadButton onPress={onBiometric} disabled={!showBiometric || disabled}>
        {showBiometric ? (
          <MaterialCommunityIcons
            name="fingerprint"
            size={28}
            color={theme.colors.primary}
          />
        ) : null}
      </PadButton>
      <PadButton onPress={() => onDigit('0')} disabled={disabled}>
        <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
          0
        </Text>
      </PadButton>
      <PadButton onPress={onBackspace} disabled={disabled}>
        <MaterialCommunityIcons
          name="backspace-outline"
          size={26}
          color={theme.colors.onSurface}
        />
      </PadButton>
    </View>
  );
}

function PadButton({
  children,
  onPress,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      android_ripple={{ color: theme.colors.surfaceVariant, borderless: true }}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.btn,
        { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 280,
    alignSelf: 'center',
  },
  btn: {
    width: 80,
    height: 80,
    margin: 6,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
