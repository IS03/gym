import type { MobileApiErrorResponse } from "./contracts";

export class MobileApiUnauthorizedError extends Error {
  readonly httpStatus = 401;

  constructor() {
    super("Unauthorized");
    this.name = "MobileApiUnauthorizedError";
  }
}

export class MobileApiValidationError extends Error {
  readonly httpStatus = 400;

  constructor(message: string) {
    super(message);
    this.name = "MobileApiValidationError";
  }
}

export class MobileApiNotFoundError extends Error {
  readonly httpStatus = 404;

  constructor(message = "El recurso ya no está disponible.") {
    super(message);
    this.name = "MobileApiNotFoundError";
  }
}

export function isRejectedMobileAccessToken(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; status?: unknown };
  const code = typeof record.code === "string"
    ? record.code.toLowerCase()
    : "";
  return (
    Number(record.status) === 401 ||
    code === "bad_jwt" ||
    code === "invalid_jwt" ||
    code === "user_not_found"
  );
}

export function mobileBearerToken(authorization: string | null): string {
  if (!authorization || authorization.length > 8_192) {
    throw new MobileApiUnauthorizedError();
  }

  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match?.[1]) {
    throw new MobileApiUnauthorizedError();
  }

  return match[1];
}

export type MobileAuthenticatedHandlerResult<T> =
  | { status: 200; body: T }
  | { status: 401 | 503; body: MobileApiErrorResponse };

export async function handleMobileAuthenticatedRequest<TContext, TBody>(
  authorization: string | null,
  dependencies: {
    authenticate: (accessToken: string) => Promise<TContext>;
    read: (context: TContext) => Promise<TBody>;
  },
): Promise<MobileAuthenticatedHandlerResult<TBody>> {
  try {
    const accessToken = mobileBearerToken(authorization);
    const context = await dependencies.authenticate(accessToken);
    return { status: 200, body: await dependencies.read(context) };
  } catch (error) {
    if (error instanceof MobileApiUnauthorizedError) {
      return { status: 401, body: { error: "UNAUTHORIZED" } };
    }
    return { status: 503, body: { error: "DATA_UNAVAILABLE" } };
  }
}

export type MobileMutationHandlerResult<T> =
  | { status: 200 | 201; body: T }
  | { status: 400 | 401 | 404 | 503; body: MobileApiErrorResponse };

export async function handleMobileMutationRequest<TContext, TBody>(
  authorization: string | null,
  dependencies: {
    authenticate: (accessToken: string) => Promise<TContext>;
    mutate: (context: TContext) => Promise<TBody>;
    successStatus?: 200 | 201;
  },
): Promise<MobileMutationHandlerResult<TBody>> {
  try {
    const accessToken = mobileBearerToken(authorization);
    const context = await dependencies.authenticate(accessToken);
    return {
      status: dependencies.successStatus ?? 200,
      body: await dependencies.mutate(context),
    };
  } catch (error) {
    if (error instanceof MobileApiUnauthorizedError) {
      return { status: 401, body: { error: "UNAUTHORIZED" } };
    }
    if (error instanceof MobileApiValidationError) {
      return {
        status: 400,
        body: { error: "VALIDATION_ERROR", message: error.message },
      };
    }
    if (error instanceof MobileApiNotFoundError) {
      return {
        status: 404,
        body: { error: "NOT_FOUND", message: error.message },
      };
    }
    return { status: 503, body: { error: "DATA_UNAVAILABLE" } };
  }
}
