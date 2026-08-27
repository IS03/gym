import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { addMonths, buildMonthGrid, formatMonthLabel, trainingCalendarHref } from "@/lib/phase2/training-calendar";
import { cn } from "@/lib/utils";
import { routineColorCssVariable } from "@/lib/phase2/routine-colors";
import { listRoutines, listTrainingDaysInMonth } from "@/lib/phase2/training";
import { todayInCordoba } from "@/lib/phase2/training-robust";
import { CalendarFilters } from "./calendar-filters";

export const dynamic = "force-dynamic";

export default async function TrainCalendarPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) ?? {};
  const month = (typeof sp.month === "string" ? sp.month : todayInCordoba().slice(0, 7)) as `${number}-${number}`;
  const routineId = typeof sp.routine_id === "string" ? sp.routine_id : "";
  const [routines, trainedDays] = await Promise.all([
    listRoutines({ includeArchived: false }),
    listTrainingDaysInMonth({ month, routineId: routineId || null }),
  ]);
  const days = buildMonthGrid(month, { full: true });

  return <div className="space-y-5 lg:mx-auto lg:max-w-5xl">
    <div className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Calendario</h1><p className="text-sm text-muted-foreground">Días entrenados (sesiones terminadas).</p></div>
    <Card className="surface-elevated">
      <CardHeader className="space-y-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <Link href={trainingCalendarHref(addMonths(month, -1), routineId)} aria-label="Mes anterior" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-10 shrink-0")}><ChevronLeft className="size-5" aria-hidden /></Link>
          <CardTitle className="min-w-0 text-center text-base sm:text-lg">{formatMonthLabel(month)}</CardTitle>
          <Link href={trainingCalendarHref(addMonths(month, 1), routineId)} aria-label="Mes siguiente" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-10 shrink-0")}><ChevronRight className="size-5" aria-hidden /></Link>
        </div>
        <div className="flex justify-center"><CalendarFilters month={month} routineId={routineId} routines={routines.map((routine) => ({ id: routine.id, nombre: routine.nombre }))} /></div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground sm:gap-2">{["L", "M", "X", "J", "V", "S", "D"].map((day) => <div key={day} className="py-1">{day}</div>)}</div>
        <div className="mt-1.5 grid grid-cols-7 gap-1 sm:mt-2 sm:gap-2">
          {days.map((entry) => {
            const colors = trainedDays.get(entry.date) ?? [];
            const trained = colors.length > 0;
            return <Link key={entry.date} href={`/train/day?date=${entry.date}${routineId ? `&routine_id=${routineId}` : ""}`} className={cn("flex h-10 min-w-0 items-center justify-center rounded-md border text-sm outline-none transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring sm:h-12 lg:h-14", entry.inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground", trained ? "border-foreground font-semibold" : "border-border")}>
              <span className="flex flex-col items-center leading-none"><span>{entry.date.slice(8, 10)}</span>{trained ? <span className="mt-1 flex max-w-full gap-0.5 sm:gap-1">{colors.slice(0, 4).map((color) => <span key={color} className="inline-block size-1.5 rounded-full" style={{ backgroundColor: routineColorCssVariable(color) }} />)}</span> : null}</span>
            </Link>;
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Borde resaltado = día con al menos una sesión terminada.</p>
      </CardContent>
    </Card>
  </div>;
}
