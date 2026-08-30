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
| Perfil personal | `profiles` | No aplica | `upsertMyProfile` desde Ajustes | Perfil y fuentes antropométricas |
| BMR | `profiles.bmr_kcal_current` | `day_logs.bmr_kcal_snapshot` | `trg_profiles_derive_bmr` | sexo, nacimiento, altura y último peso |
| Peso corporal | `profiles.current_weight_kg` | `day_logs.weight_kg` | acciones de Cuerpo o cambio explícito en Ajustes | BMR actual y tendencias |
| Medidas corporales | No hay copia de estado actual | `body_measurements` por `measured_on`, incluidas medidas laterales y calidad de importación | acciones de Cuerpo / importador histórico | Últimas medidas y gráficos |
| Energía legacy | `profiles.maintenance_kcal_current`, `target_kcal_current`, `goal_type` (deprecated) | `maintenance_kcal_snapshot`, `target_kcal_snapshot`, `goal_type_snapshot` | preservación histórica; sin consumidores nutricionales nuevos | deltas legacy únicamente |
| Plan nutricional versionado | `nutrition_goal_periods` | `nutrition_goal_period_id` y snapshots nutricionales nuevos de `day_logs` | INSERT de nuevas versiones desde Ajustes + motor diario | objetivos sin reescritura histórica |
| Gasto y trabajo versionados | `expenditure_rule_periods` y `work_schedule_periods` | IDs, fuentes y snapshots nuevos de `day_logs` | INSERT de nuevas versiones desde Ajustes + motor diario | gasto estimado y contexto del día |
| Pasos diarios | `day_logs.steps` | `day_logs.steps` | editor de Actividad de Hoy | contexto de actividad e historial de sólo lectura en `/today/steps`; `null` es sin dato y no modifica el gasto |
| Comida individual | No aplica | `meal_entries` activa (`deleted_at is null`) | acciones de Nutrición | agregados del día; Comidas sugeridas es un read model derivado |
| Comida habitual | `saved_meals` + componentes snapshot en `saved_meal_items` | snapshot independiente en `meal_entries` al agregar | CRUD owner-scoped + RPC transaccional de plantilla | Agregar rápido; no recalcula historia |
| Totales nutricionales | No se copian al perfil | calorías, proteína, carbohidratos y grasas en `day_logs` | trigger de `meal_entries` mediante `recalculate_day_log` | resumen diario e historial |
| Eventos nutricionales | No aplica | `nutrition_events` por fecha | importador histórico; lectura contextual en History | contexto de permitidos, sin sumar consumo |
| Catálogo personal | `foods`, con nutrición completa o parcial | snapshot independiente en `meal_entries` al registrar cantidad | importador histórico + CRUD owner-scoped en Ajustes | registro por cantidad; nunca recalcula historia |
| Biblioteca de ejercicios | `exercises` | snapshots de sesión | acciones de Biblioteca | rutinas y nuevas sesiones |
| Rutina planificada | `routines`, `routine_exercises`, `routine_exercise_sets` | snapshot copiado al iniciar | acciones de Rutinas | inicio y planificación futura |
| Sesión | `workout_sessions` | la misma fila con estado `completed` o `discarded` | RPCs transaccionales de entrenamiento | historial, calendario y reportes |
| Ejercicio ejecutado | No aplica | `workout_session_exercises` | inicio de sesión + autosave | detalle e historial por ejercicio |
| Serie ejecutada | No aplica | `workout_sets` | inicio de sesión + autosave/corrección | volumen, series y progreso |

`day_logs` es el ancla de un día de producto, pero no es la fuente de cada
detalle: las comidas viven en `meal_entries`, las sesiones en
`workout_sessions` y el peso medido en `day_logs.weight_kg`.

## Perfil y snapshots nutricionales

`profiles` representa configuración antropométrica actual. Un `day_log` nuevo
se obtiene con `get_or_create_day_log(p_log_date)`, que deriva el usuario de
`auth.uid()`, captura `bmr_kcal_current` y materializa de forma separada el
contexto del motor nutricional.

`trg_profiles_derive_bmr` es la única implementación antropométrica canónica de
Harris–Benedict. Deriva exclusivamente BMR desde sexo, nacimiento, altura, el
último peso y la fecha de Córdoba. No calcula el objetivo nutricional ni el
gasto estimado.

`maintenance_kcal_current` y `target_kcal_current` permanecen en `profiles`
como columnas legacy/deprecated. Sus valores existentes no se destruyen, pero
ya no se derivan desde BMR, no se copian a días nuevos y no alimentan Home,
Today, History ni el motor nutricional.

