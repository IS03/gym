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

### Reglas de seguridad y protección de datos

- Toda tabla expuesta en `public` debe tener RLS y policies de ownership para
  `authenticated`; no usar `PUBLIC`, `anon`, `USING (true)` ni `WITH CHECK
  (true)` para datos de usuario.
- El `user_id` se deriva de Auth en servidor o de una relación padre ya
  verificada. Las actions y APIs aceptan únicamente campos permitidos y nunca
  confían en ownership enviado por el navegador.
- Toda función `SECURITY DEFINER` debe usar `search_path = ''`, referenciar
  objetos de aplicación con schema explícito y revocar `EXECUTE` de `PUBLIC`,
  `anon` y `authenticated`. `service_role` sólo se usa en módulos
  `server-only` para operaciones estrictamente controladas.
- Las demás funciones públicas también fijan `search_path` cuando el caller
  puede controlarlo. No se reemplaza el body si un `ALTER FUNCTION ... SET
  search_path` conserva exactamente su semántica.
- Los tokens de integración se generan con entropía criptográfica, se muestran
  una sola vez y sólo se persisten como SHA-256. Ni el token raw ni su hash se
  incluyen en UI, responses o logs.
- Sólo la URL y la publishable/anon key de Supabase pueden usar el prefijo
  `NEXT_PUBLIC_`. Secret/service-role keys permanecen server-side, fuera de git
  y nunca se registran.
- Las páginas, respuestas RSC y APIs autenticadas no se almacenan en el cache
  del service worker. Los drafts locales de entrenamiento son el único dato de
  producto persistido deliberadamente en el navegador y se eliminan al cerrar
  correctamente el flujo.
- Ejecutar Supabase Security Advisor después de cada cambio DDL. Un finding que
  dependa del plan del proveedor se documenta como riesgo residual; no se
  reemplaza con una protección casera.

OWNLEVEL usa actualmente OAuth de Google; no implementa signup, login, reset ni
cambio de contraseña propios. La protección de contraseñas filtradas de
Supabase continúa siendo recomendable si se habilita un proveedor basado en
password y el plan contratado la admite.

### Resiliencia ante JWT recién emitidos

Los clientes de Data API clasifican exclusivamente `HTTP 401` + `PGRST303` +
`JWT issued at future` en `/rest/v1/` como un rechazo transitorio y realizan
tres retries cortos y acotados. Este caso no representa una sesión inválida: no
se limpian cookies, no se fuerza login y no se refresca nuevamente el JWT. La
causa raíz del desfase de reloj/validación continúa siendo responsabilidad del
proveedor.

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
