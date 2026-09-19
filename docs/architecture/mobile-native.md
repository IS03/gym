# OWNLEVEL — Mobile native

> **Estado:** foundation implementada en Stage 1 / M2
>
> **Última revisión:** 2026-09-19

## Arquitectura vigente

OWNLEVEL mantiene una aplicación y varias superficies:

- **Web/PWA:** la aplicación Next.js existente continúa ejecutándose en Vercel con App Router, Server Components, Server Actions, SSR, cookies y Supabase Auth.
- **iOS:** un bundle React client-only local se compila con Vite y se empaqueta dentro del proyecto oficial de Capacitor.
- **Datos:** Supabase seguirá siendo la única fuente de verdad cuando una superficie móvil real se implemente en etapas posteriores.

La aplicación iOS no usa `server.url` ni `allowNavigation` para cargar `ownlevel.fit`. El runtime productivo de Capacitor siempre parte del bundle local definido por `webDir: "mobile-dist"`.

M2 sólo demuestra el recorrido React local → Capacitor → proyecto iOS. No contiene autenticación, datos reales, Mobile API, capability bridge ni plugins nativos de producto.

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `mobile/` | Entry point React client-only, estilos y configuración de Vite/TypeScript |
| `mobile-dist/` | Build generado y no versionado que consume Capacitor |
| `capacitor.config.ts` | Identidad de la app y `webDir`; no contiene runtime remoto |
| `ios/` | Proyecto iOS oficial, versionado y administrado por Capacitor/Xcode |

El bundle móvil es deliberadamente independiente de `src/app`: no intenta exportar Next.js ni ejecutar RSC o Server Actions dentro del dispositivo.

## Comandos

Requisitos locales: Node.js 22 o posterior. Para compilar iOS se requiere macOS con Xcode 26 o posterior; Capacitor 8 usa Swift Package Manager por defecto.

```bash
npm install
npm run mobile:dev
npm run mobile:build
npm run mobile:sync
npm run mobile:open:ios
```

- `mobile:dev` sirve únicamente la superficie React temporal en el navegador.
- `mobile:build` valida su TypeScript y genera `mobile-dist/`.
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
7. comprobar que se muestran `OWNLEVEL`, `Native foundation`, `iOS shell ready`, runtime `native` y platform `ios`.

Un Apple ID con Personal Team permite la prueba local gratuita. TestFlight y distribución requieren Apple Developer Program y quedan fuera de M2.

## Límites actuales y próximos pasos

- **M3:** Auth nativo y deep links.
- **M4:** capability bridge y contrato de versionado.
- **M5:** Haptics y QA de dispositivo.

Hasta completar esas etapas, el shell no accede a cuentas ni datos de OWNLEVEL y no representa una alternativa funcional a la Web/PWA.
