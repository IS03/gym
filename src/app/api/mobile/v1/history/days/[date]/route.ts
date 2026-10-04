import { requestPerformanceContext } from '@/lib/request-performance';
import { NextResponse } from 'next/server';
import { mobileApiResponseHeaders } from '@/lib/mobile-api/http';
import { historyReadResponse, readHistoryDay } from '@/lib/mobile-api/history-server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return historyReadResponse(request, auth => readHistoryDay(date, auth, requestPerformanceContext(request.headers)));
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
}
