# OWNLEVEL — Migración de Nutrición, Actividad y ChatGPT

> **Estado:** Especificación aprobada para implementación  
> **Proyecto:** OWNLEVEL / SenesGym  
> **Stack:** Next.js App Router + TypeScript + Supabase + Vercel + GitHub  
> **Repositorio:** `IS03/gym`  
> **Dominio principal:** `senesgym.vercel.app`  
> **Zona horaria canónica:** `America/Argentina/Cordoba`

---

## 1. Objetivo

Migrar el seguimiento nutricional actualmente mantenido en Google Sheets hacia OWNLEVEL y convertir Supabase en la única fuente de verdad para:

- nutrición;
- actividad diaria;
- objetivos;
- gasto estimado;
- medidas corporales;
- historial;
- reportes;
- integración con ChatGPT.

El módulo de entrenamiento existente debe mantenerse como autoridad para sesiones, rutinas, ejercicios, series, pesos, repeticiones y progreso.

La integración con ChatGPT debe utilizar una API privada de OWNLEVEL. ChatGPT interpreta lenguaje natural y registra datos, pero no será la fuente de verdad de objetivos ni cálculos diarios.

---

## 2. Principios de arquitectura

### 2.1. Supabase es la fuente de verdad

Todos los sistemas deben leer y escribir sobre la misma fuente:

```text
                     OWNLEVEL
                        │
                  Next.js / Vercel
                        │
                     Supabase
                 FUENTE DE VERDAD
                        │
          ┌─────────────┴─────────────┐
          │                           │
    ENTRENAMIENTO                 NUTRICIÓN
          │                           │
      rutinas                     comidas
      sesiones                    objetivos
      ejercicios                  actividad
      series                      medidas
      progreso                    alimentos
```

La integración externa será:

```text
Usuario
  ↓
ChatGPT Plus / GPT privado
  ↓
API privada de OWNLEVEL
  ↓
Supabase
```

Google Sheets quedará fuera del flujo normal una vez validada la migración:

```text
Google Sheets
    ↓
backup histórico
    ↓
solo lectura
```

---

## 3. Estado actual de OWNLEVEL

La implementación debe partir del código real existente y extenderlo, no reemplazarlo.

### 3.1. Navegación actual

La navegación móvil actual ya separa:

- Inicio
- Entrenar
- Nutrición
- Historial

Archivo relevante:

```text
src/components/layout/bottom-nav-config.ts
```

### 3.2. Nutrición actual

Ya existen:

```text
day_logs
meal_entries
```

Archivos relevantes:

```text
src/app/(app)/today/page.tsx
src/app/(app)/today/actions.ts
src/app/(app)/today/create-meal-form.tsx
src/app/(app)/history/page.tsx

src/lib/phase1/day-log.ts
src/lib/phase1/profile.ts
src/lib/phase1/types.ts
```

La implementación actual ya permite:

- crear comidas;
- editar comidas;
- soft delete;
- detectar posibles duplicados recientes;
- obtener/crear `day_logs`;
- mostrar calorías;
- mostrar proteína;
- mostrar objetivo;
- mostrar delta contra objetivo.

### 3.3. Entrenamiento actual

Ya existen:

```text
workout_sessions
workout_session_exercises
workout_sets
routines
routine_exercises
routine_exercise_sets
exercises
```

El sistema actual distingue sesiones:

```text
in_progress
completed
```

Archivos relevantes:

```text
src/lib/phase2/training.ts
src/lib/phase2/training-robust.ts
src/lib/phase2/types.ts

src/app/(app)/train/session/[id]/
src/app/(app)/train/history/
src/app/(app)/train/progress/
```

Migración relevante:

```text
supabase/migrations/20260427_0014_workout_session_status.sql
```

Los reportes actuales ya consideran `completed` como sesión histórica válida.

---

## 4. Regla principal: una sola lógica diaria

Debe existir un único motor de resolución del día utilizado por:

- `/home`;
- `/today`;
- `/history`;
- reportes;
- API de ChatGPT.

No deben existir reglas duplicadas en distintas pantallas.

Conceptualmente:

```ts
getNutritionDay(date)
```

Debe resolver:

```text
fecha
trabajo efectivo
gym efectivo
plan nutricional vigente
objetivo kcal
objetivo proteína
objetivo agua
gasto estimado
calorías consumidas
proteína consumida
carbos consumidos
grasas consumidas
desvío contra objetivo
balance energético
```

---

## 5. Zona horaria

Toda la aplicación debe usar:

```text
America/Argentina/Cordoba
```

No usar UTC para determinar el día del usuario.

