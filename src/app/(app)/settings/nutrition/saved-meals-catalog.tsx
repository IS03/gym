"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLocalizedDecimalDraft } from "@/lib/localized-decimal";
import type {
  Food,
  SavedMealItem,
  SavedMealTemplateType,
  SavedMealWithItems,
} from "@/lib/phase1/types";
import { filterFoodCatalog } from "@/lib/nutrition/food-catalog-core";
import {
  filterSavedMealCatalog,
  formatSavedMealItemQuantity,
  scaleSavedMealItem,
  sumSavedMealItems,
  type SavedMealCatalogFilter,
} from "@/lib/nutrition/saved-meal-core";
import {
  deleteSavedMealAction,
  saveSavedMealAction,
  setSavedMealActiveAction,
} from "./actions";

type DraftItem = {
  key: string;
  kind: "food" | "snapshot";
  itemId?: string;
  foodId?: string;
  label: string;
  quantity: string;
  unit: string;
  baseQuantity: number;
  baseCalories: number | null;
  baseProteinG: number | null;
  baseCarbsG: number | null;
  baseFatG: number | null;
  sourceFoodId: string | null;
};

type Values = {
  name: string;
  description: string;
  templateType: SavedMealTemplateType;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  items: DraftItem[];
};

const formatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function shown(value: number | null, suffix = "") {
  return value === null ? "—" : `${formatter.format(value)}${suffix}`;
}

function emptyValues(): Values {
  return {
    name: "",
    description: "",
    templateType: "manual",
    calories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    items: [],
  };
}

function draftFromItem(item: SavedMealItem): DraftItem {
  return {
    key: item.id,
    kind: "snapshot",
    itemId: item.id,
    label: item.label,
    quantity: String(item.quantity).replace(".", ","),
    unit: item.unit,
    baseQuantity: item.base_quantity,
    baseCalories: item.base_calories,
    baseProteinG: item.base_protein_g,
    baseCarbsG: item.base_carbs_g,
    baseFatG: item.base_fat_g,
    sourceFoodId: item.source_food_id,
  };
}

function valuesOf(meal: SavedMealWithItems): Values {
  return {
    name: meal.name,
    description: meal.description ?? "",
    templateType: meal.template_type,
    calories: meal.calories === null ? "" : String(meal.calories),
    proteinG: meal.protein_g === null ? "" : String(meal.protein_g),
    carbsG: meal.carbs_g === null ? "" : String(meal.carbs_g),
    fatG: meal.fat_g === null ? "" : String(meal.fat_g),
    items: meal.items.map(draftFromItem),
  };
}

function scaledDraft(item: DraftItem) {
  try {
    return scaleSavedMealItem({
      id: item.key,
      label: item.label,
      unit: item.unit,
      base_quantity: item.baseQuantity,
      base_calories: item.baseCalories,
      base_protein_g: item.baseProteinG,
      base_carbs_g: item.baseCarbsG,
      base_fat_g: item.baseFatG,
    }, item.quantity);
  } catch {
    return null;
  }
}

function nutritionText(meal: Pick<SavedMealWithItems, "calories" | "protein_g" | "carbs_g" | "fat_g">) {
  return `${shown(meal.calories, " kcal")} · P ${shown(meal.protein_g, " g")} · C ${shown(meal.carbs_g, " g")} · G ${shown(meal.fat_g, " g")}`;
}

