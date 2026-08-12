# OWNLEVEL — Memoria técnica de decisiones e issues cerrados

> Documento de contexto histórico y técnico generado a partir de los issues cerrados del repositorio `IS03/gym` y de sus comentarios.
>
> **Fecha de recopilación:** 12 de agosto de 2026  
> **Issues cerrados relevados:** 30 (`#1` a `#28`, `#30` y `#35`)  
> **Repositorio:** `IS03/gym`

---

## 1. Propósito de este documento

Este archivo no pretende reemplazar el código ni convertirse en una especificación rígida del producto. Su objetivo es conservar el razonamiento que llevó a OWNLEVEL desde sus primeras iteraciones hasta la arquitectura y UX actuales.

Los issues contienen información que suele perderse cuando se cierra una tarea:

- cuál era el problema real;
- qué hipótesis iniciales resultaron incorrectas;
- qué decisión de producto se tomó;
- qué solución técnica se eligió;
- qué garantías se decidió preservar;
- qué alternativas se descartaron;
- qué deuda técnica quedó;
- qué decisiones posteriores reemplazaron decisiones anteriores.

Esto es especialmente útil para futuras tareas realizadas con ChatGPT Work/Codex: antes de modificar una zona sensible, este documento permite entender **por qué el sistema está hecho de determinada manera**.

### Orden de autoridad

Cuando exista una contradicción, usar este orden:

1. **Código actual del repositorio.**
2. **Migraciones y esquema real de Supabase.**
3. **`docs/entrenamiento-robusto.md` y documentación técnica vigente.**
4. **Tests actuales.**
5. **Este documento.**
6. **Issues históricos individuales.**

Un issue cerrado explica una decisión en un momento determinado, pero no garantiza que esa decisión siga vigente si fue reemplazada después.

---

# 2. Principios consolidados de OWNLEVEL

A lo largo de los issues aparecen varios principios repetidos. Estos son los que deben tratarse como invariantes salvo una decisión explícita posterior.

## 2.1 Rutina y sesión son entidades distintas

Una rutina es una plantilla editable.

Una sesión representa lo que realmente ocurrió en un entrenamiento concreto.

Por lo tanto:

- editar una rutina no debe reescribir sesiones históricas;
- una sesión iniciada conserva snapshots;
- nombres, objetivos y estructura histórica no deben reconstruirse desde la rutina actual;
- una corrección histórica no debe volver a ejecutar la lógica normal de finalización.

