import { NextResponse, type NextRequest } from "next/server";

import {
  handleMobileDailyMetricsRequest,
  readMobileDailyMetrics,
} from "@/lib/mobile-api/daily-metrics";
import { authenticateMobileAccessToken } from "@/lib/mobile-api/supabase";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import {
  measurePerformance,
  requestPerformanceContext,
} from "@/lib/request-performance";

export const dynamic = "force-dynamic";

const MOBILE_ORIGIN = "capacitor://localhost";
const ALLOWED_HEADERS = [
  "Authorization",
  "Content-Type",
  "X-OWNLEVEL-App-Version",
  "X-OWNLEVEL-Build",
  "X-OWNLEVEL-Bridge-Version",
  "X-OWNLEVEL-Platform",
].join(", ");

function responseHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  return {
    "Cache-Control": "no-store",
    Vary: "Origin",
    ...(origin === MOBILE_ORIGIN
      ? {
          "Access-Control-Allow-Origin": MOBILE_ORIGIN,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": ALLOWED_HEADERS,
          "Access-Control-Max-Age": "600",
        }
      : {}),
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: responseHeaders(request),
  });
}

export async function GET(request: NextRequest) {
  const { vercelId } = requestPerformanceContext(request.headers);
  const performanceContext = {
    route: "/api/mobile/v1/daily-metrics",
    ...(vercelId ? { vercelId } : {}),
  };
  const result = await handleMobileDailyMetricsRequest(
    request.headers.get("authorization"),
    {
      authenticate: (accessToken) =>
        measurePerformance(
          {
            ...performanceContext,
            operation: "mobile.daily_metrics.auth",
            layer: "auth",
          },
          () => authenticateMobileAccessToken(accessToken),
        ),
      read: (context) =>
        measurePerformance(
          {
            ...performanceContext,
            operation: "mobile.daily_metrics.read",
            layer: "database",
          },
          () =>
            readMobileDailyMetrics(
              context.repository,
              context.userId,
              todayInCordoba(),
            ),
        ),
    },
  );

  return NextResponse.json(result.body, {
    status: result.status,
    headers: responseHeaders(request),
  });
}
