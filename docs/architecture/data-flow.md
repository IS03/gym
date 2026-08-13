# OWNLEVEL — Flujo de datos y fuentes de verdad

## Alcance

Este documento describe la primera pasada arquitectónica del issue #32. El
objetivo es fijar las reglas vigentes antes de ampliar Nutrición, sin introducir
una capa de repositorios nueva ni reescribir Entrenamiento.

Ante una contradicción, prevalecen el schema vivo, las migraciones, el código y
los tests.

## Mapa de fuentes de verdad

| Dato | Estado actual / planificación | Histórico / ejecución | Escritura canónica | Principales dependencias |
| --- | --- | --- | --- | --- |
| Perfil personal | `profiles` | No aplica | `upsertMyProfile` desde Ajustes | Perfil, BMR y objetivos actuales |
| Peso corporal | `profiles.current_weight_kg` | `day_logs.weight_kg` | acciones de Cuerpo o cambio explícito en Ajustes | BMR actual, objetivos y tendencias |
| Medidas corporales | No hay copia de estado actual | `body_measurements` por `measured_on` | acciones de Cuerpo | Últimas medidas y gráficos |
| Objetivos nutricionales legacy | `profiles.bmr_kcal_current`, `maintenance_kcal_current`, `target_kcal_current`, `goal_type` | columnas legacy `*_snapshot` de `day_logs` | perfil actual; snapshot al crear el día y sincronización del día corriente | resumen y deltas legacy |
| Plan nutricional versionado | `nutrition_goal_periods` (motor activo, aún sin períodos reales) | `nutrition_goal_period_id` y snapshots nutricionales nuevos de `day_logs` | `resolve_nutrition_context` + `refresh_nutrition_day` | objetivos sin reescritura histórica |
| Gasto y trabajo versionados | `expenditure_rule_periods` y `work_schedule_periods` (motor activo, aún sin períodos reales) | IDs, fuentes y snapshots nuevos de `day_logs` | `resolve_nutrition_context` + `refresh_nutrition_day` | gasto estimado y contexto del día |
| Comida individual | No aplica | `meal_entries` activa (`deleted_at is null`) | acciones de Nutrición | agregados del día |
| Totales nutricionales | No se copian al perfil | calorías, proteína, carbohidratos y grasas en `day_logs` | trigger de `meal_entries` mediante `recalculate_day_log` | resumen diario e historial |
| Biblioteca de ejercicios | `exercises` | snapshots de sesión | acciones de Biblioteca | rutinas y nuevas sesiones |
| Rutina planificada | `routines`, `routine_exercises`, `routine_exercise_sets` | snapshot copiado al iniciar | acciones de Rutinas | inicio y planificación futura |
| Sesión | `workout_sessions` | la misma fila con estado `completed` o `discarded` | RPCs transaccionales de entrenamiento | historial, calendario y reportes |
| Ejercicio ejecutado | No aplica | `workout_session_exercises` | inicio de sesión + autosave | detalle e historial por ejercicio |
| Serie ejecutada | No aplica | `workout_sets` | inicio de sesión + autosave/corrección | volumen, series y progreso |

`day_logs` es el ancla de un día de producto, pero no es la fuente de cada
detalle: las comidas viven en `meal_entries`, las sesiones en
`workout_sessions` y el peso medido en `day_logs.weight_kg`.

## Perfil y snapshots nutricionales

`profiles` representa configuración actual. Un `day_log` nuevo se obtiene con
`get_or_create_day_log(p_log_date)`, que deriva el usuario de `auth.uid()` y
copia los valores actuales del perfil como snapshots.

`tr_profiles_derive_current_energy` es la implementación canónica de la regla
vigente de Harris–Benedict: deriva BMR, mantenimiento y target base desde sexo,
nacimiento, altura, peso y la fecha de Córdoba. La aplicación escribe los datos
fuente y lee los valores derivados devueltos por la base.

Cuando cambia BMR, mantenimiento, target o tipo de objetivo, el trigger
`tr_profiles_sync_today_snapshots` actualiza únicamente el `day_log` de la
fecha actual en `America/Argentina/Cordoba`. No busca ni reescribe días
anteriores.

Por lo tanto:

- un cambio actual puede afectar el día abierto de hoy y días futuros;
- un día pasado conserva los snapshots con los que fue creado;
- `delta_vs_target` y `delta_vs_maintenance` se calculan contra esos snapshots;
- un cambio de comida recalcula totales y deltas mediante el trigger de
  `meal_entries`, dentro de la misma transacción de esa comida.

## Peso actual e histórico

La medición es el hecho original y vive en `day_logs.weight_kg`. El peso actual
es una proyección del último hecho cronológico y vive en
`profiles.current_weight_kg` porque los cálculos actuales lo necesitan.

Reglas implementadas:

1. Registrar o editar el punto cronológicamente más reciente actualiza, en la
   misma transacción de Postgres, peso actual, BMR/mantenimiento/target y los
   snapshots de hoy.
2. Editar un punto antiguo no modifica el perfil.
3. Eliminar un punto antiguo no modifica el perfil.
4. Eliminar el último punto hace que el perfil tome el punto anterior; si no
   queda ninguno, el peso actual y sus derivados quedan en `null`.
5. Ajustes solo crea un punto cuando el peso cambia explícitamente o cuando
   repara un perfil legado con peso pero sin historial. Guardar otro campo no
   inventa una medición.
6. No se puede vaciar el peso desde Ajustes mientras exista historial; la
   operación canónica es eliminar el último punto desde Cuerpo.

`tr_day_logs_sync_current_weight` aplica estas reglas. La actualización de
`day_logs`, la proyección en `profiles` y los snapshots del día actual forman
una única transacción: si falla una parte, Postgres revierte todo.

La migración que introdujo esta regla también crea el primer punto de hoy para
perfiles legados con peso pero sin historial y reconcilia el perfil con el
último punto existente.

## Medidas corporales

`body_measurements` guarda una fila por usuario y fecha, con al menos una de
estas medidas: cintura, pecho, brazo, muslo o cadera. No se duplica una “medida
actual” en `profiles`; la última se obtiene ordenando `measured_on`.

La unicidad `(user_id, measured_on)`, los checks y RLS sostienen la regla en la
base.

## Entrenamiento

El flujo auditado es:

```text
rutina actual
→ start_workout_session
→ snapshots de ejercicio y objetivos por serie
→ draft local
→ autosave serializado por ejercicio
→ save_workout_exercise con versión esperada
→ flush obligatorio
→ finish_workout_session
→ historial y reportes sobre completed
```

La rutina y la sesión son entidades distintas. Cambiar `exercises` o una rutina
no reescribe `workout_session_exercises` ni `workout_sets` ya creados.

El autosave permite paralelismo entre ejercicios y serializa revisiones del
mismo ejercicio. `updated_at` actúa como control optimista; una versión vieja
recibe conflicto y no pisa una nueva. Finalizar exige que todos los cambios
necesarios estén confirmados.

Una corrección histórica modifica únicamente valores realizados y metadata
permitida. No reabre la sesión, no cambia snapshots/targets y no vuelve a
ejecutar progresión. Los reportes se actualizan porque leen los hechos
corregidos. Las consultas de historial, calendario y progreso filtran
`status = 'completed'`; `discarded` queda fuera.

## Nutrición: motor diario canónico

La arquitectura actual ya define dos niveles:

- `meal_entries`: detalle consumido por comida;
- `day_logs`: agregado persistido y contexto histórico del día.

Calorías y proteína de una comida no deben copiarse a `profiles`. Los totales
diarios se mantienen desde las comidas activas mediante el trigger existente;
no se editan como una segunda entrada manual.

La fundación del issue #29 ya incorporó carbohidratos y grasas con el mismo
patrón:

1. `meal_entries.final_carbs_g` y `final_fat_g` en el detalle;
2. `day_logs.total_carbs_g` y `total_fat_g` como agregados;
3. `recalculate_day_log` serializa mutaciones del mismo día y recalcula los
   cuatro valores desde entradas activas;
4. los deltas nutricionales nuevos sólo se calculan cuando sus snapshots
   específicos ya existen.

No corresponde crear otra tabla de “totales diarios” ni guardar macros
consumidos en `profiles`.

### Fundación y configuración pendiente

La migración `20260813150000_nutrition_schema_foundation.sql` incorporó:

- períodos versionados de objetivos, gasto y horario habitual;
- campos de actividad, overrides, referencias y snapshots en `day_logs`;
- procedencia, precisión, idempotencia e importación en `meal_entries`;
- `nutrition_import_runs` para registrar imports aplicados reproducibles;
- `foods` como catálogo personal con ownership estricto.

No se cargaron los objetivos históricos ni la matriz real, no se importó el
Google Sheet y no existen triggers nutricionales sobre entrenamiento en esta
fase. Las cinco tablas nuevas permanecen vacías en producción.

Las columnas `target_kcal_snapshot`, `maintenance_kcal_snapshot`,
`delta_vs_target` y `delta_vs_maintenance` conservan su semántica legacy/BMR.
Los nuevos conceptos viven en `nutrition_target_kcal_snapshot`,
`estimated_expenditure_kcal_snapshot`, `delta_vs_nutrition_target` y
`energy_balance_kcal`; no se reinterpretan datos anteriores.

Un `legacy_daily_summary` activo no puede convivir con comidas detalladas
activas en el mismo día. La base serializa las escrituras del día y aplica la
regla antes de recalcular, de modo que UI, importadores e integraciones futuras
compartan la misma protección.

