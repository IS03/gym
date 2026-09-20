import { NextResponse, type NextRequest } from "next/server";

import { handleMobileHomeRequest } from "@/lib/mobile-api/home";
import { readMobileHome } from "@/lib/mobile-api/home-server";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";
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
    route: "/api/mobile/v1/home",
    ...requestPerformance,
  };
  const result = await handleMobileHomeRequest(
    request.headers.get("authorization"),
    {
      authenticate: (accessToken) =>
        measurePerformance(
          {
            ...performanceBase,
            operation: "mobile.home.auth",
            layer: "auth",
          },
          () => authenticateMobileAccessToken(accessToken),
        ),
      read: (context) =>
        measurePerformance(
          {
            ...performanceBase,
            operation: "mobile.home.read",
            layer: "application",
          },
          () => readMobileHome(todayInCordoba(), context, requestPerformance),
        ),
    },
  );

  return NextResponse.json(result.body, {
    status: result.status,
    headers: mobileApiResponseHeaders(request),
  });
}
