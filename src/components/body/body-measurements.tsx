"use client";

import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";

import { deleteBodyMeasurementAction, saveBodyMeasurementAction } from "@/app/(app)/train/body/actions";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import {
  BODY_MEASUREMENT_FIELDS,
  BODY_MEASUREMENT_LABELS,
  EDITABLE_BODY_MEASUREMENT_FIELDS,
  type BodyMeasurement,
  type BodyMeasurementField,
} from "@/lib/body-measurement-types";
import { cn } from "@/lib/utils";

const labels = BODY_MEASUREMENT_LABELS;
const inputNames: Record<BodyMeasurementField, string> = {
  waist_cm: "waistCm", abdomen_cm: "abdomenCm", chest_cm: "chestCm", hip_cm: "hipCm",
  arm_cm: "armCm", arm_right_cm: "armRightCm", arm_left_cm: "armLeftCm",
  thigh_cm: "thighCm", thigh_right_cm: "thighRightCm", thigh_left_cm: "thighLeftCm",
  calf_right_cm: "calfRightCm", calf_left_cm: "calfLeftCm",
};
type Values = Record<BodyMeasurementField, string>;
const emptyValues = () => Object.fromEntries(BODY_MEASUREMENT_FIELDS.map((field) => [field, ""])) as Values;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Cordoba" })
    .format(new Date(`${value}T12:00:00Z`)).replaceAll(" de ", " ").replace(".", "");
}

function toValues(entry: BodyMeasurement | null): Values {
  return entry
    ? Object.fromEntries(BODY_MEASUREMENT_FIELDS.map((field) => [field, entry[field] == null ? "" : String(entry[field])])) as Values
    : emptyValues();
}

