type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
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
