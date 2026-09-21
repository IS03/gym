# OWNLEVEL Mobile

Cliente definitivo React Native + Expo. Este proyecto tiene `package.json`, lock y dependencias propios; no es un npm workspace y no comparte React con la Web.

## Configuración local

Copiar `.env.example` a `.env.local` y completar solamente la configuración pública del proyecto `gym`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_OWNLEVEL_API_URL=https://www.ownlevel.fit
EXPO_PUBLIC_APP_ENV=development
```

No usar variables `NEXT_PUBLIC_*`, `service_role` ni secret keys. En Supabase Auth debe estar permitida, además de las URLs Web existentes, la redirect URL exacta `ownlevel-dev://auth/callback`.

```bash
# Desde la raíz del repo
npm --prefix apps/mobile ci
npm --prefix apps/mobile start

# Development builds locales
npm --prefix apps/mobile run ios -- --device
npm --prefix apps/mobile run android

# Validación
npm --prefix apps/mobile run validate
```

El development build usa el scheme `ownlevel-dev`. Para probar Auth hay que arrancar Metro para dev client y abrir el build instalado, no Expo Go.

La arquitectura y el procedimiento de QA están documentados en:

- [`../../docs/mobile/native-auth.md`](../../docs/mobile/native-auth.md)
- [`../../docs/mobile/mobile-api-runtime.md`](../../docs/mobile/mobile-api-runtime.md)

En development, Settings → API Diagnostics prueba temporalmente el recorrido autenticado a `/api/mobile/v1/home` sin mostrar el payload.

`mobile/` e `ios/` en la raíz son el cliente Capacitor legacy. `apps/mobile/` es el cliente Expo definitivo.
