import { AppText, Button, Heading, LoadingState, Screen, Surface, UnavailableState } from '@/design-system';
import { useMobileAuth } from '@/auth';

export default function SignInScreen() {
  const { retry, signInWithGoogle, state } = useMobileAuth();

  return (
    <Screen centered testID="native-sign-in-screen">
      <Surface>
        <AppText muted variant="overline">
          OWNLEVEL
        </AppText>
        <Heading>Tu nivel, en un solo lugar.</Heading>
        <AppText muted>
          Iniciá sesión con la misma cuenta de Google que usás en OWNLEVEL Web.
        </AppText>

        {state.status === 'BOOTSTRAPPING' ? (
          <LoadingState label="Comprobando sesión" />
        ) : null}

        {state.status === 'SIGNING_IN' ? (
          <>
            <LoadingState label="Iniciando sesión" />
            <Button disabled label="Continuar con Google" onPress={() => undefined} />
          </>
        ) : null}

        {state.status === 'SIGNED_OUT' ? (
          <>
            {state.notice ? <AppText accessibilityRole="alert">{state.notice}</AppText> : null}
            <Button label="Continuar con Google" onPress={() => void signInWithGoogle()} />
          </>
        ) : null}

        {state.status === 'TRANSIENT_ERROR' && !state.session ? (
          <UnavailableState
            action={<Button label="Reintentar" onPress={() => void retry()} variant="secondary" />}
            description={state.message}
            title="Autenticación no disponible"
          />
        ) : null}
      </Surface>
    </Screen>
  );
}
