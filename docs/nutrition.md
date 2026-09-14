# OWNLEVEL — Nutrition

Documento canónico de la lógica operativa de Nutrición. Para analytics, períodos, coverage y Comparisons, consultar [`progress-v2.md`](./progress-v2.md).

## Alcance

Nutrition separa cuatro capas:

```text
Configuración → Registro diario → Historial factual → Progress
```

- **Configuración:** plan nutricional, gasto, alimentos y comidas guardadas.
- **Registro:** consumos reales y métricas del día.
- **Historial:** reconstrucción de lo que ocurrió en una fecha.
- **Analytics:** análisis derivado desde fuentes canónicas.

## Fuentes canónicas

| Concepto | Fuente |
| --- | --- |
| Día de producto | `day_logs` |
| Consumos reales | `meal_entries` |
| Alimentos | `foods` |
| Comidas guardadas | `saved_meals`, `saved_meal_items` |
| Plan nutricional | `nutrition_plan_periods`, `nutrition_plan_weekdays` |
| Configuración de gasto | `energy_config_periods` |
| Importaciones | `nutrition_import_runs`, `nutrition_events` cuando corresponda |

`day_logs` es un ancla por usuario y fecha; no reemplaza el detalle de `meal_entries`.

## Día nutricional

`/today` representa el día actual de producto en `America/Argentina/Cordoba`.

El read model combina:

- totales consumidos;
- targets efectivos;
- gasto estimado;
- balance;
- comidas activas;
- sugerencias;
- alimentos/comidas guardadas;
- métricas diarias relevantes.

La pantalla no debe convertirse en fuente de verdad: compone datos del dominio y delega la persistencia.

## Comidas registradas

`meal_entries` representa hechos consumidos. Una entrada puede crearse manualmente, desde un alimento, desde una comida guardada, una sugerencia histórica o una integración externa, pero termina en el mismo modelo canónico.

Los nutrientes registrados incluyen calorías y macros cuando se conocen.

**Contrato:** `null` significa desconocido; `0` significa cero conocido. No completar macros opcionales con ceros ficticios.

Crear, editar o hacer soft delete de una comida recalcula los agregados de `day_logs` mediante la lógica canónica de base de datos.

## Totales diarios

Los totales diarios no son una segunda entrada manual. Se derivan de `meal_entries` activas.

No crear una tabla paralela de “totales” ni guardar consumo diario en `profiles`.

## Alimentos

`foods` es un catálogo mutable para registrar por cantidad.

Flujo:

```text
Food actual
→ cantidad elegida
→ escala server-side
→ snapshot nutricional
→ meal_entry
```

Al registrar, el servidor relee el alimento activo, valida ownership y materializa el snapshot. Editar, archivar o eliminar el Food luego no modifica comidas históricas.

## Comidas guardadas

`saved_meals` son plantillas explícitas. Pueden ser manuales o compuestas.

En una compuesta, `saved_meal_items` conserva snapshot de:

- etiqueta;
- cantidad;
- unidad;
- porción base;
- nutrición base;
- provenance opcional hacia el alimento de origen.

`source_food_id` no convierte la plantilla en una dependencia nutricional viva. Cambiar el Food de origen no recalcula la plantilla histórica ni las comidas ya consumidas.

Al usar una comida guardada se crea una `meal_entry` independiente.

## Comidas sugeridas

Las sugerencias son un read model derivado del historial reciente; no son favoritos ni templates persistidos automáticamente.

Elegir una sugerencia crea una nueva `meal_entry` canónica. Guardarla como habitual es una acción explícita separada.

## Registro por cantidad

El servidor debe:

1. recibir la identidad del Food y cantidad;
2. releer el Food propio/activo;
3. validar unidad y cantidad;
4. escalar nutrientes con las reglas compartidas;
5. crear el snapshot en `meal_entries`.

La UI puede mostrar preview, pero el cálculo autoritativo se confirma en servidor.

## Plan nutricional

`nutrition_plan_periods` define versiones efectivas por fecha. `nutrition_plan_weekdays` contiene los objetivos de cada día de semana.

La configuración histórica no debe sobrescribirse para “actualizar” días pasados. Un nuevo plan entra en vigencia desde `effective_from`.