function SavedMealEditor({
  values,
  foods,
  pending,
  message,
  onChange,
  onItemsChange,
  onSave,
}: {
  values: Values;
  foods: Food[];
  pending: boolean;
  message: string | null;
  onChange: <K extends keyof Omit<Values, "items">>(key: K, value: Values[K]) => void;
  onItemsChange: (items: DraftItem[]) => void;
  onSave: () => void;
}) {
  const [foodSearch, setFoodSearch] = useState("");
  const deferredFoodSearch = useDeferredValue(foodSearch);
  const visibleFoods = useMemo(
    () => filterFoodCatalog(foods, "active", deferredFoodSearch),
    [foods, deferredFoodSearch],
  );
  const scaled = values.items.map(scaledDraft);
  const validScaled = scaled.every((item) => item !== null);
  const totals = validScaled ? sumSavedMealItems(scaled as NonNullable<(typeof scaled)[number]>[]) : null;

  function addFood(food: Food) {
    if (values.items.some((item) => item.sourceFoodId === food.id)) return;
    onItemsChange([...values.items, {
      key: `food-${food.id}`,
      kind: "food",
      foodId: food.id,
      label: food.name,
      quantity: String(food.serving_quantity).replace(".", ","),
      unit: food.serving_unit,
      baseQuantity: food.serving_quantity,
      baseCalories: food.calories,
      baseProteinG: food.protein_g,
      baseCarbsG: food.carbs_g,
      baseFatG: food.fat_g,
      sourceFoodId: food.id,
    }]);
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    onItemsChange(values.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= values.items.length) return;
    const next = [...values.items];
    [next[index], next[destination]] = [next[destination] as DraftItem, next[index] as DraftItem];
    onItemsChange(next);
  }

  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <div className="space-y-3">
        <div className="space-y-1"><Label htmlFor="saved-meal-name">Nombre</Label><Input id="saved-meal-name" value={values.name} onChange={(event) => onChange("name", event.target.value)} disabled={pending} /></div>
        <div className="space-y-1"><Label htmlFor="saved-meal-description">Descripción</Label><textarea id="saved-meal-description" rows={2} value={values.description} onChange={(event) => onChange("description", event.target.value)} disabled={pending} className="min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-[color,border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm dark:bg-input/30" /></div>
      </div>

      <div className="grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Tipo de comida habitual">
        <button type="button" role="tab" aria-selected={values.templateType === "manual"} className={`min-h-10 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${values.templateType === "manual" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => onChange("templateType", "manual")}>Manual</button>
        <button type="button" role="tab" aria-selected={values.templateType === "composite"} className={`min-h-10 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${values.templateType === "composite" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => onChange("templateType", "composite")}>Con alimentos</button>
      </div>

      {values.templateType === "manual" ? (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">Dejá vacío lo que no conozcas. Usá 0 sólo cuando sea realmente cero.</p>
          <div className="space-y-1"><Label htmlFor="saved-meal-calories">Calorías</Label><Input id="saved-meal-calories" inputMode="numeric" value={values.calories} onChange={(event) => onChange("calories", event.target.value)} placeholder="—" disabled={pending} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="saved-meal-protein">Proteína (g)</Label><Input id="saved-meal-protein" inputMode="decimal" value={values.proteinG} onChange={(event) => onChange("proteinG", event.target.value)} placeholder="—" disabled={pending} /></div>
            <div className="space-y-1"><Label htmlFor="saved-meal-carbs">Carbohidratos (g)</Label><Input id="saved-meal-carbs" inputMode="decimal" value={values.carbsG} onChange={(event) => onChange("carbsG", event.target.value)} placeholder="—" disabled={pending} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="saved-meal-fat">Grasas (g)</Label><Input id="saved-meal-fat" inputMode="decimal" value={values.fatG} onChange={(event) => onChange("fatG", event.target.value)} placeholder="—" disabled={pending} /></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ingredientes</p>
            {values.items.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Agregá alimentos y definí la cantidad de cada uno.</p> : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {values.items.map((item, index) => {
                  const itemPreview = scaled[index];
                  return <li key={item.key} className="space-y-2 p-3">
                    <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">Base {formatSavedMealItemQuantity(item.baseQuantity, item.unit)} · {shown(item.baseCalories, " kcal")}</p></div><Button type="button" size="icon" variant="ghost" className="size-9 shrink-0" aria-label={`Quitar ${item.label}`} disabled={pending} onClick={() => onItemsChange(values.items.filter((_, itemIndex) => itemIndex !== index))}><X className="size-4" aria-hidden /></Button></div>
                    <div className="flex items-center gap-2"><Input aria-label={`Cantidad de ${item.label}`} inputMode="decimal" value={item.quantity} onChange={(event) => { if (isLocalizedDecimalDraft(event.target.value)) updateItem(index, { quantity: event.target.value }); }} disabled={pending} /><span className="min-w-14 text-sm text-muted-foreground">{item.unit}</span><Button type="button" size="icon" variant="outline" className="size-9 shrink-0" aria-label={`Subir ${item.label}`} disabled={pending || index === 0} onClick={() => move(index, -1)}><ArrowUp className="size-4" aria-hidden /></Button><Button type="button" size="icon" variant="outline" className="size-9 shrink-0" aria-label={`Bajar ${item.label}`} disabled={pending || index === values.items.length - 1} onClick={() => move(index, 1)}><ArrowDown className="size-4" aria-hidden /></Button></div>
                    <p className="metric-number text-xs text-muted-foreground">{itemPreview ? `${shown(itemPreview.calories, " kcal")} · P ${shown(itemPreview.proteinG, " g")} · C ${shown(itemPreview.carbsG, " g")} · G ${shown(itemPreview.fatG, " g")}` : "Ingresá una cantidad válida."}</p>
                  </li>;
                })}
              </ul>
            )}
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="saved-meal-food-search">Agregar alimento</Label>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input id="saved-meal-food-search" value={foodSearch} onChange={(event) => setFoodSearch(event.target.value)} className="pl-9" placeholder="Buscar alimento…" disabled={pending} /></div>
            <div className="max-h-44 overflow-y-auto rounded-xl border">
              {visibleFoods.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{foods.length === 0 ? "No tenés alimentos activos." : "No encontramos alimentos."}</p> : <ul className="divide-y">{visibleFoods.map((food) => {
                const alreadyAdded = values.items.some((item) => item.sourceFoodId === food.id);
                return <li key={food.id}><button type="button" className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55" disabled={pending || alreadyAdded} onClick={() => addFood(food)}><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{food.name}</span><span className="block truncate text-xs text-muted-foreground">{formatSavedMealItemQuantity(food.serving_quantity, food.serving_unit)} · {shown(food.calories, " kcal")}</span></span><Plus className="size-4 shrink-0" aria-hidden /></button></li>;
              })}</ul>}
            </div>
          </div>

          {totals ? <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4"><p className="text-xs font-medium text-muted-foreground">Total guardado</p><p className="metric-number mt-1 text-xl font-semibold">{shown(totals.calories, " kcal")}</p><p className="metric-number mt-1 text-sm text-muted-foreground">P {shown(totals.proteinG, " g")} · C {shown(totals.carbsG, " g")} · G {shown(totals.fatG, " g")}</p>{totals.calories === null ? <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">Podés guardarla, pero completá las calorías de todos los ingredientes para agregarla en Today.</p> : null}</div> : null}
        </div>
      )}

      <div className="min-h-5" aria-live="polite">{message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}</div>
      <Button className="h-11 w-full" type="submit" disabled={pending || (values.templateType === "composite" && (values.items.length === 0 || !validScaled))}>{pending ? "Guardando…" : "Guardar comida habitual"}</Button>
    </form>
  );
}

