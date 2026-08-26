"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { formatDateFieldValue } from "@/lib/date-field-display";
import { isDateInRange, isDateSelectable, selectDateRange, type DateRangeValue } from "@/lib/calendar/date-range";
import { addMonths, buildMonthGrid, formatMonthLabel, isoMonth } from "@/lib/calendar/month";
import { cn } from "@/lib/utils";

const weekdays = ["L", "M", "X", "J", "V", "S", "D"];

type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  today: string;
  maxDays: number;
  fromName?: string;
  toName?: string;
};

function monthFor(value: DateRangeValue, today: string) {
  const date = value.end ?? value.start ?? today;
  return isoMonth(new Date(`${date}T12:00:00Z`));
}

export function DateRangePicker({
  value,
  onChange,
  today,
  maxDays,
  fromName = "from",
  toName = "to",
}: DateRangePickerProps) {
  const currentMonth = isoMonth(new Date(`${today}T12:00:00Z`));
  const [month, setMonth] = useState(() => monthFor(value, today));
  const [error, setError] = useState<string | null>(null);
  const days = buildMonthGrid(month, { full: true });
  const previousMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const canAdvance = nextMonth <= currentMonth;

  const chooseDate = (date: string) => {
    const next = selectDateRange(value, date, maxDays);
    setError(next.error);
    if (!next.error) onChange(next.value);
  };

  return (
    <div className="space-y-4">
      <input type="hidden" name={fromName} value={value.start ?? ""} />
      <input type="hidden" name={toName} value={value.end ?? ""} />

      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
        <button
          type="button"
          aria-label="Mes anterior"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setMonth(previousMonth)}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h3 className="text-center text-base font-semibold tracking-tight">{formatMonthLabel(month)}</h3>
        <button
          type="button"
          aria-label="Mes siguiente"
          disabled={!canAdvance}
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => setMonth(nextMonth)}
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground" aria-hidden>
        {weekdays.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Calendario de ${formatMonthLabel(month)}`}>
        {days.map((day) => {
          const future = !isDateSelectable(day.date, today);
          const selected = day.date === value.start || day.date === value.end;
          const between = !selected && isDateInRange(day.date, value);
          const isToday = day.date === today;
          const label = formatDateFieldValue(day.date);
          return (
            <div key={day.date} role="gridcell" className="min-w-0">
              <button
                type="button"
                disabled={future}
                aria-label={`${label}${isToday ? ", hoy" : ""}${selected ? ", seleccionada" : between ? ", dentro del rango" : ""}`}
                aria-pressed={selected}
                className={cn(
                  "flex min-h-10 w-full min-w-0 items-center justify-center rounded-lg text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-11",
                  !day.inMonth && !selected && !between && "text-muted-foreground/55",
                  !future && !selected && !between && "hover:bg-muted",
                  future && "cursor-not-allowed text-muted-foreground/35",
                  between && "rounded-none bg-primary/10 text-primary",
                  selected && "bg-primary text-primary-foreground",
                  isToday && !selected && "ring-1 ring-primary/50",
                )}
                onClick={() => chooseDate(day.date)}
              >
                {day.date.slice(8, 10)}
              </button>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-3 text-sm">
        {value.start && value.end ? <p className="text-center font-semibold">{formatDateFieldValue(value.start)} — {formatDateFieldValue(value.end)}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Desde</p><p className="mt-1 truncate font-medium">{formatDateFieldValue(value.start ?? "", "Seleccioná una fecha")}</p></div>
          <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Hasta</p><p className="mt-1 truncate font-medium">{formatDateFieldValue(value.end ?? "", "Seleccioná una fecha")}</p></div>
        </div>
      </div>
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
