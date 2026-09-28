import { NextResponse, type NextRequest } from "next/server";

import { handleMobileAuthenticatedRequest } from "@/lib/mobile-api/auth";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";
import { authenticateMobileAccessToken } from "@/lib/mobile-api/supabase";
import { readMobileTraining } from "@/lib/mobile-api/training-server";
import { parseMobileTrainingMonth } from "@/lib/mobile-api/training";
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
    route: "/api/mobile/v1/training",
    ...requestPerformance,
  };
  const result = await handleMobileAuthenticatedRequest(
    request.headers.get("authorization"),
    {
      authenticate: (accessToken) =>
        measurePerformance(
          {
            ...performanceBase,
            operation: "mobile.training.auth",
            layer: "auth",
          },
          () => authenticateMobileAccessToken(accessToken),
        ),
      read: (context) =>
        measurePerformance(
          {
            ...performanceBase,
            operation: "mobile.training.read",
            layer: "application",
          },
          () =>
            readMobileTraining(
              parseMobileTrainingMonth(request.nextUrl.searchParams.get("month")),
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
