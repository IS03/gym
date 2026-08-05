export type Adjustment =
  | "maintain"
  | "increase_weight"
  | "increase_reps"
  | "custom";

export type InitialPlanSet = {
  set_number: number;
  reps: number;
  weight_kg: number;
};

export type InitialPlanExercise = {
  source_key: string;
  name: string;
  legacy_group:
    | "pecho"
    | "espalda"
    | "piernas"
    | "hombros"
    | "bíceps"
    | "tríceps"
    | "abdomen"
    | "cardio";
  muscle_group: string;
  implement: string;
  weight_mode: string;
  order: number;
  next_adjustment: Adjustment;
  sets: InitialPlanSet[];
};

export type InitialPlanRoutine = {
  source_key: string;
  name: string;
  color: string;
  order: number;
  notes: string;
  exercises: InitialPlanExercise[];
};

function makeSets(reps: number[], weights: number[]): InitialPlanSet[] {
  if (reps.length !== weights.length || reps.length === 0) {
    throw new Error("Cada serie debe tener repetición y peso.");
  }
  return reps.map((value, index) => ({
    set_number: index + 1,
    reps: value,
    weight_kg: weights[index],
  }));
}

/**
 * Copia exacta del bloque activo de la planilla Seguimiento Gym.
 * Los source_key son estables: permiten reimportar sin duplicar catálogo.
 */
