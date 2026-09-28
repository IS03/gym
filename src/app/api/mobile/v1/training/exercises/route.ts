import { NextResponse, type NextRequest } from "next/server";

import {
  handleMobileAuthenticatedRequest,
  handleMobileMutationRequest,
} from "@/lib/mobile-api/auth";
import { mobileApiResponseHeaders, readMobileJson } from "@/lib/mobile-api/http";
import {
  authenticateMobileAccessToken,
  authenticateMobileMutationAccessToken,
} from "@/lib/mobile-api/supabase";
import {
  createMobileTrainingExercise,
  readMobileTrainingExercises,
} from "@/lib/mobile-api/training-server";
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
    route: "/api/mobile/v1/training/exercises",
    ...requestPerformance,
  };
  const result = await handleMobileAuthenticatedRequest(
    request.headers.get("authorization"),
    {
      authenticate: (accessToken) =>
        measurePerformance(
          { ...performanceBase, operation: "mobile.training.auth", layer: "auth" },
          () => authenticateMobileAccessToken(accessToken),
        ),
      read: (context) =>
        measurePerformance(
          { ...performanceBase, operation: "mobile.training.exercises.read", layer: "application" },
          () => readMobileTrainingExercises(context, requestPerformance),
        ),
    },
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: mobileApiResponseHeaders(request),
  });
}

export async function POST(request: NextRequest) {
  const requestPerformance = requestPerformanceContext(request.headers);
  const performanceBase = {
    route: "/api/mobile/v1/training/exercises",
    ...requestPerformance,
  };
  const result = await handleMobileMutationRequest(
    request.headers.get("authorization"),
    {
      successStatus: 201,
      authenticate: (accessToken) =>
        measurePerformance(
          { ...performanceBase, operation: "mobile.training.auth", layer: "auth" },
          () => authenticateMobileMutationAccessToken(accessToken),
        ),
      mutate: (context) =>
        measurePerformance(
          { ...performanceBase, operation: "mobile.training.exercise.create", layer: "database" },
          async () => createMobileTrainingExercise(await readMobileJson(request), context),
        ),
    },
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: mobileApiResponseHeaders(request),
  });
}
