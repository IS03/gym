<p align="center">
  <img src="./public/brand/ownlevel-lockup-horizontal.png" alt="OWNLEVEL" width="320" />
</p>

# OWNLEVEL

OWNLEVEL es una PWA personal de seguimiento físico que centraliza entrenamiento, nutrición y evolución corporal en una sola experiencia mobile-first.

**Producción:** https://ownlevel.fit

## Qué incluye

### Entrenamiento

- Rutinas editables y ordenables.
- Biblioteca de ejercicios con objetivos por serie.
- Inicio rápido desde rutina o sesión libre.
- Una única sesión activa por usuario.
- Registro de peso, repeticiones, RIR objetivo, descansos y series completadas.
- Draft local y autosave no bloqueante durante el entrenamiento.
- Historial de sesiones y corrección controlada de registros completados.
- Historial y progreso por ejercicio.
- Calendario de entrenamiento, continuidad y reportes semanales.
- Recordatorios de progresión para la próxima sesión.

### Nutrición

- Registro diario de comidas.
- Calorías y proteína por entrada.
- Totales diarios contra objetivos.
- Edición y eliminación controlada de registros.
- Base preparada para ampliar reportes nutricionales sin duplicar la fuente de verdad.

### Progreso

- Análisis de entrenamiento general, por rutina, músculo y ejercicio.
- Duración, volumen, series y distribución muscular por período.
- Comparación breve de la semana actual con la anterior.
- Evolución de peso, reps y volumen por ejercicio.

### Cuerpo

- Historial de peso corporal por fecha.
- Peso actual sincronizado con la última medición.
- Medidas de cintura, pecho, brazo, muslo y cadera.

### Experiencia

- PWA responsive, diseñada primero para iPhone/mobile.
- Navegación dedicada para mobile y desktop.
- Tema claro/oscuro.
- Autenticación con Supabase Auth.
- Zona horaria de producto: `America/Argentina/Cordoba`.

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Componentes | Base UI / shadcn, Lucide |
| Backend | Supabase Postgres + Auth + RLS |
| Hosting | Vercel |
| PWA | `@ducanh2912/next-pwa` |
| Tests | Vitest |

## Estructura principal

```text
src/
  app/                 rutas y pantallas
  components/          UI compartida
  lib/                 dominio, acceso a datos y utilidades
supabase/
  migrations/          esquema y cambios de base de datos
public/
  brand/               identidad visual de OWNLEVEL
docs/
  product/             definición funcional
  architecture/        decisiones de arquitectura
  development/         reglas de ingeniería
  history/             decisiones históricas consolidadas
  archive/             documentación histórica no vigente
```

## Desarrollo local

### Requisitos

- Node.js 20+
- Un proyecto de Supabase con Auth habilitado

### Instalación

```bash
git clone https://github.com/IS03/gym.git
cd gym
npm install
cp .env.example .env.local
npm run dev
```

La aplicación queda disponible en `http://localhost:3000`.

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Usar únicamente la clave pública `anon`/`publishable` en el cliente. La `service_role` no debe exponerse en frontend.

Para autenticación local y producción, configurar en Supabase los callbacks correspondientes, incluyendo:

```text
http://localhost:3000/auth/callback
https://ownlevel.fit/auth/callback
```

## Scripts

```bash
npm run dev      # desarrollo
npm run test     # tests
npm run lint     # ESLint
npm run build    # build de producción con Webpack
npm run start    # servidor de producción
```

`npm run build` utiliza `next build --webpack` por compatibilidad con la configuración PWA actual.

## Principios de arquitectura

- Rutina y sesión son entidades distintas.
- Una sesión iniciada conserva snapshots históricos.
- Una sesión completada no se reabre para corregirla.
- La interfaz puede trabajar de forma optimista, pero la finalización exige persistencia confirmada.
- Las mutaciones de datos respetan ownership y RLS.
- Las fechas lógicas del producto se resuelven en horario de Córdoba.
- Mobile no debe degradarse para mejorar desktop.

## Documentación

La documentación vigente está indexada en [`docs/README.md`](./docs/README.md).

Documentos principales:

- [Visión de producto](./docs/product/product-overview.md)
- [Arquitectura de entrenamiento](./docs/architecture/training-system.md)
- [Flujo de datos y fuentes de verdad](./docs/architecture/data-flow.md)
- [Guía de ingeniería](./docs/development/engineering-guidelines.md)
- [Historial de decisiones](./docs/history/technical-decisions.md)

Los documentos históricos anteriores se conservan en `docs/archive/` y no deben utilizarse como fuente de verdad sin contrastarlos con el código actual.