Issues relacionados: [#1](https://github.com/IS03/gym/issues/1), [#11](https://github.com/IS03/gym/issues/11), [#27](https://github.com/IS03/gym/issues/27).

---

## 2.2 Una sola sesión activa por usuario

El sistema evolucionó desde inferir una sesión abierta mediante `ended_at` a tener un estado explícito.

La garantía deseada es:

```text
por usuario
→ como máximo una sesión in_progress
```

La UI puede ayudar a evitar dobles inicios, pero la protección definitiva debe existir en backend/base de datos.

Issue principal: [#1](https://github.com/IS03/gym/issues/1).

---

## 2.3 La sesión activa debe sobrevivir a navegación, refresh y mala conexión

El entrenamiento no puede depender de permanecer en una pantalla concreta.

La arquitectura terminó combinando:

```text
estado local inmediato
+
draft local versionado
+
persistencia remota
+
control optimista de concurrencia
```

El objetivo es que una interacción de navegación o una conexión móvil mediocre no haga perder el entrenamiento.

Issues relacionados: [#1](https://github.com/IS03/gym/issues/1), [#2](https://github.com/IS03/gym/issues/2), [#30](https://github.com/IS03/gym/issues/30).

---

## 2.4 Autosave no bloqueante, finalización estricta

Esta es una de las evoluciones más importantes del proyecto.

El modelo actual deseado es:

```text
cambio del usuario
↓
draft local inmediato
↓
UI responde inmediatamente
↓
autosave en segundo plano
↓
confirmación remota
```

El usuario puede pasar a otro ejercicio mientras el anterior se sincroniza.

La única barrera estricta es **Finalizar entrenamiento**:

```text
flush de autosaves
↓
todo confirmado
↓
finish_workout_session
↓
completed
```

Si algo no pudo guardarse, la sesión permanece `in_progress`.

Issue actual que define esta semántica: [#30](https://github.com/IS03/gym/issues/30).

---

## 2.5 Una respuesta vieja nunca puede pisar una edición nueva

Para un mismo ejercicio, los saves deben serializarse correctamente.

Ejemplo:

```text
A → guardar 52 kg
usuario cambia a 55 kg mientras A está en vuelo
A responde
B → guardar 55 kg usando la nueva versión server
```

La respuesta de A no puede resetear el draft a 52 kg.

Esto debe convivir con `updated_at`/optimistic concurrency.

Issue principal: [#30](https://github.com/IS03/gym/issues/30).

---

## 2.6 Historial completado es histórico

Una sesión `completed` no debe convertirse nuevamente en una sesión viva solo para corregir un error.

Corregir significa:

> arreglar datos realizados que fueron cargados mal.

No significa:

> reabrir el entrenamiento.

Datos como fecha, horario, rutina, identidad de ejercicios, snapshots de objetivos y progresión deben permanecer congelados.

Issue principal: [#27](https://github.com/IS03/gym/issues/27).

---

## 2.7 Corregir historial sí actualiza reportes, pero no planificación

Si se corrige:

```text
520 kg
→
52 kg
```

deben cambiar:

- volumen histórico;
- mejor peso;
- gráficos;
- métricas;
- progreso del ejercicio.

Pero no debe cambiar automáticamente la rutina actual ni volver a ejecutar `apply_to_routine`.

Issue principal: [#27](https://github.com/IS03/gym/issues/27).

---

## 2.8 Eliminar una sesión completada no equivale a cancelar una activa

Son dos operaciones distintas.

### Sesión activa

`cancelWorkoutSession`

- solo para `in_progress`;
- elimina/cancela la sesión en curso según la arquitectura existente.

### Sesión histórica

La solución diseñada es descarte lógico:

```text
completed
→
discarded
```

No hard delete.

Así deja de participar en historial/reportes/calendario sin destruir inmediatamente sus ejercicios y series.

Issue principal: [#27](https://github.com/IS03/gym/issues/27).

---

## 2.9 Las estadísticas se calculan sobre hechos, no sobre intención

Para reportes de entrenamiento:

- contar solo sesiones `completed`;
- contar solo series realmente completadas;
- duración = `ended_at - started_at`;
- nombres históricos = snapshots;
- músculos = snapshot del ejercicio realizado;
- no reinterpretar semanas antiguas usando el catálogo actual.

Issue principal: [#13](https://github.com/IS03/gym/issues/13).

---

## 2.10 No inventar contribuciones musculares indirectas

Una serie de press no debe convertirse artificialmente en:

```text
1 serie pecho
0,5 tríceps
0,5 hombros
```

Mientras el modelo no tenga esa semántica explícita, las series se atribuyen al grupo muscular estructurado del ejercicio.

Issue principal: [#13](https://github.com/IS03/gym/issues/13).

---

## 2.11 `+ Peso`, `+ Repeticiones` y `Personalizado` son recordatorios, no automatización

La semántica más reciente es:

```text
+ Peso
= recordame evaluar subir peso la próxima vez

+ Repeticiones
= recordame evaluar subir repeticiones la próxima vez

Personalizado
= mostrame esta nota la próxima vez

Mantener
= no queda recordatorio pendiente
```

No modificar automáticamente los números.

Issue principal: [#35](https://github.com/IS03/gym/issues/35).

---

## 2.12 `Usar lo realizado como próximo objetivo` es independiente del reminder

Este checkbox sí controla valores numéricos futuros.

Ejemplo:

```text
real:
30 × 15
30 × 13

apply_to_routine = true
↓
próximo objetivo:
30 × 15
30 × 13
```

Puede coexistir con un reminder `+ Peso`.

Por lo tanto hay dos sistemas diferentes:

```text
apply_to_routine
= guardá estos números

decision / reminder
= recordame revisar esto la próxima vez
```

Issue principal: [#35](https://github.com/IS03/gym/issues/35).

---

## 2.13 Un reminder se consume al completar, no al iniciar

Si el usuario abre una sesión, ve `Subir peso` y luego cancela:

```text
el reminder sigue pendiente
```

Solo se consume cuando esa sesión se finaliza correctamente.

Issue principal: [#35](https://github.com/IS03/gym/issues/35).

---

## 2.14 El flujo cotidiano de iniciar entrenamiento debe ser simple

La decisión de producto consolidada es:

```text
tocar
→
elegir rutina o sesión libre
→
confirmar
→
entrenar
```

No:

```text
tocar
→
nueva página
→
fecha
→
modo
→
select de rutina
→
submit
```

El flujo normal usa el selector superpuesto reutilizable (`StartWorkoutSheet`).

Issue principal: [#20](https://github.com/IS03/gym/issues/20).

---

## 2.15 La fecha cotidiana de entrenamiento es “hoy en Córdoba”

El inicio normal no necesita selector de fecha.

La fecha debe resolverse con:

```text
America/Argentina/Cordoba
```

y lo más cerca posible del momento real de creación.

No depender ingenuamente de:

```ts
new Date().toISOString().slice(0, 10)
```

si eso puede representar otro día local.

Issues relacionados: [#12](https://github.com/IS03/gym/issues/12), [#13](https://github.com/IS03/gym/issues/13), [#18](https://github.com/IS03/gym/issues/18), [#20](https://github.com/IS03/gym/issues/20), [#21](https://github.com/IS03/gym/issues/21).

---

## 2.16 Mobile es la experiencia primaria de entrenamiento

Los issues insisten especialmente en validar:

- 375 px;
- 390 px;
- 430 px;
- safe areas de iPhone;
- teclado;
- PWA;
- touch targets.

Desktop tiene una experiencia más analítica/administrativa, pero no debe provocar regresiones mobile.

---

## 2.17 Movimiento sutil y funcional

Lenguaje de motion definido en los issues:

| Interacción | Dirección |
|---|---|
| Press | scale pequeño, ~80–140 ms |
| Cambio de estado | ~120–180 ms |
| Entrada de superficie | fade + translate corto |
| Sheet | ~180–260 ms |
| Selección | color/borde + check |
| Reduced motion | respetado |

No usar animaciones infinitas ni instalar Framer Motion solo para microinteracciones.

Issue principal: [#24](https://github.com/IS03/gym/issues/24).

---

# 3. Evolución de decisiones importantes

Esta sección evita que una tarea futura trate como vigente una decisión que ya fue reemplazada.

## 3.1 Guardado manual → autosave

### Etapa inicial — #11

El rediseño del editor conservaba un modelo de:

```text
Cambios sin guardar
[Guardar]
```

### Etapa de robustez UX — #15

Se mantenía la regla de guardado explícito y se pedía mostrar exactamente qué ejercicios faltaban guardar al finalizar.

### Decisión posterior — #30

La fricción del guardado manual se consideró demasiado alta para uso real en gimnasio.

Nueva dirección:

```text
autosave de fondo
+
draft local
+
sin bloqueo entre ejercicios
+
flush estricto al finalizar
```

**#30 reemplaza la parte de UX de guardado manual de #11/#15.**

Las garantías de drafts, concurrencia y finalización robusta permanecen.

---

## 3.2 Ajustes en BottomNav → Nutrición en BottomNav + perfil en Home

Antes:

```text
Inicio
Entrenar
Historial
Ajustes
```

Después de [#19](https://github.com/IS03/gym/issues/19):

```text
Inicio
Entrenar
Nutrición
Historial
```

Ajustes permanece en `/settings`, pero entra conceptualmente en el área de perfil/cuenta.

---

## 3.3 Fecha en el header de Home → eliminada

En #19 la fecha se dejó como experimento visual.

En #24 se tomó la decisión explícita de quitarla.

Header final deseado:

```text
[OL]                     [ I Ignacio › ]
```

Sin saludo grande y sin fecha secundaria.

---

## 3.4 Historial genérico → tres funciones distintas

### #6

Problema inicial: historial vago, sin filtros ni resúmenes.

### #23

Se define una arquitectura conceptual:

- Progreso = visión global + acceso rápido por ejercicio.
- Historial por ejercicio = encontrar un ejercicio.
- Reporte individual = analizar su evolución.

### #27

Se suma otra dimensión:

- Historial → **Sesiones**
- Historial → **Por ejercicio**

Además aparecen continuidad, corrección histórica y descarte de sesiones.

---

## 3.5 “Eliminar rutina” → “Archivar rutina”

En etapas tempranas la UI utilizaba semántica destructiva.

[#22](https://github.com/IS03/gym/issues/22) aclara que el backend realmente usaba `is_active = false`.

Decisión:

```text
Eliminar
→
Archivar
```

El historial no se destruye y la rutina puede restaurarse.

---

## 3.6 Logo provisional → identidad OWNLEVEL

[#10](https://github.com/IS03/gym/issues/10) documenta una etapa de logos provisionales en `Logos/logos gym`.

Posteriormente el producto adopta OWNLEVEL como identidad y los assets pasan a formar parte de la aplicación.

El issue #10 debe leerse como historia del branding, no como estado actual.

---

## 3.7 Abdomen/cinta como metadata auxiliar → actividades reales separadas

[#14](https://github.com/IS03/gym/issues/14) establece:

```text
PUSH
ABS
CINTA
```

son sesiones reales separadas.

No se debe volver a registrar abdominales mediante un check auxiliar dentro de PUSH/PULL/LEGS.

Los campos legacy pueden mantenerse temporalmente por compatibilidad histórica, sin seguir dominando la UX nueva.

---

# 4. Mapa temático de issues

## Persistencia, robustez y guardado

- [#1 — Persistencia de sesión en progreso](https://github.com/IS03/gym/issues/1)
- [#2 — Primeros problemas de autosave](https://github.com/IS03/gym/issues/2)
- [#15 — Feedback de cambios pendientes](https://github.com/IS03/gym/issues/15)
- [#30 — Autosave no bloqueante](https://github.com/IS03/gym/issues/30)

## UX de sesión activa

- [#11 — Rediseño de sesión activa](https://github.com/IS03/gym/issues/11)
- [#12 — Hora real y duración](https://github.com/IS03/gym/issues/12)
- [#14 — ABS/CINTA](https://github.com/IS03/gym/issues/14)
- [#25 — RIR y Más opciones](https://github.com/IS03/gym/issues/25)
- [#26 — Pulido mobile](https://github.com/IS03/gym/issues/26)
- [#28 — Confirmación al finalizar](https://github.com/IS03/gym/issues/28)
- [#35 — Recordatorios de próxima sesión](https://github.com/IS03/gym/issues/35)

## Inicio de entrenamiento y centro Entrenar

- [#20 — StartWorkoutSheet](https://github.com/IS03/gym/issues/20)
- [#21 — Rediseño de `/train`](https://github.com/IS03/gym/issues/21)
- [#24 — Motion](https://github.com/IS03/gym/issues/24)

## Rutinas y ejercicios

- [#4 — Crear rutina](https://github.com/IS03/gym/issues/4)
- [#7 — Ejercicio duplicado](https://github.com/IS03/gym/issues/7)
- [#9 — Reordenar rutina](https://github.com/IS03/gym/issues/9)
- [#22 — Gestión de rutinas](https://github.com/IS03/gym/issues/22)

## Progreso e historial

- [#6 — Historial vago](https://github.com/IS03/gym/issues/6)
- [#13 — Reporte semanal](https://github.com/IS03/gym/issues/13)
- [#18 — Historial de peso](https://github.com/IS03/gym/issues/18)
- [#23 — Progreso e historial por ejercicio](https://github.com/IS03/gym/issues/23)
- [#27 — Historial de sesiones](https://github.com/IS03/gym/issues/27)

## Nutrición

- [#5 — Comidas duplicadas](https://github.com/IS03/gym/issues/5)

## Navegación, responsive, branding y feedback

- [#3 — Flash de tema](https://github.com/IS03/gym/issues/3)
- [#8 — Falta visual de loading](https://github.com/IS03/gym/issues/8)
- [#10 — Logo](https://github.com/IS03/gym/issues/10)
- [#16 — Desktop](https://github.com/IS03/gym/issues/16)
- [#17 — Login](https://github.com/IS03/gym/issues/17)
- [#19 — Perfil + navegación](https://github.com/IS03/gym/issues/19)
- [#24 — Motion](https://github.com/IS03/gym/issues/24)
- [#26 — Pulido mobile](https://github.com/IS03/gym/issues/26)

---

# 5. Catálogo de issues cerrados

## #1 — FALTA DE PERSISTENCIA DE SESIÓN EN PROGRESO

**Fuente:** https://github.com/IS03/gym/issues/1

### Problema reportado

Una sesión abierta parecía perderse fácilmente y no existía una continuidad clara al volver a Entrenar.

### Diagnóstico documentado

El comentario de revisión aclara que el problema inicial estaba parcialmente mal identificado.

La sesión ya se insertaba en `workout_sessions` y los cambios de ejercicios ya llegaban a `workout_session_exercises`.

El problema real era:

- no detectar la sesión abierta al regresar;
- mostrar nuevamente “Iniciar sesión”;
- permitir crear otra sesión;
- inferir “abierta/cerrada” solamente a través de `ended_at`;
- no tener una protección explícita de una sola sesión abierta.

### Solución documentada

Migración:

`supabase/migrations/20260427_0014_workout_session_status.sql`

Se incorporó:

- estado explícito `in_progress | completed`;
- `user_id` en sesiones;
- trigger para mantenerlo alineado con `day_log_id`;
- índice único parcial `uniq_workout_sessions_user_in_progress`;
- limpieza de duplicados abiertos legacy.

En servidor:

- `WorkoutSessionStatus`;
- `getInProgressSessionForUser()`;
- inicio de sesión protegido contra una segunda sesión;
- `finishSession` marca `completed` y define `ended_at`;
- historial/listados filtran sesiones completadas;
- mutaciones de sesión requieren estado `in_progress`.

### Garantía que queda

> La sesión activa es una entidad persistente y única, no un estado efímero de una pantalla.

---

## #2 — SESIÓN AUTO SAVE

**Fuente:** https://github.com/IS03/gym/issues/2

### Problema reportado

> Errores con el auto guardado, desaparecen datos y no se puede distinguir lo hecho.

### Documentación disponible

El issue no contiene comentarios que expliquen una implementación final concreta.

### Evolución

Este issue representa una etapa temprana del mismo problema de robustez que más tarde fue tratado con mucha mayor precisión en [#30](https://github.com/IS03/gym/issues/30).

Para conocer la semántica actual del autosave, usar #30.

---

## #3 — FLASH

**Fuente:** https://github.com/IS03/gym/issues/3

### Problema

Flash blanco durante la carga inicial antes de entrar en modo oscuro.

### Diagnóstico documentado

- `next-themes` estaba instalado pero no era quien controlaba realmente el tema.
- La aplicación utilizaba un contexto propio.
- La clase `dark` se aplicaba dentro de `useEffect`.
- El primer paint ocurría con variables claras de `:root`.
- El HTML renderizado por servidor no tenía todavía `class="dark"`.

Resultado:

```text
paint claro
↓
useEffect
↓
dark
```

### Principio de solución

El tema efectivo debe resolverse antes del primer paint, no después de montar React.

---

## #4 — RUTINA NUEVA

**Fuente:** https://github.com/IS03/gym/issues/4

### Problema

La creación de rutinas necesitaba una interfaz mejor y, después de crear una, debía abrirse inmediatamente para agregar ejercicios.

### Comentario de cierre

> Mejorado y nueva opción de eliminar.

### Evolución posterior

[#22](https://github.com/IS03/gym/issues/22) redefine con mayor precisión la administración:

- activas primero;
- archivadas;
- nueva rutina mediante sheet/modal;
- después de crear → abrir editor;
- “Eliminar” se reemplaza conceptualmente por “Archivar”.

---

## #5 — COMIDAS DUPLICADAS

**Fuente:** https://github.com/IS03/gym/issues/5

### Problema

Era posible cargar dos veces consecutivas la misma comida con mismo nombre/calorías/proteína sin advertencia.

### Solución documentada en el issue

No hay comentario de implementación final.

### Estado arquitectónico que debe preservarse

La creación de comidas debe contemplar la posibilidad de doble submit/repetición accidental.

No debe convertirse en una restricción que impida legítimamente comer lo mismo dos veces; la intención original es detectar la duplicación accidental inmediata.

---

## #6 — HISTORIAL VAGO

**Fuente:** https://github.com/IS03/gym/issues/6

### Problema

El historial no explicaba diferencias, no tenía filtros y carecía de resúmenes claros.

### Comentarios

No hay detalle de solución en el issue.

### Evolución posterior

Este problema fue dividido posteriormente en soluciones más específicas:

- [#23](https://github.com/IS03/gym/issues/23): Progreso, buscador de ejercicios y reporte individual.
- [#27](https://github.com/IS03/gym/issues/27): historial de sesiones, continuidad, corrección y descarte.

---

## #7 — EJERCICIO DUPLICADO

**Fuente:** https://github.com/IS03/gym/issues/7

### Problema

Durante una sesión iniciada desde rutina se podía volver a agregar un ejercicio que ya formaba parte de ella.

### Comentario adicional

La misma duplicación también ocurría en sesiones libres.

### Garantía deseada

La prevención debe cubrir:

- sesión desde rutina;
- sesión libre.

No debe depender solamente de una comprobación visual del selector.

---

## #8 — FALTA VISUAL DE LOAD

**Fuente:** https://github.com/IS03/gym/issues/8

### Problema

Había demoras reales entre páginas, cargas y guardados, pero la interfaz no comunicaba que estuviera trabajando.

### Comentarios

No hay implementación final documentada.

### Principio que deja

> Una demora sin feedback se percibe como interfaz rota.

Los estados pending/loading deben ser visibles sin convertir cada navegación en una pantalla de espera pesada.

---

## #9 — REORDENAR RUTINA

**Fuente:** https://github.com/IS03/gym/issues/9

### Problema

No se podían reordenar los ejercicios dentro de una rutina.

### Decisión de producto

La modificación debe hacerse sobre la **rutina base**, no mientras se está realizando una sesión.

### Comentario de cierre

> Ya se pueden mover desde el gestor de rutinas.

### Garantía

El orden de la plantilla se administra desde Rutinas. Una sesión activa conserva su snapshot/orden histórico.

---

## #10 — CREAR LOGO Y AGREGAR A INICIO

**Fuente:** https://github.com/IS03/gym/issues/10

### Problema

Incorporar identidad visual a la app.

### Comentario

> Logos en `Logos/logos gym` provisionales.

### Estado histórico

Este issue corresponde a una etapa previa de branding.

Posteriormente el producto adopta la identidad **OWNLEVEL**, por lo que los assets mencionados acá deben interpretarse como provisionales/históricos.

---

## #11 — CAMBIO FLUJO SESIÓN EN CURSO

**Fuente:** https://github.com/IS03/gym/issues/11

### Problema

El editor de sesión se sentía como un formulario enorme. Todos los ejercicios y todas las opciones competían visualmente.

### Objetivo

Convertir la sesión activa en una experiencia de entrenamiento móvil:

```text
mirar
→
editar
→
completar
→
descansar
→
seguir
```

### Jerarquía definida

#### Siempre visible en ejercicio abierto

- nombre;
- músculo/implemento;
- progreso;
- serie;
- kg real;
- reps reales;
- objetivos de kg/reps;
- `target_rir`;
- check;
- descanso;
- timer manual.

#### Secundario

- agregar serie;
- estado de guardado.

#### Desplegable

- progresión;
- decisión para próxima vez;
- `apply_to_routine`;
- notas.

#### Avanzado/destructivo

- descartar cambios;
- quitar ejercicio.

### Acordeón

- preferencia por un ejercicio abierto;
- abrir parcialmente completado primero;
- si no, primer incompleto;
- no persistir “ejercicio actual” en DB;
- completar la última serie **no** auto-colapsa.

### RIR

`target_rir` sigue siendo guía, no input real.

No crear `actual_rir` por esta tarea.

### Timer

Manual.

Marcar una serie:

```text
NO inicia timer
```

### Guardado

El issue todavía describe la etapa de guardado manual.

**Esta parte fue reemplazada posteriormente por #30.**

### Invariantes que sí siguen vigentes

- drafts;
- stale draft protection;
- optimistic concurrency;
- snapshots;
- read-only completed;
- finalización robusta;
- `apply_to_routine` explícito.

---

## #12 — TIMER HORA DE INICIO

**Fuente:** https://github.com/IS03/gym/issues/12

### Decisión

Mostrar durante una sesión activa:

- hora real de inicio (`started_at`);
- tiempo transcurrido.

Actualizar con frecuencia baja, idealmente una vez por minuto.

### Sesión completada

Usar:

- `started_at`;
- `ended_at`;

para mostrar rango horario y duración final.

### Restricción técnica

No crear columnas nuevas: los timestamps ya existían.

---

## #13 — REPORTE SEMANAL

**Fuente:** https://github.com/IS03/gym/issues/13

### Objetivo

Responder rápidamente:

- cuántas veces entrené;
- cuánto tiempo;
- cuántas series;
- qué rutinas;
- qué músculos;
- cuántas series por músculo.

### Fuente de verdad

Reutilizar `getTrainingProgress()`.

No crear otro sistema de estadísticas para Home.

### Semana

```text
lunes → domingo
America/Argentina/Cordoba
```

### Qué cuenta

Solo:

```text
workout_sessions.status = completed
```

Series:

```text
workout_sets.is_completed = true
```

### Duración

```text
ended_at - started_at
```

No estimarla con descansos ni timers.

### Rutinas

Usar `routine_name_snapshot` o fallback histórico.

No reconstruir desde la rutina actual.

### Músculos

Usar snapshots del ejercicio realizado.

Cada serie completada suma al grupo muscular almacenado.

No realizar atribución indirecta/fraccionaria.

### Home

Compacto:

- entrenamientos;
- duración;
- series;
- días;
- rutinas;
- pocos músculos principales;
- acceso a reporte completo.

### Detalle

Preferencia por integrar el reporte en `/train/progress`, no crear otro dashboard/ruta.

---

## #14 — ABDOMEN Y CINTA DENTRO DE OTRAS SESIONES

**Fuente:** https://github.com/IS03/gym/issues/14

### Inconsistencia

Existían rutinas/sesiones reales:

- PUSH;
- PULL;
- LEGS;
- ABS;
- CINTA.

Pero una sesión normal todavía mostraba metadata legacy:

- “Hice abdominales”;
- minutos de cinta;
- distancia;
- velocidad;
- inclinación.

Eso permitía registrar conceptualmente lo mismo de dos formas.

### Decisión para ABS

Eliminar “Hice abdominales” de la UX nueva.

ABS debe registrarse mediante una sesión real y ejercicios reales.

### Compatibilidad

No hacer `DROP COLUMN abs_completed` solo por este cambio.

Puede mantenerse para datos históricos/compatibilidad.

### Decisión para cardio

Los datos de cinta siguen temporalmente a nivel sesión.

Mostrar esa sección **solo cuando la sesión contiene cardio estructurado**.

No detectar por nombres como:

```text
"CINTA"
```

### Sesiones mixtas

Si una sesión libre contiene un ejercicio cardio, puede mostrar metadata cardio.

### Independencia

```text
PUSH + ABS mismo día
= dos sesiones

PUSH + CINTA mismo día
= dos sesiones
```

No sincronizar metadata entre ellas.

### Deuda técnica explícita

A futuro los datos específicos de cardio idealmente deberían vivir a nivel del ejercicio ejecutado, no como metadata global de sesión.

---

## #15 — NO DEJA GUARDAR POR GUARDADO DE EJERCICIOS INDIVIDUALES SIN ALERTA

**Fuente:** https://github.com/IS03/gym/issues/15

### Problema

La aplicación bloqueaba correctamente Finalizar si había ejercicios dirty, pero no indicaba cuáles.

### Solución deseada en ese momento

Mostrar:

```text
Cambios sin guardar

- Press plano
- Elevaciones laterales

[ Ir al primer ejercicio ]
```

usando la misma fuente `dirtyIds`, no una segunda lógica.

### Importante: decisión histórica

Este issue defendía explícitamente el guardado manual.

Posteriormente [#30](https://github.com/IS03/gym/issues/30) cambia el modelo a autosave no bloqueante.

Por lo tanto:

- la necesidad de identificar errores/pending sigue siendo válida;
- el requisito “no autosave” ya no lo es.

---

## #16 — MODO ESCRITORIO NO EXISTENTE

**Fuente:** https://github.com/IS03/gym/issues/16

### Problema

No existía una experiencia desktop real.

### Documentación disponible

El body no contiene detalle y no hay comentarios de implementación.

### Principio histórico

Marca el comienzo de la evolución desde una interfaz exclusivamente mobile hacia una experiencia desktop orientada a:

- análisis;
- planificación;
- rutinas;
- reportes.

---

## #17 — MEJORAR INICIO DE SESIÓN

**Fuente:** https://github.com/IS03/gym/issues/17

### Problema

La pantalla de login era demasiado básica y necesitaba mayor pulido/animación.

### Documentación disponible

No hay comentarios que describan la solución exacta.

### Evolución

Más adelante el producto adopta la identidad OWNLEVEL y un lenguaje visual más definido.

---

## #18 — HISTORIAL PESO

**Fuente:** https://github.com/IS03/gym/issues/18

### Hallazgo arquitectónico clave

No hacía falta una tabla nueva.

Ya existían:

```text
profiles.current_weight_kg
```

y:

```text
day_logs.weight_kg
```

### Modelo mental adoptado

```text
Perfil
= peso actual

Day log
= fotografía histórica del peso en esa fecha
```

### Granularidad

Un registro por día.

Guardar nuevamente el mismo día corrige ese punto, no crea otro.

### Peso vacío

No debe:

- crear un histórico ficticio;
- borrar implícitamente un peso histórico ya existente.

### Fecha

Usar fecha local de Córdoba.

### Borrar historial

No borrar `day_logs`.

Solo:

```text
day_logs.weight_kg = null
```

porque el day log contiene más información.

### Editar histórico

No debe modificar silenciosamente `profiles.current_weight_kg`.

### Reporte

Ubicación elegida:

```text
/train/progress
```

### Semántica de tendencia

No asumir:

```text
bajar = verde
subir = rojo
```

porque el objetivo puede ser definición, mantenimiento o volumen.

La tendencia debe ser neutral.

### Gráfico

Simple, liviano; no instalar una chart library pesada solo para pocos puntos.

---

## #19 — ÍCONO DE PERFIL QUE TE LLEVA A AJUSTES Y PERFIL

**Fuente:** https://github.com/IS03/gym/issues/19

### Cambio conceptual de navegación

BottomNav mobile pasa a representar áreas cotidianas:

```text
Inicio
Entrenar
Nutrición
Historial
```

Ajustes deja de ocupar una pestaña principal.

### Ajustes

La ruta `/settings` permanece.

Su acceso se asocia visualmente al usuario/perfil en Home.

### Home header

Propuesta:

```text
[OL]                    [ I Ignacio › ]
```

- `BrandSymbol` a la izquierda;
- avatar inicial;
- nombre corto;
- chevron;
- toda la superficie abre `/settings`.

### Nombre

No modificar `profiles.display_name`.

Solo crear una representación compacta para UI.

### BottomNav

No reconstruir Liquid Glass.

Cambiar solamente:

- items;
- rutas;
- iconos;
- estado activo.

### Ruta sin item principal

En `/settings` no debe quedar “Inicio” falsamente activo.

### Fecha

En este issue quedó en prueba.

[#24](https://github.com/IS03/gym/issues/24) decide quitarla definitivamente.

---

## #20 — INTERFAZ DE INICIO DE ENTRENAMIENTO ENGORROSO

**Fuente:** https://github.com/IS03/gym/issues/20

### Problema

El flujo cotidiano llevaba a `/train/session/new` y se sentía como un formulario administrativo:

- fecha;
- sesión libre;
- rutina;
- select;
- submit.

### Nuevo modelo

```text
Home o Entrenar
↓
StartWorkoutSheet
↓
¿Qué vas a entrenar hoy?
↓
PUSH / PULL / LEGS / ABS / ...
Sesión libre
↓
seleccionar
↓
confirmar
↓
crear sesión
```

### Fecha

No mostrar selector.

Siempre usar hoy en Córdoba.

Resolver la fecha cerca de la operación para soportar correctamente un cambio de medianoche.

### Selección

Un tap selecciona.

El CTA confirma.

No crear la sesión al tocar accidentalmente una fila.

### Rutinas

- activas;
- visibles;
- no `<select>` como flujo principal;
- no preseleccionar la primera en Home;
- orden real del sistema.

### Sesión libre

Una opción dentro del mismo selector.

### Sesión ya activa

No mostrar opciones para crear otra.

Mostrar:

```text
Sesión en curso
[ Continuar entrenamiento ]
```

### Seguridad

La server action/backend sigue siendo protección definitiva contra race conditions.

### Responsive

- mobile: bottom sheet;
- desktop: dialog/modal compacto si encaja;
- misma lógica/contenido;
- safe area;
- focus trap;
- Escape;
- reduced motion.

### Fallback

No borrar `/train/session/new`.

Puede seguir existiendo para deep links/compatibilidad.

---

## #21 — SECCIÓN ENTRENAR

**Fuente:** https://github.com/IS03/gym/issues/21

### Problema

`/train` repetía demasiado el CTA principal de Home.

### Nueva función de la pantalla

Entrenar debe representar más:

```text
constancia
+
planificación
+
progreso
+
administración
```

### Composición

1. título;
2. mini calendario del mes;
3. cuatro accesos:
   - Rutinas;
   - Progreso;
   - Historial;
   - Ejercicios;
4. FAB `+` para iniciar/continuar sesión.

### Mini calendario

- mes actual en Córdoba;
- misma fuente de verdad que calendario completo;
- días entrenados = sesiones completed;
- preview visual;
- toda la superficie abre `/train/calendar`;
- no convertir 31 días en 31 targets táctiles pequeños.

### Grid

Mobile:

```text
2 × 2
```

### FAB

Usa el `StartWorkoutSheet` existente.

No crear un segundo flujo de creación.

---

## #22 — SECCIÓN RUTINAS

**Fuente:** https://github.com/IS03/gym/issues/22

### Problema

La jerarquía anterior mostraba primero:

- restaurar plantilla;
- formulario de nueva rutina;

y recién después las rutinas reales.

### Jerarquía nueva

1. activas;
2. archivadas;
3. acción Nueva rutina;
4. opciones avanzadas/importación al final.

### Arquitectura existente

`is_active` ya resuelve activo/archivado.

No crear una tabla/columna nueva.

### Semántica correcta

La antigua acción visual “Eliminar” realmente hacía:

```text
is_active = false
```

Por lo tanto debe llamarse:

```text
Archivar
```

### No hard delete

Preservar:

- historial;
- sesiones;
- snapshots;
- configuración.

### Archivadas

- secundarias;
- preferentemente colapsadas;
- pueden abrirse;
- pueden restaurarse (`is_active = true`).

### Nueva rutina

No mantener el formulario siempre visible.

Abrirlo en sheet/modal.

Solicitar solo:

- nombre;
- color.

Después de crear:

```text
crear
↓
abrir /train/routines/{id}
↓
agregar ejercicios/configurar
```

### Importación

Operación excepcional.

Mover al final bajo “Opciones avanzadas”.

---

## #23 — SECCIÓN PROGRESO

**Fuente:** https://github.com/IS03/gym/issues/23

### Problema

Progreso e Historial por ejercicio repetían información, y el reporte individual era demasiado pobre.

### Nueva arquitectura mental

#### `/train/progress`

Responde:

> ¿Cómo viene mi entrenamiento en general?

y permite acceso rápido a ejercicios.

#### `/train/history`

Responde:

> Quiero encontrar un ejercicio concreto.

#### `/train/history/[exerciseId]`

Responde:

> ¿Cómo evolucioné específicamente en este ejercicio?

Es el reporte detallado canónico.

### No duplicar reporte

No crear otra ruta tipo:

```text
/train/progress/exercise/{id}
```

### Progreso general

Preservar:

- semana;
- sesiones;
- series;
- duración;
- volumen;
- rutinas;
- músculos;
- comparación;
- evolución.

### “Por ejercicio”

Dejar de renderizar una pila interminable de cards grandes.

Agregar:

- búsqueda;
- músculo;
- rutina;
- resultados compactos.

### Filtro por rutina

Se basa en la composición **actual** de `routine_exercises`, porque su función es encontrar ejercicios del plan actual.

No inferir membresía desde historia.

### Ejercicio en varias rutinas

Debe aparecer con cualquiera de las rutinas asociadas.

Evitar N+1 mediante lectura batch.

### Mobile

Filtros en sheet compacto.

### Desktop

Filtros inline si resulta natural.

### Progreso vs Historial

- Progreso puede mostrar recientes/limitados inicialmente.
- Historial es directorio completo.

Ambos llevan al mismo reporte individual.

---

## #24 — FALTAN ANIMACIONES

**Fuente:** https://github.com/IS03/gym/issues/24

### Principio

No animar por decorar.

Las transiciones deben:

- responder al toque;
- comunicar cambio de estado;
- hacer que las superficies se sientan físicas;
- seguir siendo rápidas.

### FAB

Entrada única aproximada:

```text
opacity 0 → 1
scale .88 → 1
translateY 8px → 0
~220 ms
```

Press:

```text
scale ~.93
80–100 ms
```

No pulse infinito.

### Perfil de Home

Decisión adicional:

> sacar la fecha.

Header:

```text
[OL]                    [ I Ignacio › ]
```

Press:

- scale ~.97;
- fondo/borde un poco más presentes;
- chevron 1–2 px.

### Sheet de rutinas

Backdrop:

```text
fade ~180 ms
```

Superficie:

```text
translateY ~24px → 0
opacity .85 → 1
~220–260 ms
```

No hace falta subir desde 100% de la pantalla.

### Opciones

Stagger casi imperceptible, no espectáculo.

### Selección

- borde/fondo;
- check;
- feedback de press.

### Dependencias

No agregar Framer Motion.

Usar principalmente:

- transform;
- opacity;
- background-color;
- border-color.

---

## #25 — RIR DESCENTRADO Y FALTA DE DETALLE EN MÁS OPCIONES

**Fuente:** https://github.com/IS03/gym/issues/25

### Problema A — RIR

Aunque header y filas usaban una grilla compartida, visualmente el valor no quedaba centrado.

### Regla de solución

No arreglar con:

- `margin-left`;
- `translateX`;
- `left`;
- offsets mágicos.

Corregir la geometría real.

Header y contenido de RIR deben tener wrappers estructuralmente equivalentes y el mismo centro matemático.

### Check

Mantener:

- círculo visual pequeño;
- touch target grande;
- accesibilidad.

### Problema B — Más opciones global

La acción `Cancelar entrenamiento` vive dentro de un bloque “Más opciones” y era demasiado fácil no advertir su carácter sensible.

### Decisión visual

Agregar una franja vertical:

- ~2 px;
- `destructive`;
- sobria;
- a la izquierda;
- visible abierta/cerrada.

No:

- card roja;
- borde rojo completo;
- warning gigante;
- glow.

### Alcance

Solo el “Más opciones” global de la sesión.

No copiar automáticamente a “Más opciones del ejercicio”.

---

## #26 — DETALLES ESTÉTICOS

**Fuente:** https://github.com/IS03/gym/issues/26

Este issue es una segunda pasada sobre problemas que no habían quedado correctamente resueltos.

### Franja destructiva

Problema:

la franja de #25 no se veía cuando `<details>` estaba cerrado.

Decisión:

debe pertenecer al `<details>` completo o al `<summary>`, no únicamente al contenido abierto.

No depender de `group-open` para existir.

### RIR

Persistía la percepción de desalineación.

La corrección debe ser nuevamente estructural:

- revisar tracks;
- gaps;
- paddings;
- wrappers;
- simetría RIR/check.

### Nacimiento/Género en iPhone

Causa identificada:

```text
min-[430px]:grid-cols-2
```

activaba dos columnas justamente en un viewport donde el `input type="date"` nativo de iOS necesitaba más ancho.

### Solución

En teléfonos:

```text
Nacimiento
[ fecha ]

Género
[ select ]
```

Uno debajo del otro.

Dos columnas recién con ancho real suficiente (`sm` o equivalente).

Validar 375/390/430.

### Home → Settings

El `AppShell` persiste durante la navegación, por lo que una animación de mount del shell no necesariamente comunica el cambio.

Solución preferida:

- animación corta en el contenido específico de Settings;
- fade + 4–8px desde la derecha o pequeño Y;
- 160–200 ms;
- sin retrasar navegación;
- reduced motion.

### Home

No volver a introducir fecha ni saludo.

---

## #27 — VISUALIZAR, EDITAR O ELIMINAR SESIÓN REALIZADA

**Fuente:** https://github.com/IS03/gym/issues/27

### Cambio principal

Historial pasa a responder dos preguntas:

```text
Sesiones
= ¿qué entrenamientos hice?

Por ejercicio
= ¿cómo evolucionó este ejercicio?
```

### Vista por defecto

Preferencia:

```text
Sesiones
```

### Lista de sesiones

Solo `completed`.

Orden reciente → antiguo.

Usar datos históricos:

- nombre snapshot;
- `log_date`;
- `started_at`;
- `ended_at`;
- duración;
- ejercicios;
- series completadas.

Evitar N+1.

### Continuidad

Mostrar hechos:

- última sesión;
- última vez de cada rutina activa;
- cuántos días pasaron;
- eventualmente cuál lleva más tiempo sin aparecer.

### Restricción de producto

No decir todavía:

```text
Hoy te toca LEGS
```

si no existe un algoritmo/regla explícita.

Mostrar información objetiva, no inventar recomendación.

### Corrección histórica

Una sesión completed continúa completed.

No:

```text
completed → in_progress
```

Crear un flujo dedicado.

### Qué se puede corregir

Primera versión segura:

- `actual_weight_kg`;
- `actual_reps`;
- potencialmente notas/metadata descriptiva permitida.

### Qué queda congelado

Entre otros:

- fecha;
- started_at;
- ended_at;
- duración;
- rutina;
- identidad de ejercicios;
- snapshots;
- objetivos;
- target RIR;
- orden;
- progresión;
- `apply_to_routine`.

### Regla crítica

Guardar una corrección:

```text
NO llama finish_workout_session
NO reejecuta progresión
NO modifica la rutina actual
```

### Reportes

Sí deben reflejar la corrección de datos reales.

### Eliminar sesión

No reutilizar `cancelWorkoutSession`.

No hard delete.

Solución diseñada:

```text
completed
→
discarded
```

### Efectos de discarded

No debe contar en:

- historial;
- progreso;
- volumen;
- best weights;
- calendario;
- continuidad;
- reportes.

Los registros físicos pueden permanecer.

### Cancelación activa

Sigue siendo una operación separada y únicamente para `in_progress`.

---

## #28 — AVISO DE CONFIRMACIÓN DE RUTINA FINALIZADA Y OPCIÓN DE HOME O REVISAR

**Fuente:** https://github.com/IS03/gym/issues/28

### Problema

La sesión pasaba correctamente a read-only al finalizar, pero el éxito era demasiado silencioso.

### Solución

Después de que backend confirma la finalización:

```text
✓ Entrenamiento guardado
PUSH se guardó correctamente

[ Ir al inicio ]
Ver sesión
```

### Acciones

**Ir al inicio**

→ `/home`

**Ver sesión**

→ cerrar confirmación y permanecer en el detalle read-only.

### Regla importante

Mostrar solamente como consecuencia inmediata de una finalización exitosa.

No mostrar al:

- refrescar;
- abrir una sesión histórica;
- entrar por URL a una completed.

### Orden

```text
Finalizar
↓
backend
↓
completed
↓
read-only
↓
confirmación
```

Nunca anticipar éxito.

---

## #30 — DEMORA AL GUARDAR EJERCICIO DENTRO DE RUTINA ACTIVA

**Fuente:** https://github.com/IS03/gym/issues/30

### Problema

El guardado manual por ejercicio obligaba a:

```text
editar
→
guardar
→
esperar
→
seguir
```

y hacía que una conexión móvil mediocre se sintiera como bloqueo del entrenamiento.

### Decisión nueva

Autosave no bloqueante.

### Modelo

```text
cambio
↓
draft local
↓
UI inmediata
↓
debounce
↓
save backend
```

### Debounce

Aproximadamente 700–1000 ms desde el último cambio, según implementación real.

No request por tecla.

### Distintos ejercicios

Pueden sincronizarse simultáneamente.

Ejemplo:

```text
Jalón      Guardando…
Remo       Guardando…
Curl       ✓ Guardado
```

No `globalPending` que bloquee toda la sesión.

### Mismo ejercicio

Serializar.

Una respuesta vieja nunca puede limpiar una versión local más reciente.

### Navegación interna

Mientras guarda, permitir:

- colapsar;
- abrir otro;
- editar otro;
- marcar series;
- usar timer;
- recorrer sesión.

### Error de background

No interrumpir el entrenamiento con modal.

Mostrar estado discreto y conservar draft.

### Finalizar

Acá sí existe barrera estricta.

La app debe:

1. detectar saves programados;
2. detectar saves en vuelo;
3. detectar cambios locales;
4. intentar flush;
5. detenerse si algo falla;
6. llamar `finish_workout_session` solo cuando todo está confirmado.

### Eliminación de ejercicio

Debe cancelar/dejar inválido cualquier autosave pendiente para evitar que un save viejo intente modificar/revivir un ejercicio eliminado.

### Performance

Revisar trabajo innecesario por autosave, por ejemplo `revalidatePath`, sin eliminar protecciones a ciegas.

### Principio final

```text
local inmediato
+
nube en segundo plano
+
finalización estricta
```

### Evolución

Este issue reemplaza la UX de guardado manual definida en #11/#15.

---

## #35 — FALTA DE UTILIDAD EN + PESO + REPES

**Fuente:** https://github.com/IS03/gym/issues/35

### Problema conceptual

Las opciones:

- Mantener;
- + Peso;
- + Repeticiones;
- Personalizado;

podían confundirse con una progresión numérica automática.

### Semántica elegida

Son **recordatorios de una sola vez para la siguiente sesión**.

### Ejemplo

Hoy:

```text
CURL POLEA
decision = + Peso
```

Próxima sesión:

```text
↗ Revisar hoy · Subir peso
```

Pero el nuevo selector arranca:

```text
Mantener
```

### Consumo

Si la nueva sesión se completa en Mantener:

```text
reminder consumido
```

Si vuelve a elegir +Peso:

```text
nuevo reminder para la siguiente
```

### Cancelación

Iniciar una sesión no consume el reminder.

Cancelar tampoco.

Solo se consume con finalización exitosa.

### Personalizado

La nota anterior se muestra como reminder heredado/read-only.

La nueva decisión sigue arrancando en Mantener.

### No progresión automática

Nunca convertir por esta opción:

```text
28 → 30 kg
10 → 11 reps
```

### Valores numéricos futuros

Los controla independientemente:

```text
Usar lo realizado como próximo objetivo
```

### Combinaciones válidas

| Decisión | `apply_to_routine` | Resultado |
|---|---:|---|
| Mantener | off | targets iguales, sin reminder |
| + Peso | off | targets iguales, reminder |
| Mantener | on | targets actualizados, sin reminder |
| + Peso | on | targets actualizados + reminder |

### Modelo de snapshot

La intención es separar:

```text
next_adjustment_snapshot
= recordatorio heredado

decision
= decisión nueva de esta sesión
```

La decisión nueva empieza en `maintain`.

### UI

El recordatorio debe verse incluso con el ejercicio colapsado.

Usar primary/violeta.

No:

- rojo;
- naranja de cambios dirty;
- AlertTriangle;
- pulse;
- glow.

---

# 6. Issues sin solución final suficientemente documentada

Los siguientes issues describen correctamente un problema, pero su propio hilo no contiene suficiente evidencia para reconstruir con precisión la implementación final:

- #2 — SESIÓN AUTO SAVE;
- #5 — COMIDAS DUPLICADAS;
- #6 — HISTORIAL VAGO;
- #8 — FALTA VISUAL DE LOAD;
- #16 — MODO ESCRITORIO NO EXISTENTE;
- #17 — MEJORAR INICIO DE SESIÓN.

Para estos casos, no se debe inventar retrospectivamente una solución.

Si una tarea futura necesita saber exactamente cómo terminaron resueltos, revisar:

1. código actual;
2. commits cercanos;
3. tests;
4. migraciones;
5. issues posteriores relacionados.

---

# 7. Decisiones de UX que no deberían regresionarse accidentalmente

## Sesión activa

- No volver a mostrar todos los ejercicios desplegados permanentemente.
- No volver a hacer RIR editable si sigue representando `target_rir`.
- No iniciar timer al completar una serie.
- No borrar sets existentes desde el flujo normal de ejecución.
- No auto-colapsar al completar la última serie.
- No bloquear la navegación porque un autosave esté en curso.
- No volver al guardado manual por ejercicio sin una decisión explícita que reemplace #30.

## Inicio de entrenamiento

- No volver a hacer de `/train/session/new` el flujo cotidiano principal.
- No reintroducir selector de fecha en el StartWorkoutSheet.
- No crear una sesión al primer tap sobre una rutina.
- No permitir una segunda sesión activa.

## Rutinas

- No presentar “Archivar” como si fuera hard delete.
- No priorizar importación/restauración de plantilla sobre rutinas activas.
- No dejar el formulario de nueva rutina permanentemente ocupando la parte superior.
- El reordenamiento pertenece al gestor de rutina, no a la sesión viva.

## Historial

- No reconstruir el pasado usando nombres/objetivos actuales.
- No reabrir una completed para corregir.
- No reejecutar finalización/progresión desde una corrección.
- No hard-delete completed si sigue vigente el modelo `discarded`.
- No convertir datos de continuidad en una recomendación automática de rutina sin regla explícita.

## Home / Navegación

- Mobile principal: Inicio / Entrenar / Nutrición / Historial.
- Ajustes asociado al perfil.
- No volver a poner fecha/saludo grande en header de Home salvo nueva decisión explícita.
- No reconstruir Liquid Glass para cambios simples de navegación.

## Responsive / iPhone

- Nacimiento y Género no deben compartir una fila en 375/390/430 px.
- Mantener touch targets aunque los controles visuales sean compactos.
- Respetar `safe-area-inset-*`.
- Evitar offsets visuales mágicos para corregir grillas.

## Motion

- No pulse/rebote infinito.
- No animaciones largas o teatrales.
- No dependencia pesada solo para microinteracciones.
- Respetar `prefers-reduced-motion`.

---

# 8. Deuda técnica identificada explícitamente en los issues

## 8.1 Cardio

Los datos de cinta todavía pueden vivir a nivel de sesión.

Dirección futura sugerida:

```text
datos cardio
→
ejercicio ejecutado
```

para soportar múltiples ejercicios cardio y un historial más natural.

Fuente: #14.

## 8.2 Campos legacy

`abs_completed` puede seguir existiendo por compatibilidad aunque haya dejado de ser la representación correcta del entrenamiento de abdomen.

Fuente: #14.

## 8.3 Historial de decisiones

Este propio documento existe porque gran parte del razonamiento quedó distribuido en issues largos.

Conviene que futuras decisiones estructurales importantes se incorporen también a documentación estable cuando se implementen.

---

# 9. Checklist para futuros prompts de Work/Codex

Antes de implementar una mejora sensible en OWNLEVEL:

1. Leer `AGENTS.md`.
2. Revisar código actual, no asumir que coincide con este documento.
3. Revisar `docs/entrenamiento-robusto.md` si toca entrenamiento.
4. Revisar migraciones y RLS si toca datos.
5. Identificar qué issue histórico originó la funcionalidad.
6. Verificar si ese issue fue reemplazado por uno posterior.
7. Preservar snapshots históricos.
8. Preservar una sola sesión activa.
9. Preservar drafts y optimistic concurrency.
10. No introducir N+1.
11. Usar Córdoba para fechas lógicas del producto.
12. Validar mobile 375/390/430 cuando corresponda.
13. Validar desktop sin regresionar mobile.
14. Respetar safe areas.
15. No instalar dependencias pesadas por conveniencia menor.
16. Ejecutar tests/lint/build/TypeScript.
17. No hacer commit/push/merge sin autorización explícita.

---

# 10. Índice cronológico

| Issue | Título | Tema principal |
|---:|---|---|
| [#1](https://github.com/IS03/gym/issues/1) | Falta de persistencia de sesión en progreso | Estado y unicidad de sesión activa |
| [#2](https://github.com/IS03/gym/issues/2) | Sesión auto save | Pérdida/sincronización temprana |
| [#3](https://github.com/IS03/gym/issues/3) | Flash | Tema oscuro / first paint |
| [#4](https://github.com/IS03/gym/issues/4) | Rutina nueva | Flujo de creación |
| [#5](https://github.com/IS03/gym/issues/5) | Comidas duplicadas | Nutrición / doble carga |
| [#6](https://github.com/IS03/gym/issues/6) | Historial vago | Historial inicial |
| [#7](https://github.com/IS03/gym/issues/7) | Ejercicio duplicado | Integridad de sesión |
| [#8](https://github.com/IS03/gym/issues/8) | Falta visual de load | Feedback pending/loading |
| [#9](https://github.com/IS03/gym/issues/9) | Reordenar rutina | Orden de ejercicios |
| [#10](https://github.com/IS03/gym/issues/10) | Crear logo y agregar a inicio | Branding inicial |
| [#11](https://github.com/IS03/gym/issues/11) | Cambio flujo sesión en curso | Rediseño editor activo |
| [#12](https://github.com/IS03/gym/issues/12) | Timer hora de inicio | Tiempo real de sesión |
| [#13](https://github.com/IS03/gym/issues/13) | Reporte semanal | Analytics de entrenamiento |
| [#14](https://github.com/IS03/gym/issues/14) | Abdomen y cinta dentro de otras sesiones | Coherencia ABS/Cardio |
| [#15](https://github.com/IS03/gym/issues/15) | No deja guardar... | Feedback dirty/manual save |
| [#16](https://github.com/IS03/gym/issues/16) | Modo escritorio no existente | Responsive desktop |
| [#17](https://github.com/IS03/gym/issues/17) | Mejorar inicio de sesión | Login / polish |
| [#18](https://github.com/IS03/gym/issues/18) | Historial peso | Evolución corporal |
| [#19](https://github.com/IS03/gym/issues/19) | Ícono de perfil... | Navegación / perfil |
| [#20](https://github.com/IS03/gym/issues/20) | Interfaz de inicio de entrenamiento engorroso | StartWorkoutSheet |
| [#21](https://github.com/IS03/gym/issues/21) | Sección entrenar | Centro de entrenamiento |
| [#22](https://github.com/IS03/gym/issues/22) | Sección rutinas | Activas/archivadas/crear |
| [#23](https://github.com/IS03/gym/issues/23) | Sección progreso | Progreso + historial ejercicio |
| [#24](https://github.com/IS03/gym/issues/24) | Faltan animaciones | Motion language |
| [#25](https://github.com/IS03/gym/issues/25) | RIR descentrado... | Pulido editor |
| [#26](https://github.com/IS03/gym/issues/26) | Detalles estéticos | QA mobile / Settings |
| [#27](https://github.com/IS03/gym/issues/27) | Visualizar, editar o eliminar sesión realizada | Historial robusto |
| [#28](https://github.com/IS03/gym/issues/28) | Aviso de confirmación... | Feedback post-finalización |
| [#30](https://github.com/IS03/gym/issues/30) | Demora al guardar ejercicio... | Autosave no bloqueante |
| [#35](https://github.com/IS03/gym/issues/35) | Falta de utilidad en + peso + repes | Reminders de progresión |

---

# 11. Lectura rápida para un agente nuevo

Si un agente entra por primera vez al proyecto, debería quedarse con este resumen:

> OWNLEVEL es una aplicación de entrenamiento y nutrición mobile-first. La parte de entrenamiento está construida alrededor de sesiones persistentes, snapshots históricos, drafts locales, optimistic concurrency y una única sesión activa por usuario. La UI de entrenamiento busca minimizar fricción durante el gimnasio: ejercicio en foco, inputs inmediatos, timer manual y autosave de fondo. Finalizar es la barrera estricta que garantiza que todo quedó persistido.
>
> Rutina y sesión nunca deben confundirse. Las sesiones completadas son historia; pueden corregirse de forma restringida o descartarse, pero no reabrirse ni volver a aplicar progresión.
>
> Los reportes se calculan con sesiones/series realmente completadas y snapshots históricos. La continuidad muestra hechos, no prescribe automáticamente qué rutina toca.
>
> `+ Peso`, `+ Repeticiones` y `Personalizado` son recordatorios para la próxima vez. `Usar lo realizado como próximo objetivo` es un mecanismo independiente que sí actualiza los targets numéricos.
>
> La navegación mobile principal es Inicio / Entrenar / Nutrición / Historial; Ajustes vive asociado al perfil. El inicio de entrenamiento habitual ocurre mediante un sheet: elegir → confirmar → empezar. La experiencia debe funcionar especialmente bien en iPhone 375/390/430 px, respetar safe areas y usar movimiento corto y funcional.
>
> Antes de modificar algo, siempre revisar el código real actual, `AGENTS.md`, documentación robusta, migraciones/RLS y tests. Este documento explica la historia y el porqué, pero el código actual sigue siendo la fuente de verdad.

---

## Fin del documento
