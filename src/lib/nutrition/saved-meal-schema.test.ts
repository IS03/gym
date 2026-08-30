import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830171201_saved_meals.sql",
  "utf8",
);

describe("PR30 — schema de comidas habituales", () => {
  it("crea plantillas e items con ownership estructural y cascade local", () => {
    expect(migration).toContain("create table public.saved_meals");
    expect(migration).toContain("create table public.saved_meal_items");
    expect(migration).toContain("foreign key (saved_meal_id, user_id)");
    expect(migration).toContain("references public.saved_meals(id, user_id)");
    expect(migration).toContain("on delete cascade");
  });

  it("mantiene los items como snapshots sin una FK viva hacia Foods", () => {
    expect(migration).toContain("source_food_id uuid");
    expect(migration).not.toMatch(/source_food_id[^;]+[\s\S]references public\.foods/);
    expect(migration).toContain("Food deletion must not affect this snapshot");
  });

  it("activa RLS propia y no expone las tablas a anon", () => {
    expect(migration).toContain("alter table public.saved_meals enable row level security");
    expect(migration).toContain("alter table public.saved_meal_items enable row level security");
    expect(migration).toContain("saved_meals_select_own");
    expect(migration).toContain("saved_meal_items_delete_own");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to authenticated");
  });

  it("persiste totales canónicos, propaga null y protege la transacción RPC", () => {
    expect(migration).toContain("create or replace function public.recalculate_saved_meal_totals");
    expect(migration).toContain("v_carbs_count <> v_count then null");
    expect(migration).toContain("pg_catalog.round(v_calories)::integer");
    expect(migration).toContain("pg_catalog.round(v_protein, 2)");
    expect(migration).toContain("create or replace function public.save_saved_meal_template");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
  });
});