El target de una fecha se resuelve desde el plan efectivo y puede incorporar ajustes explícitos ligados a entrenamiento si la configuración vigente así lo define.

## Gasto energético

`energy_config_periods` versiona la configuración de gasto.

Puede contemplar:

- base automática derivada del BMR;
- base custom;
- factor/nivel de actividad;
- extra por entrenamiento;
- versión de fórmula.

Un override del día puede reemplazar el gasto resuelto sin cambiar la configuración global.

## Objetivo, gasto y balance

Estos conceptos son distintos:

```text
objetivo de consumo ≠ gasto estimado ≠ balance energético
balance energético = consumo − gasto
```

Nunca calcular balance como consumo menos target.

## Snapshots e historia

`day_logs` conserva IDs/snapshots/overrides necesarios para que una fecha pasada no dependa de la configuración actual.

**Contrato:** cambiar hoy el plan, gasto, alimento o comida guardada no debe reescribir el pasado.

## Edición y borrado

Las comidas usan edición controlada y soft delete cuando corresponde. La eliminación visual no implica necesariamente borrar físicamente el hecho.

Las correcciones históricas deben actuar sobre la fuente canónica y permitir que los agregados/reports se recalculen desde allí.

## Prevención de duplicados

Los flujos externos y algunas acciones rápidas pueden detectar posibles duplicados. La protección debe preservar la diferencia entre `null` y `0`.

Una repetición legítima requiere confirmación explícita cuando el flujo la marque como posible duplicado.

## ChatGPT

La integración ChatGPT es write-only y termina en `meal_entries`; no existe una base nutricional paralela.

- token con scope mínimo `meals:write`;
- raw token visible una sola vez;
- persistencia del hash;
- idempotencia;
- fecha local de Córdoba;
- validación server-side;
- no lectura de acumulados u otros datos personales por la Action.

Ver [`integrations/chatgpt-nutrition.md`](./integrations/chatgpt-nutrition.md).

## Importación histórica

El importador histórico separa dry-run y apply. Una importación debe ser reproducible, owner-scoped y transaccional.

Los hechos importados conservan provenance. Datos dudosos o eventos contextuales no deben transformarse en consumo inventado.

## Historial y Progress

Historial responde “qué registré ese día”. Progress responde “cómo cambió mi nutrición y qué se asocia con ella”.

No mezclar ambos motores.

## Code map

| Responsabilidad | Ubicación |
| --- | --- |
| Día nutricional | `src/app/(app)/today`, `src/lib/nutrition/day.ts`, `src/lib/nutrition/product.ts` |
| Foods | `src/app/(app)/settings/nutrition/foods`, `src/lib/nutrition/food-*` |
| Saved meals | `src/app/(app)/settings/nutrition/meals`, `src/lib/nutrition/saved-*`, `src/lib/nutrition/quick-*` |
| Plan/gasto | `src/app/(app)/settings/nutrition`, `src/lib/nutrition/plan-v2*` |
| Reportes | `src/lib/nutrition/report-*`, `src/components/nutrition` |
| Integración ChatGPT | `src/app/api/integrations/chatgpt`, `src/lib/integrations/chatgpt-*` |
| Importación | `scripts/nutrition-import` |
| Schema | `supabase/migrations`, `supabase/tests` |

## Invariantes

No hacer:

- guardar macros consumidos en `profiles`;
- crear una segunda tabla de totales diarios;
- recalcular historia desde Foods o plantillas actuales;
- tratar sugerencias como favoritos implícitos;
- inventar macros faltantes;
- confundir `null` con `0`;
- confundir objetivo, gasto y balance;
- inventar targets históricos con la configuración actual;
- permitir que una integración externa saltee ownership o fuentes canónicas;
- hacer N+1 por día, comida o componente cuando puede cargarse en bloque.

## Referencias

- [`ownlevel-architecture.md`](./ownlevel-architecture.md)
- [`architecture/data-flow.md`](./architecture/data-flow.md)
- [`progress-v2.md`](./progress-v2.md)
- [`integrations/chatgpt-nutrition.md`](./integrations/chatgpt-nutrition.md)