Actualmente `/home` ya utiliza una utilidad específica de Córdoba, mientras que `/today` usa:

```ts
new Date().toISOString().slice(0, 10)
```

Eso debe corregirse.

Archivo existente:

```text
src/lib/phase2/cordoba-date.ts
```

Todos los siguientes flujos deben utilizar la misma fecha canónica:

- Home
- Today
- History
- entrenamiento
- API de ChatGPT
- migración histórica
- cierres diarios
- reportes

---

# 6. `day_logs` como centro del día

Debe mantenerse un único `day_log` por usuario y fecha.

Restricción:

```text
UNIQUE(user_id, log_date)
```

## 6.1. Campos actuales a reutilizar

La estructura actual ya contiene conceptos útiles como:

```text
weight_kg
bmr_kcal_snapshot
maintenance_kcal_snapshot
target_kcal_snapshot
goal_type_snapshot
total_calories_consumed
total_protein_g
delta_vs_target
delta_vs_maintenance
```

No crear columnas duplicadas para conceptos ya existentes salvo que sea necesario por compatibilidad o versionado.

## 6.2. Nuevos conceptos necesarios

El modelo debe soportar, como mínimo:

```text
work_override
work_override_source
work_override_reason

gym_override
gym_override_source
gym_override_reason

steps
water_l
mate_l

protein_target_snapshot
water_target_snapshot

expenditure_rule_period_id
nutrition_goal_period_id

status
notes
```

Los nombres exactos pueden variar durante implementación, pero estos conceptos deben existir.

---

# 7. Trabajo

## 7.1. Horario habitual

Debe poder configurarse un perfil habitual.

Configuración inicial:

```text
Lunes     Trabajo = Sí
Martes    Trabajo = Sí
Miércoles Trabajo = Sí
Jueves    Trabajo = Sí
Viernes   Trabajo = Sí
Sábado    Trabajo = No
Domingo   Trabajo = No
```

La configuración habitual no debe escribirse manualmente en cada `day_log`.

## 7.2. Override por fecha

Debe permitirse una excepción diaria.

Ejemplo:

```text
Horario habitual: Trabajo = Sí
Override: No
Resultado efectivo: No
```

Casos:

```text
"hoy no trabajé"
"mañana trabajo aunque sea sábado"
```

La excepción solo modifica esa fecha.

Nunca debe alterar silenciosamente el calendario habitual.

---

# 8. Gimnasio

## 8.1. Workout completado es la fuente autoritativa

El gimnasio no debe almacenarse como contador.

No usar:

```text
gym + 1
```

Resolver:

```text
gym_effective = true | false
```

Regla principal:

```text
existe workout_session completed para el usuario y fecha
→ gym_effective = true
```

## 8.2. `in_progress` no cuenta como gimnasio completado

Ejemplo:

```text
workout_session.status = in_progress
→ gym_effective = false
```

Al finalizar:

```text
workout_session.status = completed
→ gym_effective = true
```

## 8.3. Dos sesiones el mismo día

Dos sesiones válidas no deben duplicar el efecto nutricional.

Ejemplo:

```text
Push completed
Cardio completed
```

Resultado:

```text
gym_effective = true
```

No:

```text
gym = 2
```

## 8.4. Override manual excepcional

Solo usar cuando el usuario realmente entrenó pero no existe sesión registrada.

Ejemplo explícito:

```text
"Hoy entrené pero no pude registrar la rutina.
Registralo excepcionalmente como día de gym."
```

Resultado:

```text
gym_override = true
gym_override_source = manual_chat
```

Esto NO debe crear:

- `workout_session`;
- rutina falsa;
- ejercicios;
- series;
- pesos;
- volumen.

## 8.5. Prioridad de fuentes

```text
1. workout_session completed
2. override manual explícito
3. nunca inferencia automática de ChatGPT
```

## 8.6. Conflictos

Si existe una sesión completada y el usuario dice:

```text
"hoy no entrené"
```

no escribir directamente:

```text
gym_override = false
```

Debe detectarse el conflicto.

Si la sesión fue una prueba/error, se corrige la fuente de entrenamiento.

Principio:

> Se corrige la fuente, no el resultado derivado.

---

# 9. Plan nutricional versionado

No guardar un único objetivo global editable que modifique el pasado.

Crear una estructura como:

```text
nutrition_goal_periods
```

Campos conceptuales:

```text
id
user_id
name
effective_from
effective_to

calories_no_gym
calories_gym

protein_g
water_no_gym_l
water_gym_l

notes
created_at
updated_at
```

## 9.1. Configuración histórica inicial

