import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { measurePerformance, requestPerformanceContext, type RequestPerformanceContext } from "../request-performance";
import { handleMobileAuthenticatedResourceRequest, handleMobileMutationRequest } from "./auth";
import { mobileApiResponseHeaders, readMobileJson } from "./http";
import { authenticateMobileAccessToken, authenticateMobileMutationAccessToken, type MobileSupabaseAuthenticatedContext } from "./supabase";

export async function sessionReadResponse<T>(request: NextRequest, route: string,
  read: (context: MobileSupabaseAuthenticatedContext, performance: RequestPerformanceContext) => Promise<T>) {
  const performance = requestPerformanceContext(request.headers);
  const base = { route, ...performance };
  const result = await handleMobileAuthenticatedResourceRequest(request.headers.get("authorization"), {
    authenticate: (token) => measurePerformance({ ...base, operation: "mobile.training.auth", layer: "auth" }, () => authenticateMobileAccessToken(token)),
    read: (context) => measurePerformance({ ...base, operation: "mobile.training.session.read", layer: "application" }, () => read(context, performance)),
  });
  return NextResponse.json(result.body, { status: result.status, headers: mobileApiResponseHeaders(request) });
}
export async function sessionMutationResponse<T>(request: NextRequest, route: string, successStatus: 200 | 201,
  mutate: (body: unknown, context: MobileSupabaseAuthenticatedContext) => Promise<T>) {
  const base = { route, ...requestPerformanceContext(request.headers) };
  const result = await handleMobileMutationRequest(request.headers.get("authorization"), {
    successStatus,
    authenticate: (token) => measurePerformance({ ...base, operation: "mobile.training.auth", layer: "auth" }, () => authenticateMobileMutationAccessToken(token)),
    mutate: (context) => measurePerformance({ ...base, operation: "mobile.training.session.mutate", layer: "database" }, async () => mutate(await readMobileJson(request), context)),
  });
  return NextResponse.json(result.body, { status: result.status, headers: mobileApiResponseHeaders(request) });
}