export const INITIAL_TRAINING_PLAN: { routines: InitialPlanRoutine[] } = {
  routines: [
    {
      source_key: "R-PECHO",
      name: "Pecho",
      color: "#ef4444",
      order: 1,
      notes: "Pecho, tríceps y hombros",
      exercises: [
        {
          source_key: "PCH-001",
          name: "Máquina baja",
          legacy_group: "pecho",
          muscle_group: "Pecho",
          implement: "Máquina",
          weight_mode: "Peso total",
          order: 1,
          next_adjustment: "maintain",
          sets: makeSets([10, 10, 10, 10], [80, 80, 80, 80]),
        },
        {
          source_key: "PCH-002",
          name: "Banca inclinada con mancuernas",
          legacy_group: "pecho",
          muscle_group: "Pecho",
          implement: "Mancuernas",
          weight_mode: "Por mancuerna",
          order: 2,
          next_adjustment: "maintain",
          sets: makeSets([8, 8, 8, 8], [17.5, 17.5, 15, 15]),
        },
        {
          source_key: "PCH-003",
          name: "Cruce pec deck",
          legacy_group: "pecho",
          muscle_group: "Pecho",
          implement: "Máquina",
          weight_mode: "Peso total",
          order: 3,
          next_adjustment: "maintain",
          sets: makeSets([12, 12, 12], [35, 35, 35]),
        },
        {
          source_key: "PCH-004",
          name: "Polea alta katana",
          legacy_group: "tríceps",
          muscle_group: "Tríceps",
          implement: "Polea",
          weight_mode: "Peso total",
          order: 4,
          next_adjustment: "maintain",
          sets: makeSets([12, 12, 12, 12], [28, 28, 28, 28]),
        },
        {
          source_key: "PCH-005",
          name: "Polea libre con barra",
          legacy_group: "tríceps",
          muscle_group: "Tríceps",
          implement: "Polea",
          weight_mode: "Peso total",
          order: 5,
          next_adjustment: "increase_weight",
          sets: makeSets([15, 15, 15, 15], [32, 32, 32, 32]),
        },
        {
          source_key: "PCH-006",
          name: "Polea apoyado con cuerda",
          legacy_group: "tríceps",
          muscle_group: "Tríceps",
          implement: "Polea",
          weight_mode: "Peso total",
          order: 6,
          next_adjustment: "maintain",
          sets: makeSets([15, 15, 15], [16, 16, 16]),
        },
        {
          source_key: "PCH-007",
          name: "Press militar con mancuernas",
          legacy_group: "hombros",
          muscle_group: "Hombros",
          implement: "Mancuernas",
          weight_mode: "Por mancuerna",
          order: 7,
          next_adjustment: "increase_reps",
          sets: makeSets([8, 8, 8, 8], [15, 12.5, 12.5, 12.5]),
        },
        {
          source_key: "PCH-008",
          name: "Vuelos laterales con mancuernas",
          legacy_group: "hombros",
          muscle_group: "Hombros",
          implement: "Mancuernas",
          weight_mode: "Por mancuerna",
          order: 8,
          next_adjustment: "maintain",
          sets: makeSets([20, 20, 20, 20], [8, 8, 8, 8]),
        },
        {
          source_key: "PCH-009",
          name: "Posteriores en pec deck",
          legacy_group: "hombros",
          muscle_group: "Hombros",
          implement: "Máquina",
          weight_mode: "Peso total",
          order: 9,
          next_adjustment: "increase_weight",
          sets: makeSets([15, 15, 15], [25, 25, 25]),
        },
      ],
    },
    {
      source_key: "R-ESPALDA",
      name: "Espalda",
      color: "#3b82f6",
      order: 2,
      notes: "Espalda, bíceps, hombros y antebrazos",
      exercises: [
        {
          source_key: "ESP-001",
          name: "Jalón en máquina",
          legacy_group: "espalda",
          muscle_group: "Espalda",
          implement: "Máquina",
          weight_mode: "Peso total",
          order: 1,
          next_adjustment: "maintain",
          sets: makeSets([10, 10, 10], [50, 50, 50]),
        },
        {
          source_key: "ESP-002",
          name: "Remo en T",
          legacy_group: "espalda",
          muscle_group: "Espalda",
          implement: "Máquina/barra",
          weight_mode: "Peso total",
          order: 2,
          next_adjustment: "maintain",
          sets: makeSets([10, 10, 10, 10], [20, 20, 20, 20]),
        },
        {
          source_key: "ESP-003",
          name: "Jalón al pecho neutro",
          legacy_group: "espalda",
          muscle_group: "Espalda",
          implement: "Polea",
          weight_mode: "Peso total",
          order: 3,
          next_adjustment: "maintain",
          sets: makeSets([8, 8, 8, 8], [48, 48, 48, 48]),
        },
        {
          source_key: "ESP-004",
          name: "Curl martillo inclinado",
          legacy_group: "bíceps",
          muscle_group: "Bíceps",
          implement: "Mancuernas",
          weight_mode: "Por mancuerna",
          order: 4,
          next_adjustment: "maintain",
          sets: makeSets([10, 10, 10, 10], [10, 10, 10, 10]),
        },
        {
          source_key: "ESP-005",
          name: "Curl W en máquina",
          legacy_group: "bíceps",
          muscle_group: "Bíceps",
          implement: "Máquina",
          weight_mode: "Peso total",
          order: 5,
          next_adjustment: "maintain",
          sets: makeSets([8, 8, 8, 8], [25, 25, 25, 25]),
        },
        {
          source_key: "ESP-006",
          name: "Curl en polea con barra",
          legacy_group: "bíceps",
          muscle_group: "Bíceps",
          implement: "Polea",
          weight_mode: "Peso total",
          order: 6,
          next_adjustment: "maintain",
          sets: makeSets([15, 15, 15], [28, 28, 28]),
        },
        {
          source_key: "ESP-007",
          name: "Face pull en polea",
          legacy_group: "hombros",
          muscle_group: "Hombros",
          implement: "Polea",
          weight_mode: "Peso total",
          order: 7,
          next_adjustment: "maintain",
          sets: makeSets([12, 12, 12, 12], [10, 10, 10, 10]),
        },
        {
          source_key: "ESP-008",
          name: "Flexores con mancuernas",
          legacy_group: "bíceps",
          muscle_group: "Antebrazo",
          implement: "Mancuernas",
          weight_mode: "Por mancuerna",
          order: 8,
          next_adjustment: "maintain",
          sets: makeSets([20, 20, 20, 20], [10, 10, 10, 10]),
        },
        {
          source_key: "ESP-009",
          name: "Extensiones con mancuernas",
          legacy_group: "bíceps",
          muscle_group: "Antebrazo",
          implement: "Mancuernas",
          weight_mode: "Por mancuerna",
          order: 9,
          next_adjustment: "maintain",
          sets: makeSets([15, 15], [7.5, 7.5]),
        },
        {
          source_key: "ESP-010",
          name: "Curl inverso prono en polea",
          legacy_group: "bíceps",
          muscle_group: "Antebrazo",
          implement: "Polea",
          weight_mode: "Peso total",
          order: 10,
          next_adjustment: "maintain",
          sets: makeSets([15, 15], [24, 24]),
        },
      ],
    },
    {
      source_key: "R-PIERNAS",
      name: "Piernas",
      color: "#22c55e",
      order: 3,
      notes: "Piernas completas",
      exercises: [
        {
          source_key: "PIE-001",
          name: "Sentadilla en máquina",
          legacy_group: "piernas",
          muscle_group: "Cuádriceps",
          implement: "Máquina",
          weight_mode: "Peso total",
          order: 1,
          next_adjustment: "maintain",
          sets: makeSets([10, 10, 10], [40, 40, 40]),
        },
        {
          source_key: "PIE-002",
          name: "Prensa",
          legacy_group: "piernas",
          muscle_group: "Cuádriceps",
          implement: "Máquina",
          weight_mode: "Peso total",
          order: 2,
          next_adjustment: "increase_reps",
          sets: makeSets([10, 10, 10], [40, 40, 40]),
        },
        {
          source_key: "PIE-003",
          name: "Peso muerto rumano",
          legacy_group: "piernas",
          muscle_group: "Isquios/glúteos",
          implement: "Barra",
          weight_mode: "Total con barra",
          order: 3,
          next_adjustment: "maintain",
          sets: makeSets([10, 10, 10], [40, 40, 40]),
        },
        {
          source_key: "PIE-004",
          name: "Extensión de cuádriceps",
          legacy_group: "piernas",
          muscle_group: "Cuádriceps",
          implement: "Máquina",
          weight_mode: "Peso total",
          order: 4,
          next_adjustment: "increase_weight",
          sets: makeSets([15, 15, 15], [25, 25, 25]),
        },
        {
          source_key: "PIE-005",
          name: "Isquios",
          legacy_group: "piernas",
          muscle_group: "Isquios/glúteos",
          implement: "Máquina",
          weight_mode: "Peso total",
          order: 5,
          next_adjustment: "maintain",
          sets: makeSets([15, 15, 15], [30, 30, 30]),
        },
        {
          source_key: "PIE-006",
          name: "Aductores · cerrar",
          legacy_group: "piernas",
          muscle_group: "Aductores",
          implement: "Máquina",
          weight_mode: "Peso total",
          order: 6,
          next_adjustment: "maintain",
          sets: makeSets([12, 12, 12], [49, 49, 49]),
        },
        {
          source_key: "PIE-007",
          name: "Abductores · abrir",
          legacy_group: "piernas",
          muscle_group: "Abductores",
          implement: "Máquina",
          weight_mode: "Peso total",
          order: 7,
          next_adjustment: "maintain",
          sets: makeSets([10, 10, 10], [25, 25, 25]),
        },
        {
          source_key: "PIE-008",
          name: "Pantorrillas",
          legacy_group: "piernas",
          muscle_group: "Pantorrillas",
          implement: "Máquina",
          weight_mode: "Peso total",
          order: 8,
          next_adjustment: "increase_weight",
          sets: makeSets([15, 15, 15, 15], [20, 20, 20, 20]),
        },
      ],
    },
  ],
};

export const INITIAL_PLAN_COUNTS = {
  routines: INITIAL_TRAINING_PLAN.routines.length,
  exercises: INITIAL_TRAINING_PLAN.routines.reduce(
    (total, routine) => total + routine.exercises.length,
    0,
  ),
  sets: INITIAL_TRAINING_PLAN.routines.reduce(
    (total, routine) =>
      total +
      routine.exercises.reduce(
        (routineTotal, exercise) => routineTotal + exercise.sets.length,
        0,
      ),
    0,
  ),
} as const;
