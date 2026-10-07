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
import { parseBearerToken } from "@/lib/integrations/chatgpt-contract";
import { oauthDenied, withOwnlevelOAuth } from "@/lib/integrations/oauth-auth";
import { ownlevelOAuthConfig } from "@/lib/integrations/oauth-config";
import { persistOAuthMeal } from "@/lib/integrations/oauth-meals";

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

  const rawToken = parseBearerToken(request.headers.get("authorization"));
  if (rawToken && !rawToken.startsWith("ownlevel_")) {
    // Body is already bounded before @supabase/server buffers it. The same
    // protected OWNLEVEL resource owns both /mcp and this private API.
    const bounded = new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(body) });
    return withOwnlevelOAuth(bounded, async (verified, identity, ctx) => {
      const result = await handleChatgptMealRequest({
        authorization: verified.headers.get("authorization"), contentLength: String(byteLength), body,
      }, {
        authenticate: async () => identity,
        persist: (_userId, meal) => persistOAuthMeal(ctx.supabaseAdmin, identity, meal),
      });
      if (result.status === 403) return oauthDenied(ownlevelOAuthConfig());
      return NextResponse.json(result.body, { status: result.status });
    });
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