function Sheet({ children, open, onOpenChange }: { children: ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-[82] bg-black/45 backdrop-blur-[2px]" /><Dialog.Viewport className="fixed inset-0 z-[83] flex items-end justify-center overflow-hidden sm:items-center sm:p-6"><Dialog.Popup className="max-h-[calc(100dvh-env(safe-area-inset-bottom))] w-full overflow-y-auto rounded-t-[1.5rem] bg-card p-5 text-card-foreground shadow-2xl outline-none sm:max-w-2xl sm:rounded-2xl sm:border">{children}</Dialog.Popup></Dialog.Viewport></Dialog.Portal></Dialog.Root>;
}

function FloatingField({ label, unit, children, className }: { label: string; unit?: string; children: ReactNode; className?: string }) {
  return <label className={cn("relative flex min-h-12 items-center rounded-xl border border-input bg-card px-3 transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/35", className)}>
    <span className="absolute -top-2 left-2 max-w-[calc(100%-1rem)] truncate bg-card px-1 text-[11px] font-medium text-muted-foreground">{label}</span>
    <span className="min-w-0 flex-1">{children}</span>
    {unit ? <span className="ml-1 text-xs text-muted-foreground">{unit}</span> : null}
  </label>;
}

export function BodyMeasurements({ entries, today, onEntriesChange }: { entries: BodyMeasurement[]; today: string; onEntriesChange: (entries: BodyMeasurement[]) => void }) {
  const [editing, setEditing] = useState<BodyMeasurement | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Values>(emptyValues);
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BodyMeasurement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ordered = useMemo(() => [...entries].reverse(), [entries]);

  const openCreate = () => { setError(null); setEditing(null); setDate(today); setValues(emptyValues()); setCondition(""); setNotes(""); setFormOpen(true); };
  const openEdit = (entry: BodyMeasurement) => { setError(null); setEditing(entry); setDate(entry.measured_on); setValues(toValues(entry)); setCondition(entry.condition ?? ""); setNotes(entry.notes ?? ""); setFormOpen(true); };
  const save = () => startTransition(async () => {
    const payload: Record<string, string | undefined> = { id: editing?.id, measuredOn: date, condition, notes };
    for(const field of BODY_MEASUREMENT_FIELDS) payload[inputNames[field]] = values[field];
    const result = await saveBodyMeasurementAction(payload as Parameters<typeof saveBodyMeasurementAction>[0]);
    if (!result.ok || !result.entry) { setError(result.ok ? "No se pudieron guardar las medidas." : result.error); return; }
    onEntriesChange([...entries.filter((entry) => entry.id !== result.entry!.id && entry.measured_on !== result.entry!.measured_on), result.entry!].sort((a, b) => a.measured_on.localeCompare(b.measured_on)));
    setFormOpen(false);
  });
  const remove = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteBodyMeasurementAction({ id: deleteTarget.id });
      if (!result.ok) { setError(result.error); return; }
      onEntriesChange(entries.filter((entry) => entry.id !== deleteTarget.id));
      setDeleteTarget(null);
    });
  };

  return <section className="space-y-3" aria-labelledby="measurement-records-title">
    <div className="flex items-center justify-between gap-3"><div><h3 id="measurement-records-title" className="font-semibold">Medidas corporales</h3><p className="text-xs text-muted-foreground">{entries.length} {entries.length === 1 ? "registro por fecha" : "registros por fecha"}</p></div><Button type="button" size="sm" onClick={openCreate}><Plus className="size-4" aria-hidden />Registrar</Button></div>
    <details className="rounded-xl border bg-card px-3 py-1.5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium marker:content-none"><span>Ver historial de medidas</span><span className="text-xs font-normal text-muted-foreground">Auditar</span></summary><div className="divide-y border-t">{ordered.map((entry) => <div key={entry.id} className="space-y-2 py-3">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{formatDate(entry.measured_on)}</p>{entry.quality_status === "suspect" ? <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600"><AlertTriangle className="size-3.5" aria-hidden />Excluida del análisis · Revisar medición</p> : null}</div><div className="flex"><Button size="sm" variant="ghost" onClick={() => openEdit(entry)}><Pencil className="size-3.5" aria-hidden />Editar</Button>{entry.import_run_id?null:<Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(entry)}><Trash2 className="size-3.5" aria-hidden /><span className="sr-only">Eliminar</span></Button>}</div></div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">{BODY_MEASUREMENT_FIELDS.filter((field) => entry[field] != null).map((field) => <span key={field}>{labels[field]} <b className="font-medium text-foreground">{new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(entry[field]!)} cm</b></span>)}</div>
      {entry.condition ? <p className="text-xs text-muted-foreground">Condición: {entry.condition}</p> : null}{entry.notes ? <p className="text-xs text-muted-foreground">Notas: {entry.notes}</p> : null}{entry.quality_note ? <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{entry.quality_note}</p> : null}{entry.import_run_id || entry.legacy_import_source ? <p className="text-[11px] text-muted-foreground">Dato histórico importado. Su procedencia se conserva al editar.</p> : null}
    </div>)}{ordered.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Todavía no registraste medidas.</p> : null}</div></details>
    {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    <Sheet open={formOpen} onOpenChange={(open) => { if (!pending) setFormOpen(open); }}>
      <div className="flex items-center justify-between"><Dialog.Title className="font-semibold">{editing ? "Editar medidas" : "Registrar medidas"}</Dialog.Title><Dialog.Close className="flex size-10 items-center justify-center rounded-full"><X className="size-4" /><span className="sr-only">Cerrar</span></Dialog.Close></div>
      <div className="mt-5 space-y-4">
        <FloatingField label="Fecha"><DateField value={date} onChange={(event) => setDate(event.target.value)} className="h-10 border-0 px-0 focus-within:ring-0" /></FloatingField>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">{EDITABLE_BODY_MEASUREMENT_FIELDS.map((field) => <FloatingField key={field} label={labels[field]} unit="cm"><input value={values[field]} onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))} inputMode="decimal" placeholder="—" className="h-10 w-full min-w-0 bg-transparent text-base outline-none" /></FloatingField>)}</div>
        <FloatingField label="Condición"><input value={condition} onChange={(event) => setCondition(event.target.value)} className="h-10 w-full bg-transparent text-base outline-none" placeholder="Opcional" /></FloatingField>
        <FloatingField label="Notas" className="items-start py-2"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-16 w-full resize-none bg-transparent py-1 text-sm outline-none" placeholder="Opcional" /></FloatingField>
        <p className="text-xs text-muted-foreground">Completá una o varias medidas. Los lados no se promedian; derecha e izquierda se guardan por separado.</p>
        <Button type="button" className="h-11 w-full" disabled={pending} onClick={save}>{pending ? "Guardando…" : "Guardar"}</Button>
      </div>
    </Sheet>
    <Sheet open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !pending) setDeleteTarget(null); }}><Dialog.Title className="font-semibold">¿Eliminar estas medidas?</Dialog.Title><Dialog.Description className="mt-2 text-sm text-muted-foreground">Esta acción sólo está disponible para registros manuales.</Dialog.Description><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button variant="destructive" disabled={pending} onClick={remove}>Eliminar</Button></div></Sheet>
  </section>;
}
