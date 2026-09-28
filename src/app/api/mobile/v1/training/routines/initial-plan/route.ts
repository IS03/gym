import { NextResponse, type NextRequest } from "next/server";

import { handleMobileMutationRequest } from "@/lib/mobile-api/auth";
import {
  mobileApiResponseHeaders,
  readOptionalMobileJson,
} from "@/lib/mobile-api/http";
import { authenticateMobileMutationAccessToken } from "@/lib/mobile-api/supabase";
import { importMobileInitialTrainingPlan } from "@/lib/mobile-api/training-server";
import { parseMobileTrainingInitialPlan } from "@/lib/mobile-api/training";
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
    route: "/api/mobile/v1/training/routines/initial-plan",
    ...requestPerformance,
  };
  const result = await handleMobileMutationRequest(
    request.headers.get("authorization"),
    {
      authenticate: (accessToken) =>
        measurePerformance(
          { ...performanceBase, operation: "mobile.training.auth", layer: "auth" },
          () => authenticateMobileMutationAccessToken(accessToken),
        ),
      mutate: (context) =>
        measurePerformance(
          { ...performanceBase, operation: "mobile.training.initial-plan.import", layer: "database" },
          async () => {
            parseMobileTrainingInitialPlan(await readOptionalMobileJson(request));
            return importMobileInitialTrainingPlan(context, requestPerformance);
          },
        ),
    },
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: mobileApiResponseHeaders(request),
  });
}
