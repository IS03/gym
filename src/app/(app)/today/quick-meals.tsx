"use client";

import Link from "next/link";
import { BookmarkPlus, Check, Plus, SlidersHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLocalizedDecimalDraft } from "@/lib/localized-decimal";
import type { SavedMealWithItems } from "@/lib/phase1/types";
import {
  defaultQuickAddTab,
  savedMealRegistrability,
  scaleSavedMealItem,
  sumSavedMealItems,
  type QuickAddTab,
  type SavedMealSummary,
} from "@/lib/nutrition/saved-meal-core";
import {
  QUICK_MEALS_INITIAL_LIMIT,
  type QuickMealCandidate,
} from "@/lib/nutrition/quick-meals-core";
import { cn } from "@/lib/utils";
import {
  addAdjustedSavedMealAction,
  getSavedMealAdjustmentAction,
  quickAddMealAction,
  quickAddSavedMealAction,
  saveSuggestedMealAction,
} from "./actions";
import { ResponsiveDialog } from "./responsive-dialog";

const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function shown(value: number | null, suffix = "") {
  return value === null ? "—" : `${numberFormatter.format(value)}${suffix}`;
}

function suggestedMacroText(meal: QuickMealCandidate) {
  return `${shown(meal.finalCalories, " kcal")} · P ${shown(meal.finalProteinG)} · C ${shown(meal.finalCarbsG)} · G ${shown(meal.finalFatG)}`;
}

function savedMacroText(meal: SavedMealSummary) {
  return `${shown(meal.calories, " kcal")} · P ${shown(meal.protein_g)} · C ${shown(meal.carbs_g)} · G ${shown(meal.fat_g)}`;
}

function SuggestedRows({ meals, pendingKey, savedSourceId, onAdd, onSave, framed = false }: {
  meals: QuickMealCandidate[];
  pendingKey: string | null;
  savedSourceId: string | null;
  onAdd: (meal: QuickMealCandidate) => void;
  onSave: (meal: QuickMealCandidate) => void;
  framed?: boolean;
}) {
  return <ul className={cn("divide-y divide-border/70", framed && "rounded-xl border bg-card")}>
    {meals.map((meal) => {
      const adding = pendingKey === `suggested-add:${meal.sourceMealId}`;
      const saving = pendingKey === `suggested-save:${meal.sourceMealId}`;
      return <li key={meal.key} className="flex min-w-0 items-center gap-1 px-3 py-2.5">
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{meal.label}</p><p className="truncate text-xs text-muted-foreground">{suggestedMacroText(meal)}{meal.useCount > 1 ? ` · ${meal.useCount} veces` : ""}</p></div>
        <Button type="button" size="icon" variant="ghost" className="size-9 shrink-0" disabled={pendingKey !== null} aria-label={`Guardar ${meal.label} como habitual`} onClick={() => onSave(meal)}>{saving ? <span className="text-[11px]">…</span> : savedSourceId === meal.sourceMealId ? <Check className="size-4 text-emerald-600" aria-hidden /> : <BookmarkPlus className="size-4" aria-hidden />}</Button>
        <Button type="button" size="icon" variant="outline" className="size-9 shrink-0" disabled={pendingKey !== null} aria-label={`Agregar ${meal.label}`} onClick={() => onAdd(meal)}>{adding ? <span className="text-[11px]">…</span> : <Plus className="size-4" aria-hidden />}</Button>
      </li>;
    })}
  </ul>;
}

function SavedRows({ meals, pendingKey, onAdd, onAdjust, framed = false }: {
  meals: SavedMealSummary[];
  pendingKey: string | null;
  onAdd: (meal: SavedMealSummary) => void;
  onAdjust: (meal: SavedMealSummary) => void;
  framed?: boolean;
}) {
  return <ul className={cn("divide-y divide-border/70", framed && "rounded-xl border bg-card")}>
    {meals.map((meal) => {
      const reason = savedMealRegistrability(meal);
      const adding = pendingKey === `saved-add:${meal.id}`;
      return <li key={meal.id} className="flex min-w-0 items-center gap-1 px-3 py-2.5">
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{meal.name}</p><p className="truncate text-xs text-muted-foreground">{savedMacroText(meal)}{meal.itemCount > 0 ? ` · ${meal.itemCount} ingredientes` : ""}</p>{reason ? <p className="mt-0.5 truncate text-xs font-medium text-amber-700 dark:text-amber-400">{reason}</p> : null}</div>
        {meal.itemCount > 0 ? <Button type="button" size="sm" variant="ghost" className="min-h-9 shrink-0 px-2" disabled={pendingKey !== null || reason !== null} onClick={() => onAdjust(meal)}><SlidersHorizontal className="size-3.5" aria-hidden />Ajustar</Button> : null}
        <Button type="button" size="icon" variant="outline" className="size-9 shrink-0" disabled={pendingKey !== null || reason !== null} aria-label={`Agregar ${meal.name}`} onClick={() => onAdd(meal)}>{adding ? <span className="text-[11px]">…</span> : <Plus className="size-4" aria-hidden />}</Button>
      </li>;
    })}
  </ul>;
}

