# Importador histórico de Nutrición

Esta herramienta construye un plan determinista y **no escribe** en Supabase ni
en Google Sheets. PR 5 implementa únicamente:

```text
snapshot de solo lectura → normalización → validación → comparación → plan → dry-run
```

PR 6 deberá consumir el mismo plan; no debe reconstruir las decisiones durante
la escritura.

## Privacidad

Los snapshots reales y el reporte contienen información privada. Sólo pueden
vivir en `tmp/` o `temp/`, ambos ignorados por Git. El CLI rechaza cualquier
otra ubicación de salida. El repositorio contiene exclusivamente fixtures
sintéticos.

Ejemplo local:

```bash
npm run nutrition:dry-run -- \
  --source tmp/nutrition-import/source.json \
  --production tmp/nutrition-import/production.json \
  --out tmp/nutrition-import/report.json
```

## Convenciones

- El hash SHA-256 usa una representación canónica (celdas recortadas, filas y
  columnas vacías finales eliminadas) de las seis pestañas fuente. Las vistas
  derivadas no alteran la identidad del import.
- Una comida sin hora usa `12:00:00-03:00` de manera determinista para satisfacer
  `consumed_at NOT NULL`. `raw_input.originalTimeKnown=false` preserva que la
  hora era desconocida; la UI no debe presentarla como una medición.
- Una fila inactiva se prepara para conservarse con soft delete aplicado en la
  fecha del import. Nunca participa de totales.
- Un resumen heredado es `legacy_daily_summary`, no una comida inventada, y no
  puede coexistir activamente con detalle del mismo día.
- El trabajo explícito gana al horario lunes-viernes mediante override. Los
  pasos no deciden trabajo ni gasto.
- Una sesión `completed` es autoritativa para gym. Un Gym=Sí anterior al sistema
  prepara `gym_override=true`; un desacuerdo con una sesión completed bloquea.
- Los días se clasifican en `INSERT`, `MERGE_SAFE`, `NO_OP` o `CONFLICT`. Nunca
  se reemplaza un `day_logs` y el plan no contiene IDs de esas filas.
- Los snapshots históricos salen de los valores explícitos del Sheet. No se
  llama a `refresh_nutrition_day` sobre el pasado.
- `APPLY_READY=false` es el resultado correcto mientras existan discrepancias,
  conflictos o campos sin destino que provocarían pérdida.

## Módulos

- `source.ts`: lectura/snapshot y hash canónico.
- `normalize.ts`: parseo de fechas, decimales, filas y procedencia.
- `validate.ts`: reconciliación con `Resumen diario`.
- `plan.ts`: colisiones con producción y plan reusable.
- `cli.ts`: ejecución y escritura restringida del reporte privado.

Las tolerancias son explícitas: calorías exactas, macros ±0,11 g y líquidos
±0,051 L (el resumen visible redondea líquidos a un decimal).
