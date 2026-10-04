import "server-only";
import { NextResponse } from "next/server";
import { MobileApiUnauthorizedError, MobileApiValidationError, mobileBearerToken } from "./auth";
import { authenticateMobileAccessToken, authenticateMobileMutationAccessToken } from "./supabase";
import { mobileApiResponseHeaders, readMobileJson } from "./http";
import { isNutritionDate } from "./nutrition-day-contract";
import {
  BODY_PAGE_SIZES, bodyRecord, parseBodyMeasurement, parseBodyMeasurementIntent, parseBodyMeasurementPage, parseBodyMeasurementReceipt,
  parseBodyOverview, parseBodyWeightIntent, parseBodyWeightPage, parseBodyWeightReceipt,
  type BodyMeasurementIntent, type BodyPage,
} from "./body-contract";

export type BodySection = "overview" | "weights" | "measurements";
const VALIDATION_CODES = ["22023", "22P02", "22003", "22008", "22007", "23514"];

/** limit+1 rows from the snapshot → a page and its keyset cursor (the last shown date). */
function page<T>(rows: unknown, limit: number, date: (row: Record<string, unknown>) => unknown): BodyPage<T> {
  const list = Array.isArray(rows) ? rows : [];
  const items = list.slice(0, limit) as T[];
  const last = items.at(-1) as Record<string, unknown> | undefined;
  return { items, nextBefore: list.length > limit && last ? String(date(last)) : null };
}
export function bodyReadDto(section: BodySection, raw: unknown) {
  if (!bodyRecord(raw)) return undefined;
  const weights = page(raw.weights, BODY_PAGE_SIZES.weights, row => row.date);
  const measurements = page(Array.isArray(raw.measurements) ? raw.measurements.map(parseBodyMeasurement) : raw.measurements,
    BODY_PAGE_SIZES.measurements, row => row.measuredOn);
  if (section === "weights") { const p = parseBodyWeightPage(weights); return p && isNutritionDate(raw.today) ? { today: raw.today, ...p } : undefined; }
  if (section === "measurements") { const p = parseBodyMeasurementPage(measurements); return p && isNutritionDate(raw.today) ? { today: raw.today, ...p } : undefined; }
  return parseBodyOverview({ today: raw.today, current: raw.current, profileWeightKg: raw.profileWeightKg, weights, measurements });
}

export async function bodyReadResponse(request: Request, section: BodySection) {
  let status = 503, body: unknown = { error: "DATA_UNAVAILABLE" };
  try {
    const auth = await authenticateMobileAccessToken(mobileBearerToken(request.headers.get("authorization")));
    const before = new URL(request.url).searchParams.get("before");
    if (section !== "overview" && before !== null && !isNutritionDate(before)) throw new MobileApiValidationError("El cursor no es válido.");
    const { data, error } = await auth.supabase.rpc("mobile_read_body", {
      p_weights_before: section === "weights" ? before : null,
      p_weights_limit: section === "measurements" ? 0 : BODY_PAGE_SIZES.weights,
      p_measurements_before: section === "measurements" ? before : null,
      p_measurements_limit: section === "weights" ? 0 : BODY_PAGE_SIZES.measurements,
    });
    // POST on purpose: a GET rpc serializes null cursors as the text "null",
    // which Postgres rejects for date parameters (first page would always fail).
    const dto = error ? undefined : bodyReadDto(section, data);
    if (!dto) throw new Error("Body read unavailable");
    status = 200; body = dto;
  } catch (e) {
    if (e instanceof MobileApiUnauthorizedError) { status = 401; body = { error: "UNAUTHORIZED" }; }
    else if (e instanceof MobileApiValidationError) { status = 400; body = { error: "VALIDATION_ERROR", message: e.message }; }
    else console.warn("[mobile.body] read unavailable");
  }
  return NextResponse.json(body, { status, headers: mobileApiResponseHeaders(request) });
}

