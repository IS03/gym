import { NextResponse } from "next/server";
import { metricDefinitionMutationResponse } from "@/lib/mobile-api/metric-definitions-server";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, { params }: Context) { return metricDefinitionMutationResponse(request, ["update", "archive", "restore"], (await params).id); }
export async function DELETE(request: Request, { params }: Context) { return metricDefinitionMutationResponse(request, ["delete"], (await params).id); }
export const OPTIONS = (request: Request) => new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
