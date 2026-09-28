import { MobileApiValidationError } from "./auth";

const MOBILE_ORIGIN = "capacitor://localhost";
const MOBILE_ALLOWED_HEADERS = [
  "Authorization",
  "Content-Type",
  "X-OWNLEVEL-App-Version",
  "X-OWNLEVEL-Build",
  "X-OWNLEVEL-Bridge-Version",
  "X-OWNLEVEL-Platform",
].join(", ");

export function mobileApiResponseHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  return {
    "Cache-Control": "no-store",
    Vary: "Origin",
    ...(origin === MOBILE_ORIGIN
      ? {
          "Access-Control-Allow-Origin": MOBILE_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": MOBILE_ALLOWED_HEADERS,
          "Access-Control-Max-Age": "600",
        }
      : {}),
  };
}

export async function readMobileJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new MobileApiValidationError("El contenido enviado no es válido.");
  }
}

export async function readOptionalMobileJson(request: Request): Promise<unknown> {
  const body = await request.text();
  if (!body.trim()) return {};
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new MobileApiValidationError("El contenido enviado no es válido.");
  }
}
