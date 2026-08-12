import { describe, expect, it } from "vitest";
import { isInvalidAuthSessionError } from "./auth-errors";

describe("errores de sesión Supabase", () => {
  it("reconoce refresh tokens vencidos, revocados o faltantes", () => {
    expect(
      isInvalidAuthSessionError({
        message: "Invalid Refresh Token: Refresh Token Not Found",
      }),
    ).toBe(true);
    expect(
      isInvalidAuthSessionError({
        message: "Invalid Refresh Token: Already Used",
      }),
    ).toBe(true);
    expect(
      isInvalidAuthSessionError({ name: "AuthSessionMissingError" }),
    ).toBe(true);
  });

  it("no confunde errores de infraestructura con una sesión inválida", () => {
    expect(
      isInvalidAuthSessionError({ message: "fetch failed: connect ECONNREFUSED" }),
    ).toBe(false);
    expect(isInvalidAuthSessionError({ message: "Internal server error" })).toBe(
      false,
    );
  });
});
