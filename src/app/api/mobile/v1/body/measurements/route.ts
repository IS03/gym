import { NextResponse } from "next/server";
import { bodyMeasurementMutationResponse, bodyReadResponse } from "@/lib/mobile-api/body-server";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";

export const dynamic = "force-dynamic";
export const GET = (request: Request) => bodyReadResponse(request, "measurements");
export const POST = (request: Request) => bodyMeasurementMutationResponse(request, "create", null);
export const OPTIONS = (request: Request) => new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
