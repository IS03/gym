import "server-only";

/** Metadata only: never return a key, prefix fragment, fingerprint or JWT claims. */
export function credentialDiagnostics(value: string | undefined) {
  return {
    exists: value !== undefined,
    length: value?.length ?? 0,
    startsWithSecretPrefix: value?.startsWith("sb_secret_") ?? false,
    hasNonByteCharacter: [...(value ?? "")].some((char) => char.codePointAt(0)! > 255),
    hasMaskBullet: value?.includes("\u2022") ?? false,
    hasNonPrintableASCII: /[^\x21-\x7e]/.test(value ?? ""),
  };
}

export class OAuthConfigurationError extends Error {
  readonly code = "OAUTH_CONFIGURATION_INVALID";
  constructor() { super("OAuth configuration unavailable"); }
}

export function supabaseOAuthServerCredential() {
  const primary = process.env.SUPABASE_SECRET_KEY;
  const legacy = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const source = primary !== undefined ? "SUPABASE_SECRET_KEY" : "SUPABASE_SERVICE_ROLE_KEY";
  const value = primary ?? legacy;
  const diagnostic = credentialDiagnostics(value);
  const secretShape = typeof value === "string" && /^sb_secret_[A-Za-z0-9_-]+$/.test(value);
  const jwtShape = typeof value === "string" && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
  // Shape validation is NOT authentication: Supabase still verifies the actual key.
  if (!value || diagnostic.hasNonPrintableASCII || (!secretShape && !jwtShape)) {
    console.error("[oauth-config] invalid server credential", {
      source, ...diagnostic,
      legacy: credentialDiagnostics(legacy),
    });
    throw new OAuthConfigurationError();
  }
  return value;
}
