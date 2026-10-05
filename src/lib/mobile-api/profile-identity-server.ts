import "server-only";
import { NextResponse } from "next/server";
import { MobileApiUnauthorizedError, MobileApiValidationError, mobileBearerToken } from "./auth";
import { authenticateMobileMutationAccessToken } from "./supabase";
import { mobileApiResponseHeaders, readMobileJson } from "./http";
import { DISPLAY_NAME_CONFLICTS, parseDisplayNameIntent, parseDisplayNameReceipt, parseProfileIdentity } from "./profile-identity-contract";

const VALIDATION_CODES = ["22023", "22P02"];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** GET/PATCH /api/mobile/v1/profile. Identity comes only from the Bearer token; the body never carries a user id. */
export async function profileIdentityResponse(request: Request) {
  let status = 503, body: unknown = { error: "DATA_UNAVAILABLE" };
  try {
    const auth = await authenticateMobileMutationAccessToken(mobileBearerToken(request.headers.get("authorization")));
    if (request.method === "GET") {
      const { data, error } = await auth.supabase.rpc("mobile_read_profile_identity", {}, { get: true });
      const dto = error ? undefined : parseProfileIdentity(data);
      if (!dto) throw new Error("Invalid profile identity");
      status = 200; body = dto;
    } else {
      const intent = parseDisplayNameIntent(await readMobileJson(request));
      if (!intent) throw new MobileApiValidationError("Revisá el nombre.");
      const { data, error } = await auth.supabase.rpc("mobile_update_profile_display_name", { p_intent: intent });
      if (error) {
        if (VALIDATION_CODES.includes(error.code)) throw new MobileApiValidationError("Revisá el nombre.");
        throw new Error("Write unavailable");
      }
      const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
      const receipt = row?.response_status === 200 ? parseDisplayNameReceipt(row.response_body) : undefined;
      if (receipt) { status = 200; body = receipt; }
      else if (row?.response_status === 409 && record(row.response_body) && (DISPLAY_NAME_CONFLICTS as readonly string[]).includes(String(row.response_body.error))
        && typeof row.response_body.message === "string") {
        status = 409; body = { error: row.response_body.error, message: row.response_body.message };
      } else throw new Error("Invalid write response");
    }
  } catch (e) {
    if (e instanceof MobileApiUnauthorizedError) { status = 401; body = { error: "UNAUTHORIZED" }; }
    else if (e instanceof MobileApiValidationError) { status = 400; body = { error: "VALIDATION_ERROR", message: e.message }; }
    else console.warn("[mobile.profile.identity] unavailable");
  }
  return NextResponse.json(body, { status, headers: mobileApiResponseHeaders(request) });
}