### Período 1

```text
Desde: 2026-06-29
Nombre: Fase 2 original

Kcal sin gym: 1800
Kcal con gym: 1800
Proteína: 130 g
Agua sin gym: 2.0 L
Agua con gym: 2.5 L
```

### Período 2

```text
Desde: 2026-07-30
Nombre: Recomposición suave

Kcal sin gym: 1900
Kcal con gym: 2100
Proteína: 130 g
Agua sin gym: 2.0 L
Agua con gym: 2.5 L
```

## 9.2. Cambios futuros

Un cambio de objetivos debe crear un nuevo período.

Ejemplo:

```text
effective_from = 2026-09-01
```

Nunca modificar retroactivamente julio/agosto.

---

# 10. Gasto estimado versionado

El gasto también debe poder evolucionar sin alterar históricos.

Crear una estructura como:

```text
expenditure_rule_periods
```

o equivalente.

Configuración inicial:

| Trabajo | Gym | Gasto estimado |
|---|---:|---:|
| Sí | Sí | 2350 kcal |
| Sí | No | 2100 kcal |
| No | Sí | 2200 kcal |
| No | No | 1950 kcal |

Los pasos no deben modificar automáticamente estos valores.

## 10.1. Override excepcional de gasto

Debe existir un mecanismo opcional:

```text
expenditure_override
```

Usar únicamente para:

- preservar históricos;
- casos especiales;
- correcciones explícitas.

---

# 11. Diferencia entre objetivo y gasto

Estas métricas deben mantenerse separadas siempre.

Ejemplo:

```text
Objetivo: 2100 kcal
Gasto estimado: 2350 kcal
Consumo: 1900 kcal
```

### Contra objetivo

```text
consumo - objetivo
1900 - 2100 = -200 kcal
```

### Balance energético

```text
consumo - gasto
1900 - 2350 = -450 kcal
```

### Déficit estimado

```text
gasto - consumo
2350 - 1900 = 450 kcal
```

La UI debe evitar llamar a ambas métricas "déficit".

---

# 12. Snapshots diarios

Cada día debe preservar los valores realmente usados.

Ejemplo:

```text
2026-08-12

target_kcal_snapshot = 2100
protein_target_snapshot = 130
water_target_snapshot = 2.5
maintenance_kcal_snapshot = 2350
```

Los históricos no deben recalcularse con objetivos futuros.

---

# 13. Estado del día

Conceptualmente:

```text
open
closed
```

Mientras está `open`:

- se agregan comidas;
- puede cambiar trabajo;
- puede cambiar gym;
- puede cambiar agua;
- se recalculan totales.

Al cerrar:

- se preservan snapshots finales;
- reportes históricos quedan estables.

No es obligatorio exigir cierre manual.

Puede implementarse cierre lógico/automático al pasar al día siguiente.

Debe permitirse corregir días pasados de forma explícita.

---

# 14. Pasos

Registrar:

```text
steps
```

Uso:

- contexto;
- reportes;
- tendencias;
- comparación actividad/peso.

No hacer:

```text
pasos → sumar/restar kcal automáticamente
```

La matriz de gasto se ajustará con tendencias reales, no con el reloj de forma directa.

---

# 15. Agua y mate

Registrar por separado:

```text
water_l
mate_l
```

La meta de agua se refiere a agua pura.

Ejemplo actual:

```text
Sin gym: 2.0 L
Con gym: 2.5 L
```

---

# 16. `meal_entries`

Mantener la tabla existente y ampliarla.

## 16.1. Campos actuales útiles

Actualmente ya existen conceptos como:

```text
id
user_id
day_log_id
consumed_at
meal_label
title
description
final_calories
final_protein_g
source_type
deleted_at
created_at
updated_at
```

## 16.2. Nuevos campos conceptuales

Agregar:

```text
final_carbs_g
final_fat_g

meal_moment
context_type
precision_level

source_note
raw_input

entry_kind
legacy_import_id
idempotency_key
```

Nombres exactos sujetos a revisión técnica.

---

# 17. Tipos de entrada

Debe diferenciarse:

```text
meal
legacy_daily_summary
```

Los históricos donde únicamente existe el total del día no deben inventar comidas.

Ejemplo:

```text
entry_kind = legacy_daily_summary
```

---

# 18. Fuente de comida

La fuente debe ser auditable.

Posibles valores:

```text
manual_web
chatgpt
sheet_import
label
```

Si la implementación existente usa enum/constraint diferente, extenderlo en lugar de romper compatibilidad.

---

# 19. Precisión

Permitir clasificar una estimación:

```text
catalog
label
estimated
historical
```

Ejemplos:

```text
Producto con tabla nutricional → label
Alimento habitual conocido → catalog
Tarta casera estimada → estimated
Resumen heredado del Sheet → historical
```

---

# 20. Soft delete

Mantener el comportamiento actual.

Una comida borrada:

```text
deleted_at != null
```

No debe contar para el día.

Debe permanecer disponible para auditoría.

---

# 21. Correcciones

Cuando el usuario corrige una comida:

```text
"el pollo eran 220 g, no 300 g"
```

debe editarse el registro correspondiente.

No agregar otra comida salvo que corresponda realmente a otro consumo.

---

# 22. Protección contra duplicados

La protección existente de duplicados recientes debe mantenerse.

Además, para ChatGPT debe agregarse idempotencia a nivel servidor.

---

# 23. Idempotencia de ChatGPT

Cada operación de escritura debe recibir:

```text
idempotency_key
```

Ejemplo:

```text
abc123
```

Primer intento:

```text
POST meal
→ crea registro
```

Segundo intento con la misma clave:

```text
POST meal
→ devuelve operación ya procesada
→ no crea duplicado
```

La restricción debe estar respaldada por la base de datos cuando sea posible.

No depender únicamente de una comprobación previa en aplicación.

---

# 24. Catálogo de alimentos

Crear tabla:

```text
foods
```

Campos conceptuales:

```text
id
user_id
name
serving_description
serving_quantity
calories
protein_g
carbs_g
fat_g
precision
source_note
is_active
created_at
updated_at
```

## 24.1. Uso

Cuando ChatGPT recibe:

```text
"las tostadas de siempre"
```

debe buscar primero el catálogo.

No reestimar desde cero un alimento conocido.

## 24.2. No guardar automáticamente todo

No promover cada comida nueva al catálogo.

Agregar principalmente:

- productos concretos;
- alimentos repetidos;
- preparaciones habituales.

---

# 25. Fotos de comida

No almacenar fotos de comida en OWNLEVEL.

No agregar Supabase Storage para este flujo.

Si el usuario envía una imagen a ChatGPT:

```text
imagen
↓
ChatGPT estima
↓
se guardan únicamente datos nutricionales
```

---

# 26. Medidas corporales

Crear tabla:

```text
body_measurements
```

Campos conceptuales:

```text
id
user_id
measured_at
condition
weight_kg
waist_cm
abdomen_cm
hips_cm
chest_cm
right_arm_cm
left_arm_cm
right_thigh_cm
left_thigh_cm
right_calf_cm
left_calf_cm
notes
created_at
updated_at
```

Las fotos corporales pueden quedar fuera de esta etapa.

---

# 27. Eventos nutricionales / permitidos

Crear:

```text
nutrition_events
```

o estructura equivalente.

Uso:

- permitidos;
- comidas sociales;
- alcohol;
- eventos relevantes para análisis.

No deben mezclarse con `meal_entries` si conceptualmente son contexto y no consumo detallado.

---

# 28. Motor diario

Crear una capa única que devuelva el estado nutricional resuelto.

Ejemplo conceptual:

```ts
type NutritionDay = {
  date: string
  workEffective: boolean
  workSource: string

  gymEffective: boolean
  gymSource: string
  workout?: {
    id: string
    routineName?: string
    status: "completed"
  }

  targets: {
    calories: number | null
    proteinG: number | null
    waterL: number | null
  }

  estimatedExpenditure: number | null

  consumed: {
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }

  balance: {
    vsTarget: number | null
    energy: number | null
    estimatedDeficit: number | null
  }
}
```

---

# 29. Lógica del motor diario

Orden recomendado:

```text
1. Resolver fecha Córdoba.
2. Obtener/crear day_log.
3. Resolver plan nutricional vigente.
4. Resolver trabajo habitual.
5. Aplicar override de trabajo.
6. Buscar workout_sessions completed.
7. Resolver gym efectivo.
8. Aplicar gym override solo si no contradice workout autoritativo.
9. Resolver objetivo kcal.
10. Resolver proteína.
11. Resolver agua.
12. Resolver gasto por matriz.
13. Aplicar gasto override si existe.
14. Sumar meal_entries activos.
15. Calcular desvío contra objetivo.
16. Calcular balance energético.
17. Devolver resumen.
```

---

# 30. ChatGPT: rol

ChatGPT debe:

- interpretar lenguaje natural;
- identificar alimentos;
- calcular/estimar macros;
- buscar alimentos habituales;
- crear comidas;
- corregir comidas;
- borrar comidas;
- registrar contexto explícito permitido;
- consultar resumen oficial.

