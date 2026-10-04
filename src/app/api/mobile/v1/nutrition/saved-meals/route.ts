import { NextResponse } from 'next/server';
import { mobileApiResponseHeaders } from '@/lib/mobile-api/http';
import { nutritionSavedResponse } from '@/lib/mobile-api/nutrition-saved-server';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => nutritionSavedResponse(request,'list');
export const POST = (request: Request) => nutritionSavedResponse(request,'write');
export const OPTIONS = (request: Request) => new NextResponse(null,{ status:204,headers:mobileApiResponseHeaders(request) });
