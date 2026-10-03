import { NextResponse, type NextRequest } from "next/server";
import { handleMobileAuthenticatedRequest } from "@/lib/mobile-api/auth";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";
import { readMobileNutritionDay } from "@/lib/mobile-api/nutrition-day-server";
import { authenticateMobileAccessToken } from "@/lib/mobile-api/supabase";
import { requestPerformanceContext } from "@/lib/request-performance";

export const dynamic = "force-dynamic";
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const result = await handleMobileAuthenticatedRequest(request.headers.get("authorization"), {
    authenticate: authenticateMobileAccessToken,
    read: context => readMobileNutritionDay(date, context, requestPerformanceContext(request.headers)),
  });
  return NextResponse.json(result.body, { status: result.status, headers: mobileApiResponseHeaders(request) });
}