ChatGPT no debe:

- recordar objetivos como fuente de verdad;
- crear entrenamientos por inferencia;
- inventar series;
- inventar rutinas;
- cambiar planes nutricionales silenciosamente;
- recalcular gasto con pasos;
- duplicar una operación por reintento.

---

# 31. API privada de OWNLEVEL

Rutas conceptuales:

```text
/api/integrations/chatgpt
```

No confundir esta API con OpenAI API.

Esta API pertenece a OWNLEVEL.

---

# 32. Endpoint de resumen diario

```http
GET /api/integrations/chatgpt/day?date=YYYY-MM-DD
```

Ejemplo de respuesta:

```json
{
  "date": "2026-08-12",
  "work": true,
  "work_source": "schedule",
  "gym": true,
  "gym_source": "workout_session",
  "workout": {
    "name": "PULL",
    "status": "completed"
  },
  "targets": {
    "calories": 2100,
    "protein_g": 130,
    "water_l": 2.5
  },
  "estimated_expenditure": 2350,
  "consumed": {
    "calories": 1420,
    "protein_g": 96,
    "carbs_g": 130,
    "fat_g": 45
  },
  "balance": {
    "vs_target": -680,
    "energy": -930,
    "estimated_deficit": 930
  }
}
```

---

# 33. Endpoint de comidas

## Crear

```http
POST /api/integrations/chatgpt/meals
```

Debe aceptar:

```text
date
consumed_at
title
description
calories
protein_g
carbs_g
fat_g
precision
raw_input
idempotency_key
```

## Corregir

```http
PATCH /api/integrations/chatgpt/meals/:id
```

## Eliminar

```http
DELETE /api/integrations/chatgpt/meals/:id
```

Internamente debe mantener soft delete.

---

# 34. Endpoint de alimentos

```http
GET /api/integrations/chatgpt/foods?query=...
```

Debe devolver únicamente alimentos pertenecientes al usuario.

---

# 35. Endpoint de contexto diario

```http
PATCH /api/integrations/chatgpt/day-context
```

Acciones permitidas:

- override de trabajo;
- override excepcional de gym;
- agua;
- mate;
- pasos si se decide permitirlo;
- notas.

No permitir que ChatGPT escriba directamente valores derivados como:

```text
gym_effective
target_kcal_snapshot
estimated_expenditure
balance
```

Esos valores deben calcularse en backend.

---

# 36. Flujo de ChatGPT al registrar comida

Ejemplo:

```text
"Comí 300 g de pollo y 200 g de arroz"
```

Flujo:

```text
1. Interpretar.
2. Buscar alimentos habituales.
3. Estimar/calcular macros.
4. POST /meals.
5. GET /day.
6. Responder usando el resumen devuelto por OWNLEVEL.
```

La respuesta final no debe basarse en memoria local del GPT.

---

# 37. Flujo de ChatGPT al mencionar gimnasio

Ejemplo:

```text
"Después del gym comí una banana."
```

ChatGPT:

```text
1. GET /day.
2. Ver gym_effective.
3. Registrar banana.
4. NO crear entrenamiento.
5. NO modificar gym si ya existe workout_session completed.
6. GET /day.
7. Responder.
```

---

# 38. Flujo de ChatGPT: “hoy entrené”

Primero:

```http
GET /day
```

### Si existe sesión completada

```text
No modificar nada.
```

### Si no existe sesión y el usuario solo lo menciona casualmente

```text
No crear override.
```

### Si el usuario ordena explícitamente registrar una excepción

```text
gym_override = true
```

---

# 39. Cambio de objetivos desde ChatGPT

Una frase como:

```text
"Desde el lunes quiero subir las calorías"
```

es una operación sensible.

No modificar el plan silenciosamente.

Debe requerir una acción explícita y crear un nuevo:

```text
nutrition_goal_period
```

con fecha de vigencia.

---

# 40. Migración desde Google Sheets

Planilla actual:

```text
Seguimiento Nutricional
```

La migración debe ser única, auditable e idempotente.

---

# 41. Mapeo de pestañas

## `Registro de comidas`

Destino:

```text
meal_entries
```

Conservar:

- fecha;
- hora;
- momento;
- tipo;
- contexto;
- detalle;
- calorías;
- proteína;
- carbos;
- grasas;
- precisión;
- activo;
- nota/fuente;
- ID histórico.

## `Actividad diaria`

Destino:

```text
day_logs
```

Conservar:

- fecha;
- trabajo;
- gym histórico;
- pasos;
- peso AM;
- agua;
- mate;
- gasto override;
- notas.

