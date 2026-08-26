"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Pencil, Plus, Scale, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartDetail } from "@/components/ui/chart-detail";
import { DateField } from "@/components/ui/date-field";
import { chartDomain, chartTickIndexes, chartX, chartY, chartYAxisTicks, formatChartValue, lineSegments } from "@/lib/chart-core";
import {
  formatWeightKg,
  weightChange,
  weightHistoryForLastDays,
  type WeightHistoryPoint,
} from "@/lib/weight-history";
import {
  deleteWeightHistoryEntryAction,
  recordWeightAction,
  updateWeightHistoryEntryAction,
} from "@/app/(app)/train/body/actions";

type Props = {
  initialEntries: WeightHistoryPoint[];
  initialCurrentWeightKg: number | null;
  today: string;
};

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Cordoba", ...options,
  }).format(new Date(`${value}T12:00:00Z`)).replace(" de ", " ").replace(".", "");
}

function WeightTrendChart({ entries }: { entries: WeightHistoryPoint[] }) {
  const [selected, setSelected] = useState(-1);
  if (entries.length === 0) return null;
  const width = 360; const height = 164; const left = 50; const right = 12; const top = 12; const bottom = 30;
  const values = entries.map((entry) => entry.weight_kg); const domain = chartDomain(values); const coordinates = lineSegments(values, domain, width, height, left, right, top, bottom)[0] ?? []; const selectedIndex = selected < 0 ? entries.length - 1 : Math.min(selected, entries.length - 1);
  return <div className="space-y-2 overflow-hidden"><p className="text-xs text-muted-foreground">Fecha · Peso (kg)</p><svg className="h-auto w-full text-primary" viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Evolución del peso corporal. Eje horizontal: fecha. Eje vertical: kilogramos.">{chartYAxisTicks(domain, 4).map((value) => { const y = chartY(value, domain, height, top, bottom); return <g key={value}><line x1={left} x2={width - right} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.14" /><text x={left - 7} y={y + 3.5} textAnchor="end" className="fill-muted-foreground text-[10px]">{formatChartValue(value, "kg")}</text></g>; })}{coordinates.length > 1 ? <polyline points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}{coordinates.map(({ index, x, y }) => <g key={entries[index]!.id}><circle cx={x} cy={y} r="11" fill="transparent" role="button" tabIndex={0} aria-label={`${formatDate(entries[index]!.log_date)}. Peso: ${formatChartValue(values[index]!, "kg")}.`} onClick={() => setSelected(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(index); } }} /><circle cx={x} cy={y} r={selectedIndex === index ? 5 : 3.75} className="fill-card stroke-primary" strokeWidth="2" pointerEvents="none" /></g>)}</svg><div className="relative h-4 text-[10px] text-muted-foreground" aria-hidden>{chartTickIndexes(entries.length, 3).map((index) => <span key={entries[index]!.id} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(chartX(index, entries.length, width, left, right) / width) * 100}%` }}>{formatDate(entries[index]!.log_date, { day: "numeric", month: "short" })}</span>)}</div><ChartDetail title={formatDate(entries[selectedIndex]!.log_date)} items={[{ label: "Peso", value: formatChartValue(values[selectedIndex]!, "kg") }]} /></div>;
}

function Sheet({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-[82] bg-black/45 backdrop-blur-[2px]" /><Dialog.Viewport className="fixed inset-0 z-[83] flex items-end justify-center overflow-hidden sm:items-center sm:p-6"><Dialog.Popup className="w-full rounded-t-[1.5rem] bg-card p-5 text-card-foreground shadow-2xl outline-none sm:max-w-sm sm:rounded-2xl sm:border">{children}</Dialog.Popup></Dialog.Viewport></Dialog.Portal></Dialog.Root>;
}

export function WeightHistory({ initialEntries, initialCurrentWeightKg, today }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [currentWeightKg, setCurrentWeightKg] = useState(initialCurrentWeightKg);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordDate, setRecordDate] = useState(today);
  const [recordWeight, setRecordWeight] = useState("");
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingWeight, setEditingWeight] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WeightHistoryPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const recentEntries = useMemo(() => weightHistoryForLastDays(entries, today, 90), [entries, today]);
  const usesAllEntries = entries.length <= 8 || recentEntries.length === 0;
  const displayedEntries = usesAllEntries ? entries : recentEntries;
  const latest = entries.at(-1) ?? null;
  const first = displayedEntries[0] ?? null;
  const change = weightChange(displayedEntries);

  function applyCurrentWeight(result: { syncedCurrentWeight: boolean; currentWeightKg: number | null }) {
    if (result.syncedCurrentWeight) setCurrentWeightKg(result.currentWeightKg);
  }

  function registerWeight() {
    setError(null);
    startTransition(async () => {
      const result = await recordWeightAction({ logDate: recordDate, weight: recordWeight });
      if (!result.ok || !result.entry) { setError(result.ok ? "No se pudo registrar el peso." : result.error); return; }
      setEntries((current) => [...current.filter((entry) => entry.log_date !== result.entry!.log_date), result.entry!].sort((a, b) => a.log_date.localeCompare(b.log_date)));
      applyCurrentWeight(result);
      setRecordOpen(false); setRecordWeight(""); setRecordDate(today);
    });
  }

  function saveEdit(logDate: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateWeightHistoryEntryAction({ logDate, weight: editingWeight });
      if (!result.ok || !result.entry) { setError(result.ok ? "No se pudo actualizar el peso." : result.error); return; }
      setEntries((current) => current.map((entry) => entry.log_date === logDate ? result.entry! : entry));
      applyCurrentWeight(result); setEditingDate(null);
    });
  }

  function deleteEntry() {
    if (!deleteTarget) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteWeightHistoryEntryAction({ logDate: deleteTarget.log_date });
      if (!result.ok) { setError(result.error); return; }
      setEntries((current) => current.filter((entry) => entry.log_date !== deleteTarget.log_date));
      applyCurrentWeight(result); setDeleteTarget(null);
    });
  }

  return <section className="space-y-3" aria-labelledby="weight-history-title">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Scale className="size-4 text-primary" aria-hidden /><div><h2 id="weight-history-title" className="text-base font-semibold tracking-tight lg:text-lg">Peso corporal</h2><p className="text-sm text-muted-foreground">{usesAllEntries ? "Todos los registros." : "Últimos 90 días."}</p></div></div><Button type="button" size="sm" onClick={() => { setError(null); setRecordOpen(true); }}><Plus className="size-4" aria-hidden />Registrar peso</Button></div>
    {entries.length === 0 ? <Card className="surface-elevated"><CardContent className="space-y-3 py-7 text-center"><p className="text-sm text-muted-foreground">Peso actual</p><p className="metric-number text-2xl font-semibold">{currentWeightKg === null ? "—" : `${formatWeightKg(currentWeightKg)} kg`}</p><p className="text-sm text-muted-foreground">Todavía no hay registros. Registrá una medición para empezar tu historial.</p></CardContent></Card> : <>
      <Card className="surface-elevated"><CardContent className="space-y-5 pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-6 lg:space-y-0 lg:pt-5"><div className="min-w-0"><WeightTrendChart entries={displayedEntries} /></div><div className="grid grid-cols-3 gap-3 border-t pt-4 text-center lg:grid-cols-1 lg:gap-0 lg:border-l lg:border-t-0 lg:pt-0 lg:text-left"><div className="lg:px-5 lg:py-2"><p className="text-[11px] text-muted-foreground">Peso actual</p><p className="metric-number mt-1 text-lg font-semibold">{currentWeightKg === null ? "—" : `${formatWeightKg(currentWeightKg)} kg`}</p></div><div className="lg:border-t lg:px-5 lg:py-3"><p className="text-[11px] text-muted-foreground">Cambio</p><p className="metric-number mt-1 text-lg font-semibold">{change === null ? "—" : `${change > 0 ? "+" : ""}${formatWeightKg(change)} kg`}</p></div><div className="lg:border-t lg:px-5 lg:py-3"><p className="text-[11px] text-muted-foreground">Primer registro</p><p className="metric-number mt-1 text-lg font-semibold">{first ? `${formatWeightKg(first.weight_kg)} kg` : "—"}</p></div></div></CardContent></Card>
      {latest ? <p className="text-xs text-muted-foreground">Último registro: {formatDate(latest.log_date)}. El cambio compara los registros de este período.</p> : null}
      <details className="rounded-xl border bg-card px-3 py-1.5 lg:px-4"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium marker:content-none"><span>Registros</span><span className="text-xs font-normal text-muted-foreground">Editar el último actualiza el peso actual.</span></summary><div className="divide-y border-t">{[...entries].reverse().map((entry) => <div key={entry.id} className="py-3">{editingDate === entry.log_date ? <div className="space-y-2"><label className="sr-only" htmlFor={`weight-${entry.id}`}>Peso del {formatDate(entry.log_date)}</label><div className="flex items-center gap-2"><input id={`weight-${entry.id}`} value={editingWeight} onChange={(event) => setEditingWeight(event.target.value)} inputMode="decimal" className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" aria-invalid={Boolean(error)} /><span className="text-sm text-muted-foreground">kg</span></div><div className="flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setEditingDate(null); setError(null); }}>Cancelar</Button><Button type="button" size="sm" disabled={pending} onClick={() => saveEdit(entry.log_date)}>{pending ? "Guardando…" : "Guardar"}</Button></div></div> : <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{formatDate(entry.log_date)}</p><p className="metric-number text-sm text-muted-foreground">{formatWeightKg(entry.weight_kg)} kg</p></div><div className="flex items-center gap-1"><Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setError(null); setEditingDate(entry.log_date); setEditingWeight(String(entry.weight_kg)); }}><Pencil aria-hidden className="size-3.5" />Editar</Button><Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { setError(null); setDeleteTarget(entry); }}><Trash2 aria-hidden className="size-3.5" /><span className="sr-only">Eliminar peso del {formatDate(entry.log_date)}</span></Button></div></div>}</div>)}</div></details>
    </>}
    <p aria-live="polite" className="text-sm text-destructive" role={error ? "alert" : undefined}>{error}</p>
    <Sheet open={recordOpen} onOpenChange={(open) => { if (!pending) setRecordOpen(open); }}><div className="flex items-center justify-between gap-3"><Dialog.Title className="text-base font-semibold">Registrar peso</Dialog.Title><Dialog.Close disabled={pending} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" /><span className="sr-only">Cerrar</span></Dialog.Close></div><div className="mt-5 space-y-4"><label className="block space-y-1"><span className="text-sm font-medium">Peso</span><div className="flex items-center gap-2"><input value={recordWeight} onChange={(event) => setRecordWeight(event.target.value)} inputMode="decimal" placeholder="64,8" className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50" autoFocus /><span className="text-sm text-muted-foreground">kg</span></div></label><label className="block min-w-0 space-y-1"><span className="text-sm font-medium">Fecha</span><DateField value={recordDate} onChange={(event) => setRecordDate(event.target.value)} /></label><div className="flex justify-end gap-2 pt-1"><Button type="button" variant="outline" disabled={pending} onClick={() => setRecordOpen(false)}>Cancelar</Button><Button type="button" disabled={pending} onClick={registerWeight}>{pending ? "Guardando…" : "Guardar"}</Button></div></div></Sheet>
    <Sheet open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !pending) setDeleteTarget(null); }}><div className="flex items-center justify-between gap-3"><Dialog.Title className="text-base font-semibold">¿Eliminar este registro?</Dialog.Title><Dialog.Close disabled={pending} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" /><span className="sr-only">Cerrar</span></Dialog.Close></div><Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">Se eliminará solamente el peso de {deleteTarget ? `${formatWeightKg(deleteTarget.weight_kg)} kg` : ""} del {deleteTarget ? formatDate(deleteTarget.log_date) : ""}. Las comidas y sesiones de ese día se conservan.</Dialog.Description><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button type="button" variant="destructive" disabled={pending} onClick={deleteEntry}>{pending ? "Eliminando…" : "Eliminar peso"}</Button></div></Sheet>
  </section>;
}
