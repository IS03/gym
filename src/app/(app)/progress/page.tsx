import Link from "next/link";
import {
  Activity,
  Apple,
  ChevronRight,
  Dumbbell,
  History,
  Scale,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNutritionReport } from "@/lib/nutrition/reports";
import { getMyProfile } from "@/lib/phase1/profile";
import { formatTrainingMinutes } from "@/lib/phase2/training-progress-summary";
import { getHomeTrainingSnapshot, todayInCordoba } from "@/lib/phase2/training-robust";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

function balanceLabel(value: number | null) {
  if (value === null) return "Sin días comparables";
  if (value < 0) return `Déficit estimado: ${integer.format(Math.abs(value))} kcal`;
  if (value > 0) return `Superávit estimado: ${integer.format(value)} kcal`;
  return "Balance estimado: 0 kcal";
}

type ProgressLinkProps = {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
};

function ProgressLink({ href, icon: Icon, title, description }: ProgressLinkProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-sm ring-1 ring-foreground/8 outline-none transition-[background-color,transform] hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export default async function ProgressPage() {
  const today = todayInCordoba();
  const auth = await requireAuthenticatedRequestContext();
  const [nutrition, training, profile] = await Promise.all([
    getNutritionReport({ period: "7" }, today, auth),
    getHomeTrainingSnapshot(today, auth),
    getMyProfile(auth),
  ]);
  const week = training.currentWeek;

  return (
    <div className="space-y-6 pb-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Progreso</h1>
        <p className="mt-1 text-sm text-muted-foreground">Seguimiento de nutrición, entrenamiento y cuerpo.</p>
      </header>

      <section aria-labelledby="progress-overview-title" className="space-y-3">
        <div>
          <h2 id="progress-overview-title" className="text-lg font-semibold tracking-tight">Vista general</h2>
          <p className="text-sm text-muted-foreground">Una lectura breve de tus últimos días.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="surface-elevated">
            <CardHeader className="pb-0"><CardTitle className="flex items-center gap-2"><Apple className="size-4 text-primary" aria-hidden /> Nutrición</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="metric-number text-2xl font-semibold">{nutrition.summary.calories.averageConsumed === null ? "—" : `${integer.format(nutrition.summary.calories.averageConsumed)} kcal`}</p>
              <p className="text-xs text-muted-foreground">Promedio de los últimos 7 días · {nutrition.summary.completedRegisteredDays} con nutrición registrada</p>
              <p className="text-xs text-muted-foreground">{balanceLabel(nutrition.summary.energy.accumulatedBalance)}</p>
            </CardContent>
          </Card>
          <Card className="surface-elevated">
            <CardHeader className="pb-0"><CardTitle className="flex items-center gap-2"><Dumbbell className="size-4 text-primary" aria-hidden /> Entrenamiento</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="metric-number text-2xl font-semibold">{week.sessions} {week.sessions === 1 ? "sesión" : "sesiones"}</p>
              <p className="text-xs text-muted-foreground">Esta semana · {week.sets} {week.sets === 1 ? "serie" : "series"}</p>
              <p className="text-xs text-muted-foreground">{formatTrainingMinutes(week.minutes)} de entrenamiento</p>
            </CardContent>
          </Card>
          <Card className="surface-elevated sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-0"><CardTitle className="flex items-center gap-2"><Scale className="size-4 text-primary" aria-hidden /> Cuerpo</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="metric-number text-2xl font-semibold">{profile?.current_weight_kg == null ? "Sin peso actual" : `${decimal.format(profile.current_weight_kg)} kg`}</p>
              <p className="text-xs text-muted-foreground">Peso actual de tu perfil.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="progress-analyze-title" className="space-y-3">
        <div><h2 id="progress-analyze-title" className="text-lg font-semibold tracking-tight">Analizar</h2></div>
        <div className="grid gap-2 lg:grid-cols-3">
          <ProgressLink href="/today/reports" icon={Apple} title="Nutrición" description="Tendencias, objetivos y balance" />
          <ProgressLink href="/train/progress" icon={Dumbbell} title="Entrenamiento" description="Sesiones, volumen y ejercicios" />
          <ProgressLink href="/train/body" icon={Activity} title="Cuerpo" description="Peso y medidas" />
        </div>
      </section>

      <section aria-labelledby="progress-more-title" className="space-y-3">
        <h2 id="progress-more-title" className="text-lg font-semibold tracking-tight">Más</h2>
        <ProgressLink href="/history" icon={History} title="Historial diario" description="Revisá el detalle de una fecha" />
      </section>
    </div>
  );
}
