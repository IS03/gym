import { NextResponse } from "next/server";
import { bodyWeightMutationResponse } from "@/lib/mobile-api/body-server";
import { mobileApiResponseHeaders } from "@/lib/mobile-api/http";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ date: string }> };
export async function PUT(request: Request, { params }: Context) { return bodyWeightMutationResponse(request, "set", (await params).date); }
export async function DELETE(request: Request, { params }: Context) { return bodyWeightMutationResponse(request, "delete", (await params).date); }
export const OPTIONS = (request: Request) => new NextResponse(null, { status: 204, headers: mobileApiResponseHeaders(request) });
