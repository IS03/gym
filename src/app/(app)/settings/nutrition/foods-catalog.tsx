"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  Archive,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Food, NutritionPrecision } from "@/lib/phase1/types";
import {
  filterFoodCatalog,
  type FoodCatalogFilter,
} from "@/lib/nutrition/food-catalog-core";
import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import {
  deleteFoodAction,
  saveFoodAction,
  setFoodActiveAction,
} from "./actions";

type Values = {
  name: string;
  description: string;
  servingQuantity: string;
  servingUnit: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  sourceNote: string;
  precisionLevel: NutritionPrecision | "";
};

const empty = (): Values => ({
  name: "",
  description: "",
  servingQuantity: "1",
  servingUnit: "unidad",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  sourceNote: "",
  precisionLevel: "",
});

const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function shown(value: number | null, suffix = "") {
  return value === null ? "—" : `${numberFormatter.format(value)}${suffix}`;
}

function valuesOf(food: Food): Values {
  return {
    name: food.name,
    description: food.description ?? "",
    servingQuantity: String(food.serving_quantity),
    servingUnit: food.serving_unit,
    calories: food.calories == null ? "" : String(food.calories),
    proteinG: food.protein_g == null ? "" : String(food.protein_g),
    carbsG: food.carbs_g == null ? "" : String(food.carbs_g),
    fatG: food.fat_g == null ? "" : String(food.fat_g),
    sourceNote: food.source_note ?? "",
    precisionLevel: food.precision_level ?? "",
  };
}

