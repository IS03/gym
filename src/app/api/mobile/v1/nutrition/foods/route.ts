import { NextResponse } from 'next/server';
import { mobileApiResponseHeaders } from '@/lib/mobile-api/http';
import { nutritionFoodResponse } from '@/lib/mobile-api/nutrition-food-server';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => nutritionFoodResponse(request,'list');
export const POST = (request: Request) => nutritionFoodResponse(request,'write');
export const OPTIONS = (request: Request) => new NextResponse(null,{ status:204,headers:mobileApiResponseHeaders(request) });