Cuando cambia una fuente antropométrica, `tr_profiles_sync_today_bmr` actualiza
únicamente `bmr_kcal_snapshot` del `day_log` de hoy en
`America/Argentina/Cordoba`, si existe. No busca ni reescribe días anteriores.

Por lo tanto:

- un cambio antropométrico puede afectar BMR actual y el snapshot de hoy;
- un día pasado conserva los snapshots con los que fue creado;
- `delta_vs_target` y `delta_vs_maintenance` sólo conservan semántica legacy;
- un cambio de comida recalcula totales y deltas mediante el trigger de
  `meal_entries`, dentro de la misma transacción de esa comida.

## Peso actual e histórico

La medición es el hecho original y vive en `day_logs.weight_kg`. El peso actual
es una proyección del último hecho cronológico y vive en
`profiles.current_weight_kg` porque los cálculos actuales lo necesitan.

Reglas implementadas:

1. Registrar o editar el punto cronológicamente más reciente actualiza, en la
   misma transacción de Postgres, peso actual, BMR y el snapshot BMR de hoy.
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

`body_measurements` guarda una fila por usuario y fecha, con al menos una medida
canónica o lateral: cintura, abdomen, pecho, brazo genérico o derecho/izquierdo,
muslo genérico o derecho/izquierdo, pantorrilla derecha/izquierda o cadera. No
se duplica una “medida actual” en `profiles`; la última se obtiene ordenando
`measured_on`. Las columnas genéricas existentes conservan su semántica: el
importador no las completa promediando lados.

La unicidad `(user_id, measured_on)`, los checks y RLS sostienen la regla en la
base. Una importación puede añadir `legacy_import_source`, `legacy_import_id`,
`import_run_id`, `quality_status`, `quality_note` y `source_payload`. Una medida
dudosa se conserva literalmente como `suspect`; no se corrige ni se presenta
como validada. Un peso sin fecha no se transforma en medición ni `day_log`: se
preserva como anomalía omitida en el reporte del import run.

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

Los read models de Home son deliberadamente acotados: el resumen nutricional
cuenta comidas sin descargar sus filas, y el snapshot semanal proyecta sólo
los campos de sesión, ejercicio y serie usados para agregados. Las rutas de
entrenamiento reutilizan el `AuthenticatedRequestContext` request-scoped; no se
cachean datos privados entre requests.

La rutina y la sesión son entidades distintas. Cambiar `exercises` o una rutina
no reescribe `workout_session_exercises` ni `workout_sets` ya creados.

La nota de `routine_exercises` se copia a `routine_note_snapshot` y `notes` al
iniciar. La primera queda inmutable; `notes` es el snapshot editable de la
sesión. Sólo una finalización correcta sincroniza de vuelta la nota cuando
`notes IS DISTINCT FROM routine_note_snapshot`. Una nota no modificada no pisa
ediciones concurrentes de la rutina, y correcciones históricas nunca propagan.

`decision` y `apply_to_routine` siguen siendo fuentes independientes:
`maintain` es neutral, `custom` existe sólo por compatibilidad histórica y
`apply_to_routine` controla exclusivamente la actualización de targets con
series completadas.

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

El flujo manual de Today persiste calorías, proteína, carbohidratos y grasas en
la misma `meal_entries`, con `source_type = 'manual'` y `entry_kind = 'meal'`.
Calorías sigue siendo obligatoria; cada macro puede quedar en `null` si no fue
informada, mientras que `0` representa un cero conocido. Crear, editar o hacer
soft delete dispara el agregado canónico en Postgres y revalida Today, History
y el resumen compacto de Home.

`Comidas sugeridas` no guarda favoritos, templates ni contadores: es un read model
derivado de `meal_entries` manuales, activas y de tipo `meal` de los 60 días
completos anteriores al día de Córdoba. Las entradas `sheet_import` y los
resúmenes heredados se excluyen. Al elegir una sugerencia, el servidor vuelve a
verificar ownership y crea una `meal_entry` manual normal para hoy; los totales
siguen siendo responsabilidad del trigger canónico.

### Food, SavedMeal, SuggestedMeal y MealEntry

Los cuatro conceptos tienen ciclos de vida distintos:

- `foods`: catálogo mutable de ingredientes/bases cuantificables;
- `saved_meals`: plantillas mutables que el usuario decidió conservar;
- Comidas sugeridas: read model derivado de historial, sin tabla propia;
- `meal_entries`: hechos consumidos y snapshots históricos.

