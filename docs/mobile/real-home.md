# OWNLEVEL Mobile — Real Native Home

> **Estado:** M2 implementado técnicamente; cierre sujeto a QA físico en iPhone.
>
> **Baseline:** `5239af32c2f0f59ea2b6b3b1dbaded51b05aeb4d`.

## Parity Packet

| Elemento | Referencia |
| --- | --- |
| Web | `/home` |
| Expo | `/(tabs)/home` |
| Web source | `src/components/home/home-dashboard.tsx` |
| Mobile source | `apps/mobile/src/home/home-screen.tsx` y `home-dashboard.tsx` |
| Endpoint | `GET /api/mobile/v1/home` |
| Contrato canónico | `src/lib/mobile-api/contracts.ts` |
| Parser Mobile | `apps/mobile/src/api/home.ts` |

La paridad es informativa y de comportamiento, no de markup. Mobile conserva la jerarquía Home de Web —identidad, entrenamiento principal, Nutrición, semana y sesiones de hoy— en una composición de una columna, touch-first y con navegación nativa.

## Contrato Home aditivo

M2 agrega sin alterar los campos existentes:

- `training.week.data.summary.routines`;
- `training.week.data.summary.muscleGroups`;
- `training.workoutStartRoutines`, con `id`, `name`, `color`, `exerciseCount` y `setCount`.

Las rutinas se leen server-side mediante `listWorkoutStartRoutines(auth)`. Conservan Bearer, identidad derivada del token, RLS y un estado `unavailable` independiente. No se incorporan mutations ni cambios de schema.

El servidor actual siempre emite los campos M2. En el contrato TypeScript canónico permanecen opcionales para conservar compatibilidad de fuente con el cliente Capacitor v1 congelado; el parser Expo M2 los exige y valida en runtime.

## Estados y refresh

Home hace una sola lectura con `fetchMobileHome` y `useApiResource`:

- skeleton estructural durante la primera carga;
- `RefreshControl` para pull-to-refresh;
- refresh al volver a foreground;
- dedupe de lecturas solapadas;
- último dato confirmado visible y marcado como stale si un refresh falla;
- estado unavailable general únicamente cuando nunca hubo data confirmada;
- unavailable parcial para Profile, Nutrition, active session y week.

Null, zero, vacío y unavailable mantienen semánticas diferentes. La fecha lógica viene del backend; horarios de sesión se presentan para `America/Argentina/Cordoba`.

## Navegación real

M2 sólo enlaza destinos existentes:

- Entrenar → tab `/(tabs)/train`;
- Nutrición → tab `/(tabs)/nutrition`;
- Progreso → tab `/(tabs)/progress`;
- perfil/Ajustes → `/settings`.

Una sesión activa o completada lleva temporalmente a Entrenar. No se crean pantallas falsas ni deep links muertos.

## Deuda de paridad intencional

| Capacidad | Milestone previsto |
| --- | --- |
| Inicio real de workout | M3.2 |
| Detalle/editor de sesión activa | M3.3 |
| Shortcut profundo a Rutinas | M3 |
| Body | M5 |
| Calendar | M6 |
| Daily History | M6 |
| Reportes profundos | M7 |

Home debe reemplazar los destinos temporales sólo cuando las rutas reales existan.

## Visual y accesibilidad

La card violeta de Training es el ancla de marca. Nutrición concentra sus métricas en una superficie, la semana usa siete estados accesibles sin charts pesados y las sesiones aparecen sólo cuando existen. Tokens, surfaces elevadas, iconografía Expo oficial y primitives pequeñas quedan reutilizables para dominios futuros.

Los controles mantienen 44 puntos mínimos, labels explícitos, progressbars con valor accesible, estados semánticos que no dependen sólo de color, Dynamic Type y temas light/dark/system.

## Diagnostics

Settings → API Diagnostics se conserva temporalmente en development para aislar problemas del runtime HTTP. Sólo solicita Home cuando el usuario abre esa pantalla; no duplica la lectura mientras Home está visible.

## QA físico iPhone

Comparar `/home` Web/PWA con el tab Inicio usando la misma cuenta y fecha lógica. Verificar Profile, Nutrition, sesión activa, semana, rutinas, músculos y sesiones de hoy; luego pull-to-refresh, background/foreground, offline/recovery y los tres modos de theme. El CTA de Training debe abrir el tab real y nunca una sesión placeholder.

QA físico Android permanece diferido; CNG, Metro, tipos y tests cubren técnicamente ambos targets.
