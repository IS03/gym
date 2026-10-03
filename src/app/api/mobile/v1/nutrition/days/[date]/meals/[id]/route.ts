import { NextResponse, type NextRequest } from 'next/server';
import { mobileApiResponseHeaders } from '@/lib/mobile-api/http';
import { nutritionMealMutationResponse } from '@/lib/mobile-api/nutrition-meal-server';
export const dynamic = 'force-dynamic';
export async function OPTIONS(request: NextRequest) { return new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) }); }
type Context = { params: Promise<{ date: string; id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  const { date, id } = await params; return nutritionMealMutationResponse(request, 'edit', date, id);
}
export async function DELETE(request: NextRequest, { params }: Context) {
  const { date, id } = await params; return nutritionMealMutationResponse(request, 'delete', date, id);
}
