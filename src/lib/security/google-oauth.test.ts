import { describe, expect, it } from "vitest";
import {
  googleOAuthRequest,
  PUBLIC_AUTH_ERROR_MESSAGE,
} from "./google-oauth";

describe("Google OAuth de OWNLEVEL", () => {
  it("mantiene Google, callback propio y selector explícito de cuenta", () => {
    expect(googleOAuthRequest("https://www.ownlevel.fit")).toEqual({
      provider: "google",
      options: {
        redirectTo: "https://www.ownlevel.fit/auth/callback",
        queryParams: { prompt: "select_account" },
      },
    });
  });

  it("usa un mensaje público de error sin detalles de infraestructura", () => {
    expect(PUBLIC_AUTH_ERROR_MESSAGE).toBe(
      "No pudimos iniciar sesión. Intentá nuevamente.",
    );
    expect(PUBLIC_AUTH_ERROR_MESSAGE).not.toMatch(/supabase|\.env|anon key/i);
  });
});
