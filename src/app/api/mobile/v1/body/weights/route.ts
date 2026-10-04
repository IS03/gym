import { NextResponse } from "next/server";
import { bodyReadResponse } from "@/lib/mobile-api/body-server";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";

export const dynamic = "force-dynamic";
export const GET = (request: Request) => bodyReadResponse(request, "weights");
export const OPTIONS = (request: Request) => new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
