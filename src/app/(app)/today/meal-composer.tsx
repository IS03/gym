"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Food } from "@/lib/phase1/types";
import type { QuickMealCandidate } from "@/lib/nutrition/quick-meals-core";
import type { SavedMealSummary } from "@/lib/nutrition/saved-meal-core";
import { CreateMealForm } from "./create-meal-form";
import { FoodMealForm } from "./food-meal-form";
import { QuickAddMeals } from "./quick-meals";
import { ResponsiveDialog } from "./responsive-dialog";

export function MealComposer({ date, quickMeals, foods, savedMeals }: { date: string; quickMeals: QuickMealCandidate[]; foods: Food[]; savedMeals: SavedMealSummary[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "food">("manual");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setMode("manual");
  }

  return (
    <div className="space-y-3">
      <Button type="button" className="h-11 w-full" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> Agregar comida
      </Button>
      <QuickAddMeals date={date} suggestedMeals={quickMeals} initialSavedMeals={savedMeals} />
      <ResponsiveDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Nueva comida"
        description="Registrá lo que comiste y los datos que conozcas."
        closeLabel="Cerrar nueva comida"
      >
        <div className="mb-4 grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Forma de registro">
          <button type="button" role="tab" aria-selected={mode === "manual"} className={`min-h-10 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${mode === "manual" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setMode("manual")}>Manual</button>
          <button type="button" role="tab" aria-selected={mode === "food"} className={`min-h-10 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${mode === "food" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setMode("food")}>Desde alimento</button>
        </div>
        {mode === "manual" ? (
          <CreateMealForm date={date} onSuccess={() => handleOpenChange(false)} />
        ) : (
          <FoodMealForm date={date} foods={foods} onSuccess={() => handleOpenChange(false)} />
        )}
      </ResponsiveDialog>
    </div>
  );
}
