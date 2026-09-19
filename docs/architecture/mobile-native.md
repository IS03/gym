# OWNLEVEL — Mobile native

> **Estado:** shell iOS y autenticación nativa implementados hasta Stage 1 / M3
>
> **Última revisión:** 2026-09-19

## Arquitectura vigente

OWNLEVEL mantiene una aplicación y varias superficies:

- **Web/PWA:** la aplicación Next.js existente continúa ejecutándose en Vercel con App Router, Server Components, Server Actions, SSR, cookies y Supabase Auth.
- **iOS:** un bundle React client-only local se compila con Vite y se empaqueta dentro del proyecto oficial de Capacitor. Su autenticación usa un cliente Supabase propio, sin cookies ni dependencias del runtime Next.js.
- **Datos:** Supabase seguirá siendo la única fuente de verdad cuando una superficie móvil real se implemente en etapas posteriores.

La aplicación iOS no usa `server.url` ni `allowNavigation` para cargar `ownlevel.fit`. El runtime productivo de Capacitor siempre parte del bundle local definido por `webDir: "mobile-dist"`.

M3 agrega Google OAuth con PKCE, retorno por deep link y persistencia segura de sesión. Todavía no contiene datos de producto, Mobile API, capability bridge ni plugins nativos de producto.

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `mobile/` | Entry point React client-only, estilos y configuración de Vite/TypeScript |
| `mobile/src/auth/` | Cliente Supabase móvil, máquina de estados, validación del callback y adapter de almacenamiento seguro |
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
- `mobile:test` ejecuta únicamente los tests del contrato Auth nativo.
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
7. comprobar el login Google, el retorno a OWNLEVEL y el estado `Sesión activa`;
8. cerrar y reabrir la app para verificar la restauración desde Keychain;
9. cerrar sesión y comprobar que Safari/PWA conserva su propia sesión.

Un Apple ID con Personal Team permite la prueba local gratuita. TestFlight y distribución requieren Apple Developer Program y quedan fuera de M2.

## Límites actuales y próximos pasos

- **M4:** capability bridge y contrato de versionado.
- **M5:** Haptics y QA de dispositivo.

Hasta completar esas etapas, el shell autentica una cuenta real de OWNLEVEL pero no consulta datos de producto y no representa una alternativa funcional a la Web/PWA.
