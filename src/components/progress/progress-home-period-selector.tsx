"use client";

import { CalendarRange, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRangeValue } from "@/lib/calendar/date-range";
import {
  PROGRESS_CUSTOM_RANGE_MAX_DAYS,
  PROGRESS_PERIOD_PRESETS,
  type ProgressResolvedPeriod,
} from "@/lib/progress/analytics";
import { cn } from "@/lib/utils";

const rangeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return rangeFormatter.format(new Date(`${value}T12:00:00Z`)).replace(" de ", " ").replace(".", "");
}

function rangeLabel(start: string, end: string) {
  return `${formatDate(start)}–${formatDate(end)}`;
}

export function ProgressHomePeriodSelector({ period, today }: { period: ProgressResolvedPeriod; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DateRangeValue>(period.current);

  function navigate(preset: string, range?: DateRangeValue) {
    const params = new URLSearchParams({ period: preset });
    if (preset === "custom" && range?.start && range.end) {
      params.set("from", range.start);
      params.set("to", range.end);
    }
    setOpen(false);
    startTransition(() => router.push(`/progress?${params.toString()}`, { scroll: false }));
  }

  return <>
    <button
      type="button"
      onClick={() => { setDraft(period.current); setOpen(true); }}
      className="flex min-h-11 w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left outline-none transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring"
      aria-expanded={open}
      aria-busy={pending}
    >
      <CalendarRange className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{period.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{rangeLabel(period.current.start, period.current.end)} · vs. {rangeLabel(period.previous.start, period.previous.end)}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>

    <ResponsiveDialog open={open} onOpenChange={setOpen} title="Período de Progreso" description="Este período se conserva al entrar a cada análisis." closeLabel="Cerrar selector de período">
      <div className="max-h-[44vh] divide-y overflow-y-auto rounded-xl border bg-card">
        {PROGRESS_PERIOD_PRESETS.map((preset) => <button
          key={preset.value}
          type="button"
          onClick={() => navigate(preset.value)}
          aria-current={period.preset === preset.value ? "page" : undefined}
          className={cn("flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium", period.preset === preset.value && "bg-primary/8 text-primary")}
          disabled={pending}
        >
          <span>{preset.label}</span>
          {period.preset === preset.value ? <span className="text-xs">Actual</span> : null}
        </button>)}
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rango personalizado</p>
        <DateRangePicker value={draft} onChange={setDraft} today={today} maxDays={PROGRESS_CUSTOM_RANGE_MAX_DAYS} />
        <Button type="button" className="h-11 w-full" disabled={!draft.start || !draft.end || pending} onClick={() => navigate("custom", draft)}>Aplicar rango</Button>
      </div>
    </ResponsiveDialog>
  </>;
}
