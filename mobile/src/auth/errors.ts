type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
};

function errorDetails(error: unknown): AuthErrorLike {
  return error && typeof error === "object" ? (error as AuthErrorLike) : {};
}

export function isConfirmedInvalidSession(error: unknown): boolean {
  const details = errorDetails(error);
  const name = typeof details.name === "string" ? details.name : "";
  const code =
    typeof details.code === "string" ? details.code.toLowerCase() : "";
  const message =
    typeof details.message === "string" ? details.message.toLowerCase() : "";

  return (
    name === "AuthSessionMissingError" ||
    code === "refresh_token_not_found" ||
    code === "session_not_found" ||
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found") ||
    message.includes("refresh token already used") ||
    message.includes("auth session missing")
  );
}
