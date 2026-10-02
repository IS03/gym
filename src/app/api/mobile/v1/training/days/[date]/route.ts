import { NextResponse, type NextRequest } from "next/server";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";
import { sessionReadResponse } from "@/lib/mobile-api/training-session-route";
import { readMobileTrainingDay } from "@/lib/mobile-api/training-session-server";

export const dynamic = "force-dynamic";
export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return sessionReadResponse(request, "/api/mobile/v1/training/days/[date]",
    (context, performance) => readMobileTrainingDay(date, context, performance));
}
