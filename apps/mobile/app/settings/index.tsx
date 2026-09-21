import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { useMobileAuth } from '@/auth';
import {
  AppText,
  Button,
  Heading,
  Row,
  ScrollScreen,
  Separator,
  Surface,
  type ThemeMode,
  useOwnlevelTheme,
} from '@/design-system';

const themeOptions: { label: string; value: ThemeMode }[] = [
  { label: 'Sistema', value: 'system' },
  { label: 'Claro', value: 'light' },
  { label: 'Oscuro', value: 'dark' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, mode, resolvedMode, setMode } = useOwnlevelTheme();
  const { session, signOut, state } = useMobileAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
  }

  return (
    <ScrollScreen>
      <Surface>
        <Heading level={2}>Tema</Heading>
        <AppText muted>La preferencia no se persiste todavía; eso pertenece a Settings real.</AppText>
        <Row>
          {themeOptions.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              onPress={() => setMode(option.value)}
              variant={mode === option.value ? 'primary' : 'secondary'}
            />
          ))}
        </Row>
        <AppText muted variant="caption">
          Modo efectivo: {resolvedMode === 'dark' ? 'oscuro' : 'claro'}
        </AppText>
      </Surface>
      <Separator />
      <Surface>
        <Heading level={2}>Runtime</Heading>
        <AppText>OWNLEVEL Dev {Constants.expoConfig?.version ?? '0.1.0'}</AppText>
        <AppText muted variant="caption">
          {Platform.OS} · Expo SDK {Constants.expoConfig?.sdkVersion ?? '57'}
        </AppText>
        {__DEV__ ? (
          <Button
            label="API Diagnostics"
            onPress={() => router.push('/settings/diagnostics')}
            variant="secondary"
          />
        ) : null}
      </Surface>
      <Separator />
      <Surface>
        <Heading level={2}>Cuenta</Heading>
        <AppText>{session?.user.email ?? 'Cuenta Google conectada'}</AppText>
        {state.status === 'TRANSIENT_ERROR' && state.session ? (
          <AppText accessibilityRole="alert" style={{ color: colors.warning }}>
            No pudimos verificar la sesión en este momento. La sesión local se conservó.
          </AppText>
        ) : null}
        <Button
          disabled={isSigningOut}
          label={isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión en este dispositivo'}
          onPress={() => void handleSignOut()}
          variant="secondary"
        />
        <AppText muted variant="caption">
          Esto no cierra tu sesión en Safari ni en OWNLEVEL Web/PWA.
        </AppText>
      </Surface>
    </ScrollScreen>
  );
}
