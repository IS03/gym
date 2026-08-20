import Link from "next/link";
import { ArrowLeft, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { listExpenditureRulePeriods } from "@/lib/nutrition/product";
import { groupConfigurationPeriods } from "../configuration-periods";
import { ExpenditureVersionDialog } from "../nutrition-settings-forms";

export const dynamic = "force-dynamic";
const formatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Cordoba" });
const dateLabel = (date: string) => formatter.format(new Date(`${date}T12:00:00`));

function ExpenditureSummary({ rule }: { rule: Awaited<ReturnType<typeof listExpenditureRulePeriods>>[number] }) {
  return <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 text-sm"><span className="text-muted-foreground">Trabajo + gym</span><span className="font-medium">{rule.work_gym_kcal} kcal</span><span className="text-muted-foreground">Trabajo + sin gym</span><span className="font-medium">{rule.work_no_gym_kcal} kcal</span><span className="text-muted-foreground">Sin trabajo + gym</span><span className="font-medium">{rule.no_work_gym_kcal} kcal</span><span className="text-muted-foreground">Sin trabajo + sin gym</span><span className="font-medium">{rule.no_work_no_gym_kcal} kcal</span></div>;
}

export default async function ExpenditureSettingsPage() {
  const today = todayInCordoba();
  const groups = groupConfigurationPeriods(await listExpenditureRulePeriods(), today);
  return <div className="space-y-6 pb-16 lg:pb-0"><div className="space-y-2"><Link href="/settings/nutrition" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Nutrición</Link><div className="flex items-center gap-2"><Flame className="size-5 text-primary" aria-hidden /><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Gasto estimado</h1></div><p className="text-sm text-muted-foreground">Reglas de gasto según trabajo y entrenamiento.</p></div>
    <section className="space-y-3" aria-labelledby="current-expenditure"><h2 id="current-expenditure" className="text-base font-semibold">Configuración actual</h2><Card><CardHeader className="pb-3"><CardTitle className="text-base">{groups.current?.name ?? "Sin configurar"}</CardTitle><p className="text-sm text-muted-foreground">{groups.current ? `Vigente desde ${dateLabel(groups.current.effective_from)}` : "Todavía no hay una versión vigente."}</p></CardHeader>{groups.current ? <CardContent><ExpenditureSummary rule={groups.current} /></CardContent> : null}</Card><ExpenditureVersionDialog current={groups.current} today={today} /></section>
    {groups.history.length > 0 ? <details className="rounded-xl border bg-card px-4 py-2"><summary className="min-h-10 cursor-pointer py-2 text-sm font-medium">Historial · {groups.history.length}</summary><div className="divide-y border-t">{groups.history.map((rule) => <div key={rule.id} className="py-3 text-sm"><p className="font-medium">{rule.name}</p><p className="mt-1 text-xs text-muted-foreground">Desde {dateLabel(rule.effective_from)} · {rule.work_gym_kcal}/{rule.work_no_gym_kcal}/{rule.no_work_gym_kcal}/{rule.no_work_no_gym_kcal} kcal</p></div>)}</div></details> : null}
    {groups.upcoming.length > 0 ? <section className="space-y-3"><h2 className="text-base font-semibold">Próximos cambios</h2><div className="space-y-2">{groups.upcoming.map((rule) => <Card key={rule.id}><CardContent className="py-3"><p className="text-sm font-medium">{rule.name}</p><p className="mt-1 text-xs text-muted-foreground">Desde {dateLabel(rule.effective_from)}</p></CardContent></Card>)}</div></section> : null}
  </div>;
}
