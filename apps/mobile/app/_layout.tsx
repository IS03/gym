import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OwnlevelThemeProvider, useOwnlevelTheme } from '@/design-system';
import { useStackScreenOptions } from '@/navigation/use-stack-screen-options';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Fast refresh can call this after the native splash has already been handled.
});

function RootNavigator() {
  const { colors, isDark } = useOwnlevelTheme();
  const screenOptions = useStackScreenOptions();
  const navigationTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.background,
        border: colors.border,
        card: colors.surface,
        primary: colors.primary,
        text: colors.text,
      },
    }),
    [colors, isDark],
  );

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {
      // System chrome theming is best-effort on unsupported targets.
    });
  }, [colors.background]);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {
      // The splash may already be hidden during fast refresh.
    });
  }, []);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Ajustes' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <OwnlevelThemeProvider>
        <RootNavigator />
      </OwnlevelThemeProvider>
    </SafeAreaProvider>
  );
}
