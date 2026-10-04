import { nutritionQuickResponse } from '@/lib/mobile-api/nutrition-quick-server';
import { NextResponse } from 'next/server';
import { mobileApiResponseHeaders } from '@/lib/mobile-api/http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ date: string }> }) {
  return nutritionQuickResponse(request, 'preview', (await context.params).date);
}
export function OPTIONS(request: Request) { return new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) }); }
