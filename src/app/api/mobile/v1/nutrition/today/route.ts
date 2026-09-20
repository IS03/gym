import { NextResponse, type NextRequest } from "next/server";

import { handleMobileAuthenticatedRequest } from "@/lib/mobile-api/auth";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";
import { readMobileNutritionToday } from "@/lib/mobile-api/nutrition-server";
import { authenticateMobileAccessToken } from "@/lib/mobile-api/supabase";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import {
  measurePerformance,
  requestPerformanceContext,
} from "@/lib/request-performance";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: mobileApiResponseHeaders(request),
  });
}

export async function GET(request: NextRequest) {
  const requestPerformance = requestPerformanceContext(request.headers);
  const performanceBase = {
    route: "/api/mobile/v1/nutrition/today",
    ...requestPerformance,
  };
  const result = await handleMobileAuthenticatedRequest(
    request.headers.get("authorization"),
    {
      authenticate: (accessToken) =>
        measurePerformance(
          {
            ...performanceBase,
            operation: "mobile.nutrition.auth",
            layer: "auth",
          },
          () => authenticateMobileAccessToken(accessToken),
        ),
      read: (context) =>
        measurePerformance(
          {
            ...performanceBase,
            operation: "mobile.nutrition.today.read",
            layer: "application",
          },
          () =>
            readMobileNutritionToday(
              todayInCordoba(),
              context,
              requestPerformance,
            ),
        ),
    },
  );

  return NextResponse.json(result.body, {
    status: result.status,
    headers: mobileApiResponseHeaders(request),
  });
}
