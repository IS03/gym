# OWNLEVEL Mobile — API Runtime

> **Estado:** M1.3 implementado técnicamente; la prueba física contra Production queda pendiente de QA en iPhone.
>
> **Cliente:** React Native + Expo SDK 57 en `apps/mobile/`.

## Límite de arquitectura

El cliente Expo accede a datos de producto exclusivamente mediante `/api/mobile/v1/*`:

```text
React Native → Mobile API client → Vercel / Next.js → Supabase Auth + RLS → Postgres
```

Supabase JS en Mobile queda reservado para Auth. La UI no consulta tablas directamente, no envía `userId`, no usa cookies Web, Server Actions ni una clave `service_role`. El backend valida cada bearer con Supabase Auth y deriva la identidad del token.

El contrato backend canónico continúa en `src/lib/mobile-api/contracts.ts`. M1.3 mantiene DTOs y parsers runtime pequeños dentro de `apps/mobile/src/api/` para no introducir Next.js ni módulos server-only en Metro. La extracción a un package compartido queda diferida hasta que varios dominios justifiquen el costo.

## Configuración

Crear `apps/mobile/.env.local` a partir de `.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_OWNLEVEL_API_URL=https://www.ownlevel.fit
EXPO_PUBLIC_APP_ENV=development
```

`EXPO_PUBLIC_OWNLEVEL_API_URL` debe ser un origin HTTPS sin path, query, hash ni credenciales. HTTP se permite solamente para `localhost` o `127.0.0.1`; un iPhone físico debe usar un host alcanzable y no `localhost`. `EXPO_PUBLIC_APP_ENV` acepta `development`, `preview` o `production`.

Todas son configuraciones públicas incluidas en el bundle. Nunca agregar tokens, `service_role`, `SUPABASE_SECRET_KEY` ni valores `NEXT_PUBLIC_*`.

## Auth y Bearer

Antes de cada request el boundary pide la sesión actual a la capa Auth M1.2 y usa su `access_token` justo a tiempo:

```http
Authorization: Bearer <supabase_access_token>
Accept: application/json
X-OWNLEVEL-App-Version: <native version, si existe>
X-OWNLEVEL-Build: <native build, si existe>
X-OWNLEVEL-Platform: ios | android
```

No se mantiene una copia paralela del token. `expo-application` obtiene versión y build nativos. Expo no envía `X-OWNLEVEL-Bridge-Version`, porque ese header pertenece al bridge Capacitor legacy.

## Ciclo de request y resultados

El cliente central recibe `method`, `path`, `body` opcional, parser runtime y `AbortSignal` opcional. Centraliza URL, JSON, headers, timeout y status mapping.

Reads:

- `ok`: respuesta HTTP válida y contrato runtime válido;
- `auth_required`: no existe una sesión local;
- `unauthorized`: el backend rechazó el bearer y Auth confirmó invalidez o no produjo un token distinto;
- `unavailable`: `network`, `timeout`, `server`, `invalid_response`, `auth` o abort solicitado.

Mutations futuras agregan `validation` y `not_found`. `200 + []` y un `null` permitido por el parser son datos confirmados; un timeout, 503 o JSON corrupto nunca se convierte en contenido vacío. Missing, null, zero y unavailable conservan significados distintos.

## 401 y retry policy

Un 401 no ejecuta logout ni limpia SecureStore desde la capa HTTP. Auth compara el bearer rechazado con la sesión actual y, si todavía coincide, intenta `refreshSession()` una vez:

- token realmente renovado: un GET puede repetirse una única vez con el nuevo bearer;
- sesión confirmada inválida: Auth realiza sign-out local y el gate vuelve a Sign In;
- fallo transitorio al revalidar: el resultado es `unavailable/auth` y se conserva la sesión;
- token sin cambio: se conserva `unauthorized` y no se crea un loop.

POST, PATCH, PUT y DELETE nunca se reintentan automáticamente. Los writes de producto deberán definir idempotencia de forma explícita cuando corresponda.

## Timeout y cancelación

El timeout central actual es 15 segundos. Cada request usa un `AbortController` interno y también respeta la señal del caller. El wrapper termina aunque una implementación de fetch no responda correctamente al abort. `timeout` y `aborted` se distinguen para diagnóstico; no hay retries genéricos, polling ni realtime.

## Resource refresh

`ApiResourceController` y `useApiResource` proveen:

- carga inicial;
- Refresh manual;
- refresh al pasar de background/inactive a foreground;
- dedupe de requests simultáneas;
- cancelación al desmontar;
- conservación explícita del último dato confirmado como stale si el refresh falla.

Un dato stale conserva su fecha de confirmación y nunca se presenta como respuesta recién validada.

## Runtime validation

El JSON remoto se valida antes de llegar a UI. `home.ts` implementa el parser completo del DTO Mobile Home usado por `/api/mobile/v1/home`, incluidos estados parciales `ok`/`unavailable`, nullables, ceros y arrays vacíos. Un payload malformado produce `unavailable/invalid_response` sin hacer crash.

## Observabilidad

La frontera actual registra sólo en development:

- método y path sin query;
- HTTP status, duración y outcome;
- plataforma, app version/build y app env.

No registra headers, bearer, sesión, response body, payload de writes, OAuth code, email ni user id. La interfaz queda reemplazable por telemetry futura sin integrar un SaaS en M1.3.

## Diagnostics temporal

Settings muestra `API Diagnostics` sólo en development. La pantalla ejecuta `GET /api/mobile/v1/home` y presenta host, environment, plataforma, Auth yes/no, state, outcome, HTTP status, duración y fecha contractual. No muestra el payload ni datos privados. Incluye Refresh manual y refresh al volver a foreground.

Esta superficie se elimina cuando M2 conecte Home real.

## QA físico iPhone

```bash
# Desde la raíz del repo
npm --prefix apps/mobile ci
npm --prefix apps/mobile run ios -- --device
npm --prefix apps/mobile start -- --dev-client --clear
```

Con una sesión M1.2 válida, abrir Settings → API Diagnostics y comprobar `ok`, HTTP 200 y Home date. Probar Refresh, background/foreground, force-close/reopen y una interrupción breve de red. Sin red debe verse unavailable sin logout; al recuperarla, Refresh debe volver a `ok`.

## Android

CNG, Metro, tipos y tests validan ambos targets. El código usa `Platform` únicamente para emitir `ios` o `android` y no incorpora APIs iOS-only. QA físico Android continúa diferido.
