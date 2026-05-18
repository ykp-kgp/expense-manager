import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '@/theme';
import { DbProvider, useDb } from '@/lib/db-context';
import { SettingsProvider } from '@/lib/settings-context';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { materializeRecurring } from '@/lib/recurring';
import { ensureAndroidChannel } from '@/lib/notifications';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DbProvider>
          <SettingsProvider>
            <AuthProvider>
              <AppThemeProvider>
                <RootGate />
              </AppThemeProvider>
            </AuthProvider>
          </SettingsProvider>
        </DbProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootGate() {
  const { ready: dbReady } = useDb();
  const { isReady, pinSet, unlocked } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!dbReady) return;
    ensureAndroidChannel().catch(() => undefined);
    materializeRecurring().catch(() => undefined);
  }, [dbReady]);

  useEffect(() => {
    if (!dbReady || !isReady) return;
    const segs = segments as readonly string[];
    const seg0 = segs[0];
    const seg1 = segs[1];
    const inAuthGroup = seg0 === '(auth)';
    if (!pinSet) {
      if (seg0 !== '(auth)' || seg1 !== 'onboarding') {
        router.replace('/(auth)/onboarding');
      }
      return;
    }
    if (!unlocked) {
      if (seg0 !== '(auth)' || seg1 !== 'lock') {
        router.replace('/(auth)/lock');
      }
      return;
    }
    if (inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [dbReady, isReady, pinSet, unlocked, segments, router]);

  if (!dbReady || !isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen
          name="modal/add-expense"
          options={{ presentation: 'modal', headerShown: true, title: 'Add Expense' }}
        />
        <Stack.Screen
          name="settings/budgets"
          options={{ headerShown: true, title: 'Budgets' }}
        />
        <Stack.Screen
          name="settings/recurring"
          options={{ headerShown: true, title: 'Recurring Expenses' }}
        />
        <Stack.Screen
          name="settings/recurring-edit"
          options={{ headerShown: true, title: 'Recurring' }}
        />
        <Stack.Screen
          name="settings/backup"
          options={{ headerShown: true, title: 'Backup & Restore' }}
        />
        <Stack.Screen
          name="settings/categories"
          options={{ headerShown: true, title: 'Categories' }}
        />
        <Stack.Screen
          name="settings/about"
          options={{ headerShown: true, title: 'About & Privacy' }}
        />
      </Stack>
    </>
  );
}
