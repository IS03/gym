type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
};

function authErrorDetails(error: unknown): AuthErrorLike {
  return error && typeof error === 'object' ? (error as AuthErrorLike) : {};
}

export function isConfirmedInvalidSession(error: unknown): boolean {
  const details = authErrorDetails(error);
  const name = typeof details.name === 'string' ? details.name : '';
  const code = typeof details.code === 'string' ? details.code.toLowerCase() : '';
  const message = typeof details.message === 'string' ? details.message.toLowerCase() : '';

  return (
    name === 'AuthSessionMissingError' ||
    code === 'refresh_token_not_found' ||
    code === 'session_not_found' ||
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('refresh token already used') ||
    message.includes('auth session missing')
  );
}

export const authMessages = {
  callbackInvalid: 'El callback de autenticación no es válido.',
  configurationMissing: 'Falta configurar Supabase para OWNLEVEL Dev.',
  exchangeFailed: 'No pudimos completar el inicio de sesión. Intentá nuevamente.',
  oauthCancelled: 'Inicio de sesión cancelado.',
  oauthFailed: 'Google no pudo completar el inicio de sesión.',
  restoreFailed: 'No pudimos comprobar tu sesión. Revisá tu conexión e intentá nuevamente.',
  signInFailed: 'No pudimos iniciar sesión. Intentá nuevamente.',
} as const;
