import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import {
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  adaptNavigationTheme,
  type MD3Theme,
} from 'react-native-paper';
// As of SDK 56, expo-router vendors react-navigation and these must be imported
// from 'expo-router' rather than '@react-navigation/native'.
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  ThemeProvider,
} from 'expo-router';
import { useColorScheme } from 'react-native';
import type { ReactNode } from 'react';
import { useSettings } from '@/lib/settings-context';

const FALLBACK_SOURCE_COLOR = '#6750A4';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const { settings } = useSettings();
  const themePref = settings.theme ?? 'system';

  const isDark =
    themePref === 'system' ? systemScheme === 'dark' : themePref === 'dark';

  const { theme: m3 } = useMaterial3Theme({ fallbackSourceColor: FALLBACK_SOURCE_COLOR });

  const lightColors = { ...MD3LightTheme.colors, ...m3.light };
  const darkColors = { ...MD3DarkTheme.colors, ...m3.dark };

  const paperTheme: MD3Theme = isDark
    ? { ...MD3DarkTheme, colors: darkColors }
    : { ...MD3LightTheme, colors: lightColors };

  // react-native-paper 5.x's `adaptNavigationTheme` types predate the newer
  // @react-navigation Theme shape (which requires `fonts`), so cast the inputs
  // and merge the navigation `fonts` back in for correct runtime behavior.
  const { LightTheme: NavLight, DarkTheme: NavDark } = adaptNavigationTheme({
    reactNavigationLight: NavigationDefaultTheme as any,
    reactNavigationDark: NavigationDarkTheme as any,
    materialLight: { ...MD3LightTheme, colors: lightColors },
    materialDark: { ...MD3DarkTheme, colors: darkColors },
  }) as { LightTheme: any; DarkTheme: any };

  const navTheme = isDark
    ? { ...NavDark, fonts: NavigationDarkTheme.fonts }
    : { ...NavLight, fonts: NavigationDefaultTheme.fonts };

  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={navTheme}>{children}</ThemeProvider>
    </PaperProvider>
  );
}
