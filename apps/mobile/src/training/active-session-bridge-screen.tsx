import { useCallback } from 'react';
import { RefreshControl, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { fetchMobileTraining, useApiResource, useMobileApi } from '@/api';
import { AppText, Button, Heading, ScrollScreen, SkeletonBlock, Surface, UnavailableState, spacing, useOwnlevelTheme } from '@/design-system';

import { formatTrainingDate, monthForDate } from './calendar';

export function ActiveSessionBridgeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { client } = useMobileApi();
  const { colors } = useOwnlevelTheme();
  const load = useCallback((signal: AbortSignal) => client
    ? fetchMobileTraining(client, monthForDate(new Date()), signal)
    : Promise.resolve({ status: 'unavailable' as const, reason: 'invalid_response' as const,
      meta: { durationMs: 0, httpStatus: null, outcome: 'unavailable' as const } }), [client]);
  const { refresh, state } = useApiResource(load);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const returnToTraining = () => router.replace('/(tabs)/train');

  if (state.status === 'loading') return (
    <ScrollScreen testID="session-bridge-loading">
      <SkeletonBlock height={32} width="58%" />
      <SkeletonBlock height={110} />
    </ScrollScreen>
  );

  const active = state.status === 'ready' ? state.current.data.activeSession : null;
  if (!active || active.status === 'unavailable') return (
    <ScrollScreen testID="session-bridge-unavailable">
      <UnavailableState
        action={<Button label="Reintentar" onPress={() => void refresh()} />}
        description="No pudimos verificar si la sesión sigue en curso."
        title="Sesión no disponible"
      />
    </ScrollScreen>
  );
  if (!active.data) return (
    <ScrollScreen testID="session-bridge-inactive">
      <UnavailableState
        action={<Button label="Volver a Entrenar" onPress={returnToTraining} />}
        description="Esta sesión ya no está en curso."
        title="Sin sesión en curso"
      />
    </ScrollScreen>
  );

  const session = active.data;
  const matches = session.id === id;
  return (
    <ScrollScreen
      refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={state.status === 'ready' && state.refreshing} tintColor={colors.primary} />}
      testID={matches ? 'session-bridge-active' : 'session-bridge-different'}
    >
      <View style={{ gap: spacing.md }}>
        <Heading>Sesión en curso</Heading>
        {!matches ? <Surface><AppText variant="label">Hay otra sesión activa</AppText><AppText muted variant="caption">Te mostramos la sesión que está en curso ahora.</AppText></Surface> : null}
        <Surface elevated style={{ gap: spacing.md }}>
          <AppText variant="heading">{session.name}</AppText>
          <AppText muted>Iniciada {formatTrainingDate(session.logDate)}</AppText>
          {matches ? <AppText muted variant="caption">La sesión ya está creada. El registro de series se incorpora en el próximo paso.</AppText> : null}
        </Surface>
        {matches ? <Button label="Volver a Entrenar" onPress={returnToTraining} variant="secondary" /> :
          <Button label="Continuar sesión actual" onPress={() => router.replace(`/(tabs)/train/session/${session.id}`)} />}
      </View>
    </ScrollScreen>
  );
}
