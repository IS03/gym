"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Food, NutritionPrecision } from "@/lib/phase1/types";
import { saveFoodAction, setFoodActiveAction } from "./actions";

type Values = {
  name: string; description: string; servingQuantity: string; servingUnit: string;
  calories: string; proteinG: string; carbsG: string; fatG: string;
  sourceNote: string; precisionLevel: NutritionPrecision | "";
};

const empty = (): Values => ({ name: "", description: "", servingQuantity: "1", servingUnit: "unidad", calories: "", proteinG: "", carbsG: "", fatG: "", sourceNote: "", precisionLevel: "" });
const shown = (value: number | null, suffix = "") => value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
function valuesOf(food: Food): Values { return { name: food.name, description: food.description ?? "", servingQuantity: String(food.serving_quantity), servingUnit: food.serving_unit, calories: food.calories == null ? "" : String(food.calories), proteinG: food.protein_g == null ? "" : String(food.protein_g), carbsG: food.carbs_g == null ? "" : String(food.carbs_g), fatG: food.fat_g == null ? "" : String(food.fat_g), sourceNote: food.source_note ?? "", precisionLevel: food.precision_level ?? "" }; }

export function FoodsCatalog({ initialFoods }: { initialFoods: Food[] }) {
  const router = useRouter();
  const [foods, setFoods] = useState(initialFoods);
  const [editing, setEditing] = useState<Food | null>(null);
  const [values, setValues] = useState<Values>(empty);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const change = (key: keyof Values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const begin = (food?: Food) => { setEditing(food ?? null); setValues(food ? valuesOf(food) : empty()); setMessage(null); setOpen(true); };

  function save() {
    startTransition(async () => {
      const result = await saveFoodAction({ id: editing?.id, ...values });
      if (!result.ok) { setMessage(result.error ?? "No se pudo guardar."); return; }
      setOpen(false);
      router.refresh();
    });
  }
  function toggle(food: Food) {
    startTransition(async () => {
      const result = await setFoodActiveAction({ id: food.id, active: !food.is_active });
      if (!result.ok) { setMessage(result.error ?? "No se pudo actualizar."); return; }
      setFoods((current) => current.map((item) => item.id === food.id ? { ...item, is_active: !item.is_active } : item));
    });
  }

  return <section className="space-y-3" aria-labelledby="foods-title">
    <div className="flex items-end justify-between gap-3"><div><h2 id="foods-title" className="text-base font-semibold lg:text-lg">Alimentos habituales</h2><p className="text-sm text-muted-foreground">Catálogo personal. Todavía no completa comidas automáticamente.</p></div><Button size="sm" type="button" onClick={() => begin()}><Plus className="size-4" />Nuevo</Button></div>
    <div className="grid gap-2 lg:grid-cols-2">{foods.map((food) => <Card key={food.id} className={!food.is_active ? "opacity-60" : ""}><CardContent className="space-y-2 pt-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{food.name}</p><p className="text-xs text-muted-foreground">{shown(food.serving_quantity)} {food.serving_unit}{food.is_active ? "" : " · Inactivo"}</p></div><Button size="sm" variant="ghost" type="button" onClick={() => begin(food)}><Pencil className="size-3.5" />Editar</Button></div><p className="metric-number text-xs text-muted-foreground">{shown(food.calories, " kcal")} · P {shown(food.protein_g, " g")} · C {shown(food.carbs_g, " g")} · G {shown(food.fat_g, " g")}</p>{food.source_note ? <p className="text-xs text-muted-foreground">Fuente: {food.source_note}</p> : null}<Button size="sm" variant="outline" type="button" disabled={pending} onClick={() => toggle(food)}>{food.is_active ? "Desactivar" : "Reactivar"}</Button></CardContent></Card>)}</div>
    {foods.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay alimentos.</p> : null}
    {open ? <Card className="border-primary/25"><CardContent className="space-y-4 pt-4"><div className="flex items-center justify-between"><p className="font-semibold">{editing ? "Editar alimento" : "Nuevo alimento"}</p><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cerrar</Button></div><div className="grid grid-cols-2 gap-3"><div className="col-span-2 space-y-1"><Label>Nombre</Label><Input value={values.name} onChange={(e) => change("name", e.target.value)} /></div><div className="space-y-1"><Label>Porción</Label><Input inputMode="decimal" value={values.servingQuantity} onChange={(e) => change("servingQuantity", e.target.value)} /></div><div className="space-y-1"><Label>Unidad</Label><Input value={values.servingUnit} onChange={(e) => change("servingUnit", e.target.value)} /></div>{([['calories','Calorías'],['proteinG','Proteína (g)'],['carbsG','Carbohidratos (g)'],['fatG','Grasas (g)']] as const).map(([key,label]) => <div key={key} className="space-y-1"><Label>{label}</Label><Input inputMode="decimal" value={values[key]} onChange={(e) => change(key, e.target.value)} placeholder="—" /></div>)}<div className="col-span-2 space-y-1"><Label>Descripción</Label><Input value={values.description} onChange={(e) => change("description", e.target.value)} /></div><div className="col-span-2 space-y-1"><Label>Fuente</Label><Input value={values.sourceNote} onChange={(e) => change("sourceNote", e.target.value)} /></div></div><p className="text-xs text-muted-foreground">Vacío significa desconocido; cero significa conocido y realmente cero. Informá al menos un valor nutricional.</p>{message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}<Button className="h-11 w-full" disabled={pending} type="button" onClick={save}>{pending ? "Guardando…" : "Guardar alimento"}</Button></CardContent></Card> : null}
  </section>;
}