function FoodEditor({
  values,
  pending,
  message,
  onChange,
  onSave,
}: {
  values: Values;
  pending: boolean;
  message: string | null;
  onChange: (key: keyof Values, value: string) => void;
  onSave: () => void;
}) {
  const nutritionFields = [
    ["calories", "Calorías"],
    ["proteinG", "Proteína (g)"],
    ["carbsG", "Carbohidratos (g)"],
    ["fatG", "Grasas (g)"],
  ] as const;

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="space-y-3">
        <div className="space-y-1"><Label htmlFor="food-name">Nombre</Label><Input id="food-name" value={values.name} onChange={(event) => onChange("name", event.target.value)} disabled={pending} /></div>
        <div className="space-y-1"><Label htmlFor="food-description">Descripción</Label><textarea id="food-description" rows={2} value={values.description} onChange={(event) => onChange("description", event.target.value)} disabled={pending} className="min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-[color,border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm dark:bg-input/30" /></div>
      </div>

      <div className="space-y-2 border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Porción base</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="food-serving-quantity">Cantidad</Label><Input id="food-serving-quantity" inputMode="decimal" value={values.servingQuantity} onChange={(event) => onChange("servingQuantity", event.target.value)} disabled={pending} /></div>
          <div className="space-y-1"><Label htmlFor="food-serving-unit">Unidad</Label><Input id="food-serving-unit" value={values.servingUnit} onChange={(event) => onChange("servingUnit", event.target.value)} placeholder="g, ml, unidad" disabled={pending} /></div>
        </div>
      </div>

      <div className="space-y-2 border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Nutrición de esa porción</p>
        <div className="grid grid-cols-2 gap-3">
          {nutritionFields.map(([key, label]) => (
            <div key={key} className="space-y-1"><Label htmlFor={`food-${key}`}>{label}</Label><Input id={`food-${key}`} inputMode="decimal" value={values[key]} onChange={(event) => onChange(key, event.target.value)} placeholder="—" disabled={pending} /></div>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">Dejá vacío lo que no conozcas. Usá 0 sólo cuando sea realmente cero. Informá al menos un valor nutricional.</p>
      </div>

      <div className="space-y-1 border-t pt-4"><Label htmlFor="food-source">Fuente</Label><Input id="food-source" value={values.sourceNote} onChange={(event) => onChange("sourceNote", event.target.value)} placeholder="Opcional" disabled={pending} /></div>
      <div className="min-h-5" aria-live="polite">{message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}</div>
      <Button className="h-11 w-full" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar alimento"}</Button>
    </form>
  );
}

export function FoodsCatalog({ initialFoods }: { initialFoods: Food[] }) {
  const [foods, setFoods] = useState(initialFoods);
  const [filter, setFilter] = useState<FoodCatalogFilter>("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Food | null>(null);
  const [values, setValues] = useState<Values>(empty);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Food | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const visibleFoods = useMemo(
    () => filterFoodCatalog(foods, filter, search),
    [foods, filter, search],
  );
  const hasArchived = foods.some((food) => !food.is_active);

  const change = (key: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  function begin(food?: Food) {
    setEditing(food ?? null);
    setValues(food ? valuesOf(food) : empty());
    setMessage(null);
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const result = await saveFoodAction({ id: editing?.id, ...values });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setFoods((current) => {
        const exists = current.some((food) => food.id === result.food.id);
        const next = exists
          ? current.map((food) => food.id === result.food.id ? result.food : food)
          : [...current, result.food];
        return next.toSorted((left, right) => left.name.localeCompare(right.name, "es-AR"));
      });
      setOpen(false);
    });
  }

  function toggle(food: Food) {
    setMessage(null);
    startTransition(async () => {
      const result = await setFoodActiveAction({ id: food.id, active: !food.is_active });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setFoods((current) => current.map((item) => item.id === food.id ? result.food : item));
    });
  }

  function remove() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteFoodAction({ id: deleteTarget.id });
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setFoods((current) => current.filter((food) => food.id !== deleteTarget.id));
      setDeleteTarget(null);
    });
  }

  const filters: Array<{ value: FoodCatalogFilter; label: string }> = [
    { value: "active", label: "Activos" },
    { value: "archived", label: "Archivados" },
    { value: "all", label: "Todos" },
  ];

  return (
    <section className="space-y-4" aria-labelledby="foods-title">
      <div className="flex items-end justify-between gap-3">
        <div><h2 id="foods-title" className="text-base font-semibold lg:text-lg">Catálogo</h2><p className="text-sm text-muted-foreground">Referencias para registrar cantidades rápidamente.</p></div>
        {foods.length > 0 ? <Button size="sm" type="button" onClick={() => begin()}><Plus className="size-4" aria-hidden />Nuevo</Button> : null}
      </div>

      {foods.length > 0 ? (
        <div className="space-y-3">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar alimento…" aria-label="Buscar alimento" /></div>
          <div className="flex gap-2" role="group" aria-label="Filtrar alimentos">
            {filters.map((item) => <Button key={item.value} type="button" size="sm" variant={filter === item.value ? "secondary" : "outline"} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</Button>)}
          </div>
        </div>
      ) : null}

      <div className="min-h-5" aria-live="polite">{message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}</div>

      {foods.length === 0 ? (
        <div className="rounded-xl border border-dashed px-5 py-8 text-center"><p className="font-medium">Todavía no agregaste alimentos.</p><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Guardá alimentos que consumís seguido para registrarlos por cantidad.</p><Button className="mt-4" type="button" onClick={() => begin()}><Plus className="size-4" aria-hidden />Nuevo alimento</Button></div>
      ) : visibleFoods.length === 0 ? (
        <div className="rounded-xl border border-dashed px-5 py-7 text-center">
          <p className="font-medium">{search.trim() ? "No encontramos alimentos con esa búsqueda." : filter === "active" && hasArchived ? "No tenés alimentos activos." : filter === "archived" ? "No tenés alimentos archivados." : "No hay alimentos para mostrar."}</p>
          {!search.trim() && filter === "active" && hasArchived ? <p className="mt-1 text-sm text-muted-foreground">Podés reactivar uno archivado o crear un alimento nuevo.</p> : null}
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visibleFoods.map((food) => (
            <li key={food.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{food.name}</h3>{!food.is_active ? <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[0.7rem] font-medium text-amber-800 dark:text-amber-300">Archivado</span> : null}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{shown(food.serving_quantity)} {food.serving_unit}</p>
                  <p className="metric-number mt-1 text-xs text-muted-foreground">{shown(food.calories, " kcal")} · P {shown(food.protein_g, " g")} · C {shown(food.carbs_g, " g")} · G {shown(food.fat_g, " g")}</p>
                  {food.calories === null ? <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">Calorías sin completar</p> : null}
                  {food.source_note ? <p className="mt-1 truncate text-xs text-muted-foreground">Fuente: {food.source_note}</p> : null}
                </div>
                <Button size="sm" variant="ghost" type="button" onClick={() => begin(food)}><Pencil className="size-3.5" aria-hidden />Editar</Button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="outline" type="button" disabled={pending} onClick={() => toggle(food)}>{food.is_active ? <Archive className="size-3.5" aria-hidden /> : <RotateCcw className="size-3.5" aria-hidden />}{food.is_active ? "Archivar" : "Reactivar"}</Button>
                <details className="group relative"><summary className="flex h-9 cursor-pointer list-none items-center gap-1 rounded-lg px-2.5 text-[0.8rem] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><MoreHorizontal className="size-3.5" aria-hidden />Más opciones</summary><div className="absolute bottom-11 left-0 z-10 min-w-44 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"><Button type="button" size="sm" variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => { setDeleteError(null); setDeleteTarget(food); }}><Trash2 className="size-3.5" aria-hidden />Eliminar alimento</Button></div></details>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ResponsiveDialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }} title={editing ? "Editar alimento" : "Nuevo alimento"} description="Definí una porción base y la nutrición que conozcas." closeLabel="Cerrar editor de alimento">
        <FoodEditor values={values} pending={pending} message={message} onChange={change} onSave={save} />
      </ResponsiveDialog>

      <Dialog.Root open={deleteTarget !== null} onOpenChange={(next) => { if (!next && !pending) { setDeleteTarget(null); setDeleteError(null); } }}>
        <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" /><Dialog.Viewport className="fixed inset-0 z-[91] flex items-end justify-center overflow-hidden sm:items-center sm:p-6"><Dialog.Popup className="w-full rounded-t-[1.5rem] bg-card p-5 text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none sm:max-w-sm sm:rounded-2xl sm:border sm:data-[ending-style]:translate-y-2 sm:data-[starting-style]:translate-y-2">
          <div className="pb-[env(safe-area-inset-bottom)]"><Dialog.Title className="text-base font-semibold">¿Eliminar “{deleteTarget?.name}”?</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">Se quitará de tu catálogo. Las comidas ya registradas no cambiarán.</Dialog.Description><div className="min-h-5 pt-3" aria-live="polite">{deleteError ? <p className="text-sm text-destructive" role="alert">{deleteError}</p> : null}</div><div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button type="button" variant="destructive" disabled={pending} onClick={remove}>{pending ? "Eliminando…" : "Eliminar"}</Button></div></div>
        </Dialog.Popup></Dialog.Viewport></Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