Una `saved_meal` puede ser manual —totales informados directamente— o compuesta. En una compuesta, cada `saved_meal_item` guarda etiqueta, cantidad, unidad, porción base y nutrición base como snapshot. `source_food_id` sólo conserva procedencia y deliberadamente no tiene FK a `foods`: editar, archivar o eliminar un Food no cambia ni bloquea la plantilla.

La FK compuesta `(saved_meal_id, user_id)` impide mezclar ownership y elimina los items cuando se elimina su plantilla. RLS limita SELECT/INSERT/UPDATE/DELETE al usuario autenticado. Eliminar o archivar una plantilla no toca `meal_entries`, porque el consumo copia título, descripción y nutrición en el momento de registrarse.

Al guardar una plantilla compuesta, el servidor relee cada Food nuevo, valida ownership/estado y materializa el snapshot. Postgres reemplaza plantilla e items de forma atómica y recalcula sus totales. El cálculo escala únicamente en la misma unidad: calorías con redondeo entero, macros a dos decimales y `null` propagado si cualquier componente desconoce ese nutriente. No se derivan calorías desde macros.

Agregar rápido recibe sólo `savedMealId` y fecha. El servidor relee la plantilla propia/activa y crea una `meal_entry` snapshot. **Ajustar** recibe IDs de items y cantidades, valida que todos pertenezcan a la plantilla y recalcula sólo esa ocurrencia. Guardar una sugerencia recibe `sourceMealId`, relee la comida histórica propia/elegible y crea una `saved_meal` manual; no existe backfill automático.

La protección de doble envío compara fecha, texto, calorías y los tres macros
durante la ventana reciente. Conserva la diferencia entre `null` y `0`; el
usuario puede confirmar explícitamente “Guardar igual”.

### Importación histórica reproducible

El importador del issue #29 separa lectura, normalización, validación,
comparación con producción y plan de cambios. `nutrition:dry-run` no escribe;
`nutrition:apply` reutiliza exactamente ese plan y exige `--apply`, target
`production`, SHA esperado y modo explícito `rollback` o `commit`.

El apply completo se ejecuta en una sola transacción PostgreSQL: crea el
`nutrition_import_run`, materializa períodos y días, inserta detalles y ejecuta
asserts de conteos, FKs, snapshots, peso/BMR y hashes de entrenamiento antes del
commit. Un import run con el mismo `(user_id, source_name, source_sha256)` corta
el proceso como `ALREADY_IMPORTED`, sin duplicar hechos.

La identidad reproducible es el SHA-256 de una representación canónica de las
pestañas fuente. Cada comida conserva un par estable
`legacy_import_source + legacy_import_id`; las filas anuladas se preparan como
soft-deleted. Una hora desconocida se materializa técnicamente al mediodía de
Córdoba, pero esa convención queda marcada como desconocida en `raw_input` y no
adquiere semántica de hora observada.

Las entradas históricas de `sheet_import` admiten `0` kcal para representar
hechos reales como hidratación sin convertirlos en consumos positivos. El flujo
manual continúa exigiendo calorías mayores a cero; valores negativos siguen
rechazados para toda procedencia.

El plan opera por `(user_id, log_date)` y sólo completa columnas autorizadas.
Nunca reemplaza una fila existente, por lo que preserva `day_logs.id`, las FKs
de entrenamiento, peso válido y snapshots ajenos al import. Los valores
históricos explícitos de target, gasto y contexto se preparan como snapshots;
no se recalculan días pasados con `refresh_nutrition_day`.

`Resumen diario` es un oráculo, no una fuente a importar. Una discrepancia
fuera de tolerancia, un desacuerdo con una sesión `completed`, un peso distinto
o un dato sin representación bloquean `APPLY_READY`. Los snapshots y reportes
reales sólo viven en `tmp/` o `temp/`, ignorados por Git; los tests versionados
usan únicamente fixtures sintéticos.

### Fundación, importación y configuración web

La migración `20260813150000_nutrition_schema_foundation.sql` incorporó:

- períodos versionados de objetivos, gasto y horario habitual;
- campos de actividad, overrides, referencias y snapshots en `day_logs`;
- procedencia, precisión, idempotencia e importación en `meal_entries`;
- `nutrition_import_runs` para registrar imports aplicados reproducibles;
- `foods` como catálogo personal con ownership estricto.

El histórico validado se aplicó de forma atómica e idempotente en PR 6. Las
filas importadas conservan import run, legacy IDs y payload de procedencia. La
web no vuelve a ejecutar ese import: consume Supabase como única fuente.

