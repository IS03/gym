import { NextResponse, type NextRequest } from "next/server";
import { handleChatgptStatusRequest } from "@/lib/integrations/chatgpt-status";
import {
  authenticateIntegrationToken,
  logIntegrationAuthEvent,
} from "@/lib/integrations/chatgpt-tokens";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const result = await handleChatgptStatusRequest(
    request.headers.get("authorization"),
    {
      authenticate: authenticateIntegrationToken,
      auditAuth: logIntegrationAuthEvent,
    },
  );
  if (result.status === 500) {
    console.error("[ownlevel-chatgpt-status] internal_error");
  }
  return NextResponse.json(result.body, { status: result.status });
}