export function SavedMealsCatalog({ initialMeals, foods }: { initialMeals: SavedMealWithItems[]; foods: Food[] }) {
  const [meals, setMeals] = useState(initialMeals);
  const [filter, setFilter] = useState<SavedMealCatalogFilter>("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SavedMealWithItems | null>(null);
  const [values, setValues] = useState<Values>(emptyValues);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedMealWithItems | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);
  const visibleMeals = useMemo(
    () => filterSavedMealCatalog(meals, filter, deferredSearch),
    [meals, filter, deferredSearch],
  );
  const hasArchived = meals.some((meal) => !meal.is_active);

  function begin(meal?: SavedMealWithItems) {
    setEditing(meal ?? null);
    setValues(meal ? valuesOf(meal) : emptyValues());
    setMessage(null);
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const result = await saveSavedMealAction({
        id: editing?.id,
        name: values.name,
        description: values.description,
        templateType: values.templateType,
        calories: values.calories,
        proteinG: values.proteinG,
        carbsG: values.carbsG,
        fatG: values.fatG,
        items: values.items.map((item) => item.kind === "food"
          ? { kind: "food" as const, foodId: item.foodId as string, quantity: item.quantity }
          : { kind: "snapshot" as const, itemId: item.itemId as string, quantity: item.quantity }),
      });
      if (!result.ok) { setMessage(result.error); return; }
      setMeals((current) => {
        const next = current.some((meal) => meal.id === result.meal.id)
          ? current.map((meal) => meal.id === result.meal.id ? result.meal : meal)
          : [...current, result.meal];
        return next.toSorted((left, right) => left.name.localeCompare(right.name, "es-AR"));
      });
      setOpen(false);
    });
  }

  function toggle(meal: SavedMealWithItems) {
    setMessage(null);
    startTransition(async () => {
      const result = await setSavedMealActiveAction({ id: meal.id, active: !meal.is_active });
      if (!result.ok) { setMessage(result.error); return; }
      setMeals((current) => current.map((item) => item.id === meal.id ? result.meal : item));
    });
  }

  function remove() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteSavedMealAction({ id: deleteTarget.id });
      if (!result.ok) { setDeleteError(result.error); return; }
      setMeals((current) => current.filter((meal) => meal.id !== deleteTarget.id));
      setDeleteTarget(null);
    });
  }

  const filters: Array<{ value: SavedMealCatalogFilter; label: string }> = [
    { value: "active", label: "Activas" },
    { value: "archived", label: "Archivadas" },
    { value: "all", label: "Todas" },
  ];

  return <section className="space-y-4" aria-labelledby="saved-meals-title">
    <div className="flex items-end justify-between gap-3"><div><h2 id="saved-meals-title" className="text-base font-semibold lg:text-lg">Catálogo</h2><p className="text-sm text-muted-foreground">Plantillas propias; las comidas ya registradas no cambian.</p></div>{meals.length > 0 ? <Button size="sm" type="button" onClick={() => begin()}><Plus className="size-4" aria-hidden />Nueva</Button> : null}</div>
    {meals.length > 0 ? <div className="space-y-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar comida…" aria-label="Buscar comida habitual" /></div><div className="flex gap-2" role="group" aria-label="Filtrar comidas habituales">{filters.map((item) => <Button key={item.value} type="button" size="sm" variant={filter === item.value ? "secondary" : "outline"} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</Button>)}</div></div> : null}
    <div className="min-h-5" aria-live="polite">{message && !open ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}</div>
    {meals.length === 0 ? <div className="rounded-xl border border-dashed px-5 py-8 text-center"><p className="font-medium">Todavía no guardaste comidas habituales.</p><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Creá una preparación manual o combiná alimentos con cantidades.</p><Button className="mt-4" type="button" onClick={() => begin()}><Plus className="size-4" aria-hidden />Nueva comida</Button></div> : visibleMeals.length === 0 ? <div className="rounded-xl border border-dashed px-5 py-7 text-center"><p className="font-medium">{search.trim() ? "No encontramos comidas con esa búsqueda." : filter === "active" && hasArchived ? "No tenés comidas habituales activas." : filter === "archived" ? "No tenés comidas archivadas." : "No hay comidas para mostrar."}</p>{!search.trim() && filter === "active" && hasArchived ? <p className="mt-1 text-sm text-muted-foreground">Podés reactivar una archivada o crear una nueva.</p> : null}</div> : <ul className="divide-y overflow-hidden rounded-xl border bg-card">{visibleMeals.map((meal) => <li key={meal.id} className="px-4 py-3"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{meal.name}</h3>{!meal.is_active ? <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[0.7rem] font-medium text-amber-800 dark:text-amber-300">Archivada</span> : null}</div><p className="metric-number mt-1 text-xs text-muted-foreground">{nutritionText(meal)}</p><p className="mt-1 text-xs text-muted-foreground">{meal.template_type === "composite" ? `${meal.items.length} ${meal.items.length === 1 ? "ingrediente" : "ingredientes"}` : "Comida manual"}</p>{meal.calories === null ? <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">Calorías sin completar</p> : null}</div><Button size="sm" variant="ghost" type="button" onClick={() => begin(meal)}><Pencil className="size-3.5" aria-hidden />Editar</Button></div><div className="mt-3 flex items-center gap-2"><Button size="sm" variant="outline" type="button" disabled={pending} onClick={() => toggle(meal)}>{meal.is_active ? <Archive className="size-3.5" aria-hidden /> : <RotateCcw className="size-3.5" aria-hidden />}{meal.is_active ? "Archivar" : "Reactivar"}</Button><details className="group relative"><summary className="flex h-9 cursor-pointer list-none items-center gap-1 rounded-lg px-2.5 text-[0.8rem] font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><MoreHorizontal className="size-3.5" aria-hidden />Más opciones</summary><div className="absolute bottom-11 left-0 z-10 min-w-48 rounded-lg border bg-popover p-1 shadow-lg"><Button type="button" size="sm" variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => { setDeleteError(null); setDeleteTarget(meal); }}><Trash2 className="size-3.5" aria-hidden />Eliminar comida habitual</Button></div></details></div></li>)}</ul>}
    <ResponsiveDialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }} title={editing ? "Editar comida habitual" : "Nueva comida habitual"} description="Guardá una base manual o armala con alimentos." closeLabel="Cerrar editor de comida habitual"><SavedMealEditor key={`${editing?.id ?? "new"}-${open ? "open" : "closed"}`} values={values} foods={foods} pending={pending} message={message} onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))} onItemsChange={(items) => setValues((current) => ({ ...current, items }))} onSave={save} /></ResponsiveDialog>
    <Dialog.Root open={deleteTarget !== null} onOpenChange={(next) => { if (!next && !pending) { setDeleteTarget(null); setDeleteError(null); } }}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" /><Dialog.Viewport className="fixed inset-0 z-[91] flex items-end justify-center overflow-hidden sm:items-center sm:p-6"><Dialog.Popup className="w-full rounded-t-[1.5rem] bg-card p-5 shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none sm:max-w-sm sm:rounded-2xl sm:border sm:data-[ending-style]:translate-y-2 sm:data-[starting-style]:translate-y-2"><div className="pb-[env(safe-area-inset-bottom)]"><Dialog.Title className="text-base font-semibold">¿Eliminar “{deleteTarget?.name}”?</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">Se quitará de tus comidas habituales. Las comidas ya registradas no cambiarán.</Dialog.Description><div className="min-h-5 pt-3" aria-live="polite">{deleteError ? <p className="text-sm text-destructive" role="alert">{deleteError}</p> : null}</div><div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button type="button" variant="destructive" disabled={pending} onClick={remove}>{pending ? "Eliminando…" : "Eliminar"}</Button></div></div></Dialog.Popup></Dialog.Viewport></Dialog.Portal></Dialog.Root>
  </section>;
}
