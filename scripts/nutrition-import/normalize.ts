import type {
  BodyMeasurementReview,
  CellValue,
  DailyOracle,
  ExpenditurePeriodPlan,
  GoalPeriodPlan,
  ImportAnomaly,
  NormalizedActivityDay,
  NormalizedFood,
  NormalizedMeal,
  NormalizedWorkbook,
  NutritionEventReview,
  NutritionPrecision,
  WeightFact,
  WorkbookSnapshot,
  WorkSchedulePlan,
} from "./types.ts";
import {
  assertWorkbookShape,
  rowsAfterHeader,
  sourceSha256,
} from "./source.ts";

function text(value: CellValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

export function parseArgentineNumber(value: CellValue | undefined): number | null {
  const raw = text(value);
  if (raw === null) return null;
  const normalized = raw
    .replace(/\s/g, "")
    .replace(/%$/, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Número argentino inválido: ${raw}`);
  return parsed;
}

function requiredNumber(value: CellValue | undefined, field: string): number {
  const parsed = parseArgentineNumber(value);
  if (parsed === null) throw new Error(`${field} es obligatorio`);
  return parsed;
}

export function parseArgentineDate(value: CellValue | undefined): string | null {
  const raw = text(value);
  if (raw === null) return null;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) throw new Error(`Fecha argentina inválida: ${raw}`);
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Fecha inexistente: ${raw}`);
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseYesNo(value: CellValue | undefined, field: string): boolean {
  const raw = text(value)?.toLocaleLowerCase("es-AR");
  if (raw === "sí" || raw === "si") return true;
  if (raw === "no") return false;
  throw new Error(`${field} debe ser Sí o No`);
}

function parseOptionalYesNo(value: CellValue | undefined): boolean | null {
  if (text(value) === null) return null;
  return parseYesNo(value, "Booleano");
}

function mealLabel(value: CellValue | undefined): NormalizedMeal["mealLabel"] {
  const raw = text(value)?.toLocaleLowerCase("es-AR") ?? "";
  if (raw === "desayuno") return "breakfast";
  if (raw === "almuerzo") return "lunch";
  if (raw === "merienda") return "snack";
  if (raw === "cena") return "dinner";
  if (raw === "extra" || raw === "extras") return "extra";
  return null;
}

export function historicalConsumedAt(logDate: string, originalTime: string | null) {
  const match = originalTime?.match(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?:\D|$)/);
  const hour = match ? String(Number(match[1])).padStart(2, "0") : "12";
  const minute = match ? match[2] : "00";
  return {
    consumedAt: `${logDate}T${hour}:${minute}:00-03:00`,
    originalTimeKnown: Boolean(match),
  };
}

export function mapPrecision(options: {
  entryKind: NormalizedMeal["entryKind"];
  originalPrecision: string | null;
  sourceNote: string | null;
}): NutritionPrecision {
  if (options.entryKind === "legacy_daily_summary") return "historical";
  const evidence = `${options.originalPrecision ?? ""} ${options.sourceNote ?? ""}`
    .toLocaleLowerCase("es-AR");
  if (/estim|aprox|incertid|conservador|referencia habitual|valor estándar/.test(evidence)) {
    return "estimated";
  }
  if (/etiqueta|información nutricional oficial|según envase/.test(evidence)) {
    return "label";
  }
  // Alta/Media/Baja no tienen equivalencia segura con el enum del schema.
  return "estimated";
}

function normalizeMeals(workbook: WorkbookSnapshot): NormalizedMeal[] {
  return rowsAfterHeader(workbook.sheets["Registro de comidas"], "ID")
    .filter(({ record }) => text(record.ID) !== null)
    .map(({ sourceRow, record }) => {
      const logDate = parseArgentineDate(record.Fecha);
      if (!logDate) throw new Error(`Registro de comidas!${sourceRow}: falta Fecha`);
      const id = text(record.ID);
      if (!id) throw new Error(`Registro de comidas!${sourceRow}: falta ID`);
      const entryKind = text(record.Tipo)?.toLocaleLowerCase("es-AR") === "resumen heredado"
        ? "legacy_daily_summary" as const
        : "meal" as const;
      const originalTime = text(record.Hora);
      const time = historicalConsumedAt(logDate, originalTime);
      const sourceNote = text(record["Nota / fuente"]);
      const originalPrecision = text(record.Precisión);
      const active = parseYesNo(record.Activo, "Activo");
      return {
        sourceRow,
        sourceType: "sheet_import" as const,
        legacyImportSource: "google-sheet:registro-comidas:v1" as const,
        legacyImportId: id,
        logDate,
        consumedAt: time.consumedAt,
        originalTimeKnown: time.originalTimeKnown,
        originalTime,
        mealLabel: entryKind === "meal" ? mealLabel(record.Momento) : null,
        entryKind,
        contextType: text(record.Contexto),
        title: text(record.Detalle) ?? text(record.Momento) ?? "Registro histórico",
        finalCalories: requiredNumber(record.Calorías, "Calorías"),
        finalProteinG: parseArgentineNumber(record["Proteína (g)"]),
        finalCarbsG: parseArgentineNumber(record["Carbos (g)"]),
        finalFatG: parseArgentineNumber(record["Grasas (g)"]),
        precisionLevel: mapPrecision({ entryKind, originalPrecision, sourceNote }),
        originalPrecision,
        sourceNote,
        rawInput: {
          sourceSheet: "Registro de comidas",
          sourceRow,
          originalRow: record,
          originalTime,
          originalTimeKnown: time.originalTimeKnown,
          originalPrecision,
          originalType: text(record.Tipo),
          originalMoment: text(record.Momento),
          originalActive: text(record.Activo),
        },
        active,
        deletedAtPolicy: active ? "none" as const : "import_applied_at" as const,
      };
    });
}

function normalizeActivity(workbook: WorkbookSnapshot): NormalizedActivityDay[] {
  return rowsAfterHeader(workbook.sheets["Actividad diaria"], "Fecha")
    .filter(({ record }) => {
      const status = text(record.Estado)?.toLocaleLowerCase("es-AR");
      return status === "cerrado" || status === "en curso";
    })
    .map(({ sourceRow, record }) => {
      const logDate = parseArgentineDate(record.Fecha);
      if (!logDate) throw new Error(`Actividad diaria!${sourceRow}: falta Fecha`);
      return {
        sourceRow,
        logDate,
        status: text(record.Estado)!,
        work: parseYesNo(record.Trabajo, "Trabajo"),
        gym: parseYesNo(record.Gym, "Gym"),
        steps: parseArgentineNumber(record.Pasos),
        weightKg: parseArgentineNumber(record["Peso AM (kg)"]),
        waterL: parseArgentineNumber(record["Agua pura (L)"]),
        mateL: parseArgentineNumber(record["Mate (L)"]),
        sourceExpenditureOverrideKcal: parseArgentineNumber(record["Gasto override"]),
        notes: text(record.Notas),
        nutritionTargetKcal: requiredNumber(record["Meta kcal"], "Meta kcal"),
        proteinTargetG: requiredNumber(record["Meta proteína"], "Meta proteína"),
        ruleExpenditureKcal: requiredNumber(record["Gasto regla"], "Gasto regla"),
        usedExpenditureKcal: requiredNumber(record["Gasto usado"], "Gasto usado"),
        waterTargetL: requiredNumber(record["Meta agua"], "Meta agua"),
      };
    });
}

function normalizeGoals(workbook: WorkbookSnapshot): GoalPeriodPlan[] {
  return rowsAfterHeader(workbook.sheets["Metas y configuración"], "Vigente desde")
    .filter(({ record }) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text(record["Vigente desde"]) ?? ""))
    .map(({ record }) => {
      const effectiveFrom = parseArgentineDate(record["Vigente desde"]);
      if (!effectiveFrom) throw new Error("Período nutricional sin fecha");
      const protein = requiredNumber(record.Proteína, "Proteína");
      return {
        ref: `nutrition-goal:${effectiveFrom}`,
        effectiveFrom,
        name: text(record.Plan) ?? `Plan ${effectiveFrom}`,
        caloriesNoGym: requiredNumber(record["kcal sin gym"], "kcal sin gym"),
        caloriesGym: requiredNumber(record["kcal con gym"], "kcal con gym"),
        proteinNoGymG: protein,
        proteinGymG: protein,
        waterNoGymL: requiredNumber(record["Agua sin gym"], "Agua sin gym"),
        waterGymL: requiredNumber(record["Agua con gym"], "Agua con gym"),
        sharedProteinSource: true as const,
      };
    });
}

