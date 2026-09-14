import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Apple,
  ArrowRight,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Dumbbell,
  History,
  Scale,
} from "lucide-react";

import { ProgressHomePeriodSelector } from "@/components/progress/progress-home-period-selector";
import { ReadUnavailable } from "@/components/ui/read-unavailable";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { progressHomeDestinationHref, type ProgressHomeRow } from "@/lib/progress/home";
import {
  getProgressHomeData,
  type ProgressHomeDomain,
} from "@/lib/progress/home-server";
import { getVerifiedRequestContext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Icon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const progressDomainLabels: Record<ProgressHomeDomain, string> = {
  training: "Entrenamiento",
  nutrition: "Nutrición",
  activity: "Actividad",
  body: "Cuerpo",
  relationships: "Relaciones",
};

const domainListFormatter = new Intl.ListFormat("es-AR", {
  style: "long",
  type: "conjunction",
});

function SectionTitle({ id, children, detail }: { id: string; children: React.ReactNode; detail?: string }) {
  return <div><h2 id={id} className="text-lg font-semibold tracking-tight">{children}</h2>{detail ? <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p> : null}</div>;
}

function DataRows({ rows }: { rows: ProgressHomeRow[] }) {
  return <div className="divide-y overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/8">{rows.map((row) => <Link key={row.id} href={row.href} className="group flex min-h-16 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-medium text-muted-foreground">{row.label}</span>
      <span className="mt-0.5 block font-semibold tracking-tight">{row.value}</span>
      {row.detail ? <span className="mt-0.5 block text-xs text-muted-foreground">{row.detail}</span> : null}
    </span>
    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
  </Link>)}</div>;
}

function NavigationRow({ href, icon: Icon, label, detail }: { href: string; icon: Icon; label: string; detail: string }) {
  return <Link href={href} className="group flex min-h-14 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
    <Icon className="size-4 shrink-0 text-primary" aria-hidden />
    <span className="min-w-0 flex-1"><span className="block font-medium">{label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span></span>
    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
  </Link>;
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = (await searchParams) ?? {};
  const value = (key: string) => typeof search[key] === "string" ? search[key] as string : undefined;
  const auth = await getVerifiedRequestContext();
  if (!auth) redirect("/login");
  const today = todayInCordoba();
  const { period, model, unavailableDomains } = await getProgressHomeData({
    period: value("period"),
    from: value("from"),
    to: value("to"),
  }, today, auth);
  const unavailable = new Set(unavailableDomains);
  const isIncomplete = (...domains: ProgressHomeDomain[]) => (
    domains.some((domain) => unavailable.has(domain))
  );

  const links = {
    training: progressHomeDestinationHref("training", period),
    nutrition: progressHomeDestinationHref("nutrition", period),
    body: progressHomeDestinationHref("body", period),
    activity: progressHomeDestinationHref("activity", period),
    relationships: progressHomeDestinationHref("relationships", period),
    calendar: progressHomeDestinationHref("calendar", period),
    history: progressHomeDestinationHref("history", period),
  };

  return <div className="space-y-7 pb-16 lg:mx-auto lg:max-w-4xl lg:pb-0">
    <header className="space-y-4">
      <div><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Progreso</h1><p className="mt-1 text-sm text-muted-foreground">Cómo estás cambiando, qué lo acompaña y dónde profundizar.</p></div>
      <ProgressHomePeriodSelector period={period} today={today} />
      {period.error ? <p className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive" role="alert">{period.error}</p> : null}
      {unavailableDomains.length ? (
        <ReadUnavailable
          message={`No pudimos actualizar ${domainListFormatter.format(unavailableDomains.map((domain) => progressDomainLabels[domain]))}.`}
        />
      ) : null}
    </header>

    <section aria-labelledby="progress-evolution-title" className="space-y-3">
      <SectionTitle id="progress-evolution-title" detail="Resultados principales sostenidos por datos comparables.">Tu evolución</SectionTitle>
      {model.evolution.length ? <DataRows rows={model.evolution} /> : <p className="rounded-xl bg-muted/25 px-4 py-5 text-sm text-muted-foreground">{isIncomplete("training", "body") ? "Esta sección no está completa porque algunos datos no pudieron actualizarse." : model.hasAnyData ? "Todavía no hay resultados comparables para destacar en este período." : "Registrá algunos días para empezar a ver tu evolución."}</p>}
    </section>

    <section aria-labelledby="progress-changes-title" className="space-y-3">
      <SectionTitle id="progress-changes-title">Qué cambió</SectionTitle>
      {model.changes.length ? <div className="divide-y overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/8">{model.changes.map((insight) => <Link key={insight.id} href={insight.href} className="group flex min-h-16 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="min-w-0 flex-1"><span className="block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{insight.label}</span><span className="mt-1 block text-sm font-medium">{insight.description}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /></Link>)}</div> : <p className="rounded-xl bg-muted/25 px-4 py-5 text-sm text-muted-foreground">{isIncomplete("training", "nutrition", "activity", "body") ? "Esta sección no está completa porque algunos datos no pudieron actualizarse." : "No hubo cambios relevantes con cobertura suficiente en este período."}</p>}
    </section>

    <section aria-labelledby="progress-relationships-title" className="space-y-3">
      <SectionTitle id="progress-relationships-title" detail="Asociaciones observadas; no implican causalidad.">Relaciones</SectionTitle>
      {model.relationships.length ? <div className="divide-y overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/8">{model.relationships.map((relationship) => <Link key={`${relationship.pair.aKey}:${relationship.pair.bKey}`} href={progressHomeDestinationHref("relationships", period, { aKey: relationship.pair.aKey, bKey: relationship.pair.bKey })} className="group flex min-h-16 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-1.5 font-medium"><span className="min-w-0 flex-1 truncate">{relationship.variableA.label}</span><ArrowRight className="size-3.5 shrink-0 text-primary" aria-hidden /><span className="min-w-0 flex-1 truncate">{relationship.variableB.label}</span></span><span className="mt-1 block text-xs text-muted-foreground">{relationship.conclusion} · {relationship.sampleSize} {relationship.observationUnit}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /></Link>)}</div> : <p className="rounded-xl bg-muted/25 px-4 py-5 text-sm text-muted-foreground">{unavailable.has("relationships") ? "No pudimos actualizar las relaciones de este período." : "Todavía no hay relaciones con señal suficiente para este período."}</p>}
      <Link href={links.relationships} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">Explorar relaciones <ChevronRight className="size-4" aria-hidden /></Link>
    </section>

    <section aria-labelledby="progress-habits-title" className="space-y-3">
      <SectionTitle id="progress-habits-title" detail="Una síntesis de lo que registraste e hiciste.">Tus hábitos</SectionTitle>
      {model.habits.length ? <DataRows rows={model.habits} /> : <p className="rounded-xl bg-muted/25 px-4 py-5 text-sm text-muted-foreground">{isIncomplete("nutrition", "activity") ? "Esta sección no está completa porque algunos datos no pudieron actualizarse." : "Todavía no hay hábitos con registros suficientes para resumir."}</p>}
    </section>

    <section aria-labelledby="progress-explore-title" className="space-y-3">
      <SectionTitle id="progress-explore-title">Explorar tu progreso</SectionTitle>
      <div className="divide-y overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/8">
        <NavigationRow href={links.training} icon={Dumbbell} label="Entrenamiento" detail="Rendimiento, rutinas, músculos y ejercicios" />
        <NavigationRow href={links.nutrition} icon={Apple} label="Nutrición" detail="Energía, macros y evolución" />
        <NavigationRow href={links.body} icon={Scale} label="Cuerpo" detail="Estado, tendencia y medidas" />
        <NavigationRow href={links.activity} icon={ChartNoAxesColumnIncreasing} label="Actividad y hábitos" detail="Métricas personales, consistencia y objetivos" />
      </div>
    </section>

    <section aria-labelledby="progress-review-title" className="space-y-3">
      <SectionTitle id="progress-review-title" detail="Revisá los datos reales que alimentan tus análisis.">Revisar datos</SectionTitle>
      <div className="divide-y overflow-hidden rounded-xl bg-card/70 ring-1 ring-foreground/8">
        <NavigationRow href={links.calendar} icon={CalendarDays} label="Calendario" detail="Ubicá rápidamente una fecha" />
        <NavigationRow href={links.history} icon={History} label="Historial diario" detail="Reconstruí y corregí un día" />
      </div>
    </section>
  </div>;
}
