# OWNLEVEL — Historial de decisiones técnicas

Este documento resume las decisiones que quedaron consolidadas a partir de los issues cerrados del proyecto. Los issues originales conservan el contexto completo; este archivo se concentra en el resultado y en las decisiones que siguen siendo relevantes.

## Decisiones consolidadas

### Fundación nutricional aditiva — #29

`day_logs` conserva IDs, peso, relaciones y snapshots legacy; sólo recibe
columnas nuevas para contexto, referencias, macros y snapshots nutricionales.
Los objetivos, reglas de gasto y horarios son períodos versionados por
`(user_id, effective_from)`, sin `effective_to`.

Calorías, proteína, carbohidratos y grasas consumidos se agregan desde
`meal_entries` activas mediante una única función transaccional. Target
nutricional y gasto estimado usan snapshots nuevos: `target_kcal_snapshot` y
`maintenance_kcal_snapshot` no cambian todavía su semántica BMR/legacy.

La infraestructura de importación e idempotencia queda creada sin importar
datos ni cargar objetivos reales. El motor diario, la derivación de gym desde
sesiones `completed` y el cambio definitivo del motor energético quedan para
la fase siguiente del issue #29.

### Sesiones persistentes y únicas — #1

La sesión activa dejó de inferirse únicamente por `ended_at`. El sistema incorporó estado explícito y una garantía de una sola sesión `in_progress` por usuario.

### Tema sin flash inicial — #3

El modo oscuro debe resolverse antes del primer paint; aplicar la clase de tema únicamente después del mount produce un flash claro.

### Crear rutina y entrar al editor — #4 / #22

Crear una rutina es una acción breve. Después de crearla se abre su editor. La gestión prioriza rutinas activas, archivadas y recién después opciones avanzadas/importación.

### Prevención de duplicados de ejercicios — #7

Una sesión no debe permitir insertar accidentalmente el mismo ejercicio más de una vez, tanto si parte de rutina como si es libre.

### Reordenamiento pertenece a la rutina — #9

El orden se edita en el gestor de rutinas. Una sesión activa conserva el snapshot de orden con el que fue creada.

### Editor de entrenamiento enfocado — #11

La sesión activa se organiza alrededor del ejercicio actual. Peso, reps, objetivo, RIR, check y descanso permanecen accesibles; progresión, notas y acciones destructivas se muestran bajo demanda.

### Tiempo real de sesión — #12

Inicio y duración se calculan desde `started_at`; una sesión completada utiliza `started_at` y `ended_at`.

### Reporte semanal sobre hechos — #13

Solo cuentan sesiones `completed` y series realmente completadas. Los nombres y músculos históricos se obtienen de snapshots.

### ABS/cardio como actividad real — #14

Abdomen deja de representarse como check auxiliar. Los datos cardio solo aparecen cuando existe cardio estructurado en la sesión. Los campos legacy pueden conservarse por compatibilidad.

### Guardado manual reemplazado por autosave — #15 → #30

El diseño inicial bloqueaba la finalización si había ejercicios dirty y pedía guardado manual. La decisión posterior reemplazó ese flujo por autosave no bloqueante, manteniendo drafts, concurrencia y finalización estricta.

### Experiencia desktop — #16

Desktop evoluciona como superficie de planificación y análisis, sin reemplazar la experiencia mobile-first.

### Historial de peso — #18

El peso actual vive en perfil y el peso histórico en `day_logs.weight_kg`. La edición de un punto histórico no modifica silenciosamente el peso actual.

### Navegación principal — #19

Mobile utiliza Inicio, Entrenar, Nutrición e Historial. Ajustes se accede desde el perfil y deja de ocupar un lugar principal en BottomNav.

### Inicio de entrenamiento mediante sheet — #20

El flujo cotidiano es elegir una rutina/sesión libre en una superficie superpuesta y confirmar. No requiere selector de fecha; usa el día local de Córdoba.

### Centro Entrenar — #21

`/train` se orienta a constancia, planificación y acceso a Rutinas, Progreso, Historial y Ejercicios. El inicio rápido se mantiene mediante FAB/selector reutilizable.

### Rutinas activas y archivadas — #22

`is_active = false` representa archivo, no hard delete. La UI utiliza semántica de Archivar/Restaurar.

### Progreso, historial y reporte individual — #23

- Progreso responde cómo viene el entrenamiento en general.
- Historial ayuda a encontrar un ejercicio o sesión.
- El detalle de ejercicio es el reporte individual canónico.

No se duplican rutas de reporte para el mismo concepto.

### Lenguaje de movimiento — #24

Microinteracciones cortas, superficies con fade/translate y selección mediante estado visual. Sin animaciones permanentes ni dependencias grandes solo por motion.

### RIR y acciones sensibles — #25 / #26

La alineación se resuelve con geometría real, no offsets mágicos. El bloque global de acciones sensibles mantiene un indicador destructivo discreto visible abierto o cerrado.

### Formulario de perfil en iPhone — #26

