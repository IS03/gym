import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { useMobileApi } from '@/api';
import { useMobileAuth } from '@/auth';
import {
  AppText, Button, Heading, ListGroup, ListRow, Row, ScrollScreen, SectionHeader, SegmentedControl, Surface, TextField,
  spacing, type ThemeMode, useOwnlevelTheme,
} from '@/design-system';
import { useNutritionConfiguration } from '@/nutrition/config-provider';
import { useHapticsPreference } from '@/platform/haptics';
import { useDisplayNameController } from './use-display-name-controller';
import type { DisplayNameController, DisplayNameState } from './display-name-controller';

const themeOptions: { label: string; value: ThemeMode }[] = [
  { label: 'Sistema', value: 'system' },
  { label: 'Claro', value: 'light' },
  { label: 'Oscuro', value: 'dark' },
];

/** "Versión X (build Y)" from the native binary; Expo config only as fallback. */
export function appVersionLabel(): string {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null;
  const build = Application.nativeBuildVersion;
  if (!version) return 'Versión no disponible';
  return build ? `Versión ${version} (build ${build})` : `Versión ${version}`;
}

function ProfileCard({ email, name }: { email: string | null; name: { controller: DisplayNameController; state: DisplayNameState } | null }) {
  const state = name?.state, controller = name?.controller;
  const identity = state?.read.identity ?? null;
  const editor = state?.editor ?? null;
  const pending = state?.phase === 'pending';
  const locked = !!state && (state.phase !== 'idle' || !!state.intent);
  const cancel = () => {
    if (!controller || pending) return;
    if (controller.dirty() && !state?.intent) {
      Alert.alert('¿Descartar cambios?', 'Tu nombre todavía no está guardado.', [
        { text: 'Seguir editando', style: 'cancel' }, { text: 'Descartar', style: 'destructive', onPress: () => controller.close() }]);
    } else controller.close();
  };
  return <Surface testID="settings-profile-card">
    {state?.read.status === 'unavailable'
      ? <AppText accessibilityRole="alert">No pudimos cargar tu nombre.</AppText>
      : !identity ? <AppText muted>Cargando perfil…</AppText>
      : <Heading level={2}>{identity.displayName ?? 'Sin nombre'}</Heading>}
    {state?.read.stale ? <AppText muted variant="caption">No pudimos actualizar. Mostramos la última lectura.</AppText> : null}
    <AppText muted>{email ?? 'Email no disponible'}</AppText>
    {state?.read.status === 'unavailable' ? <Button label="Reintentar" variant="secondary" onPress={() => void controller?.load()} /> : null}
    {editor ? <View style={styles.editor} testID="display-name-editor">
      <TextField label="Cómo querés que te llamemos" value={editor.draft} disabled={locked} placeholder="Ej: Nacho"
        onChangeText={value => controller?.change(value)} autoCapitalize="words" />
      {!locked ? <Row><Button label="Guardar nombre" onPress={() => void controller?.save()} /><Button label="Cancelar" variant="quiet" onPress={cancel} /></Row> : null}
    </View>
      : identity && state?.phase === 'idle' && !state.intent ? <Button label="Editar nombre" variant="secondary" onPress={() => controller?.open()} /> : null}
    {pending ? <AppText muted>Guardando nombre…</AppText> : null}
    {state?.message ? <AppText accessibilityRole="alert">{state.message}</AppText> : null}
    {state?.notice ? <AppText accessibilityRole="alert">{state.notice}</AppText> : null}
    {state?.phase === 'conflict' ? <View style={styles.editor}>
      <AppText variant="label">{`Valor actual: ${identity ? identity.displayName ?? 'Sin nombre' : 'sin lectura'}`}</AppText>
      <Button label="Actualizar valor actual" variant="secondary" onPress={() => void controller?.load()} />
      <Button label="Revisar mi borrador con este valor" disabled={!identity || state.read.stale} onPress={() => controller?.reviewTruth()} />
      <Button label="Descartar borrador" variant="quiet" onPress={() => controller?.close()} />
    </View> : null}
    {state && ['uncertain', 'confirmed', 'blocked'].includes(state.phase)
      ? <Button label={state.intent?.receipt ? 'Actualizar lectura confirmada' : 'Comprobar intento guardado'} onPress={() => void controller?.recover()} /> : null}
  </Surface>;
}

