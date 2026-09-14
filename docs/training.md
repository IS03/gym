# OWNLEVEL — Training

Documento canónico de la lógica operativa de entrenamiento. Para analytics, Comparisons y rendimiento histórico, consultar [`progress-v2.md`](./progress-v2.md).

## Alcance

Training separa la planificación de lo que realmente ocurrió. La biblioteca y las rutinas describen el futuro; una sesión iniciada captura snapshots; las series completadas son hechos históricos.

```text
Biblioteca → Rutina → Sesión snapshot → Series reales → Historial → Progress
```

## Fuentes canónicas

| Capa | Entidades | Responsabilidad |
| --- | --- | --- |
| Biblioteca | `exercises` | Definición actual del ejercicio |
| Planificación | `routines`, `routine_exercises`, `routine_exercise_sets` | Plantilla, orden y objetivos |
| Sesión | `workout_sessions`, `workout_session_exercises` | Ejecución concreta y snapshots |
| Series | `workout_sets` | Targets copiados y valores realizados |

**Contrato:** editar una rutina o ejercicio actual no reescribe una sesión histórica.

## Biblioteca de ejercicios

`exercises` conserva identidad, nombre, grupo/subzona, implemento, `weight_mode`, defaults y estado. Archivar retira un ejercicio de los flujos activos sin romper referencias históricas.

La identidad histórica no depende del nombre actual: las sesiones guardan snapshots suficientes para seguir siendo legibles aunque la definición cambie o se archive.

## Rutinas

Una rutina es una plantilla ordenada. Sus ejercicios y sets definen objetivos para una sesión futura.

Las reglas principales son:

- la rutina no es una sesión;
- los objetivos viven en la plantilla hasta que se inicia una sesión;
- al iniciar, los datos necesarios se copian como snapshots;
- cambios posteriores de la rutina no afectan esa ejecución;
- archivar una rutina no borra sesiones ya completadas.

## Estados de sesión

`workout_sessions.status` distingue:

- `in_progress`: sesión viva y editable;
- `completed`: hecho histórico finalizado;
- `discarded`: hecho conservado pero excluido de vistas/reportes que usan sólo sesiones completadas.

Existe como máximo una sesión `in_progress` por usuario. La garantía debe existir en backend/base de datos, no sólo en UI.

## Inicio de sesión

Una sesión puede comenzar desde una rutina o como sesión libre.

Al iniciar desde rutina se materializan:

- identidad y metadata del ejercicio;
- orden;
- `weight_mode`;
- descanso;
- targets por serie;
- nota vigente de la combinación rutina + ejercicio;
- recordatorio heredado para la próxima vez cuando corresponda.

La fecha lógica del producto usa `America/Argentina/Cordoba`.

## Sesión activa

La sesión activa prioriza una secuencia simple:

> ver objetivo → cargar serie → completar → descansar

El detalle abierto de un ejercicio concentra las series y el descanso. Acciones como próxima vez, notas y opciones avanzadas son secundarias a la ejecución.

### Draft local y autosave

El patrón vigente es:

```text
cambio del usuario
→ draft local inmediato
→ UI actualizada
→ autosave con debounce
→ persistencia remota
```

El guardado remoto no debe bloquear la interacción normal.

- ejercicios distintos pueden sincronizarse en paralelo;
- saves del mismo ejercicio se serializan;
- una respuesta vieja no puede pisar una edición local más nueva;
- `updated_at`/versión de servidor participa del control optimista;
- un fallo de red conserva el draft.

## Series

`workout_sets` conserva por serie objetivos y resultados reales. Los campos relevantes incluyen, según contexto:

- `target_reps`;
- `target_weight_kg`;
- `target_rir`;
- `actual_reps`;
- `actual_weight_kg`;
- `is_completed`.

Un valor realizado pertenece a la sesión concreta. No debe reconstruirse leyendo la rutina actual.

## `weight_mode`

La semántica de carga depende del modo del ejercicio y debe preservarse de punta a punta. No se deben comparar ni convertir implícitamente contextos incompatibles.

Ejemplo importante: una carga registrada por mancuerna se conserva como fue ingresada; no se multiplica automáticamente por dos.

## Descanso

El descanso es configuración operativa del ejercicio/sesión y no debe bloquear el guardado de series. El temporizador es estado de interacción; no reemplaza el dato histórico de lo realizado.

