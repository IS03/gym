import Link from "next/link";
import { Apple, ArrowLeft, BriefcaseBusiness, ChevronRight, Flame, KeyRound, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNutritionConfigurationHub } from "@/lib/nutrition/product";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";

export const dynamic = "force-dynamic";

const formatDate = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Cordoba" });
const dateLabel = (date: string) => formatDate.format(new Date(`${date}T12:00:00`));

function SettingsLink({ href, icon: Icon, title, description }: { href: string; icon: typeof Target; title: string; description: string }) {
  return <Link href={href} className="flex min-h-20 items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm outline-none transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    <Icon className="size-5 shrink-0 text-primary" aria-hidden />
    <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span></span>
    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
  </Link>;
}

export default async function NutritionSettingsPage() {
  const today = todayInCordoba();
  const config = await getNutritionConfigurationHub(today);
  const goal = config.goal;

  return <div className="space-y-6 pb-16 lg:pb-0">
    <div className="space-y-2">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Ajustes</Link>
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Nutrición</h1>
      <p className="text-sm text-muted-foreground">Objetivos y configuración diaria.</p>
    </div>

    <section className="space-y-3" aria-labelledby="nutrition-current-title">
      <div><h2 id="nutrition-current-title" className="text-base font-semibold tracking-tight">Configuración actual</h2><p className="text-sm text-muted-foreground">Lo que está vigente hoy en Córdoba.</p></div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{goal?.name ?? "Sin configurar"}</CardTitle>{goal ? <p className="text-sm text-muted-foreground">Vigente desde {dateLabel(goal.effective_from)}</p> : <p className="text-sm text-muted-foreground">Configurá tus objetivos para comenzar.</p>}</CardHeader>
        {goal ? <CardContent className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-3 text-sm"><span className="text-muted-foreground" /><span className="text-center text-xs font-medium text-muted-foreground">Sin gym</span><span className="text-center text-xs font-medium text-muted-foreground">Con gym</span><span className="text-muted-foreground">Calorías</span><span className="text-center font-medium">{goal.calories_no_gym} kcal</span><span className="text-center font-medium">{goal.calories_gym} kcal</span><span className="text-muted-foreground">Proteína</span><span className="text-center font-medium">{goal.protein_no_gym_g} g</span><span className="text-center font-medium">{goal.protein_gym_g} g</span><span className="text-muted-foreground">Agua</span><span className="text-center font-medium">{goal.water_no_gym_l} L</span><span className="text-center font-medium">{goal.water_gym_l} L</span></CardContent> : null}
      </Card>
    </section>

    <section className="space-y-2" aria-label="Secciones de configuración nutricional">
      <SettingsLink href="/settings/nutrition/goals" icon={Target} title="Objetivos" description={goal ? `${goal.name} · desde ${dateLabel(goal.effective_from)}` : "Sin configurar"} />
      <SettingsLink href="/settings/nutrition/expenditure" icon={Flame} title="Gasto estimado" description={config.expenditure ? `${config.expenditure.name} · desde ${dateLabel(config.expenditure.effective_from)}` : "Sin configurar"} />
      <SettingsLink href="/settings/nutrition/schedule" icon={BriefcaseBusiness} title="Horario laboral" description={config.schedule ? `${config.schedule.name} · desde ${dateLabel(config.schedule.effective_from)}` : "Sin configurar"} />
      <SettingsLink href="/settings/nutrition/foods" icon={Apple} title="Alimentos habituales" description={config.activeFoodCount > 0 ? `${config.activeFoodCount} ${config.activeFoodCount === 1 ? "activo" : "activos"} · registralos por cantidad` : "Referencias para registrar cantidades rápidamente"} />
      <SettingsLink href="/settings/nutrition/integrations" icon={KeyRound} title="Integraciones" description="ChatGPT" />
    </section>
  </div>;
}
