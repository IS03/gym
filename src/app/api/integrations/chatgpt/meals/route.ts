import { NextResponse, type NextRequest } from "next/server";
import { authenticateIntegrationToken } from "@/lib/integrations/chatgpt-tokens";
import {
  CHATGPT_MEAL_MAX_BODY_BYTES,
  handleChatgptMealRequest,
} from "@/lib/integrations/chatgpt-meals";
import { persistChatgptMeal } from "@/lib/integrations/chatgpt-server";

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
  let rawBody: string;
  try {
    rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > CHATGPT_MEAL_MAX_BODY_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_request",
          message: "El body supera el límite permitido.",
        },
        { status: 413 },
      );
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request", message: "El body debe ser JSON válido." },
      { status: 400 },
    );
  }

  const result = await handleChatgptMealRequest(
    {
      authorization: request.headers.get("authorization"),
      contentLength: String(new TextEncoder().encode(rawBody).byteLength),
      body,
    },
    {
      authenticate: authenticateIntegrationToken,
      persist: persistChatgptMeal,
    },
  );
  return NextResponse.json(result.body, { status: result.status });
}
