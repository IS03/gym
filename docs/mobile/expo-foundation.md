# OWNLEVEL Mobile — Expo foundation

## Límites del repositorio

- La Web Next.js permanece en la raíz y se instala con `npm ci`.
- React Native + Expo vive en `apps/mobile` y se instala con `npm --prefix apps/mobile ci`.
- Ambos proyectos tienen `package.json`, `package-lock.json` y `node_modules` independientes.
- No hay npm workspaces. La raíz excluye `apps/mobile/**` de TypeScript y ESLint.
- `mobile/`, `ios/` y `capacitor.config.ts` son el cliente Capacitor legacy congelado.

## Desarrollo Mobile

M1.1 usa un development build, no Expo Go, como entorno principal.

```bash
npm --prefix apps/mobile ci
npm --prefix apps/mobile run ios -- --device
npm --prefix apps/mobile start
```

En Android, abrir un emulador desde Android Studio antes de ejecutar:

```bash
npm --prefix apps/mobile run android
```

Los directorios nativos `apps/mobile/ios` y `apps/mobile/android` son generados por Expo CNG y están ignorados. No deben versionarse mientras no exista una necesidad nativa demostrada.

## Validación reproducible

```bash
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile run lint
npm --prefix apps/mobile test
npm --prefix apps/mobile run config:check
```

## Identidad development

- Nombre: `OWNLEVEL Dev`
- iOS bundle identifier: `fit.ownlevel.app.dev`
- Android package: `fit.ownlevel.app.dev`
- Scheme: `ownlevel-dev`

La identidad production `fit.ownlevel.app` queda reservada. El icono y splash actuales son assets de development y requieren revisión final antes del release.

## Native Tabs spike

El spike está encapsulado en `apps/mobile/app/(tabs)/_layout.tsx` y usa `expo-router/unstable-native-tabs`. Si el QA físico revela un bloqueo, el fallback es reemplazar sólo ese layout por Expo Router JavaScript Tabs; la route tree y los stacks internos se mantienen.

## Fuera de M1.1

No hay Supabase Auth, Mobile API, datos reales, variables `EXPO_PUBLIC_*`, EAS, Maestro ni configuración remota de Vercel/Supabase.

Variables previstas para hitos posteriores:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_OWNLEVEL_API_URL`
- `EXPO_PUBLIC_APP_ENV`
