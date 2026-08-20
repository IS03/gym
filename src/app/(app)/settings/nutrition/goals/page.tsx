import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { listNutritionGoalPeriods } from "@/lib/nutrition/product";
import { groupConfigurationPeriods } from "../configuration-periods";
import { GoalVersionDialog } from "../nutrition-settings-forms";

export const dynamic = "force-dynamic";
const formatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Cordoba" });
const dateLabel = (date: string) => formatter.format(new Date(`${date}T12:00:00`));

function GoalSummary({ goal }: { goal: Awaited<ReturnType<typeof listNutritionGoalPeriods>>[number] }) {
  return <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-3 text-sm"><span /><span className="text-center text-xs font-medium text-muted-foreground">Sin gym</span><span className="text-center text-xs font-medium text-muted-foreground">Con gym</span><span className="text-muted-foreground">Calorías</span><span className="text-center font-medium">{goal.calories_no_gym}</span><span className="text-center font-medium">{goal.calories_gym}</span><span className="text-muted-foreground">Proteína</span><span className="text-center font-medium">{goal.protein_no_gym_g} g</span><span className="text-center font-medium">{goal.protein_gym_g} g</span><span className="text-muted-foreground">Agua</span><span className="text-center font-medium">{goal.water_no_gym_l} L</span><span className="text-center font-medium">{goal.water_gym_l} L</span></div>;
}

export default async function NutritionGoalsPage() {
  const today = todayInCordoba();
  const groups = groupConfigurationPeriods(await listNutritionGoalPeriods(), today);
  return <div className="space-y-6 pb-16 lg:pb-0">
    <div className="space-y-2"><Link href="/settings/nutrition" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Nutrición</Link><div className="flex items-center gap-2"><Target className="size-5 text-primary" aria-hidden /><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Objetivos</h1></div><p className="text-sm text-muted-foreground">Metas diarias de calorías, proteína y agua.</p></div>
    <section className="space-y-3" aria-labelledby="current-goal"><h2 id="current-goal" className="text-base font-semibold">Objetivo actual</h2><Card><CardHeader className="pb-3"><CardTitle className="text-base">{groups.current?.name ?? "Sin configurar"}</CardTitle><p className="text-sm text-muted-foreground">{groups.current ? `Desde ${dateLabel(groups.current.effective_from)}` : "Todavía no hay una versión vigente."}</p></CardHeader>{groups.current ? <CardContent><GoalSummary goal={groups.current} /></CardContent> : null}</Card><GoalVersionDialog current={groups.current} today={today} /></section>
    {groups.history.length > 0 ? <details className="rounded-xl border bg-card px-4 py-2"><summary className="min-h-10 cursor-pointer py-2 text-sm font-medium">Historial de objetivos · {groups.history.length}</summary><div className="divide-y border-t">{groups.history.map((goal) => <div key={goal.id} className="py-3 text-sm"><p className="font-medium">{goal.name}</p><p className="mt-1 text-xs text-muted-foreground">Desde {dateLabel(goal.effective_from)} · {goal.calories_no_gym}/{goal.calories_gym} kcal · P {goal.protein_no_gym_g}/{goal.protein_gym_g} g · Agua {goal.water_no_gym_l}/{goal.water_gym_l} L</p></div>)}</div></details> : null}
    {groups.upcoming.length > 0 ? <section className="space-y-3" aria-labelledby="upcoming-goals"><h2 id="upcoming-goals" className="text-base font-semibold">Próximos cambios</h2><div className="space-y-2">{groups.upcoming.map((goal) => <Card key={goal.id}><CardContent className="py-3"><p className="text-sm font-medium">{goal.name}</p><p className="mt-1 text-xs text-muted-foreground">Desde {dateLabel(goal.effective_from)} · {goal.calories_no_gym}/{goal.calories_gym} kcal</p></CardContent></Card>)}</div></section> : null}
  </div>;
}
