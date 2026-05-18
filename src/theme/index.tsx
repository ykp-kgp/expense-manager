import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import {
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  adaptNavigationTheme,
  type MD3Theme,
} from 'react-native-paper';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
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

  const paperTheme: MD3Theme = isDark
    ? { ...MD3DarkTheme, colors: { ...MD3DarkTheme.colors, ...m3.dark } }
    : { ...MD3LightTheme, colors: { ...MD3LightTheme.colors, ...m3.light } };

  const { LightTheme: NavLight, DarkTheme: NavDark } = adaptNavigationTheme({
    reactNavigationLight: NavigationDefaultTheme,
    reactNavigationDark: NavigationDarkTheme,
    materialLight: { ...MD3LightTheme, colors: { ...MD3LightTheme.colors, ...m3.light } },
    materialDark: { ...MD3DarkTheme, colors: { ...MD3DarkTheme.colors, ...m3.dark } },
  });

  const navTheme = isDark ? NavDark : NavLight;

  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={navTheme}>{children}</ThemeProvider>
    </PaperProvider>
  );
}
