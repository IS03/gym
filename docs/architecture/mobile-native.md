# OWNLEVEL — Mobile native

> **Estado:** Stage 1 / M6 implementado; cierre sujeto a QA físico de paridad de datos
>
> **Última revisión:** 2026-09-19

## Arquitectura vigente

OWNLEVEL mantiene una aplicación y varias superficies:

- **Web/PWA:** la aplicación Next.js existente continúa ejecutándose en Vercel con App Router, Server Components, Server Actions, SSR, cookies y Supabase Auth.
- **iOS:** un bundle React client-only local se compila con Vite y se empaqueta dentro del proyecto oficial de Capacitor. Su autenticación usa un cliente Supabase propio, sin cookies ni dependencias del runtime Next.js.
- **Datos:** Supabase seguirá siendo la única fuente de verdad cuando una superficie móvil real se implemente en etapas posteriores.

La aplicación iOS no usa `server.url` ni `allowNavigation` para cargar `ownlevel.fit`. El runtime productivo de Capacitor siempre parte del bundle local definido por `webDir: "mobile-dist"`.

M3 agrega Google OAuth con PKCE, retorno por deep link y persistencia segura de sesión. M4 agrega la frontera propia de capacidades y versiones. M5 incorpora Haptics como primera capability nativa real. M6 agrega la primera lectura real de producto mediante una Mobile API versionada y read-only.

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `mobile/` | Entry point React client-only, estilos y configuración de Vite/TypeScript |
| `mobile/src/auth/` | Cliente Supabase móvil, máquina de estados, validación del callback y adapter de almacenamiento seguro |
| `mobile/src/native/` | Contrato OWNLEVEL para runtime, versiones, capabilities y fallbacks |
| `mobile-dist/` | Build generado y no versionado que consume Capacitor |
| `capacitor.config.ts` | Identidad de la app y `webDir`; no contiene runtime remoto |
| `ios/` | Proyecto iOS oficial, versionado y administrado por Capacitor/Xcode |

El bundle móvil es deliberadamente independiente de `src/app`: no intenta exportar Next.js ni ejecutar RSC o Server Actions dentro del dispositivo.

## Autenticación nativa

El flujo implementado es:

1. el bundle local solicita Google OAuth a Supabase con PKCE y `skipBrowserRedirect`;
2. `@capacitor/browser` abre la URL autorizada en la superficie de navegador de iOS;
3. Supabase retorna a `ownlevel://auth/callback`;
4. `@capacitor/app` recibe el URL tanto con la app abierta como en cold start;
5. el parser acepta exclusivamente scheme `ownlevel`, host `auth` y path `/callback`, y procesa cada código una sola vez;
6. `exchangeCodeForSession` intercambia el código y persiste la sesión en iOS Keychain.

El cliente móvil reutiliza `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` desde el entorno raíz durante el build de Vite. No usa `service_role`, cookies, Proxy, `getClaims()` ni el callback web. El flujo Web/PWA existente permanece separado e intacto.

`@aparajita/capacitor-secure-storage` es el adapter de Auth. En iOS guarda la sesión con Keychain `whenUnlockedThisDeviceOnly`, sin sincronización iCloud y bajo un prefijo exclusivo de OWNLEVEL Auth. La implementación web del plugin no se usa: fuera del runtime nativo el shell emplea memoria efímera, nunca `localStorage`.

La sesión se restaura antes de mostrar login. El refresh automático se activa en foreground y se detiene en background mediante el lifecycle de Capacitor. Los estados son `booting`, `signed_out`, `signing_in`, `authenticated` y `auth_unavailable`: un timeout o fallo de red conserva las credenciales y no se interpreta como logout. Sólo un logout explícito o una sesión inválida confirmada pasa a `signed_out`.

El botón de logout usa `scope: "local"`; elimina la sesión de este cliente sin cerrar las sesiones Safari/PWA del mismo usuario.

## Native Capability Bridge

Los componentes y servicios de producto consultan la frontera OWNLEVEL exportada como `native`; no importan Capacitor ni plugins concretos. El contrato base es independiente de React y expone:

- `native.info()`: snapshot serializable y sin datos privados;
- `native.capability(name)`: estado de una capability conocida o futura; una desconocida devuelve `unavailable`;
- `native.haptics.available()`: disponibilidad funcional;
- `native.haptics.selection()`, `success()` y `warning()`: operaciones semánticas implementadas por el adapter nativo y noops seguros cuando la capability no está disponible.

`NativeInfo` distingue:

| Campo | Valores / fuente | Uso |
| --- | --- | --- |
| `platform` | `web`, `pwa`, `ios` | Superficie real; PWA usa display mode estándar y no user agent |
| `runtime` | `browser`, `capacitor` | Distingue Safari/PWA de la app instalada |
| `appVersion` | `App.getInfo().version` en iOS; `null` en web | Versión de aplicación para diagnóstico y gates globales |
| `buildNumber` | `App.getInfo().build` en iOS; `null` en web | Build nativa concreta |
| `bridgeVersion` | `1` | Versión del contrato bundle React ↔ bridge nativo |
| `capabilities` | Estado individual por capability | Fuente de verdad para habilitar comportamiento |

