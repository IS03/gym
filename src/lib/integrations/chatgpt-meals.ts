import type {
  ChatgptMealHttpResult,
  ChatgptMealInput,
  ChatgptMealSuccess,
} from "./chatgpt-contract";
import { invalidRequest, parseChatgptMealInput } from "./chatgpt-contract";
import {
  authenticateChatgptAuthorization,
  type ChatgptAuthDependencies,
} from "./chatgpt-auth";

export const CHATGPT_MEAL_MAX_BODY_BYTES = 16_384;

export class PossibleDuplicateError extends Error {}

export type ChatgptMealDependencies = ChatgptAuthDependencies & {
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

  const authentication = await authenticateChatgptAuthorization(
    request.authorization,
    dependencies,
  );
  if (!authentication.ok) return authentication;

  let input: ChatgptMealInput;
  try {
    input = parseChatgptMealInput(request.body, dependencies.now?.() ?? new Date());
  } catch (error) {
    return invalidRequest(
      error instanceof Error ? error.message : "La solicitud no es válida.",
    );
  }

  try {
    return {
      status: 200,
      body: await dependencies.persist(authentication.identity.userId, input),
    };
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
