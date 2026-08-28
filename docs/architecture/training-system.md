# OWNLEVEL — Arquitectura de entrenamiento

## Objetivo

El sistema de entrenamiento conserva por separado la planificación y lo que realmente ocurrió. La arquitectura está diseñada para soportar uso móvil, sesiones interrumpidas, edición desde distintos dispositivos e historial confiable.

## Modelo conceptual

| Capa | Entidades | Responsabilidad |
| --- | --- | --- |
| Biblioteca | `exercises` | Definición general del ejercicio |
| Planificación | `routines`, `routine_exercises`, `routine_exercise_sets` | Rutina ordenada y objetivos por serie |
| Sesión | `workout_sessions`, `workout_session_exercises` | Snapshot de una ejecución concreta |
| Series reales | `workout_sets` | Objetivos copiados + valores realizados |

La regla principal es:

> modificar una rutina o un ejercicio actual no reescribe una sesión histórica.

## Estados de sesión

`WorkoutSessionStatus` admite:

```text
in_progress
completed
discarded
```

### `in_progress`

Sesión activa y editable. Por usuario puede existir como máximo una sesión activa.

### `completed`

Sesión finalizada. Se consulta como historia y no vuelve a convertirse en sesión viva.

### `discarded`

Sesión histórica retirada de reportes e historial visible sin utilizar el flujo de cancelación de una sesión activa.

## Inicio de sesión

El flujo normal de creación utiliza la fecha local de Córdoba y puede partir de:

- una rutina activa;
- una sesión libre.

Cuando se inicia desde rutina, la sesión copia la estructura necesaria para que futuras modificaciones de la plantilla no alteren esa ejecución.

La protección contra dos sesiones activas no depende únicamente de la interfaz: backend/base de datos mantiene la garantía.

## Snapshots

`workout_session_exercises` conserva información histórica como:

- nombre;
- grupo muscular;
- implemento;
- modo de peso;
- descansos;
- orden;
- ajuste heredado para la próxima sesión.

`workout_sets` conserva por serie:

- `target_reps`;
- `target_weight_kg`;
- `target_rir`;
- `actual_reps`;
- `actual_weight_kg`;
- `is_completed`.

El objetivo histórico se lee desde la sesión, no desde la rutina actual.

## Draft local y autosave

La edición durante un entrenamiento sigue este modelo:

```text
cambio del usuario
↓
draft local inmediato
↓
UI actualizada
↓
autosave con debounce
↓
persistencia remota
```

El guardado remoto no debe bloquear:

- abrir/cerrar ejercicios;
- editar otro ejercicio;
- marcar otras series;
- utilizar el temporizador;
- recorrer la sesión.

### Concurrencia entre ejercicios

Ejercicios distintos pueden sincronizarse de forma independiente.

### Concurrencia del mismo ejercicio

Los saves de un mismo ejercicio se serializan. Si el usuario vuelve a editar mientras existe un request en vuelo, una respuesta anterior nunca puede borrar la versión local más reciente.

El sistema conserva control optimista mediante `updated_at`/versión de servidor.

### Error de sincronización

Un fallo de red no descarta el draft. La interfaz puede indicar que un ejercicio sigue sin sincronizar y permitir continuar entrenando.

## Finalización

Finalizar es la barrera estricta de consistencia.

Antes de ejecutar la finalización, la aplicación debe resolver:

- autosaves programados;
- autosaves en vuelo;
- cambios locales sin persistir;
- errores pendientes.

Secuencia conceptual:

```text
flush de cambios
↓
todo confirmado
↓
finish_workout_session
↓
completed
```

Si un guardado necesario falla, la sesión permanece `in_progress`.

## Progresión y próxima sesión

Existen dos mecanismos independientes.

### Recordatorio

`decision` puede ser:

```text
maintain
increase_weight
increase_reps
custom
```

`maintain` es el estado neutral y se representa en la UI sin ningún botón seleccionado. `increase_weight` e `increase_reps` son las únicas decisiones nuevas disponibles. `custom` se conserva sólo para leer drafts, recordatorios y snapshots históricos; la UI normal no crea nuevos valores `custom`.