type Receipt = { response_status: number; response_body: unknown };
const CONFLICTS = {
  weight: ["WEIGHT_CHANGED", "BODY_FUTURE_DATE", "IDEMPOTENCY_KEY_REUSED"],
  measurement: ["MEASUREMENT_CHANGED", "MEASUREMENT_DATE_TAKEN", "BODY_FUTURE_DATE", "IDEMPOTENCY_KEY_REUSED"],
} as const;
function receiptResponse(kind: keyof typeof CONFLICTS, row: Receipt | null, ok: (body: unknown) => boolean) {
  if (row?.response_status === 200 && ok(row.response_body)) return { status: 200, body: row.response_body };
  if (row?.response_status === 404 && bodyRecord(row.response_body) && row.response_body.error === "NOT_FOUND") {
    return { status: 404, body: { error: "NOT_FOUND", message: "La medición ya no está disponible." } };
  }
  const conflict = row?.response_status === 409 && bodyRecord(row.response_body) ? row.response_body : null;
  if (conflict && (CONFLICTS[kind] as readonly string[]).includes(String(conflict.error)) && typeof conflict.message === "string") {
    return { status: 409, body: { error: conflict.error, message: conflict.message } };
  }
  throw new Error("Invalid body mutation receipt");
}
async function mutationResponse(request: Request, run: (auth: Awaited<ReturnType<typeof authenticateMobileMutationAccessToken>>, input: unknown) => Promise<{ status: number; body: unknown }>) {
  let status = 503, body: unknown = { error: "DATA_UNAVAILABLE" };
  try {
    const auth = await authenticateMobileMutationAccessToken(mobileBearerToken(request.headers.get("authorization")));
    ({ status, body } = await run(auth, await readMobileJson(request)));
  } catch (e) {
    if (e instanceof MobileApiUnauthorizedError) { status = 401; body = { error: "UNAUTHORIZED" }; }
    else if (e instanceof MobileApiValidationError) { status = 400; body = { error: "VALIDATION_ERROR", message: e.message }; }
    else console.warn("[mobile.body] mutation unavailable");
  }
  return NextResponse.json(body, { status, headers: mobileApiResponseHeaders(request) });
}
const single = (data: unknown): Receipt | null => Array.isArray(data) && data.length === 1 ? data[0] as Receipt : null;

/** PUT (set) / DELETE (delete) /body/weights/[date]: the intent must match the route. */
export function bodyWeightMutationResponse(request: Request, operation: "set" | "delete", date: string) {
  return mutationResponse(request, async (auth, input) => {
    const intent = parseBodyWeightIntent(input);
    if (!intent || intent.operation !== operation || intent.date !== date) throw new MobileApiValidationError("Revisá el peso y la fecha.");
    const { data, error } = await auth.supabase.rpc("mobile_mutate_body_weight", { p_intent: intent });
    if (error) {
      if (VALIDATION_CODES.includes(error.code)) throw new MobileApiValidationError("Revisá el peso y la fecha.");
      throw new Error("Body weight mutation unavailable");
    }
    return receiptResponse("weight", single(data), body => {
      const receipt = parseBodyWeightReceipt(body);
      return !!receipt && receipt.operation === intent.operation && receipt.date === intent.date;
    });
  });
}

/** POST /body/measurements (create), PUT/DELETE /body/measurements/[id]. */
export function bodyMeasurementMutationResponse(request: Request, operation: BodyMeasurementIntent["operation"], id: string | null) {
  return mutationResponse(request, async (auth, input) => {
    const intent = parseBodyMeasurementIntent(input);
    if (!intent || intent.operation !== operation || (intent.measurementId?.toLowerCase() ?? null) !== (id?.toLowerCase() ?? null)) {
      throw new MobileApiValidationError("Revisá los datos de la medición.");
    }
    const { data, error } = await auth.supabase.rpc("mobile_mutate_body_measurement", { p_intent: intent });
    if (error) {
      if (error.code === "23514") throw new MobileApiValidationError("Registrá al menos una medida corporal.");
      if (VALIDATION_CODES.includes(error.code)) throw new MobileApiValidationError("Revisá los datos de la medición.");
      throw new Error("Body measurement mutation unavailable");
    }
    return receiptResponse("measurement", single(data), body => {
      const receipt = parseBodyMeasurementReceipt(body);
      return !!receipt && receipt.operation === intent.operation && (!id || receipt.measurementId === id.toLowerCase());
    });
  });
}