Nacimiento y Género no comparten fila en viewports de teléfono; el input de fecha nativo necesita ancho suficiente.

### Historial de sesiones, corrección y descarte — #27

Historial separa Sesiones y Por ejercicio. Una completed se corrige con un flujo restringido y nunca vuelve a `in_progress`. Eliminar del historial utiliza descarte lógico y no el flujo de cancelación de una sesión activa.

### Confirmación de finalización — #28

El feedback de éxito aparece únicamente después de que backend confirma la finalización. Abrir posteriormente una sesión completed no vuelve a mostrar esa confirmación.

### Autosave no bloqueante — #30

El cambio local es inmediato y la sincronización ocurre en segundo plano. Saves del mismo ejercicio se serializan; saves de ejercicios distintos no bloquean la sesión. Finalizar hace flush y no completa si quedan errores.

### Fuentes de verdad y sincronizaciones — #32

La primera pasada de flujo de datos dejó documentadas las fuentes canónicas de
Perfil, Día, Cuerpo, Entrenamiento y Nutrición. El peso histórico inicia la
sincronización del peso actual; perfil, valores derivados y snapshots del día
de Córdoba se actualizan en la misma transacción. El detalle completo vive en
`../architecture/data-flow.md`.

### Recordatorios de próxima sesión — #35

`+ Peso`, `+ Repeticiones` y `Personalizado` son reminders de una sola vez, no cambios automáticos de targets. `apply_to_routine` es un mecanismo independiente que sí actualiza valores numéricos cuando el usuario lo solicita.

## Evoluciones que reemplazaron decisiones anteriores

| Decisión anterior | Decisión vigente |
| --- | --- |
| Guardar manualmente cada ejercicio | Autosave de fondo + finalización estricta (#30) |
| Ajustes en BottomNav | Nutrición en BottomNav + perfil para Ajustes (#19) |
| Fecha experimental en header de Home | Header compacto sin fecha (#24) |
| Eliminar rutina | Archivar/restaurar (#22) |
| Historial centrado solo en ejercicios | Sesiones + Por ejercicio (#27) |
| ABS como checkbox auxiliar | ABS como ejercicios/sesión real (#14) |

## Índice de issues cerrados relevados

| Issue | Tema |
| ---: | --- |
| [#1](https://github.com/IS03/gym/issues/1) | Persistencia de sesión activa |
| [#2](https://github.com/IS03/gym/issues/2) | Primeros problemas de autosave |
| [#3](https://github.com/IS03/gym/issues/3) | Flash de tema |
| [#4](https://github.com/IS03/gym/issues/4) | Crear rutina |
| [#5](https://github.com/IS03/gym/issues/5) | Duplicación accidental de comidas |
| [#6](https://github.com/IS03/gym/issues/6) | Historial inicial poco útil |
| [#7](https://github.com/IS03/gym/issues/7) | Ejercicio duplicado |
| [#8](https://github.com/IS03/gym/issues/8) | Feedback de carga |
| [#9](https://github.com/IS03/gym/issues/9) | Reordenar rutina |
| [#10](https://github.com/IS03/gym/issues/10) | Branding inicial |
| [#11](https://github.com/IS03/gym/issues/11) | Flujo de sesión activa |
| [#12](https://github.com/IS03/gym/issues/12) | Hora de inicio y duración |
| [#13](https://github.com/IS03/gym/issues/13) | Reporte semanal |
| [#14](https://github.com/IS03/gym/issues/14) | ABS y cardio |
| [#15](https://github.com/IS03/gym/issues/15) | Cambios pendientes antes de finalizar |
| [#16](https://github.com/IS03/gym/issues/16) | Desktop |
| [#17](https://github.com/IS03/gym/issues/17) | Login |
| [#18](https://github.com/IS03/gym/issues/18) | Historial de peso |
| [#19](https://github.com/IS03/gym/issues/19) | Perfil y navegación |
| [#20](https://github.com/IS03/gym/issues/20) | Inicio de entrenamiento |
| [#21](https://github.com/IS03/gym/issues/21) | Pantalla Entrenar |
| [#22](https://github.com/IS03/gym/issues/22) | Gestión de rutinas |
| [#23](https://github.com/IS03/gym/issues/23) | Progreso e historial por ejercicio |
| [#24](https://github.com/IS03/gym/issues/24) | Motion |
| [#25](https://github.com/IS03/gym/issues/25) | RIR y Más opciones |
| [#26](https://github.com/IS03/gym/issues/26) | Pulido mobile |
| [#27](https://github.com/IS03/gym/issues/27) | Historial/corrección/descarte de sesiones |
| [#28](https://github.com/IS03/gym/issues/28) | Confirmación post-finalización |
| [#30](https://github.com/IS03/gym/issues/30) | Autosave no bloqueante |
| [#32](https://github.com/IS03/gym/issues/32) | Fuentes de verdad y flujo de datos |
| [#35](https://github.com/IS03/gym/issues/35) | Reminders de próxima sesión |

La recopilación extensa original se conserva en `../archive/issue-history-full.md` como material histórico.
