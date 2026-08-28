import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getGlobalCalendar } from "@/lib/calendar/global-calendar";
import { addMonths, formatMonthLabel, isoMonth, resolveCalendarMonth } from "@/lib/calendar/month";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { getVerifiedRequestContext } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const weekdays = ["L", "M", "X", "J", "V", "S", "D"];
const signals = [
  { key: "hasNutrition", label: "Nutrición", className: "bg-primary" },
  { key: "hasTraining", label: "Entreno", className: "bg-chart-2" },
  { key: "hasActivity", label: "Actividad", className: "bg-chart-3" },
  { key: "hasBody", label: "Cuerpo", className: "bg-chart-5" },
] as const;

function calendarHref(month: string) { return `/calendar?month=${month}`; }

function formatAriaDate(date: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export default async function CalendarPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) ?? {};
  const today = todayInCordoba();
  const currentMonth = isoMonth(new Date(`${today}T12:00:00Z`));
  const month = resolveCalendarMonth(typeof sp.month === "string" ? sp.month : undefined, currentMonth);
  const auth = await getVerifiedRequestContext();
  if (!auth) redirect("/login");
  const days = await getGlobalCalendar({ month, today, context: auth });
  const previousMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const canAdvance = nextMonth <= currentMonth;

  return (
    <div className="space-y-6 pb-2 lg:mx-auto lg:max-w-5xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Calendario</h1>
        <p className="mt-1 text-sm text-muted-foreground">Nutrición, actividad, entrenamiento y cuerpo, día por día.</p>
      </header>

      <Card className="surface-elevated">
        <CardContent className="space-y-5 p-3 sm:p-5">
          <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
            <Link href={calendarHref(previousMonth)} aria-label="Mes anterior" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11 justify-self-start")}><ChevronLeft className="size-5" aria-hidden /></Link>
            <h2 className="min-w-0 text-center text-base font-semibold tracking-tight sm:text-lg">{formatMonthLabel(month)}</h2>
            {canAdvance ? <Link href={calendarHref(nextMonth)} aria-label="Mes siguiente" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11 justify-self-end")}><ChevronRight className="size-5" aria-hidden /></Link> : <span aria-disabled="true" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11 justify-self-end cursor-not-allowed opacity-40")}><ChevronRight className="size-5" aria-hidden /></span>}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:gap-x-4">
            {signals.map((signal) => <span key={signal.key} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", signal.className)} aria-hidden />{signal.label}</span>)}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground" aria-hidden>
            {weekdays.map((label) => <span key={label} className="pb-1">{label}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="grid" aria-label={`Calendario de ${formatMonthLabel(month)}`}>
            {days.map((day) => {
              const isToday = day.date === today;
              const isFuture = day.date > today;
              const present = signals.filter((signal) => day[signal.key]).map((signal) => signal.label);
              const aria = `${formatAriaDate(day.date)}${isToday ? ", hoy" : ""}${isFuture ? ". Fecha futura." : present.length ? `. ${present.join(", ")}.` : ". Sin registros."}`;
              const contents = <><span>{day.date.slice(8, 10)}</span><span className="mt-1 flex h-1.5 items-center justify-center gap-0.5" aria-hidden>{signals.filter((signal) => day[signal.key]).map((signal) => <span key={signal.key} className={cn("size-1.5 rounded-full", signal.className)} />)}</span></>;
              const classes = cn("flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg text-xs font-medium leading-none outline-none transition-colors sm:min-h-14", !day.inMonth && "text-muted-foreground/45", day.inMonth && !isToday && !isFuture && "hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring", isToday && "bg-primary/10 text-primary ring-1 ring-primary/50", isFuture && "cursor-not-allowed text-muted-foreground/35");
              return isFuture ? <span key={day.date} aria-disabled="true" aria-label={aria} className={classes}>{contents}</span> : <Link key={day.date} href={`/history?date=${day.date}`} aria-label={aria} className={classes}>{contents}</Link>;
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground">Tocá un día para ver el historial completo.</p>
        </CardContent>
      </Card>
    </div>
  );
}
