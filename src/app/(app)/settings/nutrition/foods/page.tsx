import Link from "next/link";
import { Apple, ArrowLeft } from "lucide-react";
import { listFoods } from "@/lib/nutrition/product";
import { FoodsCatalog } from "../foods-catalog";

export const dynamic = "force-dynamic";

export default async function FoodsSettingsPage() {
  const foods = await listFoods();
  return <div className="space-y-6 pb-16 lg:pb-0"><div className="space-y-2"><Link href="/settings/nutrition" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Nutrición</Link><div className="flex items-center gap-2"><Apple className="size-5 text-primary" aria-hidden /><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Alimentos habituales</h1></div><p className="text-sm text-muted-foreground">Tu catálogo personal de referencias nutricionales.</p></div><FoodsCatalog initialFoods={foods} /></div>;
}
