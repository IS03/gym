import { NextResponse, type NextRequest } from 'next/server';
import { mobileApiResponseHeaders } from '@/lib/mobile-api/http';
import { nutritionDayWriteResponse } from '@/lib/mobile-api/nutrition-day-write-server';
export const dynamic = 'force-dynamic';
export async function OPTIONS(request: NextRequest) { return new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) }); }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return nutritionDayWriteResponse(request, 'metrics', date);
}
