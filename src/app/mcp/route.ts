import { handleMealsMcp } from "@/lib/integrations/mcp-meals";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = handleMealsMcp;
export const GET = handleMealsMcp;
export const DELETE = handleMealsMcp;
