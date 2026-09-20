import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MobileHomeResponse } from "../../../src/lib/mobile-api/contracts";
import {
  HOME_NAVIGATION_TARGETS,
  HomeLoading,
  HomeView,
} from "./home-screen";

function homeData(): MobileHomeResponse {
  return {
    date: "2026-09-20",
    profile: { status: "ok", data: { displayName: "Ignacio Senestrari" } },
    nutrition: {
      status: "ok",
      data: {
        calories: 2_000,
        calorieTarget: 2_200,
        proteinG: 135,
        proteinTargetG: 140,
        mealCount: 4,
        waterL: 2.5,
        waterTargetL: 3,
        energyBalanceKcal: -180,
      },
    },
    training: {
      activeSession: { status: "ok", data: null },
      week: {
        status: "ok",
        data: {
          summary: {
            weekStart: "2026-09-14",
            weekEnd: "2026-09-20",
            sessions: 3,
            sets: 54,
            minutes: 225,
            trainingDays: ["2026-09-15", "2026-09-17", "2026-09-19"],
          },
          todaySessions: [],
        },
      },
    },
  };
}

function render(data = homeData(), refreshing = false) {
  return renderToStaticMarkup(
    <HomeView
      data={data}
      fallbackDisplayName={null}
      onNavigate={vi.fn()}
      onRefresh={vi.fn()}
      refreshing={refreshing}
    />,
  );
}

describe("native Home UI", () => {
  it("renders stable loading surfaces instead of the old placeholder", () => {
    const markup = renderToStaticMarkup(<HomeLoading />);
    expect(markup).toContain("Cargando Inicio");
    expect(markup).toContain("home-skeleton-primary");
  });

  it("renders real Nutrition and week data without inventing an active session", () => {
    const markup = render();
    expect(markup).toContain("Hola, Ignacio");
    expect(markup).toContain("Listo para entrenar");
    expect(markup).toContain("2.000 kcal");
    expect(markup).toContain("135 / 140 g");
    expect(markup).toContain("3 entrenamientos");
    expect(markup).not.toContain("Sesiones de hoy");
  });

  it("keeps healthy blocks visible when Nutrition is unavailable", () => {
    const data = homeData();
    data.nutrition = { status: "unavailable" };
    const markup = render(data);
    expect(markup).toContain("No pudimos cargar Nutrición.");
    expect(markup).toContain("3 entrenamientos");
  });

  it("shows active and completed sessions only when they exist today", () => {
    const data = homeData();
    data.training.activeSession = {
      status: "ok",
      data: {
        id: "active",
        name: "Push",
        logDate: data.date,
        startedAt: "2026-09-20T18:00:00Z",
        exercisesCompleted: 2,
        totalExercises: 5,
        completedSets: 6,
        totalSets: 15,
        progressPercent: 40,
      },
    };
    if (data.training.week.status !== "ok") throw new Error("Missing fixture");
    data.training.week.data.todaySessions = [
      {
        id: "completed",
        name: "Pull",
        startedAt: "2026-09-20T14:00:00Z",
        endedAt: "2026-09-20T15:00:00Z",
        durationMilliseconds: 3_600_000,
        exercisesCompleted: 5,
        completedSets: 15,
        status: "completed",
      },
    ];

    const markup = render(data, true);
    expect(markup).toContain("Sesión en curso");
    expect(markup).toContain("Sesiones de hoy");
    expect(markup).toContain("Push");
    expect(markup).toContain("Pull");
    expect(markup).toContain("Actualizando");
  });

  it("keeps every CTA inside the P1 native router", () => {
    expect(HOME_NAVIGATION_TARGETS).toEqual({
      training: "/train",
      nutrition: "/today",
      progress: "/progress",
    });
  });
});
