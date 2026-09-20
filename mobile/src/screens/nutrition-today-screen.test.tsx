import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MobileNutritionTodayResponse } from "../../../src/lib/mobile-api/contracts";
import { NutritionLoading, NutritionTodayView } from "./nutrition-today-screen";

function nutritionData(): MobileNutritionTodayResponse {
  return {
    date: "2026-09-20",
    summary: {
      status: "ok",
      data: {
        calories: 1_250,
        calorieTarget: 2_100,
        proteinG: 110,
        proteinTargetG: 140,
        carbsG: 130.5,
        fatG: 45,
        mealCount: 1,
        waterL: 2.5,
        waterTargetL: 3,
        energyBalanceKcal: -250,
      },
    },
    meals: {
      status: "ok",
      data: [
        {
          id: "meal-1",
          title: "Almuerzo",
          description: "Pollo con arroz",
          calories: 620,
          proteinG: 42.5,
          carbsG: 70,
          fatG: null,
          consumedAt: "2026-09-20T15:00:00Z",
          updatedAt: "2026-09-20T15:00:00Z",
        },
      ],
    },
  };
}

function render(data: MobileNutritionTodayResponse) {
  return renderToStaticMarkup(
    <NutritionTodayView
      data={data}
      onAddMeal={vi.fn()}
      onEditMeal={vi.fn()}
      onRefresh={vi.fn()}
      refreshing={false}
    />,
  );
}

describe("native Nutrition Today UI", () => {
  it("uses stable loading surfaces", () => {
    const markup = renderToStaticMarkup(<NutritionLoading />);
    expect(markup).toContain("Cargando Nutrición");
    expect(markup).toContain("home-skeleton-card");
  });

  it("renders the real summary and compact meal data", () => {
    const markup = render(nutritionData());
    expect(markup).toContain("1.250");
    expect(markup).toContain("110 / 140 g");
    expect(markup).toContain("130,5 g");
    expect(markup).toContain("Almuerzo");
    expect(markup).toContain("Pollo con arroz");
    expect(markup).toContain("P 42,5 g · C 70 g · G —");
  });

  it("shows confirmed empty separately from unavailable meals", () => {
    const empty = nutritionData();
    empty.meals = { status: "ok", data: [] };
    expect(render(empty)).toContain("Todavía no cargaste comidas hoy.");

    const unavailable = nutritionData();
    unavailable.meals = { status: "unavailable" };
    const markup = render(unavailable);
    expect(markup).toContain("No pudimos cargar las comidas.");
    expect(markup).not.toContain("Todavía no cargaste comidas hoy.");
    expect(markup).toContain("1.250");
  });

  it("keeps meals visible when only the summary is unavailable", () => {
    const data = nutritionData();
    data.summary = { status: "unavailable" };
    const markup = render(data);
    expect(markup).toContain("No pudimos cargar el resumen.");
    expect(markup).toContain("Almuerzo");
  });
});
