import { describe, expect, it } from "vitest";
import {
  isInvalidAuthSessionError,
  isTransientJwtIssuedAtFutureError,
} from "./auth-errors";

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
    expect(isInvalidAuthSessionError("JWT issued at future")).toBe(false);
    expect(
      isInvalidAuthSessionError({
        status: 401,
        code: "PGRST303",
        message: "JWT issued at future",
      }),
    ).toBe(false);
  });

  it("clasifica solamente el PGRST303 exacto emitido en el futuro", () => {
    expect(
      isTransientJwtIssuedAtFutureError({
        status: 401,
        code: "pgrst303",
        message: " JWT ISSUED AT FUTURE ",
      }),
    ).toBe(true);

    expect(
      isTransientJwtIssuedAtFutureError({
        status: 401,
        code: "PGRST303",
        message: "JWT expired",
      }),
    ).toBe(false);
    expect(
      isTransientJwtIssuedAtFutureError({
        status: 401,
        code: "PGRST301",
        message: "JWT issued at future",
      }),
    ).toBe(false);
    expect(
      isTransientJwtIssuedAtFutureError({
        status: 403,
        code: "PGRST303",
        message: "JWT issued at future",
      }),
    ).toBe(false);
  });
});
