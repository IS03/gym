import { NextResponse } from 'next/server';
import { mobileApiResponseHeaders } from '@/lib/mobile-api/http';
import { historyReadResponse, readHistoryRange } from '@/lib/mobile-api/history-server';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  return historyReadResponse(request, auth => readHistoryRange(new URL(request.url).searchParams, auth));
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
}
