import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schemaPath = "docs/integrations/ownlevel-chatgpt-action.openapi.yaml";
const schema = readFileSync(schemaPath, "utf8");

describe("OWNLEVEL ChatGPT OpenAPI", () => {
  it("describe las rutas reales y sus operationIds estables", () => {
    expect(existsSync("src/app/api/integrations/chatgpt/status/route.ts")).toBe(true);
    expect(existsSync("src/app/api/integrations/chatgpt/meals/route.ts")).toBe(true);
    expect(existsSync("src/app/api/integrations/chatgpt/openapi/route.ts")).toBe(true);
    expect(schema).toContain("/api/integrations/chatgpt/status:");
    expect(schema).toContain("operationId: checkConnection");
    expect(schema).toContain("/api/integrations/chatgpt/meals:");
    expect(schema).toContain("operationId: logMeal");
  });

  it("usa Bearer y mantiene schemas cerrados sin secretos", () => {
    expect(schema).toContain("type: http");
    expect(schema).toContain("scheme: bearer");
    expect(schema).toContain("additionalProperties: false");
    expect(schema).toContain("null significa desconocido");
    expect(schema).toContain("idempotency_key");
    expect(schema).toContain("force_duplicate");
    expect(schema).toContain("possible_duplicate");
    expect(schema).not.toMatch(/ownlevel_[A-Za-z0-9_-]{43}/);
    expect(schema).not.toMatch(/service[_-]?role/i);
  });

  it("status sólo declara ok y connected", () => {
    const statusSchema = schema.slice(
      schema.indexOf("ConnectionSuccess:"),
      schema.indexOf("MealInput:"),
    );
    expect(statusSchema).toContain("required: [ok, connected]");
    expect(statusSchema).not.toMatch(
      /email|user_id|calories|protein|carbs|fat|weight|steps|token/i,
    );
  });

  it("logMeal no expone acumulados ni objetivos nutricionales", () => {
    const successSchema = schema.slice(
      schema.indexOf("MealSuccess:"),
      schema.indexOf("Error:"),
    );
    expect(successSchema).toContain(
      "required: [ok, created, idempotent_replay, meal]",
    );
    expect(successSchema).not.toMatch(/day:|total_|target_/i);
  });
});
