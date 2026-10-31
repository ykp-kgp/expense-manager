import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Constants from 'expo-constants';

/**
 * Covers the app with an opaque screen whenever the app is not in the
 * foreground (backgrounded or inactive, e.g. the iOS/Android app switcher or an
 * incoming call), so sensitive financial data isn't exposed in app previews.
 */
export function PrivacyOverlay() {
  const theme = useTheme();
  const [obscured, setObscured] = useState(false);

  useEffect(() => {
    const handleChange = (state: AppStateStatus) => {
      setObscured(state !== 'active');
    };
    const subscription = AppState.addEventListener('change', handleChange);
    return () => subscription.remove();
  }, []);

  if (!obscured) return null;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
        {Constants.expoConfig?.name ?? 'Expense Manager'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
});
