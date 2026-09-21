# OWNLEVEL Mobile — Native Auth

> **Estado:** M1.2 implementado técnicamente; QA físico iPhone pendiente.
>
> **Cliente:** React Native + Expo SDK 57 en `apps/mobile/`.

## Límite de arquitectura

Mobile y Web/PWA autentican contra el mismo proyecto Supabase, pero son clientes independientes:

| Cliente | Sesión | OAuth callback | Logout |
| --- | --- | --- | --- |
| Web/PWA | cookies + SSR | callback HTTPS Web existente | sesión Web |
| Expo development | SecureStore + Supabase JS | `ownlevel-dev://auth/callback` | `scope: "local"` |

Mobile no lee cookies OWNLEVEL, no usa el callback Web y no contiene una clave `service_role`. El bearer de esta sesión se usará recién en la futura Mobile API.

## Configuración pública

Crear `apps/mobile/.env.local` a partir de `.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Son valores públicos de cliente, no secretos. Los archivos `.env` locales están ignorados. Nunca deben agregarse `NEXT_PUBLIC_*`, `SUPABASE_SECRET_KEY` ni `service_role` al bundle Mobile.

En el proyecto Supabase `gym`, agregar exactamente `ownlevel-dev://auth/callback` en **Authentication → URL Configuration → Redirect URLs**. No reemplazar Site URL ni borrar callbacks Web existentes.

## Cliente y persistencia

`src/auth/client.ts` crea un único cliente lazy con:

- `flowType: "pkce"`;
- `autoRefreshToken: true`;
- `persistSession: true`;
- `detectSessionInUrl: false`;
- storage key propia de OWNLEVEL Mobile.

`src/auth/storage.ts` adapta directamente `expo-secure-store`, el patrón oficial actual para Expo. En iOS usa Keychain con `WHEN_UNLOCKED_THIS_DEVICE_ONLY` y un service aislado para `fit.ownlevel.app.dev`. Los rechazos del storage se propagan a la máquina de Auth; no hay fallback inseguro a AsyncStorage ni almacenamiento plano.

## Google OAuth y callback

1. Supabase genera la autorización Google con PKCE, `skipBrowserRedirect: true` y callback nativo.
2. `expo-web-browser` abre la sesión del sistema; no se usa una WebView propia.
3. El callback puede llegar como resultado del browser, ruta Expo Router o cold start.
4. El parser sólo acepta scheme `ownlevel-dev`, host `auth`, path `/callback` y parámetros OAuth esperados.
5. Un gate deduplica por `sb_flow_id` cuando existe o por code como fallback.
6. `exchangeCodeForSession` completa y persiste la sesión.

Los product links futuros viven bajo `ownlevel-dev://app/...` y no son consumidos por el parser Auth. Nunca registrar tokens, sesión, PKCE code ni URL OAuth completa.

## Estado y restore

La máquina distingue `BOOTSTRAPPING`, `SIGNED_OUT`, `SIGNING_IN`, `SIGNED_IN` y `TRANSIENT_ERROR`. El splash permanece hasta resolver bootstrap para evitar un flash falso de login.

En restore se recupera primero la sesión local y luego se confirma con Supabase Auth mediante `getUser()`. Una ausencia o invalidez confirmada produce signed out y limpia localmente. Timeout, red caída o backend temporalmente inaccesible producen `TRANSIENT_ERROR`; si había sesión local, se conserva y el shell sigue protegido con esa sesión. Un error transitorio aislado nunca borra SecureStore.

## Lifecycle y logout

`AppState` inicia `startAutoRefresh()` al entrar en `active` y ejecuta `stopAutoRefresh()` en background/inactive. No existen timers propios. Al volver al foreground se reintenta un restore que estuviera en error transitorio.

Logout usa `supabase.auth.signOut({ scope: "local" })`. Esto elimina la sesión del cliente Mobile sin cerrar Safari ni OWNLEVEL Web/PWA.

## Navegación protegida

El Root Stack usa `Stack.Protected` de Expo Router. Sin sesión sólo están disponibles `(auth)` y `auth/callback`; con sesión sólo están disponibles tabs y Settings. Los deep links no pueden saltar el guard. `app/index.tsx` decide el destino inicial una vez terminado bootstrap.

## QA físico iPhone

Preparación:

1. configurar `.env.local`;
2. permitir `ownlevel-dev://auth/callback` en Supabase;
3. instalar/actualizar el development build con `npm --prefix apps/mobile run ios -- --device`;
4. iniciar Metro con `npm --prefix apps/mobile start`.

Validar login Google, retorno warm y cold, force-close/restore, background/foreground, cancelación y retry. Desde Settings validar logout local y comprobar que Safari/PWA continúa autenticada.

## Pendientes deliberados

- Sign in with Apple no pertenece a M1.2; debe resolverse antes de distribución si aplica App Store Review Guideline 4.8.
- QA físico Android está diferido.
- Mobile API y datos de producto no forman parte de esta etapa.