function normalizeExpenditure(workbook: WorkbookSnapshot, effectiveFrom: string): ExpenditurePeriodPlan[] {
  const rows = workbook.sheets["Metas y configuración"];
  const header = rows.findIndex((row) => text(row[0]) === "Trabajo" && text(row[1]) === "Gym");
  if (header < 0) throw new Error("No se encontró matriz de gasto");
  const matrix = new Map<string, number>();
  for (const row of rows.slice(header + 1, header + 5)) {
    matrix.set(`${text(row[0])}:${text(row[1])}`, requiredNumber(row[2], "Gasto estimado"));
  }
  return [{
    ref: `expenditure-rule:${effectiveFrom}`,
    effectiveFrom,
    name: "Matriz histórica del Sheet",
    workGymKcal: matrix.get("Sí:Sí")!,
    workNoGymKcal: matrix.get("Sí:No")!,
    noWorkGymKcal: matrix.get("No:Sí")!,
    noWorkNoGymKcal: matrix.get("No:No")!,
  }];
}

function normalizeSchedule(effectiveFrom: string): WorkSchedulePlan[] {
  return [{
    ref: `work-schedule:${effectiveFrom}`,
    effectiveFrom,
    name: "Lunes a viernes histórico",
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  }];
}

export function parseServing(value: CellValue | undefined) {
  const raw = text(value);
  const match = raw?.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (!match) throw new Error(`Porción inválida: ${raw ?? "vacía"}`);
  return { quantity: parseArgentineNumber(match[1])!, unit: match[2].trim() };
}

