import type {
  ChatgptMealHttpResult,
  ChatgptMealInput,
  ChatgptMealSuccess,
} from "./chatgpt-contract";
import {
  invalidRequest,
  parseBearerToken,
  parseChatgptMealInput,
} from "./chatgpt-contract";

export const CHATGPT_MEAL_MAX_BODY_BYTES = 16_384;

export class PossibleDuplicateError extends Error {}

export type ChatgptMealDependencies = {
  authenticate: (rawToken: string) => Promise<{ userId: string } | null>;
  persist: (userId: string, meal: ChatgptMealInput) => Promise<ChatgptMealSuccess>;
  now?: () => Date;
};

export async function handleChatgptMealRequest(
  request: {
    authorization: string | null;
    contentLength: string | null;
    body: unknown;
  },
  dependencies: ChatgptMealDependencies,
): Promise<ChatgptMealHttpResult> {
  const length = Number(request.contentLength ?? 0);
  if (Number.isFinite(length) && length > CHATGPT_MEAL_MAX_BODY_BYTES) {
    return {
      status: 413,
      body: {
        ok: false,
        error: "invalid_request",
        message: "El body supera el límite permitido.",
      },
    };
  }

  const rawToken = parseBearerToken(request.authorization);
  if (!rawToken) {
    return {
      status: 401,
      body: { ok: false, error: "invalid_token", message: "Token inválido." },
    };
  }

  let identity: { userId: string } | null;
  try {
    identity = await dependencies.authenticate(rawToken);
  } catch {
    return {
      status: 500,
      body: {
        ok: false,
        error: "internal_error",
        message: "No se pudo autenticar la integración.",
      },
    };
  }
  if (!identity) {
    return {
      status: 401,
      body: { ok: false, error: "invalid_token", message: "Token inválido." },
    };
  }

  let input: ChatgptMealInput;
  try {
    input = parseChatgptMealInput(request.body, dependencies.now?.() ?? new Date());
  } catch (error) {
    return invalidRequest(
      error instanceof Error ? error.message : "La solicitud no es válida.",
    );
  }

  try {
    return { status: 200, body: await dependencies.persist(identity.userId, input) };
  } catch (error) {
    if (error instanceof PossibleDuplicateError) {
      return {
        status: 409,
        body: {
          ok: false,
          error: "possible_duplicate",
          message:
            "Existe una comida idéntica cargada recientemente. Confirmá y reenviá con force_duplicate=true si corresponde.",
        },
      };
    }
    return {
      status: 500,
      body: {
        ok: false,
        error: "internal_error",
        message: "No se pudo registrar la comida.",
      },
    };
  }
}