## `Metas y configuración`

Destino:

```text
nutrition_goal_periods
expenditure_rule_periods
perfil/configuración
```

## `Alimentos habituales`

Destino:

```text
foods
```

## `Medidas y progreso`

Destino:

```text
body_measurements
```

## `Permitidos`

Destino:

```text
nutrition_events
```

---

# 42. Pestañas derivadas que NO se importan como fuente

No convertir en tablas:

```text
Dashboard
Resumen semanal
Resumen diario
Análisis semanal
```

Sus resultados deben reconstruirse desde Supabase.

---

# 43. Registros históricos incompletos

Los primeros días donde solo existe:

```text
Total diario
```

deben importarse sin inventar comidas.

Ejemplo:

```text
entry_kind = legacy_daily_summary
source_type = sheet_import
```

---

# 44. IDs históricos

Conservar identificadores como:

```text
HIST-0001
```

en:

```text
legacy_import_id
```

Crear restricción única adecuada para hacer la migración idempotente.

---

# 45. Script de migración

Crear algo como:

```text
scripts/migrate-nutrition-history.ts
```

El script debe soportar:

```text
--dry-run
--apply
```

Nunca escribir directamente sin un dry run verificable.

---

# 46. Dry run

Debe reportar:

```text
cantidad de días
cantidad de comidas
cantidad de resúmenes heredados
cantidad de alimentos
cantidad de medidas
cantidad de eventos

duplicados
filas inválidas
fechas inválidas
macros inválidos
IDs repetidos
campos faltantes
```

No debe modificar Supabase.

---

# 47. Orden de importación

Recomendado:

```text
1. perfiles/configuración
2. nutrition_goal_periods
3. expenditure_rule_periods
4. day_logs
5. meal_entries
6. foods
7. body_measurements
8. nutrition_events
```

---

# 48. Validación post-importación

Validar día por día:

```text
calorías
proteína
carbos
grasas
cantidad de entradas
objetivo
gasto
```

Luego validar por semana:

```text
promedios
totales
balance
proteína
```

No declarar terminada la migración hasta que las diferencias estén explicadas.

---

# 49. Google Sheets durante la migración

Secuencia:

```text
backup
↓
dry run
↓
import
↓
validación
↓
uso de OWNLEVEL
↓
período de observación
↓
Google Sheets solo lectura
```

No borrar la planilla.

---

# 50. UI — `/today`

Mantener la página existente y ampliarla.

Debe mostrar como mínimo:

```text
Calorías
Consumido / objetivo

Proteína
Consumida / objetivo

Carbos

Grasas

Trabajo efectivo

Gym efectivo
+ rutina si existe

Gasto estimado

Desvío contra objetivo

Balance energético

Agua
Consumida / objetivo
```

---

# 51. UI — comidas

Cada comida debería mostrar:

```text
momento
título
detalle

kcal
proteína
carbos
grasas

precisión/origen cuando corresponda
```

Acciones:

- editar;
- borrar.

---

# 52. UI — Home

Home ya integra entrenamiento y nutrición.

Debe seguir siendo una vista compacta.

Podría mostrar:

```text
calorías
proteína
entrenamiento del día
balance estimado
progreso semanal
```

Evitar convertir Home en un dashboard excesivamente cargado.

---

# 53. UI — `/history`

Ampliar el historial diario existente.

Debe mostrar:

```text
Trabajo
Gym / rutina

Objetivo kcal
Consumido
Gasto

Vs objetivo
Balance energético

Proteína
Carbos
Grasas
Agua
Pasos

Comidas
```

---

# 54. Reportes semanales

Métricas recomendadas:

```text
promedio kcal
promedio proteína
cumplimiento proteína
balance semanal estimado
días de gym
días laborales
promedio pasos
promedio agua
```

---

# 55. Reportes mensuales

Métricas recomendadas:

```text
peso
cintura
otras medidas

promedio calorías
promedio proteína
balance acumulado

sesiones
series
volumen
progresión de ejercicios
```

La principal ventaja del sistema final será poder cruzar nutrición y entrenamiento.

---

# 56. Perfil y progreso corporal

Integrar peso/medidas con la configuración existente.

No usar un único peso de perfil como historial.

El perfil puede mantener:

```text
peso actual / referencia
```

pero la evolución real debe vivir en:

```text
body_measurements
```

o una estructura histórica equivalente.

---

# 57. Seguridad

## 57.1. Navegador

No exponer ninguna clave secreta.

El frontend solo debe usar credenciales permitidas por RLS.

## 57.2. Backend

