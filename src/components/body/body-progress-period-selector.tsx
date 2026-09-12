"use client";

import { CalendarRange, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRangeValue } from "@/lib/calendar/date-range";
import {
  PROGRESS_CUSTOM_RANGE_MAX_DAYS,
  PROGRESS_PERIOD_PRESETS,
  type ProgressPeriodRange,
  type ProgressResolvedPeriod,
} from "@/lib/progress/analytics";
import { cn } from "@/lib/utils";

const allowedPresets = new Set(["1w", "2w", "4w", "8w", "3m", "6m", "1y"]);
const presets = PROGRESS_PERIOD_PRESETS.filter((preset) => allowedPresets.has(preset.value));

export function formatBodyPeriodRange(range: ProgressPeriodRange) {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Cordoba",
  });
  const date = (value: string) => formatter.format(new Date(`${value}T12:00:00Z`)).replace(".", "");
  return `${date(range.start)}–${date(range.end)}`;
}

export function BodyProgressPeriodSelector({
  period,
  reference,
  referenceLabel,
  today,
}: {
  period: ProgressResolvedPeriod;
  reference: ProgressPeriodRange;
  referenceLabel: string;
  today: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DateRangeValue>(period.current);

  function navigate(preset: string, range?: DateRangeValue) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("period", preset);
    if (preset === "custom" && range?.start && range.end) {
      next.set("from", range.start);
      next.set("to", range.end);
    } else {
      next.delete("from");
      next.delete("to");
    }
    setOpen(false);
    startTransition(() => router.push(`/train/body?${next.toString()}`, { scroll: false }));
  }

  return <>
    <button
      type="button"
      onClick={() => { setDraft(period.current); setOpen(true); }}
      className="flex min-h-11 w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-expanded={open}
      aria-busy={pending}
    >
      <CalendarRange className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{period.label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {formatBodyPeriodRange(period.current)} · {referenceLabel} {formatBodyPeriodRange(reference)}
        </span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title="Período corporal"
      description="El período y su referencia usan el motor común de Progreso."
      closeLabel="Cerrar selector de período"
    >
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        {presets.map((preset) => <button
          key={preset.value}
          type="button"
          onClick={() => navigate(preset.value)}
          aria-current={period.preset === preset.value ? "page" : undefined}
          className={cn(
            "flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium",
            period.preset === preset.value && "bg-primary/8 text-primary",
          )}
          disabled={pending}
        >
          <span>{preset.label}</span>
          {period.preset === preset.value ? <span className="text-xs">Actual</span> : null}
        </button>)}
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rango personalizado</p>
        <DateRangePicker value={draft} onChange={setDraft} today={today} maxDays={PROGRESS_CUSTOM_RANGE_MAX_DAYS} />
        <Button type="button" className="h-11 w-full" disabled={!draft.start || !draft.end || pending} onClick={() => navigate("custom", draft)}>
          Aplicar rango
        </Button>
      </div>
    </ResponsiveDialog>
  </>;
}
