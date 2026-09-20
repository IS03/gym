import type { MobileApiErrorResponse } from "./contracts";

export class MobileApiUnauthorizedError extends Error {
  readonly httpStatus = 401;

  constructor() {
    super("Unauthorized");
    this.name = "MobileApiUnauthorizedError";
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