Los estados posibles son `available`, `unavailable`, `permission_required` y `denied`. `platform: "ios"` no implica disponibilidad. En M5, `haptics` es `available` únicamente cuando el runtime es Capacitor iOS y el plugin oficial está registrado. `notifications`, `health`, `camera` y `photos` continúan `unavailable`.

`bridgeVersion` sólo aumenta cuando cambia el contrato entre el bundle React y las capacidades nativas. No cambia por UI, copy, bugfix web, métricas, backend ni migrations. `appVersion` y `buildNumber` son diagnósticos; el producto nunca debe inferir una capability comparando versiones.

La ausencia de una capability es un fallback admitido: la función principal continúa y el efecto nativo se omite. Un bridge o cliente viejo tampoco debe romper por un nombre desconocido.

## Haptics

M5 integra el plugin oficial `@capacitor/haptics` exclusivamente detrás del Native Capability Bridge. Componentes y lógica de producto no importan el plugin directamente.

| Operación OWNLEVEL | Implementación nativa |
| --- | --- |
| `native.haptics.selection()` | ciclo `selectionStart` → `selectionChanged` → `selectionEnd` |
| `native.haptics.success()` | `notification` con `NotificationType.Success` |
| `native.haptics.warning()` | `notification` con `NotificationType.Warning` |

La disponibilidad combina runtime Capacitor iOS y registro efectivo del plugin mediante `Capacitor.isPluginAvailable("Haptics")`. En Web/PWA, ante plugin ausente o si iOS rechaza el feedback, las operaciones terminan como noops: el feedback háptico es complementario y nunca convierte una acción de producto en error. Esta implementación completa una capability ya declarada y mantiene `bridgeVersion = 1`.

## Compatibilidad y versionado

La Mobile API vive bajo `/api/mobile/v1/*`. M6 activa el contrato HTTP preparado por `createMobileClientHeaders()` en el primer cliente real:

- `X-OWNLEVEL-App-Version`, si existe;
- `X-OWNLEVEL-Build`, si existe;
- `X-OWNLEVEL-Bridge-Version`;
- `X-OWNLEVEL-Platform`.

El cliente HTTP móvil es el único responsable de aplicar esos headers a la Mobile API; no son headers globales, no se envían a Supabase directamente y no autorizan la request. La autorización usa un Bearer separado.

El estado futuro de soporte se expresa como `supported`, `update_recommended` o `update_required`. La decisión vendrá de un contrato versionado del backend, no de una tabla o endpoint anticipado en M4. `update_recommended` permitirá continuar; `update_required` deberá mostrar una pantalla explícita de actualización y nunca degradarse a un error genérico.

Para una app instalada vieja y un backend nuevo, los cambios de DB/API siguen la secuencia permanente:

1. **EXPAND:** agregar contratos opcionales o compatibles;
2. **CLIENTS ADOPT:** publicar y permitir adopción de builds nuevas;
3. **OBSERVE:** comprobar que las builds soportadas dejaron el contrato anterior;
4. **CONTRACT:** retirar sólo cuando ninguna build soportada dependa de él.

No se eliminan campos, DTOs, endpoints, RPCs ni significados que una build todavía soportada pueda utilizar.

## Mobile API v1 y prueba de datos

El primer endpoint real es:

```text
GET /api/mobile/v1/daily-metrics
```

El bundle local obtiene el access token de la sesión Supabase M3 sólo al iniciar la lectura y envía `Authorization: Bearer <token>` a Vercel. El servidor crea un cliente Supabase aislado con la key pública, valida el token con Auth y ejecuta las consultas con ese mismo Bearer. No acepta `userId`, no usa `service_role` y las políticas RLS de `user_metrics` y `daily_metric_values` limitan las filas a `auth.uid()`.

La fecha primaria es `todayInCordoba()`. Si hoy no tiene valores, el endpoint devuelve el último día con métricas registrado hasta hoy; si no existe ninguno devuelve la fecha de hoy con `metrics: []`. La respuesta expone un DTO explícito, no filas Supabase:

```ts
type MobileDailyMetricsResponse = {
  date: string;
  metrics: Array<{
    id: string;
    key: string | null;
    label: string;
    unit: string | null;
    valueType: "integer" | "decimal" | "duration";
    value: number;
  }>;
};
```

Sólo aparecen métricas con un valor real. Una métrica ausente no se convierte en cero; un cero almacenado sí se conserva. `200` con lista vacía significa que la lectura fue válida y no hay valores. `503 DATA_UNAVAILABLE` significa que Auth o datos no pudieron comprobarse por infraestructura, mientras `401 UNAUTHORIZED` representa un Bearer rechazado. Ninguno de esos errores se convierte en datos vacíos.

