"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Pencil, Plus, Ruler, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BODY_MEASUREMENT_FIELDS,
  type BodyMeasurement,
  type BodyMeasurementField,
} from "@/lib/body-measurement-types";
import { deleteBodyMeasurementAction, saveBodyMeasurementAction } from "@/app/(app)/train/body/actions";

const labels: Record<BodyMeasurementField, string> = {
  waist_cm: "Cintura", chest_cm: "Pecho", arm_cm: "Brazo", thigh_cm: "Muslo", hip_cm: "Cadera",
};

type MeasurementValues = Record<BodyMeasurementField, string>;
const emptyValues = (): MeasurementValues => ({ waist_cm: "", chest_cm: "", arm_cm: "", thigh_cm: "", hip_cm: "" });

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Cordoba" }).format(new Date(`${value}T12:00:00Z`)).replace(" de ", " ").replace(".", "");
}
function formatCm(value: number | null) { return value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)} cm`; }

function toValues(entry: BodyMeasurement | null): MeasurementValues {
  if (!entry) return emptyValues();
  return Object.fromEntries(BODY_MEASUREMENT_FIELDS.map((field) => [field, entry[field] == null ? "" : String(entry[field])])) as MeasurementValues;
}

function Sheet({ children, open, onOpenChange }: { children: ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-[82] bg-black/45 backdrop-blur-[2px]" /><Dialog.Viewport className="fixed inset-0 z-[83] flex items-end justify-center overflow-hidden sm:items-center sm:p-6"><Dialog.Popup className="max-h-[calc(100dvh-env(safe-area-inset-bottom))] w-full overflow-y-auto rounded-t-[1.5rem] bg-card p-5 text-card-foreground shadow-2xl outline-none sm:max-w-lg sm:rounded-2xl sm:border">{children}</Dialog.Popup></Dialog.Viewport></Dialog.Portal></Dialog.Root>;
}

function MeasurementChart({ entries, field }: { entries: BodyMeasurement[]; field: BodyMeasurementField }) {
  const points = entries.filter((entry) => entry[field] !== null);
  if (points.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay registros de {labels[field].toLowerCase()}.</p>;
  const width = 360; const height = 156; const left = 42; const right = 10; const top = 12; const bottom = 30;
  const values = points.map((entry) => entry[field] as number); const min = Math.min(...values); const max = Math.max(...values); const pad = Math.max((max - min) * .18, .5); const minY = Math.max(0, min - pad); const maxY = max + pad;
  const usableWidth = width - left - right; const usableHeight = height - top - bottom;
  const xFor = (index: number) => left + (points.length === 1 ? usableWidth / 2 : index / (points.length - 1) * usableWidth);
  const yFor = (value: number) => top + (maxY - value) / (maxY - minY) * usableHeight;
  const path = points.map((entry, index) => `${index ? "L" : "M"} ${xFor(index)} ${yFor(entry[field] as number)}`).join(" ");
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  return <div className="overflow-hidden" role="img" aria-label={`Evolución de ${labels[field].toLowerCase()}`}><svg className="h-auto w-full text-primary" viewBox={`0 0 ${width} ${height}`}><line x1={left} x2={width-right} y1={yFor(maxY)} y2={yFor(maxY)} stroke="currentColor" strokeOpacity=".14" /><line x1={left} x2={width-right} y1={yFor(minY)} y2={yFor(minY)} stroke="currentColor" strokeOpacity=".14" /><text x={left-6} y={yFor(maxY)+3} textAnchor="end" className="fill-muted-foreground text-[10px]">{formatCm(maxY)}</text><text x={left-6} y={yFor(minY)+3} textAnchor="end" className="fill-muted-foreground text-[10px]">{formatCm(minY)}</text>{points.length > 1 ? <path d={path} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /> : null}{points.map((entry,index)=><circle key={entry.id} cx={xFor(index)} cy={yFor(entry[field] as number)} r="3.75" className="fill-card stroke-primary" strokeWidth="2" />)}{labelIndexes.map((index)=><text key={index} x={xFor(index)} y={height-8} textAnchor="middle" className="fill-muted-foreground text-[10px]">{formatDate(points[index]!.measured_on).replace(/ \d{4}$/, "")}</text>)}</svg></div>;
}

export function BodyMeasurements({ initialEntries, today }: { initialEntries: BodyMeasurement[]; today: string }) {
  const [entries, setEntries] = useState(initialEntries);
  const [selectedField, setSelectedField] = useState<BodyMeasurementField>("waist_cm");
  const [editing, setEditing] = useState<BodyMeasurement | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<MeasurementValues>(emptyValues);
  const [deleteTarget, setDeleteTarget] = useState<BodyMeasurement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const latest = entries.at(-1) ?? null;
  const ordered = useMemo(() => [...entries].reverse(), [entries]);

  function openCreate() { setError(null); setEditing(null); setDate(today); setValues(emptyValues()); setFormOpen(true); }
  function openEdit(entry: BodyMeasurement) { setError(null); setEditing(entry); setDate(entry.measured_on); setValues(toValues(entry)); setFormOpen(true); }
  function save() { setError(null); startTransition(async () => {
    const result = await saveBodyMeasurementAction({ id: editing?.id, measuredOn: date, waistCm: values.waist_cm, chestCm: values.chest_cm, armCm: values.arm_cm, thighCm: values.thigh_cm, hipCm: values.hip_cm });
    if (!result.ok || !result.entry) { setError(result.ok ? "No se pudieron guardar las medidas." : result.error); return; }
    setEntries((current) => [...current.filter((entry) => entry.id !== result.entry!.id && entry.measured_on !== result.entry!.measured_on), result.entry!].sort((a,b) => a.measured_on.localeCompare(b.measured_on)));
    setFormOpen(false);
  }); }
  function remove() { if (!deleteTarget) return; setError(null); startTransition(async () => { const result = await deleteBodyMeasurementAction({ id: deleteTarget.id }); if (!result.ok) { setError(result.error); return; } setEntries((current) => current.filter((entry) => entry.id !== deleteTarget.id)); setDeleteTarget(null); }); }

  return <section className="space-y-3" aria-labelledby="body-measurements-title">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Ruler className="size-4 text-primary" aria-hidden /><div><h2 id="body-measurements-title" className="text-base font-semibold tracking-tight lg:text-lg">Medidas corporales</h2><p className="text-sm text-muted-foreground">Mediciones por fecha, en centímetros.</p></div></div><Button type="button" size="sm" onClick={openCreate}><Plus className="size-4" aria-hidden />Registrar medidas</Button></div>
    <Card className="surface-elevated"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Últimas medidas{latest ? ` · ${formatDate(latest.measured_on)}` : ""}</p><div className="mt-3 grid grid-cols-2 divide-x-0 divide-y border-t sm:grid-cols-5 sm:divide-x sm:divide-y-0">{BODY_MEASUREMENT_FIELDS.map((field) => <div key={field} className="flex items-center justify-between gap-2 px-0 py-2 text-sm sm:block sm:px-3 sm:py-0 sm:first:pl-0"><span className="text-muted-foreground">{labels[field]}</span><span className="metric-number font-semibold sm:mt-1 sm:block">{formatCm(latest?.[field] ?? null)}</span></div>)}</div></CardContent></Card>
    <section className="space-y-2" aria-labelledby="measurement-chart-title"><div className="flex flex-wrap items-center justify-between gap-2"><h3 id="measurement-chart-title" className="text-sm font-semibold">Evolución</h3><select value={selectedField} onChange={(event) => setSelectedField(event.target.value as BodyMeasurementField)} className="h-10 rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm" aria-label="Medida a visualizar">{BODY_MEASUREMENT_FIELDS.map((field) => <option key={field} value={field}>{labels[field]}</option>)}</select></div><Card className="surface-elevated"><CardContent className="pt-4"><MeasurementChart entries={entries} field={selectedField} /></CardContent></Card></section>
    <details className="rounded-xl border bg-card px-3 py-1.5 lg:px-4"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium marker:content-none"><span>Historial de medidas</span><span className="text-xs font-normal text-muted-foreground">{entries.length} {entries.length === 1 ? "registro" : "registros"}</span></summary><div className="divide-y border-t">{ordered.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Todavía no registraste medidas.</p> : ordered.map((entry) => <div key={entry.id} className="py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{formatDate(entry.measured_on)}</p><div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-5">{BODY_MEASUREMENT_FIELDS.filter((field) => entry[field] !== null).map((field) => <span key={field}>{labels[field]} <span className="metric-number">{formatCm(entry[field])}</span></span>)}</div></div><div className="flex items-center gap-1"><Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => openEdit(entry)}><Pencil className="size-3.5" aria-hidden />Editar</Button><Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => { setError(null); setDeleteTarget(entry); }}><Trash2 className="size-3.5" aria-hidden /><span className="sr-only">Eliminar medidas del {formatDate(entry.measured_on)}</span></Button></div></div></div>)}</div></details>
    <p aria-live="polite" className="text-sm text-destructive" role={error ? "alert" : undefined}>{error}</p>
    <Sheet open={formOpen} onOpenChange={(open) => { if (!pending) setFormOpen(open); }}><div className="flex items-center justify-between gap-3"><Dialog.Title className="text-base font-semibold">{editing ? "Editar medidas" : "Registrar medidas"}</Dialog.Title><Dialog.Close disabled={pending} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" /><span className="sr-only">Cerrar</span></Dialog.Close></div><div className="mt-5 space-y-4"><label className="block space-y-1"><span className="text-sm font-medium">Fecha</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label><div className="grid grid-cols-2 gap-3">{BODY_MEASUREMENT_FIELDS.map((field) => <label key={field} className="block space-y-1"><span className="text-sm font-medium">{labels[field]}</span><div className="flex items-center gap-2"><input value={values[field]} onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))} inputMode="decimal" placeholder="—" className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /><span className="text-xs text-muted-foreground">cm</span></div></label>)}</div><p className="text-xs text-muted-foreground">Completá al menos una medida.</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="button" disabled={pending} onClick={save}>{pending ? "Guardando…" : "Guardar"}</Button></div></div></Sheet>
    <Sheet open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !pending) setDeleteTarget(null); }}><div className="flex items-center justify-between gap-3"><Dialog.Title className="text-base font-semibold">¿Eliminar estas medidas?</Dialog.Title><Dialog.Close disabled={pending} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" /><span className="sr-only">Cerrar</span></Dialog.Close></div><Dialog.Description className="mt-2 text-sm text-muted-foreground">Se eliminará el conjunto de medidas del {deleteTarget ? formatDate(deleteTarget.measured_on) : ""}.</Dialog.Description><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button type="button" variant="destructive" disabled={pending} onClick={remove}>{pending ? "Eliminando…" : "Eliminar"}</Button></div></Sheet>
  </section>;
}
