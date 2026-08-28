"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";

type Routine = { id: string; nombre: string };

export function CalendarFilters({ month, routineId, routines }: { month: `${number}-${number}`; routineId: string; routines: Routine[] }) {
  const [open, setOpen] = useState(false);
  const activeName = routines.find((routine) => routine.id === routineId)?.nombre;
  return <>
    <Button type="button" variant="outline" className="h-10" onClick={() => setOpen(true)}>
      {activeName ? `Filtros · ${activeName}` : "Filtros"}
    </Button>
    <ResponsiveDialog open={open} onOpenChange={setOpen} title="Filtros" description="Elegí una rutina o saltá directamente a otro mes." closeLabel="Cerrar filtros del calendario">
      <form action="/train/calendar" className="space-y-4">
        <div className="space-y-1"><label htmlFor="calendar-month" className="text-sm font-medium">Ir a mes</label><input id="calendar-month" name="month" type="month" defaultValue={month} className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm" /></div>
        <div className="space-y-1"><label htmlFor="calendar-routine" className="text-sm font-medium">Rutina</label><select id="calendar-routine" name="routine_id" defaultValue={routineId} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="">Todas las rutinas</option>{routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.nombre}</option>)}</select></div>
        <Button className="h-11 w-full" type="submit">Aplicar</Button>
      </form>
    </ResponsiveDialog>
  </>;
}
