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
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": MOBILE_ALLOWED_HEADERS,
          "Access-Control-Max-Age": "600",
        }
      : {}),
  };
}
