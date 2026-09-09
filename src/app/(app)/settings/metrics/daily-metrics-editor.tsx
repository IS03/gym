"use client";

import {
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Coffee,
  Droplet,
  Footprints,
  GripVertical,
  Moon,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  METRIC_VALUE_TYPES,
  formatMetricTarget,
  metricTypeLabel,
  moveMetric,
  type MetricValueType,
  type SystemMetricKey,
  type UserMetric,
} from "@/lib/daily-metrics/core";
import {
  archiveMetricAction,
  createMetricAction,
  deleteMetricAction,
  reorderMetricsAction,
  restoreMetricAction,
  updateMetricAction,
} from "./actions";

type Tab = "active" | "archived";

const iconByKey: Record<SystemMetricKey, typeof Footprints> = {
  steps: Footprints,
  water: Droplet,
  mate: Coffee,
  sleep: Moon,
};

function emptyDraft() {
  return { name: "", valueType: "integer" as MetricValueType, unit: "", target: "", hours: "", minutes: "" };
}

export function DailyMetricsEditor({ initialMetrics }: { initialMetrics: UserMetric[] }) {
  const router = useRouter();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [tab, setTab] = useState<Tab>("active");
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<UserMetric | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const active = metrics.filter((metric) => metric.is_active);
  const archived = metrics.filter((metric) => !metric.is_active);
  const visible = tab === "active" ? active : archived;

  function openCreate() {
    setMessage(null);
    setSelected(null);
    setDraft(emptyDraft());
    setDialog("create");
  }

  function openEdit(metric: UserMetric) {
    const duration = metric.value_type === "duration" && metric.target_value !== null;
    setMessage(null);
    setSelected(metric);
    setDraft({
      name: metric.name,
      valueType: metric.value_type,
      unit: metric.unit ?? "",
      target: metric.target_value === null || duration ? "" : String(metric.target_value),
      hours: duration ? String(Math.floor((metric.target_value ?? 0) / 60)) : "",
      minutes: duration ? String((metric.target_value ?? 0) % 60) : "",
    });
    setDialog("edit");
  }

  function targetValue() {
    if (draft.valueType !== "duration") return draft.target;
    if (!draft.hours.trim() && !draft.minutes.trim()) return "";
    const hours = Number(draft.hours || 0);
    const minutes = Number(draft.minutes || 0);
    if (!Number.isInteger(hours) || hours < 0 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
      throw new Error("Ingresá horas y minutos válidos.");
    }
    return String((hours * 60) + minutes);
  }

  function refreshFromServer() {
    router.refresh();
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      try {
        const payload = {
          name: draft.name,
          valueType: draft.valueType,
          unit: draft.unit,
          target: targetValue(),
        };
        const result = selected
          ? await updateMetricAction({ id: selected.id, ...payload })
          : await createMetricAction(payload);
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        setDialog(null);
        refreshFromServer();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No pudimos guardar la métrica.");
      }
    });
  }

  function changeState(task: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setDialog(null);
      refreshFromServer();
    });
  }

  function reorder(index: number, direction: -1 | 1) {
    const next = moveMetric(active, index, direction);
    if (next === active) return;
    const previous = metrics;
    setMetrics((current) => [...next, ...current.filter((metric) => !metric.is_active)]);
    startTransition(async () => {
      const result = await reorderMetricsAction(next.map((metric) => metric.id));
      if (!result.ok) {
        setMessage(result.error);
        setMetrics(previous);
      }
    });
  }

  const identityLocked = Boolean(selected?.system_key || selected?.has_history);
  const footer = dialog ? (
    <div className="space-y-2">
      <Button type="button" className="h-11 w-full" disabled={pending} onClick={submit}>
        {pending ? "Guardando…" : dialog === "create" ? "Crear métrica" : "Aplicar"}
      </Button>
      {selected?.is_active ? (
        <Button type="button" variant="outline" className="h-11 w-full" disabled={pending} onClick={() => changeState(() => archiveMetricAction(selected.id))}>
          Archivar
        </Button>
      ) : selected ? (
        <Button type="button" variant="outline" className="h-11 w-full" disabled={pending} onClick={() => changeState(() => restoreMetricAction(selected.id))}>
          <RotateCcw className="size-4" aria-hidden /> Reactivar
        </Button>
      ) : null}
      {selected && !selected.system_key && !selected.has_history ? (
        <Button type="button" variant="ghost" className="h-11 w-full text-destructive hover:text-destructive" disabled={pending} onClick={() => changeState(() => deleteMetricAction(selected.id))}>
          <Trash2 className="size-4" aria-hidden /> Eliminar métrica
        </Button>
      ) : null}
    </div>
  ) : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Estado de métricas">
        <button type="button" role="tab" aria-selected={tab === "active"} onClick={() => setTab("active")} className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-colors ${tab === "active" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>Activas</button>
        <button type="button" role="tab" aria-selected={tab === "archived"} onClick={() => setTab("archived")} className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-colors ${tab === "archived" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>Archivadas</button>
      </div>

      <section className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/8" aria-label={tab === "active" ? "Métricas activas" : "Métricas archivadas"}>
        {visible.length ? visible.map((metric, index) => {
          const Icon = metric.system_key ? iconByKey[metric.system_key] : ChartNoAxesColumnIncreasing;
          return (
            <div key={metric.id} className="flex min-h-[4.75rem] items-center gap-2 px-3 py-2.5">
              {tab === "active" ? (
                <div className="flex shrink-0 items-center">
                  <GripVertical className="size-4 text-muted-foreground/60" aria-hidden />
                  <div className="flex flex-col">
                    <button type="button" aria-label={`Subir ${metric.name}`} disabled={pending || index === 0} onClick={() => reorder(index, -1)} className="rounded text-muted-foreground disabled:opacity-20"><ChevronUp className="size-4" /></button>
                    <button type="button" aria-label={`Bajar ${metric.name}`} disabled={pending || index === active.length - 1} onClick={() => reorder(index, 1)} className="rounded text-muted-foreground disabled:opacity-20"><ChevronDown className="size-4" /></button>
                  </div>
                </div>
              ) : null}
              <button type="button" onClick={() => openEdit(metric)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{metric.name}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{formatMetricTarget(metric)}</span></span>
                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${metric.is_active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>{metric.is_active ? "Activa" : "Archivada"}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </div>
          );
        }) : <p className="px-4 py-10 text-center text-sm text-muted-foreground">{tab === "active" ? "No tenés métricas activas." : "No tenés métricas archivadas."}</p>}
      </section>

      <Button type="button" className="h-12 w-full" onClick={openCreate}><Plus className="size-5" aria-hidden /> Agregar métrica</Button>
      <p className="px-1 text-xs leading-relaxed text-muted-foreground">Las métricas con historial se archivan para preservar sus registros.</p>
      {message && !dialog ? <p role="status" className="text-sm text-destructive">{message}</p> : null}

      <ResponsiveDialog
        open={dialog !== null}
        onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}
        title={dialog === "create" ? "Nueva métrica" : selected?.name ?? "Editar métrica"}
        description={dialog === "create" ? "Definí qué querés registrar cada día." : "Ajustá el objetivo y el estado de esta métrica."}
        closeLabel="Cerrar editor de métrica"
        footer={footer}
      >
        <div className="space-y-4">
          <label className="space-y-1.5 text-sm font-medium"><span>Nombre</span><Input value={draft.name} disabled={Boolean(selected?.system_key)} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="text-base" /></label>
          <label className="space-y-1.5 text-sm font-medium"><span>Tipo</span><select value={draft.valueType} disabled={identityLocked} onChange={(event) => setDraft((current) => ({ ...current, valueType: event.target.value as MetricValueType, unit: event.target.value === "duration" ? "min" : current.unit }))} className="h-11 w-full rounded-md border bg-background px-3 text-base">{METRIC_VALUE_TYPES.map((type) => <option key={type} value={type}>{metricTypeLabel(type)}</option>)}</select></label>
          {draft.valueType !== "duration" ? <label className="space-y-1.5 text-sm font-medium"><span>Unidad</span><Input value={draft.unit} disabled={identityLocked} maxLength={16} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))} placeholder="Ej: km, kg, veces" className="text-base" /></label> : <div><p className="text-sm font-medium">Unidad</p><p className="mt-1 text-sm text-muted-foreground">Horas y minutos</p></div>}
          {draft.valueType === "duration" ? (
            <fieldset className="space-y-1.5"><legend className="text-sm font-medium">Objetivo opcional</legend><div className="grid grid-cols-2 gap-3"><label className="space-y-1"><span className="text-xs text-muted-foreground">Horas</span><Input inputMode="numeric" value={draft.hours} onChange={(event) => setDraft((current) => ({ ...current, hours: event.target.value }))} className="text-base" /></label><label className="space-y-1"><span className="text-xs text-muted-foreground">Minutos</span><Input inputMode="numeric" value={draft.minutes} onChange={(event) => setDraft((current) => ({ ...current, minutes: event.target.value }))} className="text-base" /></label></div></fieldset>
          ) : <label className="space-y-1.5 text-sm font-medium"><span>Objetivo opcional</span><Input inputMode={draft.valueType === "integer" ? "numeric" : "decimal"} value={draft.target} onChange={(event) => setDraft((current) => ({ ...current, target: event.target.value }))} className="text-base" placeholder="Sin objetivo" /></label>}
          {selected?.has_history ? <p className="text-xs leading-relaxed text-muted-foreground">Tiene historial: podés cambiar {selected.system_key ? "el objetivo" : "el nombre visible o el objetivo"} y archivarla, pero no reciclar su tipo ni unidad.</p> : null}
          {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
        </div>
      </ResponsiveDialog>
    </div>
  );
}
