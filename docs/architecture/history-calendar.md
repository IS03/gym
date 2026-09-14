# OWNLEVEL — Historial diario y Calendario

> **Estado:** documento canónico de reconstrucción histórica y navegación por fecha
>
> **Base verificada:** `origin/main` en `7e08a43af42b0a41d80907a13b6df0de16b256a8`
>
> **Última revisión:** 2026-09-14

## Propósito y alcance

Este documento describe cómo OWNLEVEL reconstruye **qué ocurrió en una fecha concreta** y cómo el Calendario permite navegar esa historia sin crear otra fuente de datos.

Cubre:

- `/history` y `/history?date=YYYY-MM-DD`;
- `/calendar?month=YYYY-MM`;
- composición del día desde Nutrición, Entrenamiento, Métricas y Cuerpo;
- señales de presencia del calendario;
- navegación entre fechas y preservación del origen;
- edición histórica permitida;
- semántica de fechas de Córdoba;
- estados vacíos, días futuros y el día actual;
- límites con Progress V2;
- tests e invariantes que deben preservarse.

No reemplaza la documentación de cada dominio:

- [`nutrition-system.md`](./nutrition-system.md): Nutrición y sus snapshots;
- [`training-system.md`](./training-system.md): sesiones, series, historial y corrección;
- [`data-model.md`](./data-model.md): entidades, ownership y relaciones;
- [`auth-security.md`](./auth-security.md): sesión, RLS y límites de confianza;
- [`../progress-v2.md`](../progress-v2.md): analytics, períodos, comparaciones y relaciones.

Ante contradicciones, usar este orden:

1. código y tests actuales;
2. migraciones y schema vigente;
3. este documento y los documentos especializados actuales;
4. documentación histórica.

---

## Índice

