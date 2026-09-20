import {
  Activity,
  ChevronRight,
  Droplets,
  Flame,
  Plus,
  RefreshCw,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import type {
  MobileMealDto,
  MobileMealMutationPayload,
  MobileNutritionSummaryDto,
  MobileNutritionTodayResponse,
} from "../../../src/lib/mobile-api/contracts";
import {
  createMobileNutritionMeal,
  deleteMobileNutritionMeal,
  updateMobileNutritionMeal,
} from "../api/nutrition";
import { native } from "../native/bridge";
import {
  acceptsMealNumericDraft,
  EMPTY_MEAL_DRAFT,
  mealDraftFromMeal,
  type MealDraft,
  validateMealDraft,
} from "./meal-draft";
import { runSingleMutation } from "./mutation-guard";
import { useMobileNutrition } from "./use-mobile-nutrition";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

type NutritionTodayScreenProps = {
  onUnauthorized: () => Promise<void>;
};

type NutritionTodayViewProps = {
  data: MobileNutritionTodayResponse;
  onAddMeal: () => void;
  onEditMeal: (meal: MobileMealDto) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

type MealEditorState =
  | { mode: "create" }
  | { mode: "edit"; meal: MobileMealDto };

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00Z`));
}

function formatTarget(value: number | null, target: number | null, unit: string) {
  const current = value === null ? "—" : decimal.format(value);
  return target === null
    ? `${current} ${unit}`
    : `${current} / ${decimal.format(target)} ${unit}`;
}

function formatBalance(value: number | null) {
  if (value === null) return "—";
  const rounded = Math.round(value);
  if (rounded === 0 || Object.is(rounded, -0)) return "0 kcal";
  return `${rounded < 0 ? "−" : "+"}${integer.format(Math.abs(rounded))} kcal`;
}

function formatMealMacro(value: number | null) {
  return value === null ? "—" : `${decimal.format(value)} g`;
}

function calorieProgress(summary: MobileNutritionSummaryDto) {
  if (!summary.calorieTarget || summary.calorieTarget <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((summary.calories / summary.calorieTarget) * 100)),
  );
}

function NutritionSummary({ summary }: { summary: MobileNutritionSummaryDto }) {
  const progress = calorieProgress(summary);
  return (
    <div className="nutrition-card nutrition-summary-card">
      <div className="nutrition-calorie-row">
        <span className="home-icon-circle"><Flame aria-hidden size={20} /></span>
        <div>
          <span>Calorías</span>
          <strong>
            {integer.format(summary.calories)}
            <small>
              {summary.calorieTarget === null
                ? " kcal"
                : ` / ${integer.format(summary.calorieTarget)} kcal`}
            </small>
          </strong>
        </div>
      </div>
      {summary.calorieTarget !== null && summary.calorieTarget > 0 ? (
        <div
          aria-label="Progreso de calorías"
          aria-valuemax={summary.calorieTarget}
          aria-valuemin={0}
          aria-valuenow={summary.calories}
          className="home-progress-track"
          role="progressbar"
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      <div className="nutrition-macro-grid">
        <div>
          <span>Proteína</span>
          <strong>{formatTarget(summary.proteinG, summary.proteinTargetG, "g")}</strong>
        </div>
        <div>
          <span>Carbohidratos</span>
          <strong>{decimal.format(summary.carbsG)} g</strong>
        </div>
        <div>
          <span>Grasas</span>
          <strong>{decimal.format(summary.fatG)} g</strong>
        </div>
      </div>
      <div className="nutrition-context-grid">
        <div>
          <Utensils aria-hidden size={17} />
          <span>Comidas</span>
          <strong>{summary.mealCount}</strong>
        </div>
        <div>
          <Droplets aria-hidden size={17} />
          <span>Agua</span>
          <strong>{formatTarget(summary.waterL, summary.waterTargetL, "L")}</strong>
        </div>
        <div>
          <Activity aria-hidden size={17} />
          <span>Balance</span>
          <strong>{formatBalance(summary.energyBalanceKcal)}</strong>
        </div>
      </div>
    </div>
  );
}

function MealRow({ meal, onEdit }: { meal: MobileMealDto; onEdit: () => void }) {
  return (
    <button
      aria-label={`Editar ${meal.title || "comida"}`}
      className="nutrition-meal-row"
      onClick={onEdit}
      type="button"
    >
      <span className="nutrition-meal-icon"><Utensils aria-hidden size={17} /></span>
      <span className="nutrition-meal-copy">
        <span className="nutrition-meal-heading">
          <strong>{meal.title || "Comida"}</strong>
          <b>{meal.calories === null ? "—" : `${integer.format(meal.calories)} kcal`}</b>
        </span>
        <small>
          P {formatMealMacro(meal.proteinG)} · C {formatMealMacro(meal.carbsG)} · G {formatMealMacro(meal.fatG)}
        </small>
        {meal.description ? <em>{meal.description}</em> : null}
      </span>
      <ChevronRight aria-hidden size={17} />
    </button>
  );
}

function InlineUnavailable({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="nutrition-card nutrition-unavailable" role="status">
      <p>{message}</p>
      <button className="home-retry" onClick={onRetry} type="button">Reintentar</button>
    </div>
  );
}

export function NutritionTodayView({
  data,
  onAddMeal,
  onEditMeal,
  onRefresh,
  refreshing,
}: NutritionTodayViewProps) {
  return (
    <section className="product-screen nutrition-screen" aria-labelledby="nutrition-title">
      <div className="nutrition-intro">
        <div>
          <h1 id="nutrition-title">Nutrición</h1>
          <p>{formatDate(data.date)}</p>
        </div>
        <button
          aria-label="Actualizar Nutrición"
          className="home-refresh"
          disabled={refreshing}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw aria-hidden className={refreshing ? "is-spinning" : undefined} size={18} />
          <span>{refreshing ? "Actualizando" : "Actualizar"}</span>
        </button>
      </div>

      <section className="nutrition-section" aria-labelledby="nutrition-summary-title">
        <h2 id="nutrition-summary-title">Resumen de hoy</h2>
        {data.summary.status === "ok" ? (
          <NutritionSummary summary={data.summary.data} />
        ) : (
          <InlineUnavailable message="No pudimos cargar el resumen." onRetry={onRefresh} />
        )}
      </section>

      <section className="nutrition-section" aria-labelledby="nutrition-meals-title">
        <div className="nutrition-section-heading">
          <h2 id="nutrition-meals-title">Comidas</h2>
          <button className="nutrition-add-button" onClick={onAddMeal} type="button">
            <Plus aria-hidden size={17} /> Agregar comida
          </button>
        </div>
        {data.meals.status === "unavailable" ? (
          <InlineUnavailable message="No pudimos cargar las comidas." onRetry={onRefresh} />
        ) : data.meals.data.length === 0 ? (
          <div className="nutrition-card nutrition-empty">
            <span className="nutrition-meal-icon"><Utensils aria-hidden size={19} /></span>
            <strong>Todavía no cargaste comidas hoy.</strong>
            <button className="home-primary-button" onClick={onAddMeal} type="button">
              Agregar comida
            </button>
          </div>
        ) : (
          <div className="nutrition-card nutrition-meal-list">
            {data.meals.data.map((meal) => (
              <MealRow key={meal.id} meal={meal} onEdit={() => onEditMeal(meal)} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function MealEditor({
  editor,
  onClose,
  onDelete,
  onRefresh,
  onUnauthorized,
}: {
  editor: MealEditorState;
  onClose: () => void;
  onDelete: (meal: MobileMealDto) => void;
  onRefresh: () => Promise<void>;
  onUnauthorized: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<MealDraft>(() =>
    editor.mode === "create" ? { ...EMPTY_MEAL_DRAFT } : mealDraftFromMeal(editor.meal),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  function updateField(field: keyof MealDraft, value: string) {
    if (
      (field === "calories" || field === "proteinG" || field === "carbsG" || field === "fatG") &&
      !acceptsMealNumericDraft(field, value)
    ) {
      return;
    }
    setDraft((current) => ({ ...current, [field]: value }));
    if (editor.mode === "create") idempotencyKeyRef.current = crypto.randomUUID();
    setError(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateMealDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }

    const payload: MobileMealMutationPayload = {
      ...draft,
      ...(editor.mode === "create"
        ? { idempotencyKey: idempotencyKeyRef.current }
        : {}),
    };

    await runSingleMutation(savingRef, async () => {
      setSaving(true);
      setError(null);
      try {
        const result = editor.mode === "create"
          ? await createMobileNutritionMeal(payload)
          : await updateMobileNutritionMeal(editor.meal.id, payload);
        if (result.status === "ok") {
          await native.haptics.success();
          await onRefresh();
          onClose();
          return;
        }
        if (result.status === "unauthorized") {
          setError("Estamos comprobando tu sesión.");
          await onUnauthorized();
          return;
        }
        if (result.status === "validation" || result.status === "not_found") {
          setError(result.message);
          return;
        }
        await onRefresh();
        setError(
          editor.mode === "create"
            ? "No pudimos confirmar si la comida se guardó. Cerrá el formulario y revisá la lista antes de reintentar."
            : "No pudimos guardar la comida. Tus cambios siguen en el formulario.",
        );
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <div className="nutrition-sheet-layer" role="dialog" aria-modal="true" aria-labelledby="meal-editor-title">
      <button
        aria-label="Cerrar formulario"
        className="nutrition-sheet-backdrop"
        disabled={saving}
        onClick={onClose}
        type="button"
      />
      <div className="nutrition-sheet">
        <div className="nutrition-sheet-header">
          <div>
            <small>Nutrición de hoy</small>
            <h2 id="meal-editor-title">{editor.mode === "create" ? "Agregar comida" : "Editar comida"}</h2>
          </div>
          <button aria-label="Cerrar" className="nutrition-close-button" disabled={saving} onClick={onClose} type="button">
            <X aria-hidden size={20} />
          </button>
        </div>
        <form className="nutrition-form" onSubmit={(event) => void save(event)}>
          <label>
            <span>Título</span>
            <input
              autoComplete="off"
              disabled={saving}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Ej: Yogur + granola"
              value={draft.title}
            />
          </label>
          <label>
            <span>Calorías</span>
            <input
              autoComplete="off"
              disabled={saving}
              inputMode="numeric"
              onChange={(event) => updateField("calories", event.target.value)}
              placeholder="Ej: 420"
              required
              value={draft.calories}
            />
          </label>
          <div className="nutrition-form-grid">
            <label>
              <span>Proteína (g)</span>
              <input disabled={saving} inputMode="decimal" onChange={(event) => updateField("proteinG", event.target.value)} placeholder="Ej: 30" value={draft.proteinG} />
            </label>
            <label>
              <span>Carbohidratos (g)</span>
              <input disabled={saving} inputMode="decimal" onChange={(event) => updateField("carbsG", event.target.value)} placeholder="Ej: 45" value={draft.carbsG} />
            </label>
          </div>
          <label>
            <span>Grasas (g)</span>
            <input disabled={saving} inputMode="decimal" onChange={(event) => updateField("fatG", event.target.value)} placeholder="Ej: 12" value={draft.fatG} />
          </label>
          <label>
            <span>Descripción</span>
            <textarea disabled={saving} onChange={(event) => updateField("description", event.target.value)} placeholder="Opcional" rows={3} value={draft.description} />
          </label>
          <div className="nutrition-form-message" aria-live="polite">
            {error ? <p role="alert">{error}</p> : null}
          </div>
          <button className="nutrition-save-button" disabled={saving} type="submit">
            {saving ? "Guardando…" : editor.mode === "create" ? "Agregar comida" : "Guardar cambios"}
          </button>
          {editor.mode === "edit" ? (
            <button className="nutrition-delete-link" disabled={saving} onClick={() => onDelete(editor.meal)} type="button">
              <Trash2 aria-hidden size={17} /> Eliminar comida
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function DeleteMealConfirmation({
  meal,
  onCancel,
  onDeleted,
  onRefresh,
  onUnauthorized,
}: {
  meal: MobileMealDto;
  onCancel: () => void;
  onDeleted: () => void;
  onRefresh: () => Promise<void>;
  onUnauthorized: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deletingRef = useRef(false);

  async function confirmDelete() {
    await runSingleMutation(deletingRef, async () => {
      setDeleting(true);
      setError(null);
      try {
        const result = await deleteMobileNutritionMeal(meal.id);
        if (result.status === "ok") {
          await native.haptics.success();
          await onRefresh();
          onDeleted();
          return;
        }
        if (result.status === "unauthorized") {
          setError("Estamos comprobando tu sesión.");
          await onUnauthorized();
        } else if (result.status === "validation" || result.status === "not_found") {
          setError(result.message);
        } else {
          setError("No pudimos eliminar la comida. No se ocultó ningún dato localmente.");
        }
      } finally {
        setDeleting(false);
      }
    });
  }

  return (
    <div className="nutrition-confirm-layer" role="alertdialog" aria-modal="true" aria-labelledby="delete-meal-title">
      <div className="nutrition-confirm-card">
        <h2 id="delete-meal-title">Eliminar comida</h2>
        <p>¿Querés eliminar “{meal.title || "Comida"}”?</p>
        <div className="nutrition-form-message" aria-live="polite">
          {error ? <p role="alert">{error}</p> : null}
        </div>
        <div className="nutrition-confirm-actions">
          <button disabled={deleting} onClick={onCancel} type="button">Cancelar</button>
          <button className="is-destructive" disabled={deleting} onClick={() => void confirmDelete()} type="button">
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NutritionLoading() {
  return (
    <section className="product-screen nutrition-screen" aria-label="Cargando Nutrición">
      <div className="home-skeleton home-skeleton-heading" />
      <div className="home-skeleton home-skeleton-card" />
      <div className="home-skeleton home-skeleton-primary" />
    </section>
  );
}

export function NutritionTodayScreen({ onUnauthorized }: NutritionTodayScreenProps) {
  const { refresh, state } = useMobileNutrition(onUnauthorized);
  const [editor, setEditor] = useState<MealEditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MobileMealDto | null>(null);

  if (state.status === "loading") return <NutritionLoading />;
  if (state.status === "ready") {
    return (
      <>
        <NutritionTodayView
          data={state.data}
          onAddMeal={() => setEditor({ mode: "create" })}
          onEditMeal={(meal) => setEditor({ mode: "edit", meal })}
          onRefresh={() => void refresh()}
          refreshing={state.refreshing}
        />
        {editor ? (
          <MealEditor
            key={editor.mode === "create" ? "create" : editor.meal.updatedAt}
            editor={editor}
            onClose={() => setEditor(null)}
            onDelete={(meal) => setDeleteTarget(meal)}
            onRefresh={refresh}
            onUnauthorized={onUnauthorized}
          />
        ) : null}
        {deleteTarget ? (
          <DeleteMealConfirmation
            meal={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onDeleted={() => {
              setDeleteTarget(null);
              setEditor(null);
            }}
            onRefresh={refresh}
            onUnauthorized={onUnauthorized}
          />
        ) : null}
      </>
    );
  }

  return (
    <section className="product-screen nutrition-screen" aria-labelledby="nutrition-title">
      <h1 id="nutrition-title">Nutrición</h1>
      <div className="nutrition-card nutrition-page-unavailable" role="alert">
        <strong>
          {state.status === "unauthorized"
            ? "Comprobando tu sesión"
            : "No pudimos cargar Nutrición"}
        </strong>
        <p>
          {state.status === "unauthorized"
            ? "Estamos verificando tu acceso de forma segura."
            : "Tus comidas y totales no se reemplazaron por datos vacíos."}
        </p>
        {state.status === "unavailable" ? (
          <button className="home-retry" onClick={() => void refresh()} type="button">Reintentar</button>
        ) : null}
      </div>
    </section>
  );
}
