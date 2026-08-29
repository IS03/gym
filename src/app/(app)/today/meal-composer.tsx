"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuickMealCandidate } from "@/lib/nutrition/quick-meals-core";
import { CreateMealForm } from "./create-meal-form";
import { QuickMeals } from "./quick-meals";
import { ResponsiveDialog } from "./responsive-dialog";

export function MealComposer({ date, quickMeals }: { date: string; quickMeals: QuickMealCandidate[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <Button type="button" className="h-11 w-full" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> Agregar comida
      </Button>
      <QuickMeals meals={quickMeals} />
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Nueva comida"
        description="Registrá lo que comiste y los datos que conozcas."
        closeLabel="Cerrar nueva comida"
      >
        <CreateMealForm date={date} onSuccess={() => setOpen(false)} />
      </ResponsiveDialog>
    </div>
  );
}
