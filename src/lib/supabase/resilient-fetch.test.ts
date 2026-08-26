import { describe, expect, it, vi } from "vitest";
import { createResilientSupabaseFetch } from "./resilient-fetch";

const DATA_API_URL = "https://project.supabase.co/rest/v1/rpc/get_or_create_day_log";

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function jwtIssuedAtFutureResponse(): Response {
  return jsonResponse(401, {
    code: "PGRST303",
    message: "JWT issued at future",
    details: null,
    hint: null,
  });
}

function testFetch(fetchImplementation: typeof fetch) {
  return createResilientSupabaseFetch(fetchImplementation, {
    retryDelaysMs: [250, 750, 1500],
    sleep: vi.fn(async () => undefined),
    logger: { info: vi.fn(), warn: vi.fn() },
  });
}

describe("Supabase Data API JWT clock-skew retry", () => {
  it("absorbe el primer PGRST303 transitorio y deja continuar la navegación", async () => {
    const implementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jwtIssuedAtFutureResponse())
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const response = await testFetch(implementation)(DATA_API_URL);

    expect(implementation).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it.each([2, 3])(
    "puede recuperarse después de %i retries",
    async (retriesBeforeSuccess) => {
      const implementation = vi.fn<typeof fetch>();
      for (let index = 0; index < retriesBeforeSuccess; index += 1) {
        implementation.mockResolvedValueOnce(jwtIssuedAtFutureResponse());
      }
      implementation.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

      const response = await testFetch(implementation)(DATA_API_URL);

      expect(implementation).toHaveBeenCalledTimes(retriesBeforeSuccess + 1);
      expect(response.status).toBe(200);
    },
  );

  it("agota tres retries y devuelve el último 401 con el body intacto", async () => {
    const implementation = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jwtIssuedAtFutureResponse());

    const response = await testFetch(implementation)(DATA_API_URL);

    expect(implementation).toHaveBeenCalledTimes(4);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "PGRST303",
      message: "JWT issued at future",
    });
  });

  it("reproduce un Request POST con body mediante un clone nuevo por intento", async () => {
    const bodies: string[] = [];
    const implementation = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      bodies.push(await request.text());
      return bodies.length === 1
        ? jwtIssuedAtFutureResponse()
        : jsonResponse(200, { id: "day-log" });
    });
    const request = new Request(DATA_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ p_log_date: "2026-08-26" }),
    });

    const response = await testFetch(implementation)(request);

    expect(response.status).toBe(200);
    expect(bodies).toEqual([
      '{"p_log_date":"2026-08-26"}',
      '{"p_log_date":"2026-08-26"}',
    ]);
  });

  it("reproduce también URL/string + RequestInit con body", async () => {
    const bodies: string[] = [];
    const implementation = vi.fn<typeof fetch>(async (input) => {
      bodies.push(await (input as Request).text());
      return bodies.length === 1
        ? jwtIssuedAtFutureResponse()
        : jsonResponse(200, { id: "profile" });
    });

    const response = await testFetch(implementation)(DATA_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: "Nacho" }),
    });

    expect(response.status).toBe(200);
    expect(bodies).toEqual([
      '{"display_name":"Nacho"}',
      '{"display_name":"Nacho"}',
    ]);
  });

  it.each([
    [
      "401 genérico",
      401,
      { code: "AUTH_ERROR", message: "Unauthorized" },
    ],
    [
      "PGRST301",
      401,
      { code: "PGRST301", message: "JWT issued at future" },
    ],
    [
      "otro PGRST303",
      401,
      { code: "PGRST303", message: "JWT expired" },
    ],
    ["403 RLS", 403, { code: "42501", message: "RLS denied" }],
    ["500", 500, { code: "XX000", message: "Internal error" }],
  ])("no reintenta %s", async (_label, status, body) => {
    const implementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(status, body));

    const response = await testFetch(implementation)(DATA_API_URL);

    expect(implementation).toHaveBeenCalledOnce();
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("no reintenta el mismo error fuera de /rest/v1/", async () => {
    const implementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jwtIssuedAtFutureResponse());

    const response = await testFetch(implementation)(
      "https://project.supabase.co/auth/v1/user",
    );

    expect(implementation).toHaveBeenCalledOnce();
    expect(response.status).toBe(401);
  });

  it("propaga un error de red sin ampliar el scope de retry", async () => {
    const networkError = new TypeError("fetch failed");
    const implementation = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(networkError);

    await expect(testFetch(implementation)(DATA_API_URL)).rejects.toBe(
      networkError,
    );
    expect(implementation).toHaveBeenCalledOnce();
  });
});
