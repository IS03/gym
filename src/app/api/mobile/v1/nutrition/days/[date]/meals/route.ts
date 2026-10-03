import { NextResponse, type NextRequest } from 'next/server';
import { mobileApiResponseHeaders } from '@/lib/mobile-api/http';
import { nutritionMealMutationResponse } from '@/lib/mobile-api/nutrition-meal-server';
export const dynamic = 'force-dynamic';
export async function OPTIONS(request: NextRequest) { return new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) }); }
export async function POST(request: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return nutritionMealMutationResponse(request, 'create', date);
}
