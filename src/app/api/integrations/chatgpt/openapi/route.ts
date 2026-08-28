import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-static";

const schemaPath = join(
  process.cwd(),
  "docs/integrations/ownlevel-chatgpt-action.openapi.yaml",
);

export async function GET() {
  try {
    const schema = await readFile(schemaPath, "utf8");
    return new Response(schema, {
      status: 200,
      headers: {
        "Content-Type": "application/yaml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    console.error("[ownlevel-chatgpt-openapi] schema_unavailable");
    return Response.json(
      { ok: false, error: "internal_error", message: "Esquema no disponible." },
      { status: 500 },
    );
  }
}
