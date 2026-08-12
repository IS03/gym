# OWNLEVEL — Guía de ingeniería

## Objetivo

Estas reglas resumen los criterios técnicos que deben mantenerse al modificar el proyecto.

## Next.js

El repositorio utiliza Next.js `16.2.x`.

Antes de modificar APIs específicas del framework —routing, Server Actions, caching, middleware, rendering o convenciones del App Router— verificar la documentación correspondiente a la versión instalada en:

```text
node_modules/next/dist/docs/
```

No asumir comportamiento de versiones anteriores cuando exista una API local documentada.

## Alcance de los cambios

- Revisar el código actual antes de implementar.
- Reutilizar helpers, componentes y read models existentes.
- Evitar sistemas paralelos para resolver un problema ya modelado.
- No aprovechar una tarea acotada para refactorizar áreas no relacionadas.
- Mantener compatibilidad histórica cuando una migración destructiva no sea necesaria.

## Mobile y responsive

OWNLEVEL es mobile-first.

Para cambios de interfaz relevantes validar como mínimo:

```text
375 px
390 px
430 px
```

También verificar desktop cuando corresponda, sin degradar mobile.

Considerar:

- safe areas de iPhone;
- teclado;
- touch targets;
- overflow horizontal;
- PWA standalone;
- dark/light mode;
- `prefers-reduced-motion`.

## Movimiento

Priorizar animaciones cortas y funcionales con:

- `transform`;
- `opacity`;
- `background-color`;
- `border-color`.

Evitar dependencias pesadas para microinteracciones y no introducir animaciones permanentes sin una razón funcional.

## Fechas

La zona horaria del producto es:

```text
America/Argentina/Cordoba
```

Reutilizar el helper temporal canónico del proyecto.

No derivar fechas lógicas del día mediante UTC si puede cambiar el día local.

## Supabase

- Mantener RLS habilitado.
- Nunca exponer `service_role` en cliente.
- No confiar en `user_id` recibido desde frontend para ownership.
- Preferir operaciones que obtienen el usuario autenticado en servidor/base de datos.
- Crear migraciones solo cuando el esquema realmente deba cambiar.
- Mantener migraciones pequeñas, auditables y reversibles cuando sea posible.
- Revisar constraints, índices y políticas existentes antes de agregar duplicados.

## Historial y snapshots

No reconstruir datos históricos desde plantillas actuales cuando la sesión ya contiene snapshots.

Una modificación de rutina no debe cambiar retrospectivamente:

- nombre histórico;
- ejercicios;
- objetivos;
- orden;
- duración;
- resultados.

## Rendimiento

Evitar:

- N+1 queries;
- requests por pulsación cuando puede usarse debounce/batch;
- recargar una página completa por una mutación local pequeña;
- listeners globales innecesarios;
- dependencias grandes para resolver UI simple.

Preferir lecturas batch y reutilizar datos que ya están disponibles.

## Validación mínima

Antes de integrar un cambio:

```bash
npm test
npm run lint
npm run build
```

Además revisar TypeScript mediante el build o el comando específico que corresponda al trabajo.

Si una tarea toca una interacción sensible, el build no reemplaza QA manual.

## Cambios de entrenamiento

Leer primero:

[`../architecture/training-system.md`](../architecture/training-system.md)

Preservar especialmente:

- una única sesión activa;
- snapshots;
- drafts locales;
- autosave no bloqueante;
- optimistic concurrency;
- finalización estricta;
- sesiones completed históricas;
- separación entre reminder y `apply_to_routine`.

## Documentación

Cuando una decisión estructural cambie, actualizar la documentación vigente en el mismo cambio.

Los archivos de `docs/archive/` son material histórico y no deben usarse como especificación actual.
