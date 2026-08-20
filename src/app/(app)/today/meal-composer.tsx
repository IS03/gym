"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateMealForm } from "./create-meal-form";
import { ResponsiveDialog } from "./responsive-dialog";

export function MealComposer({ date }: { date: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" className="h-11 w-full" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> Agregar comida
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Nueva comida"
        description="Registrá los datos que conozcas. La fecha usa el día lógico de Córdoba."
        closeLabel="Cerrar nueva comida"
      >
        <CreateMealForm date={date} onSuccess={() => setOpen(false)} />
      </ResponsiveDialog>
    </>
  );
}