1. [Modelo mental](#modelo-mental)
2. [Superficies y responsabilidades](#superficies-y-responsabilidades)
3. [Fuentes canónicas](#fuentes-canónicas)
4. [Historial: listado de días](#historial-listado-de-días)
5. [Historial: detalle de un día](#historial-detalle-de-un-día)
6. [Calendario global](#calendario-global)
7. [Semántica de presencia](#semántica-de-presencia)
8. [Nutrición dentro del Historial](#nutrición-dentro-del-historial)
9. [Entrenamiento dentro del Historial](#entrenamiento-dentro-del-historial)
10. [Métricas diarias dentro del Historial](#métricas-diarias-dentro-del-historial)
11. [Cuerpo dentro del Historial](#cuerpo-dentro-del-historial)
12. [Eventos y provenance](#eventos-y-provenance)
13. [Fechas y zona horaria](#fechas-y-zona-horaria)
14. [Navegación y preservación de contexto](#navegación-y-preservación-de-contexto)
15. [Edición histórica](#edición-histórica)
16. [Vacíos, hoy y futuro](#vacíos-hoy-y-futuro)
17. [Performance y composición de lecturas](#performance-y-composición-de-lecturas)
18. [Seguridad](#seguridad)
19. [Límite con Progress V2](#límite-con-progress-v2)
20. [Limitaciones conocidas](#limitaciones-conocidas)
21. [Cómo extender Historial o Calendario](#cómo-extender-historial-o-calendario)
22. [Antipatrones](#antipatrones)
23. [Validación y tests](#validación-y-tests)
24. [Code map](#code-map)
25. [Documentos relacionados](#documentos-relacionados)

---

# Modelo mental

Historial y Calendario son una capa de **reconstrucción factual y navegación**, no un segundo motor de analytics.

```text
FUENTES CANÓNICAS
→ reconstrucción por fecha
→ Historial diario
→ navegación / corrección controlada
```

Progress sigue otro flujo:

```text
FUENTES CANÓNICAS
→ períodos + agregación + coverage
→ comparaciones / tendencias / relaciones
→ Progress
```

La diferencia es deliberada.

## Historial responde

- ¿Qué comí ese día?
- ¿Qué objetivo y gasto quedaron vigentes para esa fecha?
- ¿Entrené?
- ¿Qué sesión fue?
- ¿Cuántas series y ejercicios completé?
- ¿Qué métricas registré?
- ¿Qué peso o medidas corporales existen en esa fecha?
- ¿Hay datos importados o marcados para revisar?

## Historial no debe responder por sí mismo

- ¿Estoy progresando?
- ¿Mi volumen subió respecto del mes anterior?
- ¿Dormir más se relaciona con rendir mejor?
- ¿Mi promedio semanal cambió?
- ¿Qué tendencia tiene mi peso?

Esas preguntas pertenecen a Progress V2.

> **Contrato vigente:** `Historial = reconstrucción factual`. `Progress = análisis entre observaciones o períodos`.

---

# Superficies y responsabilidades

## `/history`

Entry point del Historial diario.

Sin `date`:

- muestra días recientes;
- resume señales reales de Nutrición, Entrenamiento, Métricas y Cuerpo;
- permite saltar a cualquier fecha mediante selector.

Con `date=YYYY-MM-DD`:

- reconstruye una fecha concreta;
- conserva el origen de navegación;
- permite avanzar/retroceder por día sin superar hoy;
- muestra secciones sólo cuando corresponden;
- expone edición histórica limitada para algunos dominios.

## `/calendar`

Navegador mensual global.

Responsabilidades:

- representar un mes en una grilla;
- indicar presencia de cuatro dominios mediante señales visuales;
- impedir navegación a días futuros;
- abrir el Historial de la fecha elegida;
- conservar el mes de origen para que Back vuelva al mismo calendario.

No muestra detalle ni analytics.

## Drill-downs desde Historial

El Historial puede derivar a superficies dueñas del dato.

Ejemplo principal:

```text
/history?date=...
→ sesión completada
→ /train/session/[id]?return=...
```

La sesión conserva un `return` seguro construido por OWNLEVEL para volver al mismo día.

---

# Fuentes canónicas

Historial no posee tablas propias.

Compone read models desde fuentes existentes.

| Dominio | Fuente canónica usada por Historial | Fecha semántica |
| --- | --- | --- |
| Nutrición | `day_logs`, `meal_entries` | `day_logs.log_date` |
| Contexto nutricional | snapshots de `day_logs` | `log_date` |
| Eventos nutricionales | `nutrition_events` | `event_date` |
| Entrenamiento | `workout_sessions` | fecha del `day_log` asociado |
| Ejercicios de sesión | `workout_session_exercises` | heredada de la sesión |
| Series | `workout_sets` | heredada de la sesión |
| Métricas diarias | `daily_metric_values` | `metric_date` |
| Definiciones de métricas | `user_metrics` | definición actual + lifecycle |
| Peso histórico | `day_logs.weight_kg` | `log_date` |
| Medidas corporales | `body_measurements` | `measured_on` |

`day_logs` funciona como ancla para varias operaciones, pero **no reemplaza** las fuentes específicas.

Por ejemplo:

- que exista un `day_log` no significa que exista Nutrición registrada;
- una medida puede existir por `measured_on` aunque no dependa de una comida;
- una métrica diaria existe por la row de `daily_metric_values`;
- una sesión debe estar `completed` para aparecer como Entrenamiento histórico.

---

# Historial: listado de días

La lectura principal es:

```text
listDailyHistoryDays(...)
```

ubicada en:

`src/lib/history/daily-history.ts`.

## Ventana actual

La página `/history` solicita por defecto:

```text
60 días
```

El loader acepta un límite entre 1 y 366 días.

El selector de fecha no queda limitado a esos 60 días: una fecha más antigua puede abrirse directamente mediante el detalle.

## Lecturas agrupadas

El listado obtiene en paralelo:

- `day_logs`;
- sesiones completadas;
- `body_measurements`;
- `daily_metric_values`;
- `meal_entries` activas relevantes.

Después unifica por fecha en memoria.

No realiza una query independiente por cada día.

## Resumen por fecha

`DailyHistoryListItem` conserva:

- fecha;
- datos resumidos de `day_logs`;
- objetivo calórico snapshot cuando existe;
- nombres de entrenamientos;
- medida corporal de la fecha;
- cantidad de métricas registradas;
- cantidad de comidas relevantes.

La UI puede mostrar, según disponibilidad:

- calorías / objetivo;
- proteína;
- entrenamiento;
- cantidad de métricas;
- peso;
- presencia de medidas.

## Qué cuenta como comida para el listado

Sólo entradas activas con:

```text
entry_kind = meal
```

o:

```text
entry_kind = legacy_daily_summary
```

Las soft-deleted quedan fuera.

## Qué entrenamiento entra

Sólo:

```text
status = completed
```

No se listan como historia factual sesiones `in_progress` o `discarded`.

---

# Historial: detalle de un día

La entrada server-side es:

```text
getDailyHistoryDetail(date, context)
```

El detalle compone cinco bloques principales en paralelo:

1. Nutrición;
2. sesiones completadas;
3. medida corporal;
4. eventos nutricionales;
5. métricas personales.

## Regla crítica: abrir una fecha no debe crearla

Nutrición se lee con:

```text
getNutritionDay(date, { createIfMissing: false }, context)
```

Esto impide que visitar una fecha vacía materialice un `day_log` sólo por haber abierto la pantalla.

> **Contrato vigente:** una lectura histórica no debe inventar hechos ni persistencia.

## Fecha inválida o futura

`/history?date=...` valida:

- formato ISO `YYYY-MM-DD`;
- existencia real de la fecha;
- que no sea posterior a hoy en Córdoba.

Si falla, vuelve a `/history`.

## Día actual

Hoy puede abrirse en Historial, pero la UI lo identifica explícitamente como:

```text
Hoy · en curso
```

Eso evita presentar un día todavía incompleto como una observación cerrada.

---

# Calendario global

La superficie `/calendar` usa:

```text
getGlobalCalendar(...)
```

El calendario es un **read model de presencia**, no una tabla persistida.

## Grilla mensual

`buildMonthGrid(month, { full: true })` construye siempre una grilla de 42 celdas.

Características:

- semana visual de lunes a domingo;
- incluye días del mes anterior y siguiente necesarios para completar la grilla;
- cada celda conserva `date` e `inMonth`;
- la aritmética de fechas usa UTC a mediodía para evitar desplazamientos de día.

## Mes actual y meses futuros

`resolveCalendarMonth()` sólo acepta:

```text
YYYY-MM
```

Si la URL es inválida o intenta abrir un mes futuro, se normaliza al mes actual.

La flecha de mes siguiente queda deshabilitada cuando se alcanza el mes corriente.

## Días futuros

Se muestran visualmente dentro de la grilla cuando corresponde, pero:

- no son links;
- están deshabilitados;
- no disparan lectura de detalle;
- no se consultan como rango de datos más allá de hoy.

---

# Semántica de presencia

El Calendario expone cuatro señales:

```text
Nutrición
Métricas
Entreno
Cuerpo
```

Cada señal tiene una condición explícita.

## Nutrición

`hasNutrition = true` cuando existe al menos una `meal_entry`:

- activa (`deleted_at is null`);
- `entry_kind = meal` o `legacy_daily_summary`.

**No alcanza con que exista `day_logs`.**

Un día materializado pero sin consumo no debe marcar Nutrición.

## Entrenamiento

`hasTraining = true` sólo si existe una sesión:

```text
status = completed
```

Una sesión:

- `in_progress`;
- `discarded`;

no marca el día como entrenamiento histórico.

## Métricas

`hasMetrics = true` si existe una row de `daily_metric_values` en esa fecha.

Un valor:

```text
0
```

es una observación real y por lo tanto **sí marca** la fecha.

## Cuerpo

`hasBody = true` si existe al menos uno de:

- `day_logs.weight_kg` no nulo;
- `body_measurements` en `measured_on`.

## Tabla resumen

| Señal | Qué la activa | Qué NO debe activarla |
| --- | --- | --- |
| Nutrición | comida activa o resumen histórico | `day_log` vacío |
| Entreno | sesión `completed` | `in_progress`, `discarded` |
| Métricas | row real de `daily_metric_values` | definición sin valor |
| Cuerpo | peso o medida real | perfil actual sin observación ese día |

> **Contrato vigente:** las señales del Calendario representan hechos, no “la existencia técnica de una fila contenedora”.

---

# Nutrición dentro del Historial

Historial reutiliza el read model canónico de Nutrición.

No recalcula por su cuenta objetivos o gasto.

## Contexto histórico

Cuando existe información del día, se muestran valores efectivos correspondientes a esa fecha, entre ellos:

- calorías consumidas;
- proteína;
- carbohidratos y grasas cuando están disponibles;
- objetivo nutricional;
- gasto estimado;
- delta contra objetivo;
- balance energético;
- overrides históricos cuando existieron.

La UI diferencia los conceptos:

```text
objetivo de consumo
!=
gasto estimado
!=
balance energético
```

## Snapshots mandan para el pasado

Un día histórico materializado conserva el contexto con el que fue resuelto.

El Historial no debe reconstruir una fecha pasada usando el plan actual.

Para el detalle completo de esta semántica, consultar [`nutrition-system.md`](./nutrition-system.md).

## Comidas

La sección de comidas reutiliza `MealList`.

Una comida normal conserva:

- título;
- descripción;
- calorías;
- proteína;
- carbohidratos;
- grasas;
- contexto de horario/origen cuando corresponde.

## Resúmenes legacy

`legacy_daily_summary` se muestra como:

```text
Resumen diario histórico
```

con contexto de que no existe desglose individual de comidas.

No se presenta como una comida moderna normal.

## Horario desconocido

Si una importación histórica declara que el horario original era desconocido, la UI muestra:

```text
Horario no informado
```

No inventa una hora semántica sólo porque `consumed_at` necesite contener un timestamp técnico.

## Provenance de importación

Entradas `sheet_import` o `chatgpt` pueden mostrar contexto de procedencia.

El provenance complementa el hecho; no crea una segunda semántica nutricional.

---

# Entrenamiento dentro del Historial

Historial muestra sólo sesiones completadas de la fecha.

El flujo de lectura es:

```text
workout_sessions completed
→ workout_session_exercises
→ workout_sets
→ resumen factual de sesión
```

## Resumen de sesión

`DailyHistorySession` contiene:

- ID;
- nombre;
- inicio;
- duración;
- series completadas;
- ejercicios con al menos una serie completada;
- volumen resumido;
- feedback de energía, rendimiento y dolor.

## Nombre histórico

La prioridad es:

```text
routine_name_snapshot
→ session_name
→ "Sesión libre"
```

No se usa el nombre actual de la rutina para reescribir el pasado.

## Series usadas

El resumen considera únicamente sets con:

```text
is_completed = true
```

## Volumen mostrado

Para el resumen factual se usa:

```text
actual_reps × actual_weight_kg
```

sobre series completadas.

Es la misma semántica base usada por Training Progress para ese cálculo concreto, pero en Historial se utiliza sólo para describir la sesión.

No produce tendencia, comparación ni conclusión de fuerza.

## Drill-down

Al tocar una sesión, OWNLEVEL abre el detalle de Training y pasa un retorno hacia el día histórico.

Historial no implementa una segunda pantalla completa de sesión ni duplica el motor de Training.

---

# Métricas diarias dentro del Historial

Las métricas son dinámicas.

Historial **no hardcodea** nombres como Pasos, Agua o Sueño para construir la lista.

Lee:

```text
user_metrics
+
daily_metric_values
```

por `metric_id`.

## `recorded`

Incluye métricas que realmente tienen una row ese día.

Puede incluir:

- métricas del sistema;
- métricas custom;
- métricas actualmente archivadas si tenían valor en esa fecha.

## `editable`

Incluye:

- métricas activas, tengan o no valor ese día;
- métricas archivadas sólo cuando ya tenían una row histórica en esa fecha.

Esto permite corregir historia sin reactivar silenciosamente una definición archivada.

## Regla de archivadas

Una métrica archivada:

- puede corregirse si ya tenía dato ese día;
- no puede recibir un valor nuevo en una fecha donde nunca había sido registrada.

## `missing != 0`

En Historial:

```text
row con value = 0
```

es dato real.

Ausencia de row significa que no hubo registro.

No se transforma ausencia en cero.

## Tipos

El editor respeta:

- `integer`;
- `decimal`;
- `duration`.

Las duraciones se editan en horas/minutos y se persisten en la unidad canónica del sistema.

## Identidad

La edición se guarda por:

```text
metric_id
```

no por nombre visible.

Cambiar un label no debe crear otra métrica ni romper el historial de esa identidad.

---

# Cuerpo dentro del Historial

La sección Cuerpo combina hechos de dos fuentes distintas:

## Peso

Fuente histórica:

```text
day_logs.weight_kg
```

para la fecha concreta.

El `profiles.current_weight_kg` actual no se usa para fingir una observación histórica.

## Medidas

Fuente:

```text
body_measurements.measured_on
```

Puede mostrar:

- cintura;
- abdomen;
- pecho;
- brazo genérico;
- brazo derecho/izquierdo;
- muslo genérico;
- muslo derecho/izquierdo;
- pantorrilla derecha/izquierda;
- cadera.

## Metadata histórica

También conserva cuando corresponde:

- condición;
- notas;
- `quality_status = suspect`;
- `quality_note`;
- provenance de importación.

Una medición sospechosa se muestra como tal; no se corrige automáticamente.

## Render condicional

La sección Cuerpo no aparece sólo porque la aplicación tenga un perfil.

Debe existir información real de esa fecha:

- peso;
- una medida;
- metadata relevante de la medición.

---

# Eventos y provenance

`nutrition_events` se leen por `event_date` dentro del detalle histórico.

Representan contexto histórico, no consumo.

Por lo tanto:

- no suman calorías;
- no cuentan como comida;
- no activan por sí solos la señal Nutrición del Calendario;
- no deben convertirse en `meal_entries` para simplificar la UI.

El Historial puede mostrar además provenance o quality metadata procedente de importaciones.

> **Contrato vigente:** contexto histórico y hecho consumido son conceptos separados.

---

# Fechas y zona horaria

La fecha lógica del producto está anclada a:

```text
America/Argentina/Cordoba
```

## Hoy

`todayInCordoba()` determina qué día es “hoy”.

Esto es importante cerca de medianoche y cuando UTC ya cambió de fecha.

## Fechas de Historial

`isHistoryDate()` valida una fecha ISO real.

Ejemplos:

```text
2026-09-07  → válida
2026-02-29  → inválida
2028-02-29  → válida
```

## Aritmética de día

`adjacentHistoryDate()` usa aritmética UTC sobre una fecha lógica a mediodía.

Preserva correctamente:

- cambio de mes;
- cambio de año;
- años bisiestos.

## Formateo

Las fechas lógicas se convierten con UTC cuando se busca preservar literalmente `YYYY-MM-DD`, mientras que horas reales (`timestamptz`) se formatean en `America/Argentina/Cordoba`.

No mezclar ambas semánticas.

> **Contrato vigente:** una fecha de dominio no debe correrse un día por interpretar incorrectamente UTC como fecha local.

---

# Navegación y preservación de contexto

Historial acepta un vocabulario cerrado de origen:

```text
history
calendar + month
```

No acepta una URL de retorno arbitraria desde query params.

## Desde Historial

Ejemplo:

```text
/history?date=2026-08-24&from=history
```

Back vuelve a:

```text
/history
```

## Desde Calendario

Ejemplo:

```text
/calendar?month=2026-08
→ /history?date=2026-08-24&from=calendar&month=2026-08
```

Back vuelve a:

```text
/calendar?month=2026-08
```

Aunque desde el detalle se navegue al día siguiente y se cruce a septiembre, el origen sigue siendo agosto porque representa la pantalla desde la cual se entró.

## Seguridad del origen

Inputs como:

```text
from=https://...
month=javascript:...
```

no son aceptados como destino.

El fallback es Historial.

## Selector de fecha

El selector permite:

- día anterior/siguiente;
- elegir año;
- elegir mes;
- elegir día;
- saltar a hoy.

Los días sin registros también pueden seleccionarse.

Actualmente el selector ofrece años desde 1900 hasta el año actual.

No permite seleccionar fechas futuras.

---

# Edición histórica

Historial no convierte todos los dominios en un editor genérico.

Cada dato mantiene su owner operacional.

## Métricas diarias

Sí tienen editor histórico directo en `/history`.

El flujo es:

```text
HistoricalMetricsEditor
→ saveHistoricalDailyMetricsAction
→ saveHistoricalDailyMetricValues
```

Después se revalidan:

```text
/history
/calendar
/today
```

## Comidas

La sección reutiliza el componente canónico de comidas.

Las comidas normales pueden ser editables según el flujo compartido de Nutrición.

Los `legacy_daily_summary` quedan explícitamente en sólo lectura.

## Entrenamiento

Historial deriva al dominio Training.

La corrección de sesiones completadas debe seguir las reglas de [`training-system.md`](./training-system.md).

Historial no modifica series directamente por una ruta paralela.

## Cuerpo

Historial reconstruye el hecho corporal. Las mutaciones deben seguir perteneciendo al dominio Cuerpo y sus acciones canónicas.

## Regla general

> **Editar desde Historial no debe significar crear un segundo camino de persistencia con reglas distintas.**

Cuando exista una mutación compartida del dominio, debe reutilizarse.

---

# Vacíos, hoy y futuro

## Día sin registros

Abrir un día vacío es válido.

La pantalla muestra un estado explícito y puede ofrecer completar métricas disponibles.

No se materializa un `day_log` por la mera lectura.

## Métrica activa sin valor

No cuenta como registro, pero puede aparecer en el editor para que el usuario la complete.

## Métrica archivada sin valor

No aparece como editable en ese día.

## `0`

Es dato real.

Por ejemplo:

```text
Pasos = 0
```

sigue siendo un valor registrado y activa la señal Métricas.

## Hoy

Puede contener datos parciales.

La UI lo marca como en curso y no debe confundirse con un día histórico cerrado.

## Futuro

- `/history` rechaza una fecha futura;
- el date picker la deshabilita;
- el calendario la presenta deshabilitada;
- el calendario no consulta hechos posteriores a hoy.

---

# Performance y composición de lecturas

Historial y Calendario evitan deliberadamente un patrón N+1 por día.

## Listado de Historial

Ejecuta en paralelo lecturas por rango para:

- días;
- sesiones;
- cuerpo;
- métricas;
- comidas.

Después agrupa por fecha en memoria.

## Detalle de Historial

Ejecuta en paralelo las áreas principales:

```text
Nutrición
Sesiones
Cuerpo
Eventos
Métricas
```

Dentro de Training, primero obtiene las sesiones completadas de la fecha y luego agrupa ejercicios/sets por los IDs relevantes.

No consulta series ejercicio por ejercicio.

## Calendario

Primero lee `day_logs` del rango visible hasta hoy para obtener IDs y peso.

Después lee en paralelo:

- comidas relevantes;
- sesiones completadas;
- métricas;
- medidas corporales.

Las señales se construyen en memoria.

## Métricas históricas

El detalle carga:

- definiciones de `user_metrics` una vez;
- valores de la fecha una vez.

No ejecuta una query por definición.

---

# Seguridad

Todas estas superficies están dentro del app autenticado.

La lectura usa `AuthenticatedRequestContext` con:

- cliente Supabase verificado;
- `userId` autenticado.

Además:

- las queries filtran por `user_id`;
- RLS sigue siendo la barrera de base de datos;
- History no acepta un arbitrary return URL;
- fechas y meses son validados antes de usarse como navegación;
- las mutaciones históricas reutilizan ownership y validaciones del dominio.

Para la arquitectura completa de seguridad, consultar [`auth-security.md`](./auth-security.md).

---

# Límite con Progress V2

Historial y Progress pueden leer los mismos hechos, pero no tienen la misma responsabilidad.

## Historial

Trabaja con una fecha concreta.

Puede mostrar resúmenes descriptivos del propio día, por ejemplo:

- volumen de una sesión;
- balance energético del día;
- número de métricas registradas.

Eso no lo convierte en analytics longitudinal.

## Progress

Trabaja con:

- períodos;
- agregación;
- coverage;
- comparaciones;
- tendencias;
- relaciones entre variables.

## Regla

```text
History: qué pasó
Progress: cómo cambia / cómo se compara / qué se asocia
```

No agregar a `/history`:

- tendencias de 30 días;
- comparación contra período anterior;
- correlaciones;
- insights analíticos;
- otro selector de períodos.

Para eso existe [`../progress-v2.md`](../progress-v2.md).

---

# Limitaciones conocidas

## Listado reciente limitado

La portada de `/history` muestra actualmente una ventana de 60 días.

Fechas más antiguas siguen accesibles mediante selector o deep link.

## Un `day_log` materializado puede entrar al listado reciente aunque no tenga señales visibles

`listDailyHistoryDays()` inicia el mapa con los `day_logs` del rango y luego agrega hechos de cada dominio.

Por eso una fecha con un `day_log` técnico pero sin comida, sesión, métrica, peso o medida puede existir en la lista base aunque su detalle resulte vacío.

El Calendario es más estricto y no infiere señales desde ese `day_log` vacío.

No asumir que ambos read models tienen exactamente el mismo criterio de inclusión.

## Calendario expone cuatro señales

Actualmente representa sólo:

- Nutrición;
- Métricas;
- Entreno;
- Cuerpo.

`nutrition_events` y otras metadata no tienen señal propia.

## Definiciones históricas de métricas

`daily_metric_values` conserva el valor y `metric_id`, pero el sistema no guarda todavía snapshots históricos completos del nombre/objetivo visible de cada `user_metric`.

Una fecha histórica usa la definición actualmente persistida para esa identidad.

Ver también las limitaciones de métricas dinámicas en [`../progress-v2.md`](../progress-v2.md).

## El día actual es mutable

Historial permite verlo, pero no representa una observación cerrada hasta que el día haya terminado.

---

# Cómo extender Historial o Calendario

## Agregar un nuevo dominio al detalle de Historial

Antes de tocar UI:

1. definir cuál es la fuente canónica del hecho;
2. definir su fecha semántica;
3. decidir si ausencia de row significa missing o cero;
4. crear un read model server-side por fecha;
5. cargarlo dentro de `getDailyHistoryDetail()` sin materializar datos;
6. mostrarlo sólo cuando exista información real;
7. si necesita edición, reutilizar la mutación canónica del dominio;
8. agregar tests de presencia, vacío y ownership.

## Agregar una nueva señal al Calendario

Una señal nueva debe responder:

```text
¿qué hecho real hace que este día deba marcarse?
```

No responder:

```text
¿qué fila técnica existe?
```

Pasos:

1. definir el hecho canónico;
2. traer sólo los campos mínimos del rango visible;
3. agregarlo a `GlobalCalendarDay`;
4. componerlo en `buildGlobalCalendarDays()`;
5. agregar test donde el hecho está presente;
6. agregar test donde existe sólo contenedor/configuración pero no hecho;
7. actualizar leyenda y `aria-label`.

## Agregar una corrección histórica

Preferencia:

```text
History UI
→ action del dominio
→ source of truth existente
```

Evitar:

```text
History UI
→ tabla paralela de correcciones
```

Si el dominio necesita preservar el valor original y una corrección explícita, esa decisión debe modelarse en el dominio/schema, no esconderse sólo en la pantalla.

## Agregar una nueva navegación de origen

No aceptar `return=/cualquier/cosa` sin validación.

Extender el union type cerrado de `DailyHistoryOrigin` y sus helpers:

- parse;
- href;
- return target;
- tests de inputs inválidos.

---

# Antipatrones

No hacer:

- crear `history_entries` para copiar hechos de otros dominios;
- marcar Nutrición sólo porque existe `day_logs`;
- marcar Training por una sesión `in_progress`;
- transformar missing en cero;
- ocultar un cero real porque es falsy;
- reconstruir un objetivo viejo desde la configuración actual;
- usar `profiles.current_weight_kg` como peso histórico de cualquier fecha;
- reconstruir una sesión histórica desde la rutina actual;
- hardcodear métricas por label visible;
- crear un valor nuevo para una métrica archivada en un día donde no existía;
- permitir fechas futuras como hechos;
- usar UTC como “hoy” del producto;
- aceptar URLs arbitrarias como origen/retorno;
- duplicar el editor completo de Training dentro de Historial;
- duplicar el motor de Nutrición dentro de Historial;
- convertir `/history` en otro Progress;
- calcular correlaciones o comparaciones longitudinales en esta capa;
- hacer una query por cada día del calendario;
- materializar días sólo para visualizarlos.

---

# Validación y tests

Los contratos relevantes viven principalmente en:

## Historial

```text
src/lib/history/daily-history-core.test.ts
src/lib/history/daily-history-navigation.test.ts
src/lib/history/daily-history-ui.test.ts
src/lib/history/pr75-history.test.ts
```

Protegen, entre otras cosas:

- fechas válidas y bisiestas;
- navegación anterior/siguiente;
- preservación de origen;
- rechazo de retorno arbitrario;
- métricas custom/system/archivadas;
- `missing != 0`;
- snapshots nutricionales;
- objetivo vs gasto vs balance;
- comidas legacy de sólo lectura;
- uso de sesiones reales completadas;
- render condicional de Cuerpo;
- estructura del editor de métricas.

## Calendario

```text
src/lib/calendar/global-calendar-core.test.ts
src/lib/calendar/global-calendar-ui.test.ts
src/lib/calendar/month.test.ts
src/lib/calendar/date-range.test.ts
```

Protegen:

- composición de las cuatro señales;
- cero real como métrica registrada;
- ausencia de señales desde day log vacío;
- exclusión de comidas borradas;
- exclusión de sesiones no terminadas;
- reconocimiento de `legacy_daily_summary`;
- peso como señal de Cuerpo;
- construcción del mes;
- bloqueo de futuro.

## Al modificar Historial o Calendario

Validar como mínimo:

1. una fecha con todos los dominios;
2. una fecha completamente vacía;
3. una fecha con `day_log` pero sin hechos;
4. una métrica con valor `0`;
5. una métrica archivada con valor histórico;
6. una métrica archivada sin valor histórico;
7. una comida soft-deleted;
8. un `legacy_daily_summary`;
9. sesión `completed` vs `in_progress`/`discarded`;
10. peso sin medidas;
11. medidas sin peso;
12. hoy;
13. fecha futura;
14. cambio de mes/año/bisiesto;
15. regreso a Historial;
16. regreso a Calendario preservando mes.

---

# Code map

| Responsabilidad | Archivo(s) |
| --- | --- |
| Página de Historial | `src/app/(app)/history/page.tsx` |
| Loader de Historial | `src/lib/history/daily-history.ts` |
| Resumen factual de sesiones | `src/lib/history/daily-history-core.ts` |
| Navegación History/Calendar | `src/lib/history/daily-history-navigation.ts` |
| Selector de fecha | `src/components/history/daily-history-date-navigator.tsx` |
| Editor histórico de métricas | `src/app/(app)/history/historical-metrics-editor.tsx` |
| Action de métricas históricas | `src/app/(app)/history/historical-metrics-actions.ts` |
| Métricas server | `src/lib/daily-metrics/server.ts` |
| Métricas core/formato | `src/lib/daily-metrics/core.ts` |
| Página de Calendario | `src/app/(app)/calendar/page.tsx` |
| Loader de Calendario | `src/lib/calendar/global-calendar.ts` |
| Composición de señales | `src/lib/calendar/global-calendar-core.ts` |
| Helpers mensuales | `src/lib/calendar/month.ts` |
| Helpers de rangos | `src/lib/calendar/date-range.ts` |
| Nutrición diaria | `src/lib/nutrition/day.ts` |
| Lista/editor de comidas compartido | `src/app/(app)/today/meal-list.tsx` |
| Fecha lógica de Córdoba | `src/lib/phase2/cordoba-date.ts` |
| Tests de Historial | `src/lib/history/*.test.ts` |
| Tests de Calendario | `src/lib/calendar/*.test.ts` |

---

# Documentos relacionados

| Documento | Consultar para |
| --- | --- |
| [`../ownlevel-architecture.md`](../ownlevel-architecture.md) | mapa general de OWNLEVEL |
| [`data-model.md`](./data-model.md) | ownership, entidades, snapshots y lifecycle |
| [`data-flow.md`](./data-flow.md) | sincronizaciones y flujos históricos complementarios |
| [`nutrition-system.md`](./nutrition-system.md) | día nutricional, snapshots, comidas, objetivos y gasto |
| [`training-system.md`](./training-system.md) | sesión, sets, corrección e historial de Training |
| [`auth-security.md`](./auth-security.md) | auth, RLS, ownership y navegación segura |
| [`../progress-v2.md`](../progress-v2.md) | analytics, períodos, comparaciones y relaciones |
| [`../design/principles.md`](../design/principles.md) | contratos visuales generales |
| [`../design/patterns.md`](../design/patterns.md) | patrones de navegación, superficies y estados |

---

## Decisiones estables

1. **Historial reconstruye hechos; no persiste una copia de ellos.**
2. **Calendario es un índice visual de presencia; no es una fuente de verdad.**
3. **Ver una fecha no debe crear datos.**
4. **Una señal exige un hecho real, no sólo una fila contenedora.**
5. **Sólo sesiones completadas forman parte del entrenamiento histórico normal.**
6. **`0` es dato; missing es ausencia.**
7. **Los snapshots históricos mandan sobre la configuración actual.**
8. **Las métricas se identifican por ID, no por label.**
9. **La fecha lógica del producto es Córdoba.**
10. **La navegación conserva contexto mediante un vocabulario cerrado de origen.**
11. **Las correcciones reutilizan el dominio dueño del dato.**
12. **Historial y Progress deben seguir siendo responsabilidades separadas.**
