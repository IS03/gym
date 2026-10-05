import { NextResponse } from "next/server";
import { profileIdentityResponse } from "@/lib/mobile-api/profile-identity-server";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";

export const dynamic = "force-dynamic";
export const GET = (request: Request) => profileIdentityResponse(request);
export const PATCH = (request: Request) => profileIdentityResponse(request);
export const OPTIONS = (request: Request) => new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
