"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Food } from "@/lib/phase1/types";
import { isLocalizedDecimalDraft } from "@/lib/localized-decimal";
import { filterFoodCatalog } from "@/lib/nutrition/food-catalog-core";
import {
  foodRegistrability,
  formatFoodQuantity,
  scaleFoodNutrition,
  type ScaledFoodNutrition,
} from "@/lib/nutrition/food-quantity";
import { addFoodToDayAction } from "./actions";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function shown(value: number | null, suffix = "") {
  return value === null ? "—" : `${numberFormatter.format(value)}${suffix}`;
}

function foodSummary(food: Food) {
  return `${formatFoodQuantity(food.serving_quantity, food.serving_unit)} · ${shown(food.calories, " kcal")} · P ${shown(food.protein_g, " g")} · C ${shown(food.carbs_g, " g")} · G ${shown(food.fat_g, " g")}`;
}

function previewFor(food: Food | null, quantity: string) {
  if (!food || !quantity.trim()) return null;
  try {
    return scaleFoodNutrition(food, quantity);
  } catch {
    return null;
  }
}

function Preview({ value }: { value: ScaledFoodNutrition }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
      <p className="text-xs font-medium text-muted-foreground">Vista previa</p>
      <p className="metric-number mt-1 text-xl font-semibold">{value.calories} kcal</p>
      <p className="metric-number mt-1 text-sm text-muted-foreground">
        P {shown(value.proteinG, " g")} · C {shown(value.carbsG, " g")} · G {shown(value.fatG, " g")}
      </p>
    </div>
  );
}

export function FoodMealForm({
  date,
  foods,
  onSuccess,
}: {
  date: string;
  foods: Food[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleFoods = useMemo(
    () => filterFoodCatalog(foods, "active", search),
    [foods, search],
  );
  const selected = foods.find((food) => food.id === selectedId) ?? null;
  const preview = previewFor(selected, quantity);

  function choose(food: Food) {
    if (foodRegistrability(food)) return;
    setSelectedId(food.id);
    setQuantity(String(food.serving_quantity).replace(".", ","));
    setError(null);
  }

  async function add() {
    if (!selected || !quantity.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await addFoodToDayAction({
        foodId: selected.id,
        quantity,
        date,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelectedId(null);
      setQuantity("");
      onSuccess?.();
      router.refresh();
    } catch {
      setError("No pudimos agregar el alimento.");
    } finally {
      setPending(false);
    }
  }

  if (foods.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-5 text-center">
        <p className="font-medium">Todavía no tenés alimentos activos.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Creá uno o reactivalo para registrarlo por cantidad.
        </p>
        <Link href="/settings/nutrition/foods" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>Ir a Alimentos habituales</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="food-meal-search">Buscar alimento</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="food-meal-search" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Ej: Pechuga" disabled={pending} />
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto overscroll-contain rounded-xl border" aria-label="Alimentos activos">
        {visibleFoods.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No encontramos alimentos con esa búsqueda.</p>
        ) : (
          <ul className="divide-y">
            {visibleFoods.map((food) => {
              const unavailable = foodRegistrability(food);
              const isSelected = food.id === selectedId;
              return (
                <li key={food.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    disabled={pending || unavailable !== null}
                    onClick={() => choose(food)}
                    className="min-h-16 w-full px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted/20"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{food.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{foodSummary(food)}</span>
                        {unavailable ? <span className="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-400">{unavailable}</span> : null}
                      </span>
                      <span className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`} aria-hidden>{isSelected ? "✓" : ""}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected ? (
        <div className="space-y-3 border-t pt-4">
          <div className="space-y-1">
            <Label htmlFor="food-meal-quantity">Cantidad</Label>
            <div className="flex items-center gap-2">
              <Input id="food-meal-quantity" type="text" inputMode="decimal" value={quantity} onChange={(event) => { if (isLocalizedDecimalDraft(event.target.value)) setQuantity(event.target.value); }} pattern="[0-9]*[.,]?[0-9]*" disabled={pending} />
              <span className="min-w-16 text-sm font-medium text-muted-foreground">{selected.serving_unit}</span>
            </div>
            <p className="text-xs text-muted-foreground">Misma unidad que la porción base: {formatFoodQuantity(selected.serving_quantity, selected.serving_unit)}.</p>
          </div>
          {preview ? <Preview value={preview} /> : null}
        </div>
      ) : null}

      <div className="min-h-5" aria-live="polite">
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </div>
      <Button type="button" className="h-11 w-full" disabled={!selected || !preview || pending} onClick={() => void add()}>
        {pending ? "Agregando…" : "Agregar a hoy"}
      </Button>
    </div>
  );
}
