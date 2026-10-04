import { NextResponse } from "next/server";
import { metricDefinitionMutationResponse, metricDefinitionsReadResponse } from "@/lib/mobile-api/metric-definitions-server";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";

export const dynamic = "force-dynamic";
export const GET = (request: Request) => metricDefinitionsReadResponse(request);
export const POST = (request: Request) => metricDefinitionMutationResponse(request, ["create"], null);
export const OPTIONS = (request: Request) => new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