export function SettingsScreen() {
  const router = useRouter();
  const { client, config: apiConfig } = useMobileApi();
  const { colors, mode, resolvedMode, setMode, persistenceFailed } = useOwnlevelTheme();
  const { session, signOut, state: authState } = useMobileAuth();
  const vibration = useHapticsPreference();
  const userId = session?.user.id ?? 'anonymous';
  const name = useDisplayNameController(session ? client : null, userId);
  const configuration = useNutritionConfiguration();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const configState = configuration?.state;
  const configAvailable = !!configuration && configState?.phase === 'idle' && !configState.intent;
  const google = session?.user.app_metadata?.provider === 'google';

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
  }

  return <ScrollScreen testID="settings-screen">
    <ProfileCard email={session?.user.email ?? null} name={name} />

    <SectionHeader title="Perfil y plan" />
    <ListGroup>
      <ListRow title="Perfil físico" subtitle="Nacimiento, sexo, altura y peso" accessibilityHint="Nacimiento, sexo, altura y peso"
        disabled={!configAvailable} onPress={() => configuration?.controller.open('physical')} />
      <ListRow title="Plan nutricional" subtitle="Plan, energía y datos físicos desde hoy" accessibilityHint="Plan, energía y datos físicos desde hoy"
        disabled={!configAvailable} onPress={() => configuration?.controller.open()} />
      <ListRow title="Métricas diarias" subtitle="Qué querés registrar cada día" accessibilityHint="Qué querés registrar cada día"
        onPress={() => router.push('/settings/metrics')} />
    </ListGroup>
    {configState?.message && !configState.open ? <Surface>
      <AppText accessibilityRole="alert">{configState.message}</AppText>
      {configState.intent ? <Button label="Revisar intento de configuración" onPress={() => configuration?.controller.showRecovery()} /> : null}
      {configState.phase === 'blocked' ? <Button label="Comprobar almacenamiento de configuración" onPress={() => void configuration?.controller.recover()} /> : null}
    </Surface> : null}

    <SectionHeader title="Preferencias" />
    <Surface>
      <Heading level={2}>Tema</Heading>
      <SegmentedControl accessibilityLabel="Tema" options={themeOptions} value={mode} onChange={setMode} />
      {mode === 'system' ? <AppText muted variant="caption">{`Usando el tema ${resolvedMode === 'dark' ? 'oscuro' : 'claro'} del sistema.`}</AppText> : null}
      {persistenceFailed ? <AppText muted variant="caption">No pudimos guardar la preferencia en este dispositivo. Se aplica hasta cerrar la app.</AppText> : null}
    </Surface>
    <Surface>
      <ListRow title="Vibración" subtitle="Respuesta táctil al usar la app." trailing={
        <Switch accessibilityLabel="Vibración" value={vibration.enabled} onValueChange={value => void vibration.setEnabled(value)}
          trackColor={{ false: colors.surfaceRaised, true: colors.primary }} />} />
      {vibration.persistenceFailed ? <AppText muted variant="caption">No pudimos guardar la preferencia en este dispositivo. Se aplica hasta cerrar la app.</AppText> : null}
    </Surface>

    <SectionHeader title="Cuenta" />
    <Surface>
      <AppText variant="label">Cuenta conectada</AppText>
      <AppText>{session?.user.email ?? 'Email no disponible'}</AppText>
      {google ? <AppText muted variant="caption">Ingresás con Google</AppText> : null}
      {authState.status === 'TRANSIENT_ERROR' && authState.session ? (
        <AppText accessibilityRole="alert" style={{ color: colors.text }}>
          No pudimos verificar la sesión en este momento. La sesión local se conservó.
        </AppText>
      ) : null}
      <Button disabled={isSigningOut} label={isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión en este dispositivo'}
        onPress={() => void handleSignOut()} variant="secondary" />
      <AppText muted variant="caption">Esto no cierra tu sesión en Safari ni en OWNLEVEL Web/PWA. Tus datos quedan en tu cuenta.</AppText>
    </Surface>

    <SectionHeader title="Acerca de" />
    <Surface>
      <AppText>{appVersionLabel()}</AppText>
      {apiConfig && apiConfig.appEnv !== 'production' ? <AppText muted variant="caption">{`Entorno: ${apiConfig.appEnv}`}</AppText> : null}
      {__DEV__ ? <Button label="API Diagnostics" onPress={() => router.push('/settings/diagnostics')} variant="secondary" /> : null}
    </Surface>
  </ScrollScreen>;
}

const styles = StyleSheet.create({
  editor: { gap: spacing.sm },
});