## Próxima vez

Existen dos mecanismos distintos:

### Recordatorio

`decision` puede conservar estados como `maintain`, `increase_weight`, `increase_reps` y `custom` histórico. El recordatorio comunica intención; no cambia números por sí mismo.

### Aplicar lo realizado a la rutina

`apply_to_routine` controla si los resultados completados se convierten en nuevos objetivos numéricos.

```text
decision = recordatorio
apply_to_routine = actualización explícita de targets
```

No deben fusionarse conceptualmente.

## Notas

`routine_exercises.notes` pertenece a la combinación rutina + ejercicio.

Al iniciar una sesión se conserva un snapshot. Sólo una finalización correcta puede propagar una nota modificada de vuelta a la rutina. Autosave, cancelación, descarte y corrección histórica no deben reescribir la nota de la plantilla.

## Finalización

Finalizar es la barrera estricta de consistencia.

Antes de `finish_workout_session` deben resolverse:

- autosaves programados;
- requests en vuelo;
- cambios locales sin persistir;
- errores pendientes relevantes.

```text
flush de cambios
→ persistencia confirmada
→ finish_workout_session
→ completed
```

Si una escritura necesaria falla, la sesión permanece `in_progress`.

## Cancelación, descarte y corrección

### Cancelar activa

Opera sobre `in_progress`. No es el mecanismo para borrar historia.

### Descartar completada

Una sesión `completed` puede pasar a `discarded` para salir de historial/reportes sin perder trazabilidad física.

### Corregir completada

Corregir no significa reabrir. Sólo deben cambiarse campos permitidos de la ejecución real.

No debe:

- cambiar fecha/hora estructural;
- cambiar rutina o identidad de ejercicios;
- recrear snapshots;
- modificar targets históricos;
- reejecutar progresión;
- aplicar nuevamente cambios a la rutina.

Los reportes se actualizan porque leen los hechos corregidos.

## Historial

Historial y calendario consumen sesiones `completed`. Los snapshots son la referencia para reconstruir qué ocurrió y con qué contexto.

Historial factual y Progress tienen responsabilidades distintas:

- Historial: qué se hizo y cuándo;
- Progress: cómo cambia el rendimiento/carga a lo largo del tiempo.

## ABS y cardio

ABS debe registrarse mediante ejercicios/sesiones reales, no como un checkbox paralelo. Campos legacy pueden existir por compatibilidad, pero la UI debe inferir cardio desde datos estructurados y no desde nombres de rutina.

## Seguridad

- RLS habilitado;
- ownership validado en mutaciones;
- no confiar en `user_id` arbitrario del cliente;
- RPCs sensibles con permisos mínimos;
- service role fuera del browser;
- migraciones pequeñas y compatibles con historia existente.

## Code map

| Responsabilidad | Ubicación |
| --- | --- |
| Core de dominio | `src/lib/phase2` |
| Robustez/contratos | `src/lib/phase2/training-robust.ts` |
| Drafts | `src/lib/phase2/training-drafts.ts` |
| Autosave | `src/lib/phase2/exercise-autosave.ts` |
| Rutinas | `src/app/(app)/train/routines` |
| Biblioteca | `src/app/(app)/train/exercises` |
| Sesión activa | `src/app/(app)/train/session` |
| Historial | `src/app/(app)/train/history` |
| Calendario/día | `src/app/(app)/train/calendar`, `src/app/(app)/train/day` |
| Analytics | `src/lib/progress`, [`progress-v2.md`](./progress-v2.md) |
| Schema/RPCs | `supabase/migrations`, `supabase/tests` |

## Invariantes

No hacer:

- tratar rutina y sesión como la misma entidad;
- leer targets históricos desde la rutina actual;
- permitir dos sesiones activas por usuario;
- perder drafts ante un fallo de red;
- finalizar con cambios necesarios sin persistir;
- reabrir sesiones completadas para corregirlas;
- ejecutar progresión durante una corrección histórica;
- comparar cargas con `weight_mode` incompatible;
- usar volumen global como equivalente de fuerza;
- borrar historia al archivar definiciones actuales.

## Referencias

- [`ownlevel-architecture.md`](./ownlevel-architecture.md)
- [`architecture/training-system.md`](./architecture/training-system.md)
- [`architecture/data-flow.md`](./architecture/data-flow.md)
- [`progress-v2.md`](./progress-v2.md)
