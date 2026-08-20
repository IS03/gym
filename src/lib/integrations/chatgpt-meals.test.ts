import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import {
  handleChatgptMealRequest,
  PossibleDuplicateError,
  type ChatgptMealDependencies,
} from "./chatgpt-meals";
import { parseBearerToken, parseChatgptMealInput } from "./chatgpt-contract";
import {
  authenticateIntegrationToken,
  hashIntegrationToken,
  newIntegrationToken,
} from "./chatgpt-tokens";

const validToken = `ownlevel_${"a".repeat(43)}`;

const validBody = {
  date: "2026-08-20",
  title: "Pechuga con arroz",
  description: "Porción sintética",
  calories: 650,
  protein_g: 55,
  carbs_g: 70,
  fat_g: 14,
  idempotency_key: "synthetic-request-1",
};

const success = {
  ok: true as const,
  created: true,
  idempotent_replay: false,
  meal: {
    id: "synthetic-meal",
    date: "2026-08-20",
    title: "PECHUGA CON ARROZ",
    calories: 650,
    protein_g: 55,
    carbs_g: 70,
    fat_g: 14,
  },
  day: {
    total_calories: 650,
    total_protein_g: 55,
    total_carbs_g: 70,
    total_fat_g: 14,
    target_calories: 2_100,
    target_protein_g: 130,
  },
};

function deps(overrides: Partial<ChatgptMealDependencies> = {}): ChatgptMealDependencies {
  return {
    authenticate: vi.fn(async () => ({ userId: "token-owner" })),
    persist: vi.fn(async () => success),
    ...overrides,
  };
}

function request(body: unknown = validBody, authorization: string | null = "Bearer ownlevel_synthetic_token_that_is_long_enough") {
  return { body, authorization, contentLength: "512" };
}

describe("ChatGPT private meal contract", () => {
  it("acepta Bearer case-insensitive, OWS exterior y múltiples espacios", () => {
    expect(parseBearerToken(`Bearer ${validToken}`)).toBe(validToken);
    expect(parseBearerToken(`bearer ${validToken}`)).toBe(validToken);
    expect(parseBearerToken(`BEARER ${validToken}`)).toBe(validToken);
    expect(parseBearerToken(`Bearer    ${validToken}`)).toBe(validToken);
    expect(parseBearerToken(` \t bearer\t${validToken} \t`)).toBe(validToken);
  });

  it("rechaza credential vacía, whitespace interno y Authorization ausente", () => {
    expect(parseBearerToken("Bearer    ")).toBeNull();
    expect(parseBearerToken(`Bearer ${validToken} extra`)).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });

  it("envía cada Bearer válido al autenticador sin alterar la credential", async () => {
    for (const header of [
      `Bearer ${validToken}`,
      `bearer ${validToken}`,
      `BEARER    ${validToken}`,
      ` \tBearer\t${validToken}\t `,
    ]) {
      const authenticate = vi.fn(async () => ({ userId: "token-owner" }));
      expect(
        (await handleChatgptMealRequest(request(validBody, header), deps({ authenticate }))).status,
      ).toBe(200);
      expect(authenticate).toHaveBeenCalledWith(validToken);
    }
  });

  it("clasifica fallos previos al lookup sin registrar credenciales", async () => {
    const auditAuth = vi.fn();
    const authenticate = vi.fn(async () => ({ userId: "token-owner" }));
    await handleChatgptMealRequest(request(validBody, null), deps({ auditAuth, authenticate }));
    await handleChatgptMealRequest(request(validBody, "Bearer   "), deps({ auditAuth, authenticate }));
    expect(auditAuth.mock.calls).toEqual([
      ["missing_authorization"],
      ["malformed_bearer"],
    ]);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("rechaza formas de token ajenas a OWNLEVEL antes del lookup", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await expect(authenticateIntegrationToken("arbitrary-token")).resolves.toBeNull();
    expect(info).toHaveBeenCalledWith(
      "[ownlevel-chatgpt-auth] invalid_token_shape",
    );
    info.mockRestore();
  });

  it("rechaza Authorization ausente, inválida o revocada", async () => {
    expect((await handleChatgptMealRequest(request(validBody, null), deps())).status).toBe(401);
    expect((await handleChatgptMealRequest(request(validBody, "Basic abc"), deps())).status).toBe(401);
    expect((await handleChatgptMealRequest(request(), deps({ authenticate: vi.fn(async () => null) }))).status).toBe(401);
    expect((await handleChatgptMealRequest(request(), deps({ authenticate: vi.fn(async () => { throw new Error("db"); }) }))).status).toBe(500);
  });

  it("usa exclusivamente el user del token y rechaza user_id en payload", async () => {
    const persist = vi.fn(async () => success);
    const dependency = deps({ persist });
    expect((await handleChatgptMealRequest(request(), dependency)).status).toBe(200);
    expect(persist).toHaveBeenCalledWith("token-owner", expect.objectContaining({ date: "2026-08-20" }));
    const injected = await handleChatgptMealRequest(
      request({ ...validBody, user_id: "attacker" }),
      dependency,
    );
    expect(injected.status).toBe(400);
  });

  it("resuelve fecha explícita o default Córdoba y conserva null distinto de cero", () => {
    expect(parseChatgptMealInput({ ...validBody, date: undefined }, new Date("2026-08-20T02:30:00Z")).date).toBe("2026-08-19");
    expect(parseChatgptMealInput({ ...validBody, protein_g: null, carbs_g: 0, fat_g: undefined })).toMatchObject({
      date: "2026-08-20",
      protein_g: null,
      carbs_g: 0,
      fat_g: null,
    });
  });

  it("rechaza macros inválidos, campos arbitrarios y bodies grandes", async () => {
    expect(() => parseChatgptMealInput({ ...validBody, protein_g: -1 })).toThrow();
    expect(() => parseChatgptMealInput({ ...validBody, calories: Number.NaN })).toThrow();
    expect(() => parseChatgptMealInput({ ...validBody, extra: true })).toThrow("Campos no permitidos");
    const oversized = await handleChatgptMealRequest(
      { ...request(), contentLength: "20000" },
      deps(),
    );
    expect(oversized.status).toBe(413);
  });

  it("diferencia replay idempotente, duplicado humano y force_duplicate", async () => {
    const replay = { ...success, created: false, idempotent_replay: true };
    expect((await handleChatgptMealRequest(request(), deps({ persist: vi.fn(async () => replay) }))).body).toMatchObject({ created: false, idempotent_replay: true });
    expect((await handleChatgptMealRequest(request(), deps({ persist: vi.fn(async () => { throw new PossibleDuplicateError(); }) }))).status).toBe(409);
    const persist = vi.fn(async () => success);
    await handleChatgptMealRequest(request({ ...validBody, force_duplicate: true }), deps({ persist }));
    expect(persist).toHaveBeenCalledWith("token-owner", expect.objectContaining({ force_duplicate: true }));
  });

  it("genera secretos aleatorios y sólo persiste SHA-256", () => {
    const first = newIntegrationToken();
    const second = newIntegrationToken();
    expect(first).toMatch(/^ownlevel_[A-Za-z0-9_-]{40,}$/);
    expect(first).not.toBe(second);
    expect(hashIntegrationToken(first)).toMatch(/^[0-9a-f]{64}$/);
    const migration = readFileSync("supabase/migrations/20260820130000_chatgpt_private_meal_api.sql", "utf8");
    expect(migration).toContain("token_hash text not null");
    expect(migration).not.toContain(first);
    expect(migration).toContain("'chatgpt'");
    expect(migration).toContain("'meal'");
  });
});
