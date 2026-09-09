"use client";

import { ChevronRight, Plus, Scale, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Food } from "@/lib/phase1/types";
import type { QuickMealCandidate } from "@/lib/nutrition/quick-meals-core";
import type { SavedMealSummary } from "@/lib/nutrition/saved-meal-core";
import { CreateMealForm } from "./create-meal-form";
import { FoodMealForm } from "./food-meal-form";
import { QuickAddMeals } from "./quick-meals";
import { ResponsiveDialog } from "./responsive-dialog";

type AddMode = "menu" | "manual" | "quick" | "food";

const modeCopy: Record<AddMode, { title: string; description: string }> = {
  menu: { title: "Agregar", description: "Elegí cómo querés cargar tu comida." },
  manual: { title: "Nueva comida", description: "Registrá lo que comiste y los datos que conozcas." },
  quick: { title: "Agregar rápido", description: "Elegí una comida habitual o una sugerencia para agregar hoy." },
  food: { title: "Alimento por cantidad", description: "Elegí un alimento y calculá la porción que vas a registrar." },
};

function AddChoice({ icon: Icon, title, description, onClick }: {
  icon: typeof Plus;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-20 w-full items-center gap-3 rounded-xl border bg-background/45 p-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

export function MealComposer({ date, quickMeals, foods, savedMeals }: { date: string; quickMeals: QuickMealCandidate[]; foods: Food[]; savedMeals: SavedMealSummary[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>("menu");
  const copy = modeCopy[mode];

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setMode("menu");
  }

  return (
    <>
      <Button
        type="button"
        className="h-14 w-full rounded-xl text-base"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-5" aria-hidden /> Agregar
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={copy.title}
        description={copy.description}
        closeLabel="Cerrar agregado de comida"
        backLabel="Volver a formas de carga"
        onBack={mode === "menu" ? undefined : () => setMode("menu")}
        footerSlot={mode === "manual" || mode === "food"}
      >
        {mode === "menu" ? (
          <div className="space-y-3 pb-4">
            <AddChoice icon={Plus} title="Nueva comida" description="Cargá título, calorías y macros manualmente." onClick={() => setMode("manual")} />
            <AddChoice icon={Zap} title="Agregar rápido" description="Usá una comida habitual o una sugerencia." onClick={() => setMode("quick")} />
            <AddChoice icon={Scale} title="Alimento por cantidad" description="Elegí un alimento, indicá la cantidad y calculá la porción." onClick={() => setMode("food")} />
          </div>
        ) : mode === "manual" ? (
          <CreateMealForm date={date} onSuccess={() => handleOpenChange(false)} />
        ) : mode === "quick" ? (
          <QuickAddMeals date={date} suggestedMeals={quickMeals} initialSavedMeals={savedMeals} embedded />
        ) : (
          <FoodMealForm date={date} foods={foods} onSuccess={() => handleOpenChange(false)} />
        )}
      </ResponsiveDialog>
    </>
  );
}
