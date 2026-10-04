import { nutritionConfigurationResponse } from '@/lib/mobile-api/nutrition-config-server';
import { NextResponse } from 'next/server';
import { mobileApiResponseHeaders } from '@/lib/mobile-api/http';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>nutritionConfigurationResponse(request,true);
export const PATCH=(request:Request)=>nutritionConfigurationResponse(request,true);
export const OPTIONS=(request:Request)=>new NextResponse(null,{status:204,headers:mobileApiResponseHeaders(request)});
