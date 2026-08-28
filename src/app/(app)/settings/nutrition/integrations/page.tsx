import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { listIntegrationApiTokens } from "@/lib/integrations/chatgpt-tokens";
import { ChatgptIntegration } from "../chatgpt-integration";

export const dynamic = "force-dynamic";

export default async function NutritionIntegrationsPage() {
  const tokens = await listIntegrationApiTokens();
  return <div className="space-y-6 pb-16 lg:pb-0"><div className="space-y-2"><Link href="/settings/nutrition" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Nutrición</Link><div className="flex items-center gap-2"><KeyRound className="size-5 text-primary" aria-hidden /><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Integraciones</h1></div><p className="text-sm text-muted-foreground">Conexiones externas de tu nutrición.</p></div><ChatgptIntegration initialTokens={tokens} /></div>;
}
