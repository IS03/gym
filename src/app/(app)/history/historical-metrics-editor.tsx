"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateFieldValue } from "@/lib/date-field-display";
import type { DailyMetricWithValue } from "@/lib/daily-metrics/core";
import { saveHistoricalDailyMetricsAction } from "./historical-metrics-actions";

type Props = {
  date: string;
  metrics: DailyMetricWithValue[];
};

function initialValues(metrics: DailyMetricWithValue[]) {
  return Object.fromEntries(metrics.map((metric) => [metric.id, metric.value === null ? "" : String(metric.value)]));
}

function durationParts(raw: string) {
  const total = Number(raw);
  if (!raw || !Number.isInteger(total) || total < 0) return { hours: "", minutes: "" };
  return { hours: String(Math.floor(total / 60)), minutes: String(total % 60) };
}

export function HistoricalMetricsEditor({ date, metrics }: Props) {
  const router = useRouter();
  const initial = useMemo(() => initialValues(metrics), [metrics]);
  const [values, setValues] = useState(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(metricId: string, value: string) {
    setValues((current) => ({ ...current, [metricId]: value }));
  }

  function changeDuration(metricId: string, hours: string, minutes: string) {
    if (!hours && !minutes) return change(metricId, "");
    const parsedHours = Number(hours || 0);
    const parsedMinutes = Number(minutes || 0);
    if (!Number.isInteger(parsedHours) || !Number.isInteger(parsedMinutes) || parsedHours < 0 || parsedMinutes < 0 || parsedMinutes > 59) return;
    change(metricId, String(parsedHours * 60 + parsedMinutes));
  }

  function onOpenChange(next: boolean) {
    if (next) {
      setValues(initial);
      setError(null);
    }
    setOpen(next);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveHistoricalDailyMetricsAction({ date, values });
      if (!result.ok) return setError(result.error);
      setOpen(false);
      router.refresh();
    });
  }

  if (!metrics.length) return null;
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="-mr-2" onClick={() => onOpenChange(true)}>
        Editar
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Editar métricas del día"
        description={formatDateFieldValue(date)}
        closeLabel="Cerrar edición de métricas"
      >
        <form className="space-y-4" onSubmit={submit}>
          <div className="divide-y overflow-hidden rounded-xl border">
            {metrics.map((metric) => {
              const raw = values[metric.id] ?? "";
              const duration = durationParts(raw);
              return (
                <div key={metric.id} className="space-y-2 p-3">
                  <p className="text-sm font-medium">{metric.name}</p>
                  {metric.value_type === "duration" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`history-metric-${metric.id}-hours`} className="text-xs text-muted-foreground">Horas</Label>
                        <Input id={`history-metric-${metric.id}-hours`} inputMode="numeric" min={0} value={duration.hours} onChange={(event) => changeDuration(metric.id, event.target.value, duration.minutes)} placeholder="—" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`history-metric-${metric.id}-minutes`} className="text-xs text-muted-foreground">Minutos</Label>
                        <Input id={`history-metric-${metric.id}-minutes`} inputMode="numeric" min={0} max={59} value={duration.minutes} onChange={(event) => changeDuration(metric.id, duration.hours, event.target.value)} placeholder="—" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input id={`history-metric-${metric.id}`} inputMode={metric.value_type === "integer" ? "numeric" : "decimal"} value={raw} onChange={(event) => change(metric.id, event.target.value)} placeholder="—" />
                      {metric.unit ? <span className="shrink-0 text-sm text-muted-foreground">{metric.unit}</span> : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button>
        </form>
      </ResponsiveDialog>
    </>
  );
}