Las credenciales sensibles deben existir únicamente en variables de entorno del servidor.

## 57.3. GPT privado

La API debe utilizar autenticación propia.

No colocar secretos de Supabase dentro de:

- instrucciones del GPT;
- schema OpenAPI;
- frontend;
- repositorio.

---

# 58. RLS

Todas las tablas nuevas deben tener RLS.

Regla base:

```text
user_id = auth.uid()
```

Aplicar también a:

```text
foods
body_measurements
nutrition_goal_periods
expenditure_rule_periods
nutrition_events
```

Las operaciones backend de integración deben validar explícitamente el usuario objetivo.

---

# 59. Constraints e índices

Crear índices útiles para:

```text
(user_id, log_date)
(user_id, effective_from)
(user_id, consumed_at)
(user_id, legacy_import_id)
(user_id, idempotency_key)
(user_id, status)
```

Agregar `UNIQUE` donde corresponda.

No depender de lógica de aplicación para invariantes críticas.

---

# 60. Compatibilidad con entrenamiento

La migración nutricional no debe romper:

- sesiones existentes;
- rutina en curso;
- historial;
- progreso;
- reportes;
- calendario;
- ejercicios;
- series;
- RIR.

Antes de tocar `day_logs`, revisar todas las dependencias desde `phase2`.

---

# 61. Tests obligatorios

## Nutrición

- crear comida manual;
- editar comida;
- borrar comida;
- proteína nula;
- carbos/grasas nulos;
- comida histórica;
- día sin comidas;
- día anterior;
- fecha Córdoba;
- cambio de día cerca de medianoche.

## Duplicados

- doble click web;
- doble POST;
- retry de ChatGPT;
- misma `idempotency_key`;
- dos comidas realmente iguales pero consumidas por separado.

## Trabajo

- lunes normal;
- sábado normal;
- lunes override no trabajo;
- sábado override trabajo;
- override solo afecta una fecha.

## Gym

- sin sesión;
- `in_progress`;
- `completed`;
- dos sesiones completadas;
- mención casual a gym;
- “hoy entrené” con sesión existente;
- override explícito sin sesión;
- conflicto sesión completada + usuario dice no entrenó.

## Objetivos

- plan histórico;
- nuevo plan con `effective_from`;
- pasado no cambia;
- gym cambia target del día;
- trabajo/gym cambia gasto.

## Migración

- dry run;
- import idempotente;
- `legacy_import_id`;
- resumen diario heredado;
- reejecución no duplica;
- valores Sheet vs Supabase.

---

# 62. Criterios de aceptación

La migración se considera correcta cuando:

- [ ] Supabase es la única fuente de verdad activa.
- [ ] Google Sheets queda fuera del flujo diario.
- [ ] Todos los días usan fecha Córdoba.
- [ ] `workout_session completed` determina gym automáticamente.
- [ ] `in_progress` no cuenta como gym.
- [ ] ChatGPT no duplica gym.
- [ ] ChatGPT no inventa entrenamientos.
- [ ] Trabajo habitual funciona con overrides diarios.
- [ ] Objetivos se resuelven por período.
- [ ] Gasto se resuelve por período.
- [ ] Históricos conservan snapshots.
- [ ] Objetivo y gasto aparecen separados.
- [ ] Comidas soportan kcal, proteína, carbos y grasas.
- [ ] Soft delete sigue funcionando.
- [ ] API de ChatGPT es idempotente.
- [ ] Alimentos habituales son consultables.
- [ ] Datos de Sheets migrados coinciden matemáticamente.
- [ ] No se inventan comidas históricas faltantes.
- [ ] Todas las tablas nuevas tienen RLS.
- [ ] Home continúa funcionando.
- [ ] Entrenamiento continúa funcionando sin regresiones.
- [ ] Today muestra el nuevo resumen.
- [ ] History muestra el nuevo resumen.
- [ ] Tests automatizados pasan.
- [ ] Build de producción pasa.
- [ ] Deploy de Vercel funciona.

---

# 63. Orden de implementación recomendado

```text
FASE 0
Backup y rama de trabajo

FASE 1
Auditoría final del esquema actual

FASE 2
Migraciones Supabase

FASE 3
Motor diario unificado

FASE 4
Extensión de comidas y catálogo

FASE 5
Script de migración de Google Sheets

FASE 6
Dry run + validación

FASE 7
Importación real

FASE 8
Validación matemática

FASE 9
Actualizar /today

FASE 10
Actualizar /home y /history

FASE 11
Reportes

FASE 12
API privada ChatGPT

FASE 13
OpenAPI + GPT privado

FASE 14
Tests end-to-end

FASE 15
Cutover

FASE 16
Google Sheets read-only
```

