import { NextResponse, type NextRequest } from 'next/server';
import { handleMobileAuthenticatedRequest } from '@/lib/mobile-api/auth';
import { mobileApiResponseHeaders } from '@/lib/mobile-api/http';
import { authenticateMobileAccessToken } from '@/lib/mobile-api/supabase';
import { readMobileNutritionReport } from '@/lib/mobile-api/nutrition-report-server';
export const dynamic='force-dynamic';
export async function OPTIONS(request:NextRequest) { return new NextResponse(null,{status:204,headers:mobileApiResponseHeaders(request)}); }
export async function GET(request:NextRequest) {
  const result=await handleMobileAuthenticatedRequest(request.headers.get('authorization'),{
    authenticate:authenticateMobileAccessToken,
    read:context=>readMobileNutritionReport(request.nextUrl.searchParams,context),
  });
  return NextResponse.json(result.body,{status:result.status,headers:mobileApiResponseHeaders(request)});
}