function AdjustSavedMeal({ meal, pending, error, quantities, onQuantityChange, onAdd }: {
  meal: SavedMealWithItems;
  pending: boolean;
  error: string | null;
  quantities: Record<string, string>;
  onQuantityChange: (itemId: string, value: string) => void;
  onAdd: () => void;
}) {
  const scaled = meal.items.map((item) => {
    try { return scaleSavedMealItem(item, quantities[item.id] ?? ""); } catch { return null; }
  });
  const valid = scaled.every((item) => item !== null);
  const totals = valid ? sumSavedMealItems(scaled as NonNullable<(typeof scaled)[number]>[]) : null;
  const addable = totals?.calories !== null && totals?.calories !== undefined && totals.calories > 0;
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Estos cambios se aplican sólo a esta vez; la habitual no se modifica.</p>
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">{meal.items.map((item, index) => <li key={item.id} className="space-y-2 p-3"><div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">Base {shown(item.base_quantity)} {item.unit}</p></div><div className="flex items-center gap-2"><Label className="sr-only" htmlFor={`adjust-${item.id}`}>Cantidad de {item.label}</Label><Input id={`adjust-${item.id}`} inputMode="decimal" value={quantities[item.id] ?? ""} onChange={(event) => { if (isLocalizedDecimalDraft(event.target.value)) onQuantityChange(item.id, event.target.value); }} disabled={pending} /><span className="min-w-14 text-sm text-muted-foreground">{item.unit}</span></div>{scaled[index] ? <p className="metric-number text-xs text-muted-foreground">{shown(scaled[index]!.calories, " kcal")} · P {shown(scaled[index]!.proteinG)} · C {shown(scaled[index]!.carbsG)} · G {shown(scaled[index]!.fatG)}</p> : <p className="text-xs text-destructive">Ingresá una cantidad válida.</p>}</li>)}</ul>
    {totals ? <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4"><p className="text-xs text-muted-foreground">Vista previa</p><p className="metric-number mt-1 text-xl font-semibold">{shown(totals.calories, " kcal")}</p><p className="metric-number mt-1 text-sm text-muted-foreground">P {shown(totals.proteinG, " g")} · C {shown(totals.carbsG, " g")} · G {shown(totals.fatG, " g")}</p></div> : null}
    <div className="min-h-5" aria-live="polite">{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}</div>
    <Button className="h-11 w-full" type="button" disabled={pending || !valid || !addable} onClick={onAdd}>{pending ? "Agregando…" : "Agregar a hoy"}</Button>
  </div>;
}