Ajustes permite crear nuevas versiones de objetivos, gasto y horario mediante
`INSERT` con `effective_from`; nunca actualiza las versiones históricas. También
permite crear, editar, archivar, reactivar y eliminar `foods`. No existen FKs
entrantes hacia `foods`: eliminar una referencia propia no afecta comidas ya
registradas porque éstas no vuelven a consultar el catálogo.

`foods` permite que calorías o cualquiera de los tres macros sea `null`, pero
exige al menos un valor nutricional conocido y valores no negativos. Así,
desconocido no se degrada a cero.

Registrar **Desde alimento** conserva `meal_entries` como única fuente de
consumo. El cliente envía `foodId`, cantidad y fecha; el servidor relee el Food
con `id + user_id + is_active`, escala con
`cantidad / serving_quantity` en la misma unidad y crea una comida manual con
título, cantidad, calorías y macros como snapshot. Calorías se redondea al
entero más cercano; macros conocidos a dos decimales; `null` se propaga y cero
permanece cero. También se capturan `precision_level` y `source_note` cuando
existen. No hay conversiones de unidad ni relación viva Food → MealEntry.

`nutrition_events` conserva el contexto estructurado de Permitidos —tipo,
intensidad, planificación, alcohol, tragos equivalentes, kcal del evento,
contexto, notas y origen— con ownership, RLS e idempotencia por legacy ID. Esas
kcal no alimentan `meal_entries` ni `day_logs`: el consumo continúa viniendo
exclusivamente de comidas o resúmenes heredados.

El dry-run trata `Registro de comidas` como fuente primaria y `Resumen diario`
como oráculo derivado. Cuando la fuente tiene un macro y el oráculo está vacío,
preserva la fuente y registra `SOURCE_WINS`; si ambos tienen valores distintos
fuera de tolerancia, bloquea. Sólo un dato real no vacío sin destino seguro se
considera schema gap; headers completamente vacíos, como las fotos históricas
auditadas, no crean columnas por sí solos.

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
existía, la devuelve sin reinterpretar sus snapshots. El día nuevo captura BMR,
pero no copia `maintenance_kcal_current` ni `target_kcal_current`; no crea
configuración.

### Sincronización de fuentes

La materialización automática sigue siendo puntual, no un backfill:

- cambiar `work_override`, `gym_override` o `expenditure_override_kcal`
  refresca ese mismo `day_log` desde Postgres;
- cuando una sesión agrega o quita el estado `completed`, se refresca sólo el
  día relacionado. Varias sesiones siguen resolviendo un único booleano y al
  descartar la última se vuelve al override o a `false`;
- insertar un período que pasa a ser el vigente para hoy refresca únicamente
  el día actual, si existe. Un período futuro o histórico superado por una
  versión posterior no reinterpreta días materializados.

Los triggers son consumidores laterales: no escriben ejercicios, sets,
progresión ni snapshots de entrenamiento. El trigger de overrides escucha sólo
columnas fuente; `refresh_nutrition_day` escribe columnas snapshot distintas,
por lo que no existe recursión. Todas las rutas de totales/refresco toman
primero el lock de `day_logs`, compatible con `recalculate_day_log`.

### Read model, escritura web e History

`getNutritionDay(date, options)` en `src/lib/nutrition/` es el wrapper servidor
tipado común a Home, Today y History. Devuelve día, comidas, contexto,
objetivos, gasto, macros, balances, fuentes e IDs de períodos sin reconstruir
reglas en React.

Home y Today pueden asegurar el día con `createIfMissing = true`. History usa
`createIfMissing = false`: consultar una fecha inexistente devuelve un estado
vacío, no crea un `day_log`, no refresca snapshots ni modifica timestamps. Los
snapshots históricos sólo cambian por una corrección explícita del mismo día.

Today escribe pasos, agua y mate directamente en el `day_log`; esas columnas no
disparan un refresh energético. Trabajo usa `work_override` con fuente y motivo,
y volver al horario habitual limpia los tres campos. Gym manual sólo admite
`true` cuando no hay sesión; una sesión `completed` continúa siendo autoritativa.
El gasto excepcional usa `expenditure_override_kcal` y se presenta separado del
objetivo nutricional.

History consulta sólo las comidas activas y eventos de la fecha solicitada. Un
`legacy_daily_summary` se identifica como resumen sin desglose, y la convención
técnica de mediodía no se muestra como una hora observada cuando
`raw_input.originalTimeKnown = false`. Las kcal de `nutrition_events` son sólo
contexto y nunca vuelven a sumarse al consumo.

Home, Today e History muestran `nutrition_target_kcal_snapshot` a través del
read model. Si no hay un período configurado, el objetivo es `null`; nunca se
usa BMR ni `target_kcal_snapshot` como fallback silencioso.

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
