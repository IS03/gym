"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button } from "@/components/ui/button";
import { addMonths, buildMonthGrid, formatMonthLabel, type CalendarMonth } from "@/lib/calendar/month";
import {
  adjacentHistoryDate,
  dailyHistoryDetailHref,
  type DailyHistoryOrigin,
} from "@/lib/history/daily-history-navigation";
import { cn } from "@/lib/utils";

const weekdays = ["L", "M", "X", "J", "V", "S", "D"];
const earliestPickerYear = 1900;

const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, index, 1, 12)),
  ),
);

function navigationDateLabel(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function dayAriaLabel(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

type Props = {
  value: string;
  today: string;
  origin: DailyHistoryOrigin | null;
  adjacent?: boolean;
};

export function DailyHistoryDateNavigator({ value, today, origin, adjacent = true }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(value.slice(0, 7) as CalendarMonth);
  const [isPending, startTransition] = useTransition();
  const currentMonth = today.slice(0, 7) as CalendarMonth;
  const selectedYear = Number(visibleMonth.slice(0, 4));
  const selectedMonthNumber = Number(visibleMonth.slice(5, 7));
  const years = Array.from(
    { length: Number(today.slice(0, 4)) - earliestPickerYear + 1 },
    (_, index) => Number(today.slice(0, 4)) - index,
  );

  function navigate(date: string) {
    setOpen(false);
    startTransition(() => router.push(dailyHistoryDetailHref(date, origin), { scroll: false }));
  }

  function changeYear(year: number) {
    const monthNumber = year === Number(today.slice(0, 4))
      ? Math.min(selectedMonthNumber, Number(today.slice(5, 7)))
      : selectedMonthNumber;
    setVisibleMonth(`${year}-${String(monthNumber).padStart(2, "0")}` as CalendarMonth);
  }

  const trigger = (
    <Button
      type="button"
      variant="outline"
      className={cn("h-11 min-w-0 justify-center px-2", adjacent ? "w-full" : "w-full justify-between px-3")}
      aria-label={`Elegir fecha. Seleccionada: ${dayAriaLabel(value)}`}
      aria-expanded={open}
      disabled={isPending}
      onClick={() => {
        setVisibleMonth(value.slice(0, 7) as CalendarMonth);
        setOpen(true);
      }}
    >
      <span className="truncate capitalize">{isPending ? "Actualizando…" : navigationDateLabel(value)}</span>
      {!adjacent ? <ChevronRight className="size-4 text-muted-foreground" aria-hidden /> : null}
    </Button>
  );

  return (
    <>
      {adjacent ? (
        <nav className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2" aria-label="Navegación por fecha">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Día anterior"
            disabled={isPending}
            onClick={() => navigate(adjacentHistoryDate(value, -1))}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
          {trigger}
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Día siguiente"
            disabled={isPending || value >= today}
            onClick={() => navigate(adjacentHistoryDate(value, 1))}
          >
            <ChevronRight className="size-5" aria-hidden />
          </Button>
        </nav>
      ) : trigger}

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Elegir fecha"
        description="Elegí año, mes y día. Los días sin registros también están disponibles."
        closeLabel="Cerrar selector de fecha"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5 text-sm font-medium">
              <span>Año</span>
              <select
                aria-label="Cambiar año"
                value={selectedYear}
                onChange={(event) => changeYear(Number(event.currentTarget.value))}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <span>Mes</span>
              <select
                aria-label="Cambiar mes"
                value={selectedMonthNumber}
                onChange={(event) => setVisibleMonth(`${selectedYear}-${String(event.currentTarget.value).padStart(2, "0")}` as CalendarMonth)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base capitalize outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {monthNames.map((name, index) => {
                  const monthNumber = index + 1;
                  const disabled = selectedYear === Number(today.slice(0, 4)) && monthNumber > Number(today.slice(5, 7));
                  return <option key={name} value={monthNumber} disabled={disabled}>{name}</option>;
                })}
              </select>
            </label>
          </div>

          <div className="rounded-xl border bg-background/60 p-3">
            <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label="Mes anterior"
                disabled={visibleMonth <= `${earliestPickerYear}-01`}
                onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
              >
                <ChevronLeft className="size-5" aria-hidden />
              </Button>
              <p className="text-center text-sm font-semibold">{formatMonthLabel(visibleMonth)}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label="Mes siguiente"
                disabled={visibleMonth >= currentMonth}
                onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
              >
                <ChevronRight className="size-5" aria-hidden />
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground" aria-hidden>
              {weekdays.map((day) => <span key={day} className="py-1">{day}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Elegir un día de ${formatMonthLabel(visibleMonth)}`}>
              {buildMonthGrid(visibleMonth, { full: true }).map((day) => {
                const future = day.date > today;
                const selected = day.date === value;
                return (
                  <button
                    key={day.date}
                    type="button"
                    aria-label={dayAriaLabel(day.date)}
                    aria-current={selected ? "date" : undefined}
                    disabled={future}
                    onClick={() => navigate(day.date)}
                    className={cn(
                      "flex min-h-11 min-w-0 touch-manipulation items-center justify-center rounded-lg text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30",
                      !day.inMonth && "text-muted-foreground/45",
                      day.inMonth && !selected && !future && "hover:bg-muted/60",
                      selected && "bg-primary text-primary-foreground",
                    )}
                  >
                    {day.date.slice(8, 10)}
                  </button>
                );
              })}
            </div>
          </div>

          <Button type="button" variant="outline" className="w-full" disabled={value === today || isPending} onClick={() => navigate(today)}>
            Ir a hoy
          </Button>
        </div>
      </ResponsiveDialog>
    </>
  );
}
