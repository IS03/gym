import { NextResponse } from "next/server";
import { metricOrderMutationResponse } from "@/lib/mobile-api/metric-definitions-server";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";

export const dynamic = "force-dynamic";
export const PUT = (request: Request) => metricOrderMutationResponse(request);
export const OPTIONS = (request: Request) => new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
