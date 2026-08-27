import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NutritionReportPeriodSelector } from "@/components/nutrition/nutrition-report-period-selector";
import { StepsReport } from "@/components/steps/steps-report";
import { formatNutritionReportRange } from "@/lib/nutrition/report-display";
import { getStepsReport } from "@/lib/nutrition/steps-report";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";

export const dynamic = "force-dynamic";

export default async function StepsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const value = (key: string) => typeof sp[key] === "string" ? sp[key] as string : undefined;
  const today = todayInCordoba();
  const { range, days, summary } = await getStepsReport({ period: value("period"), from: value("from"), to: value("to") }, today);

  return <div className="space-y-6">
    <header className="space-y-3">
      <Link href="/today" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4" aria-hidden /> Hoy</Link>
      <div><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Pasos</h1><p className="mt-1 text-sm text-muted-foreground">Evolución de tu actividad diaria.</p></div>
    </header>
    <Card><CardContent className="space-y-4 pt-1"><NutritionReportPeriodSelector preset={range.preset} start={range.start} end={range.end} today={today} rangeLabel={formatNutritionReportRange(range.start, range.end)} basePath="/today/steps" />{range.error ? <p className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">{range.error} Se muestran los últimos 7 días.</p> : null}</CardContent></Card>
    <Card className="surface-elevated"><CardContent className="pt-5"><StepsReport days={days} summary={summary} /></CardContent></Card>
  </div>;
}
