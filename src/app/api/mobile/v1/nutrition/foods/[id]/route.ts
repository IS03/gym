import { NextResponse } from 'next/server';
import { mobileApiResponseHeaders } from '@/lib/mobile-api/http';
import { nutritionFoodResponse } from '@/lib/mobile-api/nutrition-food-server';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id:string }> };
export const GET = async (request:Request,context:Context) => nutritionFoodResponse(request,'detail',(await context.params).id);
export const PATCH = async (request:Request,context:Context) => nutritionFoodResponse(request,'write',(await context.params).id);
export const DELETE = PATCH;
export const OPTIONS = (request:Request) => new NextResponse(null,{ status:204,headers:mobileApiResponseHeaders(request) });
