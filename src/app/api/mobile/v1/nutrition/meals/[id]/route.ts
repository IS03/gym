import { NextResponse, type NextRequest } from "next/server";

import { handleMobileMutationRequest } from "@/lib/mobile-api/auth";
import {
  mobileApiResponseHeaders,
  readMobileJson,
} from "@/lib/mobile-api/http";
import {
  deleteMobileMeal,
  updateMobileMeal,
} from "@/lib/mobile-api/nutrition-server";
import { authenticateMobileAccessToken } from "@/lib/mobile-api/supabase";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import {
  measurePerformance,
  requestPerformanceContext,
} from "@/lib/request-performance";

export const dynamic = "force-dynamic";

type MealRouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: mobileApiResponseHeaders(request),
  });
}

async function authenticatedContext(
  request: NextRequest,
  operation: "update" | "delete",
  action: (
    context: Awaited<ReturnType<typeof authenticateMobileAccessToken>>,
    requestPerformance: ReturnType<typeof requestPerformanceContext>,
  ) => Promise<unknown>,
) {
  const requestPerformance = requestPerformanceContext(request.headers);
  const performanceBase = {
    route: "/api/mobile/v1/nutrition/meals/[id]",
    ...requestPerformance,
  };
  return handleMobileMutationRequest(request.headers.get("authorization"), {
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
          operation: `mobile.nutrition.meal.${operation}`,
          layer: "database",
        },
        () => action(context, requestPerformance),
      ),
  });
}

export async function PATCH(request: NextRequest, route: MealRouteContext) {
  const { id } = await route.params;
  const result = await authenticatedContext(
    request,
    "update",
    async (context, requestPerformance) =>
      updateMobileMeal(
        id,
        todayInCordoba(),
        await readMobileJson(request),
        context,
        requestPerformance,
      ),
  );

  return NextResponse.json(result.body, {
    status: result.status,
    headers: mobileApiResponseHeaders(request),
  });
}

export async function DELETE(request: NextRequest, route: MealRouteContext) {
  const { id } = await route.params;
  const result = await authenticatedContext(
    request,
    "delete",
    (context, requestPerformance) =>
      deleteMobileMeal(id, context, requestPerformance),
  );

  return NextResponse.json(result.body, {
    status: result.status,
    headers: mobileApiResponseHeaders(request),
  });
}
