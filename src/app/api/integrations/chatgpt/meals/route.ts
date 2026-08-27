import { NextResponse, type NextRequest } from "next/server";
import {
  authenticateIntegrationToken,
  logIntegrationAuthEvent,
} from "@/lib/integrations/chatgpt-tokens";
import {
  CHATGPT_MEAL_MAX_BODY_BYTES,
  handleChatgptMealRequest,
} from "@/lib/integrations/chatgpt-meals";
import { persistChatgptMeal } from "@/lib/integrations/chatgpt-server";
import {
  readJsonRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/security/request-body";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > CHATGPT_MEAL_MAX_BODY_BYTES
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "El body supera el límite permitido.",
      },
      { status: 413 },
    );
  }

  let body: unknown;
  let byteLength: number;
  try {
    ({ body, byteLength } = await readJsonRequestBody(
      request,
      CHATGPT_MEAL_MAX_BODY_BYTES,
    ));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_request",
          message: "El body supera el límite permitido.",
        },
        { status: 413 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "invalid_request", message: "El body debe ser JSON válido." },
      { status: 400 },
    );
  }

  const result = await handleChatgptMealRequest(
    {
      authorization: request.headers.get("authorization"),
      contentLength: String(byteLength),
      body,
    },
    {
      authenticate: authenticateIntegrationToken,
      persist: persistChatgptMeal,
      auditAuth: logIntegrationAuthEvent,
    },
  );
  if (result.status === 500) {
    console.error("[ownlevel-chatgpt-api] internal_error");
  }
  return NextResponse.json(result.body, { status: result.status });
}