function foodPrecision(source: string | null): NutritionPrecision {
  const value = source?.toLocaleLowerCase("es-AR") ?? "";
  if (value.includes("etiqueta") && !value.includes("historial")) return "label";
  if (value.includes("estim")) return "estimated";
  return "historical";
}

function normalizeFoods(workbook: WorkbookSnapshot): NormalizedFood[] {
  return rowsAfterHeader(workbook.sheets["Alimentos habituales"], "Alimento / preparación")
    .filter(({ record }) => text(record["Alimento / preparación"]) !== null)
    .map(({ sourceRow, record }) => {
      const serving = parseServing(record.Porción);
      const proteinG = parseArgentineNumber(record["Proteína (g)"]);
      const carbsG = parseArgentineNumber(record["Carbos (g)"]);
      const fatG = parseArgentineNumber(record["Grasas (g)"]);
      const sourceNote = text(record["Fuente / precisión"]);
      return {
        sourceRow,
        name: text(record["Alimento / preparación"])!,
        servingQuantity: serving.quantity,
        servingUnit: serving.unit,
        calories: requiredNumber(record.Calorías, "Calorías de alimento"),
        proteinG,
        carbsG,
        fatG,
        sourceNote,
        precisionLevel: foodPrecision(sourceNote),
        active: parseYesNo(record.Activo, "Activo de alimento"),
        schemaCompatible: proteinG !== null && carbsG !== null && fatG !== null,
      };
    });
}

