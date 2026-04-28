"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  checkRecentDuplicateMealAction,
  createMealAction,
} from "./actions";

type Props = {
  date: string;
};

function buildFormData(
  el: HTMLFormElement,
  date: string,
  forceDuplicate: boolean,
): FormData {
  const fd = new FormData(el);
  fd.set("date", date);
  fd.set("force_duplicate", forceDuplicate ? "1" : "0");
  return fd;
}

export function CreateMealForm({ date }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [showDup, setShowDup] = useState(false);

  return (
    <>
      <form
        ref={formRef}
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const el = formRef.current;
          if (!el) return;
          if (saving) return;
          if (el.checkValidity() === false) {
            el.reportValidity();
            return;
          }

          setSaving(true);
          try {
            const fd = buildFormData(el, date, false);
            const { duplicate } = await checkRecentDuplicateMealAction(fd);
            if (duplicate) {
              setShowDup(true);
              return;
            }
            const result = await createMealAction(fd);
            if (result.ok === false && result.reason === "duplicate") {
              setShowDup(true);
              return;
            }
            el.reset();
            router.refresh();
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="new-meal-title">Título</Label>
          <Input
            id="new-meal-title"
            name="title"
            placeholder="Ej: Yogur + granola"
            disabled={saving}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-meal-final_calories">Calorías</Label>
          <Input
            id="new-meal-final_calories"
            name="final_calories"
            type="number"
            min={1}
            step={1}
            required
            inputMode="numeric"
            placeholder="Ej: 420"
            disabled={saving}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-meal-protein">Proteína (g)</Label>
          <Input
            id="new-meal-protein"
            name="final_protein_g"
            type="number"
            min={0}
            step="0.1"
            inputMode="numeric"
            placeholder="Ej: 30"
            disabled={saving}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-meal-desc">Descripción</Label>
          <Input
            id="new-meal-desc"
            name="description"
            placeholder="Opcional"
            disabled={saving}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-11 w-full" type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Agregar comida"}
          </Button>
        </div>
      </form>

      {showDup ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dup-meal-title"
        >
          <div className="w-full max-w-sm rounded-lg border bg-background p-4 shadow-lg">
            <h3 id="dup-meal-title" className="text-base font-semibold">
              Posible comida duplicada
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Parece que esta comida ya fue cargada recién. ¿Querés guardarla
              igual?
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full sm:w-auto"
                onClick={() => {
                  if (saving) return;
                  setShowDup(false);
                }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="h-11 w-full sm:w-auto"
                disabled={saving}
                onClick={async () => {
                  if (saving) return;
                  const el = formRef.current;
                  if (!el) return;
                  if (el.checkValidity() === false) {
                    setShowDup(false);
                    el.reportValidity();
                    return;
                  }
                  setSaving(true);
                  try {
                    const fd = buildFormData(el, date, true);
                    const result = await createMealAction(fd);
                    if (result.ok) {
                      setShowDup(false);
                      el.reset();
                      router.refresh();
                    } else if (result.ok === false) {
                      setShowDup(true);
                    }
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Guardando…" : "Guardar igual"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