---

# 64. Archivos que deben revisarse antes de implementar

Como mínimo:

```text
AGENTS.md

src/app/(app)/home/page.tsx

src/app/(app)/today/page.tsx
src/app/(app)/today/actions.ts
src/app/(app)/today/create-meal-form.tsx

src/app/(app)/history/page.tsx

src/app/(app)/settings/page.tsx
src/app/(app)/settings/profile-form.tsx
src/app/(app)/settings/profile-actions.ts

src/app/(app)/train/actions.ts
src/app/(app)/train/progress/page.tsx
src/app/(app)/train/history/
src/app/(app)/train/session/

src/components/layout/
src/components/training/
src/components/ui/

src/lib/phase1/day-log.ts
src/lib/phase1/profile.ts
src/lib/phase1/types.ts

src/lib/phase2/cordoba-date.ts
src/lib/phase2/training.ts
src/lib/phase2/training-robust.ts
src/lib/phase2/types.ts

src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/middleware.ts

supabase/migrations/
```

Revisar también todos los tests relacionados antes de modificar comportamiento.

---

# 65. Migraciones existentes relevantes

Entre otras:

```text
supabase/migrations/0001.sql

supabase/migrations/20260426_0002_phase1_profiles_weight_and_checks.sql
supabase/migrations/20260426_0003_phase1_meal_entries_calories_required.sql
supabase/migrations/20260426_0004_phase1_remove_meal_status.sql

supabase/migrations/20260427_0014_workout_session_status.sql

supabase/migrations/20260810112232_training_robust_rebuild.sql
supabase/migrations/20260810130000_prevent_duplicate_session_exercises.sql
supabase/migrations/20260810133336_catalog_and_rir.sql
```

No asumir que el esquema actual coincide únicamente con `0001.sql`.

Las nuevas migraciones deben ser incrementales.

---

# 66. Cosas que NO se implementan en esta etapa

No incluir inicialmente:

- IA integrada dentro de OWNLEVEL;
- llamadas directas a OpenAI API desde la web;
- chat propio dentro de la aplicación;
- almacenamiento de fotos de comida;
- reconocimiento de alimentos dentro de OWNLEVEL;
- Apple Health;
- Huawei Health;
- smartwatch como fuente automática de gasto;
- modificación automática de objetivos por IA;
- recomendaciones nutricionales autónomas;
- generación automática de entrenamientos desde ChatGPT.

---

# 67. Resultado final esperado

```text
                       OWNLEVEL
                          │
                    Supabase DB
                          │
         ┌────────────────┴────────────────┐
         │                                 │
   ENTRENAMIENTO                       NUTRICIÓN
         │                                 │
workout_sessions                       meal_entries
workout_sets                           foods
routines                               goal periods
exercises                              measurements
         │                                 │
         └────────────── day_logs ─────────┘
                          │
                 motor diario único
                          │
           ┌──────────────┼──────────────┐
           │              │              │
          Home           Today         History
                          │
                    API privada
                          │
                      ChatGPT
```

---

# 68. Decisiones arquitectónicas cerradas

Estas decisiones no deben reinterpretarse durante implementación:

```text
Supabase = única fuente de verdad.

OWNLEVEL = cálculo, persistencia y visualización.

Workout completed = autoridad principal de gym.

ChatGPT = interfaz natural para registrar y consultar.

ChatGPT no es fuente de verdad de objetivos.

Objetivos = versionados por fecha.

Gasto = separado de objetivo.

Gasto = versionado.

Trabajo = calendario habitual + override diario.

Gym = derivado de workout + override excepcional.

Pasos = contexto, no gasto automático.

Google Sheets = migración + backup.

Históricos = snapshots.

Comidas = soft delete.

ChatGPT API = privada + idempotente.

Fotos de comida = no almacenar.

OpenAI API dentro de OWNLEVEL = fuera de alcance inicial.

Zona horaria = America/Argentina/Cordoba.
```

---

# 69. Regla de implementación

Antes de cambiar código:

> Revisar el estado REAL del repositorio, migraciones, RLS, helpers, componentes, tipos y tests.  
> No asumir que el código sigue exactamente igual que esta especificación.

Si el código real presenta una incompatibilidad con esta arquitectura:

1. no improvisar una arquitectura paralela;
2. identificar el conflicto;
3. preservar los principios definidos en este documento;
4. realizar la adaptación mínima necesaria;
5. agregar tests para la nueva garantía.

---

## Fin de especificación
