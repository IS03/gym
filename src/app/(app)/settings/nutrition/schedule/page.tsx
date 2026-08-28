import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { listWorkSchedulePeriods } from "@/lib/nutrition/product";
import { groupConfigurationPeriods } from "../configuration-periods";
import { ScheduleVersionDialog } from "../nutrition-settings-forms";

export const dynamic = "force-dynamic";
const formatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Cordoba" });
const dateLabel = (date: string) => formatter.format(new Date(`${date}T12:00:00`));
const weekdays = [["monday", "Lunes"], ["tuesday", "Martes"], ["wednesday", "Miércoles"], ["thursday", "Jueves"], ["friday", "Viernes"], ["saturday", "Sábado"], ["sunday", "Domingo"]] as const;
const scheduleDays = (schedule: Awaited<ReturnType<typeof listWorkSchedulePeriods>>[number]) => weekdays.filter(([key]) => schedule[key]).map(([, label]) => label).join(" · ") || "Sin días seleccionados";

export default async function ScheduleSettingsPage() {
  const today = todayInCordoba();
  const groups = groupConfigurationPeriods(await listWorkSchedulePeriods(), today);
  return <div className="space-y-6 pb-16 lg:pb-0"><div className="space-y-2"><Link href="/settings/nutrition" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Nutrición</Link><div className="flex items-center gap-2"><BriefcaseBusiness className="size-5 text-primary" aria-hidden /><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Horario laboral</h1></div><p className="text-sm text-muted-foreground">Días habituales de trabajo.</p></div>
    <section className="space-y-3" aria-labelledby="current-schedule"><h2 id="current-schedule" className="text-base font-semibold">Horario actual</h2><Card><CardHeader className="pb-3"><CardTitle className="text-base">{groups.current?.name ?? "Sin configurar"}</CardTitle><p className="text-sm text-muted-foreground">{groups.current ? `Desde ${dateLabel(groups.current.effective_from)}` : "Todavía no hay una versión vigente."}</p></CardHeader>{groups.current ? <CardContent><p className="text-sm font-medium leading-relaxed">{scheduleDays(groups.current)}</p></CardContent> : null}</Card><ScheduleVersionDialog current={groups.current} today={today} /></section>
    {groups.history.length > 0 ? <details className="rounded-xl border bg-card px-4 py-2"><summary className="min-h-10 cursor-pointer py-2 text-sm font-medium">Historial · {groups.history.length}</summary><div className="divide-y border-t">{groups.history.map((schedule) => <div key={schedule.id} className="py-3 text-sm"><p className="font-medium">{schedule.name}</p><p className="mt-1 text-xs text-muted-foreground">Desde {dateLabel(schedule.effective_from)} · {scheduleDays(schedule)}</p></div>)}</div></details> : null}
    {groups.upcoming.length > 0 ? <section className="space-y-3"><h2 className="text-base font-semibold">Próximos cambios</h2><div className="space-y-2">{groups.upcoming.map((schedule) => <Card key={schedule.id}><CardContent className="py-3"><p className="text-sm font-medium">{schedule.name}</p><p className="mt-1 text-xs text-muted-foreground">Desde {dateLabel(schedule.effective_from)} · {scheduleDays(schedule)}</p></CardContent></Card>)}</div></section> : null}
  </div>;
}
