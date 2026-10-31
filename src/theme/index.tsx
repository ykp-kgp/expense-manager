import {
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  configureFonts,
  useTheme,
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
import {
  darkPalette,
  lightPalette,
  radius,
  spacing,
  typography,
  type IOSTokens,
} from '@/theme/tokens';

/** Paper theme extended with our iOS design tokens. */
export type AppTheme = MD3Theme & { ios: IOSTokens };

// Map the iOS type scale onto Paper's MD3 font slots so built-in Paper
// components (Button, Dialog, List, TextInput) inherit iOS metrics.
const fontConfig = configureFonts({
  config: {
    displayLarge: { ...typography.largeTitle, fontFamily: 'System' },
    displayMedium: { ...typography.title1, fontFamily: 'System' },
    displaySmall: { ...typography.title1, fontFamily: 'System' },
    headlineLarge: { ...typography.title1, fontFamily: 'System' },
    headlineMedium: { ...typography.title2, fontFamily: 'System' },
    headlineSmall: { ...typography.title3, fontFamily: 'System' },
    titleLarge: { ...typography.title3, fontFamily: 'System' },
    titleMedium: { ...typography.headline, fontFamily: 'System' },
    titleSmall: { ...typography.subhead, fontFamily: 'System', fontWeight: '600' },
    bodyLarge: { ...typography.body, fontFamily: 'System' },
    bodyMedium: { ...typography.callout, fontFamily: 'System' },
    bodySmall: { ...typography.footnote, fontFamily: 'System' },
    labelLarge: { ...typography.headline, fontFamily: 'System' },
    labelMedium: { ...typography.footnote, fontFamily: 'System', fontWeight: '600' },
    labelSmall: { ...typography.caption1, fontFamily: 'System', fontWeight: '600' },
  },
});

function buildPaperTheme(isDark: boolean): AppTheme {
  const palette = isDark ? darkPalette : lightPalette;
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  // Flatten MD3 elevation surfaces — iOS grouped UI is flat, not shadowed.
  const flatSurface = palette.groupedCard;

  return {
    ...base,
    roundness: radius.md,
    fonts: fontConfig,
    colors: {
      ...base.colors,
      primary: palette.tint,
      onPrimary: palette.onTint,
      primaryContainer: palette.selection,
      onPrimaryContainer: palette.tint,
      secondary: palette.tint,
      onSecondary: palette.onTint,
      secondaryContainer: palette.selection,
      onSecondaryContainer: palette.label,
      background: palette.background,
      onBackground: palette.label,
      surface: palette.groupedCard,
      onSurface: palette.label,
      surfaceVariant: palette.background,
      onSurfaceVariant: palette.secondaryLabel,
      surfaceDisabled: palette.fill,
      outline: palette.separator,
      outlineVariant: palette.separator,
      error: palette.negative,
      onError: palette.onTint,
      elevation: {
        level0: 'transparent',
        level1: flatSurface,
        level2: flatSurface,
        level3: flatSurface,
        level4: flatSurface,
        level5: flatSurface,
      },
    },
    ios: { palette, typography, spacing, radius, isDark },
  };
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const { settings } = useSettings();
  const themePref = settings.theme ?? 'system';
  const isDark =
    themePref === 'system' ? systemScheme === 'dark' : themePref === 'dark';

  const paperTheme = buildPaperTheme(isDark);
  const palette = paperTheme.ios.palette;

  // Navigation theme shares the same semantic colors.
  const navBase = isDark ? NavigationDarkTheme : NavigationDefaultTheme;
  const navTheme = {
    ...(navBase as any),
    dark: isDark,
    colors: {
      ...(navBase as any).colors,
      primary: palette.tint,
      background: palette.background,
      card: palette.groupedCard,
      text: palette.label,
      border: palette.separator,
      notification: palette.negative,
    },
  };

  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={navTheme}>{children}</ThemeProvider>
    </PaperProvider>
  );
}

/** Typed access to Paper colors plus our iOS tokens. */
export function useAppTheme(): AppTheme {
  return useTheme<AppTheme>();
}
