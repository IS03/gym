import { NextResponse } from "next/server";
import { bodyMeasurementMutationResponse } from "@/lib/mobile-api/body-server";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, { params }: Context) { return bodyMeasurementMutationResponse(request, "update", (await params).id); }
export async function DELETE(request: Request, { params }: Context) { return bodyMeasurementMutationResponse(request, "delete", (await params).id); }
export const OPTIONS = (request: Request) => new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