El endpoint admite CORS exclusivamente para el origen local esperado de Capacitor iOS (`capacitor://localhost`). `NEXT_PUBLIC_OWNLEVEL_API_BASE_URL` permite cambiar el backend para desarrollo; si no se define, el bundle usa el origen canónico `https://www.ownlevel.fit`. Esto no configura `server.url`: React continúa empaquetado localmente y sólo las requests viajan a Vercel.

## Matriz de actualización

| Cambio | Publicación | ¿Nueva build iOS? |
| --- | --- | --- |
| UI web, RSC o Server Actions web | Vercel | No |
| Backend compatible / Mobile API compatible | Vercel | No |
| DB aditiva y compatible | Supabase | No |
| Bundle React local de iOS | Xcode / distribución iOS | Sí, con el modelo actual |
| Plugin nativo | Xcode / distribución iOS | Sí |
| Permiso o entitlement | Xcode / distribución iOS | Sí |
| Swift o configuración nativa | Xcode / distribución iOS | Sí |

M4 no agrega live updates ni Appflow.

## Deep links y configuración manual

El callback de desarrollo registrado en iOS y requerido en Supabase es:

```text
ownlevel://auth/callback
```

Antes del QA físico, agregarlo en **Supabase Dashboard → proyecto gym → Authentication → URL Configuration → Redirect URLs → Add URL**. No cambiar el Site URL ni eliminar el callback web existente.

El custom scheme permite desarrollo con Personal Team, pero no es el contrato final de distribución. El callback de producción previsto es `https://ownlevel.fit/auth/native/callback` mediante Universal Links. Associated Domains, el archivo AASA y la allowlist de ese callback quedan gated hasta preparar distribución con Apple Developer Program; no se agregaron entitlements incompletos en M3.

Sign in with Apple queda pendiente antes de TestFlight externo/App Store, salvo que se confirme una excepción aplicable de App Review 4.8. M3 no lo implementa ni modifica el provider Google actual.

## Comandos

Requisitos locales: Node.js 22 o posterior. Para compilar iOS se requiere macOS con Xcode 26 o posterior; Capacitor 8 usa Swift Package Manager por defecto.

```bash
npm install
npm run mobile:dev
npm run mobile:test
npm run mobile:build
npm run mobile:sync
npm run mobile:open:ios
```

- `mobile:dev` sirve únicamente la superficie React temporal en el navegador.
- `mobile:test` ejecuta únicamente los tests focalizados del cliente Mobile API, Auth y Native Capability Bridge.
- `mobile:build` valida su TypeScript y genera `mobile-dist/`. Requiere en el entorno raíz los mismos valores públicos de Supabase que usa Next.js.
- `mobile:sync` vuelve a compilar y copia el bundle al proyecto iOS, además de sincronizar dependencias nativas.
- `mobile:open:ios` abre el proyecto generado en Xcode y por eso sólo funciona en macOS con Xcode instalado.

## iOS y QA físico

El proyecto generado conserva el deployment target oficial de Capacitor 8: iOS 15.0. En una Mac:

1. instalar dependencias con `npm install`;
2. ejecutar `npm run mobile:sync`;
3. ejecutar `npm run mobile:open:ios`;
4. en Xcode, seleccionar el target **App**, elegir un Team de firma y conectar el iPhone;
5. activar Developer Mode en el iPhone si iOS lo solicita;
6. seleccionar el dispositivo y pulsar **Run**;
7. comprobar el login Google o la restauración de la sesión M3;
8. verificar el diagnóstico temporal: platform `ios`, runtime `capacitor`, app version, build y bridge `1`;
9. comprobar `haptics: available` y que `notifications`, `health`, `camera` y `photos` permanecen `unavailable`;
10. probar los botones temporales **Selección**, **Éxito** y **Advertencia** y confirmar feedback real sin errores;
11. comparar fecha, etiqueta y valor de una métrica real con Web/PWA; cambiarla en Web/PWA y pulsar **Actualizar** en iOS para verificar el nuevo valor;
12. enviar la app a background, volver y comprobar que sesión, Haptics y la actualización de datos siguen operativos;
13. cerrar sesión y comprobar que Safari/PWA conserva su propia sesión.

Un Apple ID con Personal Team permite la prueba local gratuita. TestFlight y distribución requieren Apple Developer Program y quedan fuera de M2.

## Cierre de Stage 1

La foundation ya demuestra bundle React local, proyecto iOS reproducible, identidad Supabase compartida, sesión segura, deep links, contrato de capabilities/versiones y el recorrido React → bridge OWNLEVEL → plugin oficial de Haptics. M6 suma el recorrido access token nativo → Mobile API v1 → RLS → datos canónicos → DTO → shell iOS.

El cierre requiere comparar físicamente una fecha, etiqueta y valor real de métricas en Web/PWA contra el resultado del shell iOS, y repetir después de actualizar el valor desde Web/PWA y pulsar **Actualizar** en iOS. No se marca paridad antes de esa evidencia.

Una vez aprobado ese MATCH, Stage 1 queda cerrable: la prueba es deliberadamente read-only y no implica que exista todavía una pantalla móvil de producto ni paridad funcional completa.
