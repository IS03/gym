import { NextResponse, type NextRequest } from "next/server";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";
import { sessionReadResponse } from "@/lib/mobile-api/training-session-route";
import { readMobileTrainingExerciseHistory } from "@/lib/mobile-api/training-session-server";

export const dynamic = "force-dynamic";
export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  return sessionReadResponse(request, "/api/mobile/v1/training/history/exercises/[exerciseId]",
    (context, performance) => readMobileTrainingExerciseHistory(exerciseId, request.nextUrl.searchParams, context, performance));
}