export function QuickAddMeals({ date, suggestedMeals, initialSavedMeals }: {
  date: string;
  suggestedMeals: QuickMealCandidate[];
  initialSavedMeals: SavedMealSummary[];
}) {
  const router = useRouter();
  const [savedMeals, setSavedMeals] = useState(initialSavedMeals);
  const [tab, setTab] = useState<QuickAddTab>(() => defaultQuickAddTab(initialSavedMeals.length, suggestedMeals.length));
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedSourceId, setSavedSourceId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMeal, setAdjustMeal] = useState<SavedMealWithItems | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const visibleSaved = savedMeals.slice(0, QUICK_MEALS_INITIAL_LIMIT);
  const visibleSuggested = suggestedMeals.slice(0, QUICK_MEALS_INITIAL_LIMIT);
  const currentHasMore = tab === "saved" ? savedMeals.length > visibleSaved.length : suggestedMeals.length > visibleSuggested.length;

  async function run(key: string, task: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPendingKey(key); setError(null); setNotice(null);
    try {
      const result = await task();
      if (!result.ok) { setError(result.error ?? "No pudimos completar la acción."); return false; }
      setNotice(success); router.refresh(); return true;
    } catch { setError("No pudimos completar la acción. Intentá nuevamente."); return false; }
    finally { pendingRef.current = false; setPendingKey(null); }
  }

  async function addSaved(meal: SavedMealSummary) {
    const ok = await run(`saved-add:${meal.id}`, () => quickAddSavedMealAction({ savedMealId: meal.id, date }), "Agregada");
    if (ok) setMoreOpen(false);
  }

  async function addSuggested(meal: QuickMealCandidate) {
    const ok = await run(`suggested-add:${meal.sourceMealId}`, () => quickAddMealAction(meal.sourceMealId), "Agregada");
    if (ok) setMoreOpen(false);
  }

  async function saveSuggested(meal: QuickMealCandidate) {
    if (pendingRef.current) return;
    pendingRef.current = true; setPendingKey(`suggested-save:${meal.sourceMealId}`); setError(null); setNotice(null);
    try {
      const result = await saveSuggestedMealAction(meal.sourceMealId);
      if (!result.ok) { setError(result.error); return; }
      setSavedMeals((current) => [...current, result.meal].toSorted((left, right) => left.name.localeCompare(right.name, "es-AR")));
      setSavedSourceId(meal.sourceMealId); setNotice("Guardada como habitual."); setMoreOpen(false); router.refresh();
    } catch { setError("No pudimos guardar la comida habitual."); }
    finally { pendingRef.current = false; setPendingKey(null); }
  }

  async function openAdjust(meal: SavedMealSummary) {
    if (pendingRef.current) return;
    pendingRef.current = true; setPendingKey(`adjust-open:${meal.id}`); setError(null);
    try {
      const result = await getSavedMealAdjustmentAction(meal.id);
      if (!result.ok) { setError(result.error); return; }
      setAdjustMeal(result.meal);
      setQuantities(Object.fromEntries(result.meal.items.map((item) => [item.id, String(item.quantity).replace(".", ",")])));
      setMoreOpen(false);
      setAdjustOpen(true);
    } finally { pendingRef.current = false; setPendingKey(null); }
  }

  async function addAdjusted() {
    if (!adjustMeal) return;
    const ok = await run(`adjust-add:${adjustMeal.id}`, () => addAdjustedSavedMealAction({ savedMealId: adjustMeal.id, date, items: adjustMeal.items.map((item) => ({ itemId: item.id, quantity: quantities[item.id] ?? "" })) }), "Agregada con ajustes.");
    if (ok) setAdjustOpen(false);
  }

  const tabButton = (value: QuickAddTab, label: string) => <button id={`quick-add-tab-${value}`} type="button" role="tab" aria-controls={`quick-add-panel-${value}`} aria-selected={tab === value} className={`min-h-10 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${tab === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => { setTab(value); setError(null); setNotice(null); }}>{label}</button>;

  return <section className="overflow-hidden rounded-xl border bg-card shadow-sm" aria-labelledby="quick-add-heading">
    <div className="space-y-3 p-3"><h2 id="quick-add-heading" className="text-sm font-semibold">Agregar rápido</h2><div className="grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Tipo de agregado rápido">{tabButton("saved", "Habituales")}{tabButton("suggested", "Sugeridas")}</div></div>
    <div id={`quick-add-panel-${tab}`} role="tabpanel" aria-labelledby={`quick-add-tab-${tab}`} className="border-t border-border/70">
      {tab === "saved" ? (visibleSaved.length > 0 ? <SavedRows meals={visibleSaved} pendingKey={pendingKey} onAdd={(meal) => void addSaved(meal)} onAdjust={(meal) => void openAdjust(meal)} /> : <div className="p-4 text-sm"><p className="text-muted-foreground">Todavía no guardaste comidas habituales.</p><Link href="/settings/nutrition/meals" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}>Crear una</Link></div>) : (visibleSuggested.length > 0 ? <SuggestedRows meals={visibleSuggested} pendingKey={pendingKey} savedSourceId={savedSourceId} onAdd={(meal) => void addSuggested(meal)} onSave={(meal) => void saveSuggested(meal)} /> : <p className="p-4 text-sm text-muted-foreground">Todavía no hay suficientes comidas anteriores para sugerir.</p>)}
      <div className="min-h-5 px-3 text-xs" aria-live="polite">{notice ? <p className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400" role="status"><Check className="size-3.5" aria-hidden />{notice}</p> : null}{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}</div>
      {currentHasMore ? <div className="px-1.5 pb-1.5"><Button type="button" variant="ghost" size="sm" className="px-2" onClick={() => setMoreOpen(true)}>Ver más</Button></div> : null}
    </div>
    <ResponsiveDialog open={moreOpen} onOpenChange={setMoreOpen} title={tab === "saved" ? "Comidas habituales" : "Comidas sugeridas"} description={tab === "saved" ? "Elegí una comida guardada para agregarla hoy." : "Elegí una comida anterior para agregarla hoy."} closeLabel="Cerrar agregado rápido">{tab === "saved" ? <SavedRows meals={savedMeals} pendingKey={pendingKey} onAdd={(meal) => void addSaved(meal)} onAdjust={(meal) => void openAdjust(meal)} framed /> : <SuggestedRows meals={suggestedMeals} pendingKey={pendingKey} savedSourceId={savedSourceId} onAdd={(meal) => void addSuggested(meal)} onSave={(meal) => void saveSuggested(meal)} framed />}</ResponsiveDialog>
    <ResponsiveDialog open={adjustOpen} onOpenChange={(open) => { if (!pendingRef.current) setAdjustOpen(open); }} title={adjustMeal?.name ?? "Ajustar comida"} description="Cambiá cantidades sólo para esta vez." closeLabel="Cerrar ajuste">{adjustMeal ? <AdjustSavedMeal meal={adjustMeal} pending={pendingKey === `adjust-add:${adjustMeal.id}`} error={error} quantities={quantities} onQuantityChange={(itemId, value) => setQuantities((current) => ({ ...current, [itemId]: value }))} onAdd={() => void addAdjusted()} /> : null}</ResponsiveDialog>
  </section>;
}
