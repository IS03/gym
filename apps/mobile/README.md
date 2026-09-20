# OWNLEVEL Mobile

Cliente definitivo React Native + Expo. Este proyecto tiene `package.json`, lock y dependencias propios; no es un npm workspace y no comparte React con la Web.

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

`mobile/` e `ios/` en la raíz son el cliente Capacitor legacy. `apps/mobile/` es el cliente Expo definitivo.
