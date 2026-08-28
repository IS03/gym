"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  QUICK_MEALS_INITIAL_LIMIT,
  type QuickMealCandidate,
} from "@/lib/nutrition/quick-meals-core";
import { quickAddMealAction } from "./actions";
import { ResponsiveDialog } from "./responsive-dialog";

const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

function macroText(meal: QuickMealCandidate): string {
  const macros = [`${numberFormatter.format(meal.finalCalories)} kcal`];
  if (meal.finalProteinG !== null) macros.push(`P ${numberFormatter.format(meal.finalProteinG)}`);
  if (meal.finalCarbsG !== null) macros.push(`C ${numberFormatter.format(meal.finalCarbsG)}`);
  if (meal.finalFatG !== null) macros.push(`G ${numberFormatter.format(meal.finalFatG)}`);
  return macros.join(" · ");
}

type QuickMealRowsProps = {
  meals: QuickMealCandidate[];
  pendingMealId: string | null;
  onQuickAdd: (meal: QuickMealCandidate) => void;
  framed?: boolean;
};

function QuickMealRows({ meals, pendingMealId, onQuickAdd, framed = false }: QuickMealRowsProps) {
  return (
    <ul className={cn("divide-y divide-border/70", framed && "rounded-xl border bg-card")}>
      {meals.map((meal) => {
        const pending = pendingMealId === meal.sourceMealId;
        return (
          <li key={meal.key} className="flex min-w-0 items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{meal.label}</p>
              <p className="truncate text-xs text-muted-foreground">{macroText(meal)}{meal.useCount > 1 ? ` · ${meal.useCount} veces` : ""}</p>
            </div>
            <Button type="button" size="icon" variant="outline" className="size-9 shrink-0" disabled={pending} aria-label={`Agregar ${meal.label}`} onClick={() => onQuickAdd(meal)}>
              {pending ? <span className="text-[11px]">…</span> : <Plus className="size-4" aria-hidden />}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function QuickMeals({ meals }: { meals: QuickMealCandidate[] }) {
  const [pendingMealId, setPendingMealId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedMealId, setAddedMealId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const pendingSourceMealId = useRef<string | null>(null);

  if (meals.length === 0) return null;

  const visibleMeals = meals.slice(0, QUICK_MEALS_INITIAL_LIMIT);
  const hasMore = meals.length > QUICK_MEALS_INITIAL_LIMIT;

  async function onQuickAdd(meal: QuickMealCandidate) {
    if (pendingSourceMealId.current) return;
    pendingSourceMealId.current = meal.sourceMealId;
    setPendingMealId(meal.sourceMealId);
    setError(null);
    setAddedMealId(null);
    try {
      const result = await quickAddMealAction(meal.sourceMealId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAddedMealId(meal.sourceMealId);
    } catch {
      setError("No pudimos agregar la comida. Intentá de nuevo.");
    } finally {
      setPendingMealId(null);
      pendingSourceMealId.current = null;
    }
  }

  return (
    <section aria-labelledby="quick-meals-heading">
      <details className="group/quick-meals overflow-hidden rounded-xl border bg-card shadow-sm">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <h2 id="quick-meals-heading" className="min-w-0 flex-1 text-sm font-semibold">Comidas rápidas</h2>
          <span className="shrink-0 text-xs text-muted-foreground">
            {visibleMeals.length} {visibleMeals.length === 1 ? "sugerida" : "sugeridas"}
          </span>
          <span className="shrink-0 text-muted-foreground transition-transform duration-200 group-open/quick-meals:rotate-180 motion-reduce:transition-none">
            <ChevronDown className="size-4" aria-hidden />
          </span>
        </summary>

        <div className="border-t border-border/70">
          <QuickMealRows meals={visibleMeals} pendingMealId={pendingMealId} onQuickAdd={onQuickAdd} />
          <div className="min-h-4 px-3 text-xs" aria-live="polite">
            {pendingMealId ? <p className="text-muted-foreground" role="status">Agregando…</p> : null}
            {addedMealId ? <p className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400" role="status"><Check className="size-3.5" aria-hidden /> Agregada</p> : null}
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          </div>
          {hasMore ? (
            <div className="px-1.5 pb-1.5">
              <Button type="button" variant="ghost" size="sm" className="px-2" onClick={() => setMoreOpen(true)}>Ver más</Button>
              <ResponsiveDialog open={moreOpen} onOpenChange={setMoreOpen} title="Comidas rápidas" description="Elegí una comida anterior para agregarla hoy." closeLabel="Cerrar comidas rápidas">
                <QuickMealRows meals={meals} pendingMealId={pendingMealId} onQuickAdd={onQuickAdd} framed />
              </ResponsiveDialog>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}
