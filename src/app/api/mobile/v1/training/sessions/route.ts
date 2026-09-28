import { NextResponse, type NextRequest } from "next/server";

import { handleMobileExplicitMutationRequest } from "@/lib/mobile-api/auth";
import { mobileApiResponseHeaders, readMobileJson } from "@/lib/mobile-api/http";
import { authenticateMobileMutationAccessToken } from "@/lib/mobile-api/supabase";
import { startMobileTrainingSession } from "@/lib/mobile-api/training-server";
import { measurePerformance, requestPerformanceContext } from "@/lib/request-performance";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
}

export async function POST(request: NextRequest) {
  const requestPerformance = requestPerformanceContext(request.headers);
  const performanceBase = {
    route: "/api/mobile/v1/training/sessions",
    ...requestPerformance,
  };
  const result = await handleMobileExplicitMutationRequest(
    request.headers.get("authorization"),
    {
      authenticate: (accessToken) => measurePerformance(
        { ...performanceBase, operation: "mobile.training.auth", layer: "auth" },
        () => authenticateMobileMutationAccessToken(accessToken),
      ),
      mutate: (context) => measurePerformance(
        { ...performanceBase, operation: "mobile.training.session.start", layer: "database" },
        async () => startMobileTrainingSession(await readMobileJson(request), context),
      ),
    },
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: mobileApiResponseHeaders(request),
  });
}
