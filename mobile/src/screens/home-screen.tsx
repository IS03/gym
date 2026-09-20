import {
  Activity,
  CalendarDays,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  RefreshCw,
} from "lucide-react";

import type {
  MobileHomeActiveSessionDto,
  MobileHomeNutritionDto,
  MobileHomeResponse,
  MobileHomeTodaySessionDto,
  MobileHomeWeekDto,
} from "../../../src/lib/mobile-api/contracts";
import type { ProductTabPath } from "../navigation/routes";
import { useMobileHome } from "./use-mobile-home";

export const HOME_NAVIGATION_TARGETS = {
  training: "/train",
  nutrition: "/today",
  progress: "/progress",
} as const satisfies Record<string, ProductTabPath>;

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const CORDOBA_TIME_ZONE = "America/Argentina/Cordoba";
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: CORDOBA_TIME_ZONE,
});

type HomeScreenProps = {
  fallbackDisplayName: string | null;
  onNavigate: (path: ProductTabPath) => void;
  onUnauthorized: () => Promise<void>;
};

type HomeViewProps = {
  data: MobileHomeResponse;
  fallbackDisplayName: string | null;
  onNavigate: (path: ProductTabPath) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

function firstName(value: string | null) {
  return value?.trim().split(/\s+/u)[0] || null;
}

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00Z`));
}

function formatTime(value: string) {
  return timeFormatter.format(new Date(value));
}

function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) return null;
  const minutes = Math.max(0, Math.round(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatMinutes(minutes: number) {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatTarget(
  value: number | null,
  target: number | null,
  unit: string,
) {
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

function progress(value: number, target: number | null) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="home-section-heading">
      <h2>{title}</h2>
      {action && onAction ? (
        <button className="home-link-action" onClick={onAction} type="button">
          {action}
          <ChevronRight aria-hidden size={15} />
        </button>
      ) : null}
    </div>
  );
}

function InlineUnavailable({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="home-card home-unavailable" role="status">
      <p>{message}</p>
      <button className="home-retry" onClick={onRetry} type="button">
        Reintentar
      </button>
    </div>
  );
}

function TrainingCard({
  session,
  onNavigate,
  onRetry,
}: {
  session: MobileHomeResponse["training"]["activeSession"];
  onNavigate: () => void;
  onRetry: () => void;
}) {
  if (session.status === "unavailable") {
    return (
      <section aria-labelledby="native-training-title">
        <div className="home-training-card home-training-unavailable">
          <p className="home-eyebrow">Entrenamiento</p>
          <h2 id="native-training-title">Estado no disponible</h2>
          <p>No pudimos verificar si tenés una sesión en curso.</p>
          <button className="home-primary-button" onClick={onRetry} type="button">
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  const active = session.data;
  return (
    <section aria-labelledby="native-training-title">
      <div className="home-training-card">
        {active ? (
          <>
            <span className="home-training-badge">Sesión en curso</span>
            <h2 id="native-training-title">{active.name}</h2>
            <p className="home-training-meta">
              {active.exercisesCompleted}/{active.totalExercises} ejercicios ·{" "}
              {active.completedSets}/{active.totalSets} series
            </p>
            <div className="home-progress-label">
              <span>Progreso</span>
              <strong>{active.progressPercent}%</strong>
            </div>
            <div
              aria-label="Progreso de la sesión"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={active.progressPercent}
              className="home-progress-track home-progress-inverted"
              role="progressbar"
            >
              <span style={{ width: `${active.progressPercent}%` }} />
            </div>
          </>
        ) : (
          <>
            <p className="home-eyebrow">Entrenamiento</p>
            <h2 id="native-training-title">Listo para entrenar</h2>
            <p className="home-training-meta">
              Tus rutinas y sesiones están disponibles en Entrenar.
            </p>
          </>
        )}
        <button className="home-primary-button" onClick={onNavigate} type="button">
          Ir a Entrenar
        </button>
      </div>
    </section>
  );
}

function NutritionCard({
  nutrition,
}: {
  nutrition: MobileHomeNutritionDto;
}) {
  const calorieProgress = progress(nutrition.calories, nutrition.calorieTarget);
  return (
    <div className="home-card home-nutrition-card">
      <div className="home-calorie-row">
        <span className="home-icon-circle"><Flame aria-hidden size={20} /></span>
        <div>
          <span>Calorías consumidas</span>
          <strong>{integer.format(nutrition.calories)} kcal</strong>
        </div>
        <small>
          {nutrition.calorieTarget === null
            ? "Sin objetivo"
            : `de ${integer.format(nutrition.calorieTarget)} kcal`}
        </small>
      </div>
      {nutrition.calorieTarget !== null && nutrition.calorieTarget > 0 ? (
        <div className="home-progress-track" aria-hidden>
          <span style={{ width: `${calorieProgress}%` }} />
        </div>
      ) : null}
      <div className="home-nutrition-grid">
        <div>
          <strong>{formatTarget(nutrition.proteinG, nutrition.proteinTargetG, "g")}</strong>
          <span>Proteína</span>
        </div>
        <div>
          <strong>{nutrition.mealCount}</strong>
          <span>{nutrition.mealCount === 1 ? "comida" : "comidas"}</span>
        </div>
        <div>
          <strong>{formatTarget(nutrition.waterL, nutrition.waterTargetL, "L")}</strong>
          <span>Agua</span>
        </div>
      </div>
      <div className="home-balance-row">
        <span className="home-icon-circle"><Activity aria-hidden size={18} /></span>
        <div>
          <span>Balance estimado</span>
          <strong>{formatBalance(nutrition.energyBalanceKcal)}</strong>
        </div>
      </div>
    </div>
  );
}

function WeekCard({
  activeSession,
  date,
  week,
}: {
  activeSession: MobileHomeActiveSessionDto | null;
  date: string;
  week: MobileHomeWeekDto;
}) {
  const activeThisWeek = activeSession &&
    activeSession.logDate >= week.weekStart &&
    activeSession.logDate <= week.weekEnd
    ? activeSession
    : null;
  const completedDays = new Set(week.trainingDays);

  return (
    <div className="home-card home-week-card">
      <div className="home-week-summary">
        <span className="home-icon-circle"><CalendarDays aria-hidden size={19} /></span>
        <div>
          <span>Esta semana</span>
          <strong>
            {week.sessions} {week.sessions === 1 ? "entrenamiento" : "entrenamientos"}
            {activeThisWeek ? " · 1 en curso" : ""}
          </strong>
          <small>{week.sets} series · {formatMinutes(week.minutes)}</small>
        </div>
      </div>
      <div className="home-week-days" aria-label="Actividad de esta semana">
        {["L", "M", "X", "J", "V", "S", "D"].map((label, index) => {
          const day = addDays(week.weekStart, index);
          const active = activeThisWeek?.logDate === day;
          const completed = completedDays.has(day);
          return (
            <div key={day} className={day === date ? "is-today" : undefined}>
              <span>{label}</span>
              <i
                className={`${completed ? "is-completed" : ""} ${active ? "is-active" : ""}`.trim()}
                aria-label={`${label}: ${active ? "sesión en curso" : completed ? "entrenamiento completado" : "sin entrenamiento"}`}
                role="img"
              />
              <small>{day === date ? "Hoy" : ""}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActiveSessionRow({
  session,
  onNavigate,
}: {
  session: MobileHomeActiveSessionDto;
  onNavigate: () => void;
}) {
  return (
    <button className="home-session-row" onClick={onNavigate} type="button">
      <span className="home-icon-circle"><Dumbbell aria-hidden size={18} /></span>
      <span>
        <strong>{session.name}</strong>
        <small>{formatTime(session.startedAt)} · En curso</small>
        <small>{session.exercisesCompleted}/{session.totalExercises} ejercicios · {session.completedSets}/{session.totalSets} series</small>
      </span>
      <em>En curso</em>
    </button>
  );
}

function CompletedSessionRow({
  session,
  onNavigate,
}: {
  session: MobileHomeTodaySessionDto;
  onNavigate: () => void;
}) {
  const range = `${formatTime(session.startedAt)}–${formatTime(session.endedAt)}`;
  const duration = formatDuration(session.durationMilliseconds);
  return (
    <button className="home-session-row" onClick={onNavigate} type="button">
      <span className="home-icon-circle"><Dumbbell aria-hidden size={18} /></span>
      <span>
        <strong>{session.name}</strong>
        <small>{[range, duration].filter(Boolean).join(" · ")}</small>
        <small>{session.exercisesCompleted} ejercicios · {session.completedSets} series</small>
      </span>
      <ChevronRight aria-hidden size={16} />
    </button>
  );
}

export function HomeView({
  data,
  fallbackDisplayName,
  onNavigate,
  onRefresh,
  refreshing,
}: HomeViewProps) {
  const profileName = data.profile.status === "ok"
    ? data.profile.data.displayName
    : null;
  const name = firstName(profileName ?? fallbackDisplayName);
  const activeSession = data.training.activeSession.status === "ok"
    ? data.training.activeSession.data
    : null;
  const completedToday = data.training.week.status === "ok"
    ? data.training.week.data.todaySessions
    : [];
  const activeToday = activeSession?.logDate === data.date ? activeSession : null;
  const showTodaySessions = Boolean(activeToday) || completedToday.length > 0;

  return (
    <section className="product-screen home-screen" aria-labelledby="home-title">
      <div className="home-intro">
        <div>
          <h1 id="home-title">{name ? `Hola, ${name}` : "Inicio"}</h1>
          <p>{formatDate(data.date)}</p>
        </div>
        <button
          aria-label="Actualizar Inicio"
          className="home-refresh"
          disabled={refreshing}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw aria-hidden className={refreshing ? "is-spinning" : undefined} size={18} />
          <span>{refreshing ? "Actualizando" : "Actualizar"}</span>
        </button>
      </div>

      <TrainingCard
        session={data.training.activeSession}
        onNavigate={() => onNavigate(HOME_NAVIGATION_TARGETS.training)}
        onRetry={onRefresh}
      />

      <section className="home-section" aria-label="Nutrición de hoy">
        <SectionTitle
          title="Nutrición de hoy"
          action="Ver Nutrición"
          onAction={() => onNavigate(HOME_NAVIGATION_TARGETS.nutrition)}
        />
        {data.nutrition.status === "ok" ? (
          <NutritionCard
            nutrition={data.nutrition.data}
          />
        ) : (
          <InlineUnavailable message="No pudimos cargar Nutrición." onRetry={onRefresh} />
        )}
      </section>

      <section className="home-section" aria-label="Progreso de la semana">
        <SectionTitle
          title="Progreso de la semana"
          action="Ver Progreso"
          onAction={() => onNavigate(HOME_NAVIGATION_TARGETS.progress)}
        />
        {data.training.week.status === "ok" ? (
          <WeekCard
            activeSession={activeSession}
            date={data.date}
            week={data.training.week.data.summary}
          />
        ) : (
          <InlineUnavailable message="No pudimos cargar el resumen semanal." onRetry={onRefresh} />
        )}
      </section>

      {showTodaySessions ? (
        <section className="home-section" aria-label="Sesiones de hoy">
          <SectionTitle title="Sesiones de hoy" />
          <div className="home-card home-sessions-card">
            {activeToday ? (
              <ActiveSessionRow
                session={activeToday}
                onNavigate={() => onNavigate(HOME_NAVIGATION_TARGETS.training)}
              />
            ) : null}
            {completedToday.map((session) => (
              <CompletedSessionRow
                key={session.id}
                session={session}
                onNavigate={() => onNavigate(HOME_NAVIGATION_TARGETS.training)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

export function HomeLoading() {
  return (
    <section className="product-screen home-screen" aria-label="Cargando Inicio">
      <div className="home-skeleton home-skeleton-heading" />
      <div className="home-skeleton home-skeleton-primary" />
      <div className="home-skeleton home-skeleton-card" />
      <div className="home-skeleton home-skeleton-card" />
    </section>
  );
}

export function HomeScreen({
  fallbackDisplayName,
  onNavigate,
  onUnauthorized,
}: HomeScreenProps) {
  const { refresh, state } = useMobileHome(onUnauthorized);

  if (state.status === "loading") return <HomeLoading />;
  if (state.status === "ready") {
    return (
      <HomeView
        data={state.data}
        fallbackDisplayName={fallbackDisplayName}
        onNavigate={onNavigate}
        onRefresh={() => void refresh()}
        refreshing={state.refreshing}
      />
    );
  }

  return (
    <section className="product-screen home-screen" aria-labelledby="home-title">
      <h1 id="home-title">Inicio</h1>
      <div className="home-card home-page-unavailable" role="alert">
        <span className="home-icon-circle">
          {state.status === "unauthorized" ? (
            <Clock3 aria-hidden size={19} />
          ) : (
            <RefreshCw aria-hidden size={19} />
          )}
        </span>
        <div>
          <strong>
            {state.status === "unauthorized"
              ? "Comprobando tu sesión"
              : "No pudimos cargar Inicio"}
          </strong>
          <p>
            {state.status === "unauthorized"
              ? "Estamos verificando tu acceso de forma segura."
              : "Tus datos no se reemplazaron por valores vacíos."}
          </p>
        </div>
        {state.status === "unavailable" ? (
          <button className="home-retry" onClick={() => void refresh()} type="button">
            Reintentar
          </button>
        ) : null}
      </div>
    </section>
  );
}