`increase_weight`, `increase_reps` y los `custom` históricos no modifican automáticamente números. Son recordatorios para la próxima vez.

El recordatorio heredado vive en el snapshot de la sesión; la nueva decisión comienza en `maintain`.

Un recordatorio se consume al finalizar correctamente una nueva sesión, no simplemente al iniciarla.

### Aplicar lo realizado a la rutina

`apply_to_routine` controla si los valores completados se convierten en próximos objetivos numéricos.

Por lo tanto:

```text
decision
= recordatorio

apply_to_routine
= actualización explícita de targets
```

Pueden utilizarse juntos o por separado.

### Nota persistente por rutina

`routine_exercises.notes` pertenece a la combinación ejercicio + rutina. Al iniciar desde una rutina, `routine_note_snapshot` y `workout_session_exercises.notes` reciben la nota vigente. El snapshot inicial no es editable.

Sólo `finish_workout_session` compara la nota confirmada de la sesión con `routine_note_snapshot`. Si hubo un cambio explícito, la edición de la sesión actualiza `routine_exercises.notes`; si no cambió, la rutina no se reescribe y una edición concurrente externa se conserva. Autosave, cancelación, descarte y corrección histórica no propagan notas.

`workout_session_exercises.notes` permanece como snapshot histórico editable de esa sesión. Cambiar posteriormente la nota de rutina nunca reescribe sesiones anteriores.

## Corrección de sesiones completadas

Corregir una sesión histórica no significa reabrirla.

La corrección se limita a campos permitidos de la ejecución real, por ejemplo peso/repeticiones y metadata expresamente habilitada.

No debe modificar:

- fecha;
- hora de inicio/fin;
- rutina;
- identidad de ejercicios;
- orden;
- snapshots;
- targets históricos;
- decisión de progresión;
- `apply_to_routine`.

Guardar una corrección:

- no llama nuevamente a `finish_workout_session`;
- no reejecuta progresión;
- no altera la rutina actual;
- sí actualiza los reportes que dependen de los valores históricos corregidos.

## Cancelación y descarte

### Cancelar sesión activa

Es una operación para `in_progress`. No debe reutilizarse para borrar historia.

### Descartar sesión completada

Una sesión completada puede pasar a `discarded`. El registro deja de participar en reportes que consideran exclusivamente `completed`, preservando los datos físicos para trazabilidad.

## Reportes

Las estadísticas se construyen sobre hechos:

- sesiones `completed`;
- ejercicios/series realmente completados;
- duración real `ended_at - started_at`;
- volumen = `actual_reps × actual_weight_kg`;
- snapshots de rutina y músculo.

El peso cargado por mancuerna se conserva como fue registrado; no se multiplica implícitamente por dos.

## ABS y cardio

ABS se registra mediante ejercicios/sesiones reales y no mediante un checkbox auxiliar en otra rutina.

Los campos legacy de cardio/ABS pueden mantenerse por compatibilidad histórica. La UI de cardio debe mostrarlos únicamente cuando la sesión realmente contiene cardio según datos estructurados, no por comparar nombres de rutina.

Mover métricas específicas de cardio a nivel de ejercicio ejecutado sigue siendo una posible evolución del modelo.

## Seguridad

- RLS permanece habilitado.
- Las mutaciones validan usuario/ownership.
- No se confía en un `user_id` arbitrario enviado por cliente.
- Las funciones SQL sensibles mantienen permisos mínimos y configuración segura.
- Las migraciones deben ser pequeñas, auditables y compatibles con el historial existente.

## Validación

Un cambio en esta arquitectura debe probar como mínimo:

- una sola sesión activa;
- inicio desde rutina y libre;
- refresh/reanudación;
- edición durante autosave;
- error de red;
- conflicto de versión;
- finalización con cambios pendientes;
- cancelación de activa;
- corrección de completed;
- descarte de completed;
- historial/reportes;
- mobile 375/390/430.
