import { NextResponse, type NextRequest } from "next/server";

import { handleMobileMutationRequest } from "@/lib/mobile-api/auth";
import {
  mobileApiResponseHeaders,
  readMobileJson,
} from "@/lib/mobile-api/http";
import { createMobileMeal } from "@/lib/mobile-api/nutrition-server";
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

export async function POST(request: NextRequest) {
  const requestPerformance = requestPerformanceContext(request.headers);
  const performanceBase = {
    route: "/api/mobile/v1/nutrition/meals",
    ...requestPerformance,
  };
  const result = await handleMobileMutationRequest(
    request.headers.get("authorization"),
    {
      successStatus: 201,
      authenticate: (accessToken) =>
        measurePerformance(
          {
            ...performanceBase,
            operation: "mobile.nutrition.auth",
            layer: "auth",
          },
          () => authenticateMobileAccessToken(accessToken),
        ),
      mutate: (context) =>
        measurePerformance(
          {
            ...performanceBase,
            operation: "mobile.nutrition.meal.create",
            layer: "database",
          },
          async () =>
            createMobileMeal(
              todayInCordoba(),
              await readMobileJson(request),
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
