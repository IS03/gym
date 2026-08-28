import type { ChatgptMealError } from "./chatgpt-contract";
import { parseBearerToken } from "./chatgpt-contract";
import type { IntegrationAuthEvent } from "./chatgpt-tokens";

export type IntegrationIdentity = {
  userId: string;
  tokenId?: string;
};

export type ChatgptAuthDependencies = {
  authenticate: (rawToken: string) => Promise<IntegrationIdentity | null>;
  auditAuth?: (event: IntegrationAuthEvent) => void;
};

export type ChatgptAuthResult =
  | { ok: true; identity: IntegrationIdentity }
  | { ok: false; status: 401 | 500; body: ChatgptMealError };

export async function authenticateChatgptAuthorization(
  authorization: string | null,
  dependencies: ChatgptAuthDependencies,
): Promise<ChatgptAuthResult> {
  const rawToken = parseBearerToken(authorization);
  if (!rawToken) {
    dependencies.auditAuth?.(
      authorization?.trim() ? "malformed_bearer" : "missing_authorization",
    );
    return {
      ok: false,
      status: 401,
      body: { ok: false, error: "invalid_token", message: "Token inválido." },
    };
  }

  try {
    const identity = await dependencies.authenticate(rawToken);
    if (!identity) {
      return {
        ok: false,
        status: 401,
        body: { ok: false, error: "invalid_token", message: "Token inválido." },
      };
    }
    return { ok: true, identity };
  } catch {
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: "internal_error",
        message: "No se pudo autenticar la integración.",
      },
    };
  }
}
