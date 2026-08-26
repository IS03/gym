type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
};

type DataApiErrorLike = {
  status?: unknown;
  code?: unknown;
  message?: unknown;
};

/**
 * Errores que representan una sesión local vencida o revocada, no una caída de
 * Auth. Se usan para volver al login sin esconder fallos reales de infraestructura.
 */
export function isInvalidAuthSessionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const { code, message, name } = error as AuthErrorLike;
  const normalizedCode = typeof code === "string" ? code.toLowerCase() : "";
  const normalizedName = typeof name === "string" ? name.toLowerCase() : "";
  const normalizedMessage =
    typeof message === "string" ? message.toLowerCase() : "";

  return (
    normalizedName === "authsessionmissingerror" ||
    normalizedCode === "refresh_token_not_found" ||
    normalizedCode === "session_not_found" ||
    normalizedMessage.includes("invalid refresh token") ||
    normalizedMessage.includes("refresh token not found") ||
    normalizedMessage.includes("refresh token already used") ||
    normalizedMessage.includes("auth session missing")
  );
}

/**
 * Clasifica exclusivamente el rechazo transitorio observado cuando PostgREST
 * valida un JWT recién emitido. No representa una sesión inválida y no debe
 * provocar logout, limpieza de cookies ni redirect al login.
 */
export function isTransientJwtIssuedAtFutureError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const { status, code, message } = error as DataApiErrorLike;
  const normalizedCode = typeof code === "string" ? code.trim().toUpperCase() : "";
  const normalizedMessage =
    typeof message === "string" ? message.trim().toLowerCase() : "";

  return (
    status === 401 &&
    normalizedCode === "PGRST303" &&
    normalizedMessage === "jwt issued at future"
  );
}
