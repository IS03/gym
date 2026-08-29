"use client";

import { Dialog } from "@base-ui/react/dialog";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MealEntry } from "@/lib/phase1/types";
import { softDeleteMealAction, updateMealAction } from "./actions";
import { ResponsiveDialog } from "./responsive-dialog";

const gramFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

function formatKcal(value: number | null) {
  return typeof value === "number" ? `${value} kcal` : "—";
}

function formatGrams(value: number | null) {
  return typeof value === "number" ? `${gramFormatter.format(value)} g` : "—";
}

export type TodayMeal = Pick<
  MealEntry,
  | "id"
  | "updated_at"
  | "title"
  | "description"
  | "final_calories"
  | "final_protein_g"
  | "final_carbs_g"
  | "final_fat_g"
>;

function formatMealMacros(meal: TodayMeal) {
  return [
    `P ${formatGrams(meal.final_protein_g)}`,
    `C ${formatGrams(meal.final_carbs_g)}`,
    `G ${formatGrams(meal.final_fat_g)}`,
  ].join(" · ");
}

function MealEditorForm({ meal, date, onSaved, onRequestDelete }: { meal: TodayMeal; date: string; onSaved: () => void; onRequestDelete: (meal: TodayMeal) => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await updateMealAction(new FormData(form));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
      router.refresh();
    } catch {
      setError("No pudimos guardar los cambios. Intentá nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="min-w-0 space-y-4" onSubmit={save}>
      <input type="hidden" name="id" value={meal.id} />
      <div className="min-w-0 space-y-1"><Label htmlFor="edit-meal-date">Fecha</Label><DateField id="edit-meal-date" name="date" required defaultValue={date} disabled={saving} /></div>
      <div className="space-y-1"><Label htmlFor="edit-meal-title">Título</Label><Input id="edit-meal-title" name="title" defaultValue={meal.title ?? ""} disabled={saving} /></div>
      <div className="space-y-1"><Label htmlFor="edit-meal-calories">Calorías</Label><Input id="edit-meal-calories" name="final_calories" type="number" min={1} step={1} required inputMode="numeric" defaultValue={meal.final_calories === null ? "" : String(meal.final_calories)} disabled={saving} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 space-y-1"><Label htmlFor="edit-meal-protein">Proteína (g)</Label><Input id="edit-meal-protein" name="final_protein_g" type="text" min={0} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" defaultValue={meal.final_protein_g === null ? "" : String(meal.final_protein_g)} disabled={saving} /></div>
        <div className="min-w-0 space-y-1"><Label htmlFor="edit-meal-carbs">Carbohidratos (g)</Label><Input id="edit-meal-carbs" name="final_carbs_g" type="text" min={0} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" defaultValue={meal.final_carbs_g === null ? "" : String(meal.final_carbs_g)} disabled={saving} /></div>
      </div>
      <div className="space-y-1"><Label htmlFor="edit-meal-fat">Grasas (g)</Label><Input id="edit-meal-fat" name="final_fat_g" type="text" min={0} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" defaultValue={meal.final_fat_g === null ? "" : String(meal.final_fat_g)} disabled={saving} /></div>
      <div className="space-y-1"><Label htmlFor="edit-meal-description">Descripción</Label><textarea id="edit-meal-description" name="description" defaultValue={meal.description ?? ""} disabled={saving} rows={3} className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-[color,border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30" /></div>
      <div className="min-h-5" aria-live="polite">{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}</div>
      <Button className="h-11 w-full" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
      <details className="group border-t pt-3">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">Más opciones<MoreHorizontal className="size-4" aria-hidden /></summary>
        <div className="pt-2"><Button type="button" size="sm" variant="ghost" className="min-h-10 w-full justify-start px-2 text-destructive hover:text-destructive" disabled={saving} onClick={() => onRequestDelete(meal)}><Trash2 className="size-3.5" aria-hidden /> Eliminar comida</Button></div>
      </details>
    </form>
  );
}

export function MealList({ meals, date }: { meals: TodayMeal[]; date: string }) {
  const router = useRouter();
  const [editingMeal, setEditingMeal] = useState<TodayMeal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TodayMeal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function deleteMeal() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const formData = new FormData();
      formData.set("id", deleteTarget.id);
      const result = await softDeleteMealAction(formData);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setDeleteTarget(null);
      setEditingMeal(null);
      setNotice("Comida eliminada.");
      router.refresh();
    } catch {
      setDeleteError("No pudimos eliminar la comida. Intentá nuevamente.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="meals-heading">
      <div className="flex items-center justify-between gap-3"><h2 id="meals-heading" className="text-lg font-semibold tracking-tight">Comidas</h2><p className="text-xs text-muted-foreground">{meals.length === 1 ? "1 registro" : `${meals.length} registros`}</p></div>
      <div className="min-h-5" aria-live="polite">{notice ? <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">{notice}</p> : null}</div>
      {meals.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no cargaste comidas.</p> : (
        <ul className="space-y-2">
          {meals.map((meal) => <li key={meal.id} className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{meal.title || "Comida"}</h3><p className="mt-1 text-sm font-medium">{formatKcal(meal.final_calories)}</p><p className="metric-number mt-0.5 text-xs text-muted-foreground">{formatMealMacros(meal)}</p>{meal.description ? <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{meal.description}</p> : null}</div><Button type="button" variant="ghost" size="sm" className="min-h-10 shrink-0 px-2" onClick={() => { setNotice(null); setEditingMeal(meal); }}><Pencil className="size-3.5" aria-hidden /> Editar</Button></div>
          </li>)}
        </ul>
      )}
      <ResponsiveDialog open={editingMeal !== null} onOpenChange={(open) => { if (!open && !deleting) setEditingMeal(null); }} title="Editar comida" description="Actualizá los datos que quieras corregir." closeLabel="Cerrar edición de comida">
        {editingMeal ? <MealEditorForm key={`${editingMeal.id}-${editingMeal.updated_at}`} meal={editingMeal} date={date} onSaved={() => { setEditingMeal(null); setNotice("Cambios guardados."); }} onRequestDelete={(meal) => { setDeleteError(null); setDeleteTarget(meal); }} /> : null}
      </ResponsiveDialog>
      <Dialog.Root open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !deleting) { setDeleteError(null); setDeleteTarget(null); } }}>
        <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" /><Dialog.Viewport className="fixed inset-0 z-[91] flex items-end justify-center overflow-hidden sm:items-center sm:p-6"><Dialog.Popup className="w-full rounded-t-[1.5rem] bg-card p-5 text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none sm:max-w-sm sm:rounded-2xl sm:border sm:data-[ending-style]:translate-y-2 sm:data-[starting-style]:translate-y-2">
          <Dialog.Title className="text-base font-semibold">{deleteTarget?.title ? `¿Eliminar “${deleteTarget.title}”?` : "¿Eliminar esta comida?"}</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">Esta comida dejará de contar en el día y ya no aparecerá en la lista.</Dialog.Description><div className="min-h-5 pt-3" aria-live="polite">{deleteError ? <p className="text-sm text-destructive" role="alert">{deleteError}</p> : null}</div><div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button type="button" variant="destructive" disabled={deleting} onClick={() => void deleteMeal()}>{deleting ? "Eliminando…" : "Eliminar"}</Button></div>
        </Dialog.Popup></Dialog.Viewport></Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
