import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { CellValue, WorkbookSnapshot } from "./types.ts";

export const REQUIRED_SHEETS = [
  "Dashboard",
  "Resumen semanal",
  "Resumen diario",
  "Actividad diaria",
  "Medidas y progreso",
  "Permitidos",
  "Metas y configuración",
  "Rules",
  "Registro de comidas",
  "Análisis semanal",
  "Alimentos habituales",
] as const;

export const HASHED_SOURCE_SHEETS = [
  "Actividad diaria",
  "Medidas y progreso",
  "Permitidos",
  "Metas y configuración",
  "Registro de comidas",
  "Alimentos habituales",
] as const;

export async function readWorkbookSnapshot(path: string): Promise<WorkbookSnapshot> {
  return JSON.parse(await readFile(path, "utf8")) as WorkbookSnapshot;
}

function normalizeCell(value: CellValue | undefined): CellValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const normalized = value.replace(/\r\n/g, "\n").trim();
    return normalized === "" ? null : normalized;
  }
  return value;
}

function canonicalRows(rows: CellValue[][]): CellValue[][] {
  const normalized = rows.map((row) => {
    const cells = row.map(normalizeCell);
    while (cells.at(-1) === null) cells.pop();
    return cells;
  });
  while (normalized.at(-1)?.length === 0) normalized.pop();
  return normalized;
}

export function canonicalSourcePayload(workbook: WorkbookSnapshot) {
  return HASHED_SOURCE_SHEETS.map((name) => ({
    name,
    rows: canonicalRows(workbook.sheets[name] ?? []),
  }));
}

export function sourceSha256(workbook: WorkbookSnapshot): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalSourcePayload(workbook)))
    .digest("hex");
}

export function assertWorkbookShape(workbook: WorkbookSnapshot): void {
  if (workbook.locale !== "es_AR") {
    throw new Error(`Locale inesperado: ${workbook.locale}`);
  }
  if (workbook.timezone !== "America/Cordoba") {
    throw new Error(`Timezone inesperada: ${workbook.timezone}`);
  }
  for (const sheet of REQUIRED_SHEETS) {
    if (!Array.isArray(workbook.sheets[sheet])) {
      throw new Error(`Falta la pestaña requerida: ${sheet}`);
    }
  }
}

/**
 * Adaptador opcional para ejecuciones locales con un OAuth token de solo
 * lectura. El dry-run también acepta snapshots JSON producidos por el conector
 * de Google Drive; ambos caminos entregan exactamente WorkbookSnapshot.
 */
export async function readGoogleSheet(options: {
  spreadsheetId: string;
  accessToken: string;
  sourceName: string;
}): Promise<WorkbookSnapshot> {
  const ranges = REQUIRED_SHEETS.map((name) => `'${name.replaceAll("'", "''")}'!A1:Z1000`);
  const query = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption: "FORMATTED_VALUE",
  });
  for (const range of ranges) query.append("ranges", range);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${options.spreadsheetId}/values:batchGet?${query}`,
    { headers: { Authorization: `Bearer ${options.accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`Google Sheets read-only fetch falló: ${response.status}`);
  }
  const body = (await response.json()) as {
    valueRanges?: Array<{ range: string; values?: CellValue[][] }>;
  };
  const sheets: Record<string, CellValue[][]> = {};
  REQUIRED_SHEETS.forEach((name, index) => {
    sheets[name] = body.valueRanges?.[index]?.values ?? [];
  });
  return {
    spreadsheetId: options.spreadsheetId,
    sourceName: options.sourceName,
    locale: "es_AR",
    timezone: "America/Cordoba",
    sheets,
  };
}

export function rowsAfterHeader(
  rows: CellValue[][],
  firstHeader: string,
): Array<{ sourceRow: number; values: CellValue[]; record: Record<string, CellValue> }> {
  const headerIndex = rows.findIndex((row) => String(row[0] ?? "").trim() === firstHeader);
  if (headerIndex < 0) throw new Error(`No se encontró encabezado ${firstHeader}`);
  const headers = rows[headerIndex].map((cell) => String(cell ?? "").trim());
  return rows.slice(headerIndex + 1).map((values, offset) => ({
    sourceRow: headerIndex + offset + 2,
    values,
    record: Object.fromEntries(headers.map((header, index) => [header, values[index] ?? null])),
  }));
}
