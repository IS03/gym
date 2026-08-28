export const PUBLIC_AUTH_ERROR_MESSAGE =
  "No pudimos iniciar sesión. Intentá nuevamente.";

/**
 * The only supported OWNLEVEL entry flow. Keeping this request in one tested
 * place prevents a visual login change from accidentally changing OAuth.
 */
export function googleOAuthRequest(origin: string) {
  return {
    provider: "google" as const,
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        prompt: "select_account",
      },
    },
  };
}