### Resolución y materialización

`resolve_nutrition_context(p_log_date)` es la única resolución dinámica. Es
read-only, obtiene ownership de `auth.uid()` y aplica estas reglas:

1. El horario vigente es el de mayor `effective_from <= fecha`. El día de la
   semana determina trabajo habitual; un `day_logs.work_override` explícito
   gana. Los pasos son sólo contexto.
2. Gym es verdadero cuando existe al menos una sesión `completed` del día. Una
   o varias sesiones producen el mismo booleano. `in_progress` y `discarded`
   no cuentan. Si no hay `completed`, `gym_override = true` puede actuar como
   fallback. La fuente queda en `workout`, `override` o `none`.
3. El plan de objetivos vigente es el de mayor `effective_from <= fecha`; se
   eligen calorías, proteína y agua de la variante con/sin gym. Sin período
   aplicable, los valores son `null`.
4. La regla de gasto vigente usa exactamente una de las cuatro combinaciones
   trabajo/gym. `expenditure_override_kcal` gana si existe. Pasos, agua y mate
   no participan del cálculo.

`refresh_nutrition_day(p_day_log_id)` es una operación separada y explícita:
toma primero un lock sobre `day_logs`, persiste IDs, fuentes y snapshots, y
calcula `delta_vs_nutrition_target = consumo - target` y
`energy_balance_kcal = consumo - gasto`. Sigue el mismo orden de lock que
`recalculate_day_log` para serializar cambios del agregado sin introducir un
ciclo de bloqueos.

`get_or_create_day_log(p_log_date)` conserva su firma sin `user_id`. Sólo al
insertar un día nuevo materializa su contexto nutricional; si la fila ya
existía, la devuelve sin reinterpretar sus snapshots. No crea configuración ni
toca las columnas legacy/BMR.

### Read model de aplicación e History

`getNutritionDay(date, options)` en `src/lib/nutrition/` es el wrapper servidor
tipado común a Home, Today y History. Devuelve día, comidas, contexto,
objetivos, gasto, macros, balances, fuentes e IDs de períodos sin reconstruir
reglas en React.

Home y Today pueden asegurar el día con `createIfMissing = true`. History usa
`createIfMissing = false`: consultar una fecha inexistente devuelve un estado
vacío, no crea un `day_log`, no refresca snapshots ni modifica timestamps. Los
snapshots históricos sólo cambian por una materialización/corrección explícita
o una importación controlada futura.

## Día de producto y timestamps

Las fechas lógicas usan `todayInCordoba()` y la zona
`America/Argentina/Cordoba`. Nutrición de hoy, el selector diario y la vista de
sesiones por día no derivan el día desde UTC.

Los timestamps técnicos (`created_at`, `updated_at`, `started_at`, `ended_at`,
`consumed_at`) permanecen en UTC. Los helpers que suman días a un string ISO
usan fechas UTC sintéticas al mediodía para evitar cambios de día y no
representan “hoy”.

## Ownership

- las acciones obtienen el usuario autenticado en servidor;
- las RPCs sensibles derivan ownership desde `auth.uid()`;
- RLS está habilitado en todas las tablas de usuario;
- ningún flujo canónico acepta un `user_id` arbitrario desde el cliente;
- `get_or_create_day_log` es `SECURITY INVOKER`, sin parámetro de usuario y sin
  permiso para `anon`.

## Invariantes verificadas

- existe como máximo un `day_logs` por `(user_id, log_date)`;
- existe como máximo una sesión `in_progress` por usuario;
- el último peso histórico y el peso actual coinciden después de una mutación
  canónica;
- una mutación de peso no puede confirmar solo una de sus escrituras;
- los días anteriores no cambian al editar el perfil actual;
- una sesión iniciada no depende de cambios posteriores de la rutina;
- una sesión completed no vuelve a `in_progress` para corregirse;
- `discarded` no participa en reportes de completed;
- “hoy” se calcula en Córdoba.

## Duplicación y deuda clasificada

### Corregida por ser peligrosa

- sincronización de peso en varias llamadas de aplicación;
- sincronización manual y tolerante a fallos de snapshots del día actual;
- cálculo duplicado de BMR entre aplicación y base;
- cálculo de “hoy” en UTC en tres rutas de producto.

### Pequeña y aceptable

- helpers locales para obtener el usuario autenticado en módulos separados;
- listas de rutas a revalidar después de mutaciones distintas;
- aritmética UTC sobre strings ISO cuando no representa el día actual.

### Deuda futura

- unificar gradualmente el contexto autenticado sin crear una capa repository;
- decidir actividad, objetivo y targets de macros antes de ampliar Nutrición;
- endurecer funciones trigger heredadas con `search_path` mutable dentro del
  alcance de seguridad del issue #34;
- revisar índices y performance dentro del issue #33, no en esta auditoría.