function measurementReview(sourceRow: number, record: Record<string, CellValue>): BodyMeasurementReview {
  const logDate = parseArgentineDate(record.Fecha);
  const number = (key: string) => parseArgentineNumber(record[key]);
  const representable: Record<string, number> = {};
  for (const [source, target] of [["Cintura (cm)", "waist_cm"], ["Pecho (cm)", "chest_cm"], ["Cadera (cm)", "hip_cm"]] as const) {
    const value = number(source);
    if (value !== null) representable[target] = value;
  }
  const unrepresentable = Object.fromEntries([
    ["condition", text(record.Condición)],
    ["abdomen_cm", number("Abdomen (cm)")],
    ["right_arm_cm", number("Brazo der. relajado")],
    ["left_arm_cm", number("Brazo izq. relajado")],
    ["right_thigh_cm", number("Muslo der.")],
    ["left_thigh_cm", number("Muslo izq.")],
    ["right_calf_cm", number("Pantorrilla der.")],
    ["left_calf_cm", number("Pantorrilla izq.")],
    ["front_photo", text(record["Foto frente"])],
    ["profile_photo", text(record["Foto perfil"])],
    ["back_photo", text(record["Foto espalda"])],
    ["notes", text(record.Notas)],
  ].filter(([, value]) => value !== null));
  const suspicious: string[] = [];
  const rightArm = number("Brazo der. relajado");
  const leftArm = number("Brazo izq. relajado");
  const rightCalf = number("Pantorrilla der.");
  const leftCalf = number("Pantorrilla izq.");
  if (rightArm !== null && leftArm !== null && Math.abs(rightArm - leftArm) > 5) suspicious.push("asimetría de brazos > 5 cm");
  if (rightCalf !== null && leftCalf !== null && Math.abs(rightCalf - leftCalf) > 5) suspicious.push("asimetría de pantorrillas > 5 cm");
  if ([rightArm, leftArm].some((value) => value !== null && (value < 15 || value > 80))) suspicious.push("medida de brazo fuera de rango esperable");
  if ([rightCalf, leftCalf].some((value) => value !== null && (value < 20 || value > 70))) suspicious.push("medida de pantorrilla fuera de rango esperable");
  if (/revisar|posible error/i.test(text(record.Notas) ?? "")) suspicious.push("la fuente marca un posible error");
  if (logDate === null) suspicious.push("fila sin fecha");
  return { sourceRow, logDate, representable, unrepresentable, suspicious };
}

function normalizeBody(workbook: WorkbookSnapshot): BodyMeasurementReview[] {
  return rowsAfterHeader(workbook.sheets["Medidas y progreso"], "Fecha")
    .filter(({ values }) => values.some((value) => text(value) !== null))
    .map(({ sourceRow, record }) => measurementReview(sourceRow, record));
}

function normalizeEvents(workbook: WorkbookSnapshot): NutritionEventReview[] {
  return rowsAfterHeader(workbook.sheets.Permitidos, "ID")
    .filter(({ record }) => text(record.ID) !== null)
    .map(({ sourceRow, record }) => ({
      sourceRow,
      legacyId: text(record.ID)!,
      logDate: parseArgentineDate(record.Fecha)!,
      structuredFieldsWithoutDestination: [
        "legacy event ID", "event type", "intensity", "planned status",
        "alcohol flag", "equivalent drinks", "event calories", "origin",
      ],
      partiallyPreservedBy: ["meal_entries detail/source_note", "day_logs notes"],
    }));
}

function normalizeOracle(workbook: WorkbookSnapshot): DailyOracle[] {
  return rowsAfterHeader(workbook.sheets["Resumen diario"], "Fecha")
    .filter(({ record }) => {
      const status = text(record.Estado)?.toLocaleLowerCase("es-AR");
      return status === "cerrado" || status === "en curso";
    })
    .map(({ sourceRow, record }) => ({
      sourceRow,
      logDate: parseArgentineDate(record.Fecha)!,
      calories: requiredNumber(record.Calorías, "Calorías de resumen"),
      proteinG: requiredNumber(record.Proteína, "Proteína de resumen"),
      carbsG: parseArgentineNumber(record.Carbos),
      fatG: parseArgentineNumber(record.Grasas),
      waterL: parseArgentineNumber(record["Agua pura"]),
      mateL: parseArgentineNumber(record.Mate),
      work: parseYesNo(record.Trabajo, "Trabajo de resumen"),
      gym: parseYesNo(record.Gym, "Gym de resumen"),
      steps: parseArgentineNumber(record.Pasos),
      weightKg: parseArgentineNumber(record["Peso AM"]),
      targetKcal: requiredNumber(record["Meta kcal"], "Meta kcal de resumen"),
      expenditureKcal: requiredNumber(record.Gasto, "Gasto de resumen"),
      energyBalanceKcal: requiredNumber(record.Balance, "Balance de resumen"),
    }));
}

function normalizeWeights(activity: NormalizedActivityDay[], body: BodyMeasurementReview[], workbook: WorkbookSnapshot, anomalies: ImportAnomaly[]): WeightFact[] {
  const facts: WeightFact[] = [];
  for (const day of activity) {
    if (day.weightKg !== null) facts.push({ logDate: day.logDate, weightKg: day.weightKg, sources: ["activity"], sourceRows: [day.sourceRow] });
  }
  const bodyRows = rowsAfterHeader(workbook.sheets["Medidas y progreso"], "Fecha")
    .filter(({ values }) => values.some((value) => text(value) !== null));
  for (const row of bodyRows) {
    const weightKg = parseArgentineNumber(row.record["Peso (kg)"]);
    if (weightKg === null) continue;
    const logDate = parseArgentineDate(row.record.Fecha);
    const existing = facts.find((fact) => fact.logDate === logDate);
    if (existing && Math.abs(existing.weightKg - weightKg) <= 0.01) {
      existing.sources.push("body_measurements");
      existing.sourceRows.push(row.sourceRow);
    } else if (existing) {
      anomalies.push({ code: "WEIGHT_SOURCE_CONFLICT", severity: "blocker", sheet: "Medidas y progreso", sourceRow: row.sourceRow, logDate, message: "Actividad diaria y Medidas tienen pesos distintos para la misma fecha." });
      facts.push({ logDate, weightKg, sources: ["body_measurements"], sourceRows: [row.sourceRow] });
    } else {
      facts.push({ logDate, weightKg, sources: ["body_measurements"], sourceRows: [row.sourceRow] });
    }
  }
  return facts;
}

export function normalizeWorkbook(workbook: WorkbookSnapshot): NormalizedWorkbook {
  assertWorkbookShape(workbook);
  const anomalies: ImportAnomaly[] = [];
  const meals = normalizeMeals(workbook);
  const activityDays = normalizeActivity(workbook);
  const goalPeriods = normalizeGoals(workbook).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  if (goalPeriods.length === 0) throw new Error("No hay períodos nutricionales");
  const expenditurePeriods = normalizeExpenditure(workbook, goalPeriods[0].effectiveFrom);
  const workSchedulePeriods = normalizeSchedule(goalPeriods[0].effectiveFrom);
  const foods = normalizeFoods(workbook);
  const bodyMeasurements = normalizeBody(workbook);
  const events = normalizeEvents(workbook);
  const dailyOracle = normalizeOracle(workbook);
  const weights = normalizeWeights(activityDays, bodyMeasurements, workbook, anomalies);

  for (const body of bodyMeasurements) {
    if (body.logDate === null) anomalies.push({ code: "BODY_ROW_WITHOUT_DATE", severity: "blocker", sheet: "Medidas y progreso", sourceRow: body.sourceRow, logDate: null, message: "La fila corporal no tiene fecha y no puede importarse de forma determinista." });
    if (body.suspicious.length > 0) anomalies.push({ code: "SUSPICIOUS_BODY_MEASUREMENT", severity: "blocker", sheet: "Medidas y progreso", sourceRow: body.sourceRow, logDate: body.logDate, message: body.suspicious.join("; ") });
  }
  for (const food of foods.filter((item) => !item.schemaCompatible)) {
    anomalies.push({ code: "FOOD_NULL_MACROS_SCHEMA_GAP", severity: "blocker", sheet: "Alimentos habituales", sourceRow: food.sourceRow, message: "El alimento tiene macros desconocidos, pero foods exige proteína, carbohidratos y grasas NOT NULL." });
  }

  const allDates = [...activityDays.map((day) => day.logDate), ...meals.map((meal) => meal.logDate)].sort();
  return {
    spreadsheetId: workbook.spreadsheetId,
    sourceName: workbook.sourceName,
    sourceSha256: sourceSha256(workbook),
    sourceRange: { from: allDates[0], to: allDates.at(-1)! },
    rowCounts: Object.fromEntries(Object.entries(workbook.sheets).map(([name, rows]) => [name, rows.length])),
    meals,
    activityDays,
    goalPeriods,
    expenditurePeriods,
    workSchedulePeriods,
    foods,
    weights,
    bodyMeasurements,
    events,
    dailyOracle,
    anomalies,
  };
}

export function isScheduledWorkday(logDate: string): boolean {
  const day = new Date(`${logDate}T12:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

export function periodForDate<T extends { effectiveFrom: string }>(periods: T[], logDate: string): T {
  const period = periods.filter((item) => item.effectiveFrom <= logDate).at(-1);
  if (!period) throw new Error(`No hay período aplicable para ${logDate}`);
  return period;
}

export function optionalYesNoForTests(value: CellValue | undefined) {
  return parseOptionalYesNo(value);
}
