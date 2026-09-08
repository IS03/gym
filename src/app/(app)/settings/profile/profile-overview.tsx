"use client";

import Link from "next/link";
import { Activity, CheckCircle2, ChevronRight, Flame, Pencil, Ruler, Scale, UserRound } from "lucide-react";
import { useCallback, useState } from "react";
import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import type { Profile } from "@/lib/phase1/profile";
import { ProfileForm } from "../profile-form";
import { ProfileInitial } from "../settings-components";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeZone: "America/Argentina/Cordoba",
});
const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(`${value}T12:00:00`)) : "Sin cargar";
}

function sexLabel(value: Profile["sex"]) {
  if (value === "male") return "Masculino";
  if (value === "female") return "Femenino";
  if (value === "other") return "Otro";
  return "Sin cargar";
}

function shown(value: number | null | undefined, unit: string) {
  return value == null ? "Sin cargar" : `${numberFormatter.format(value)} ${unit}`;
}

function isProfileComplete(profile: Profile | null) {
  return Boolean(
    profile?.display_name?.trim()
      && profile.birth_date
      && profile.sex
      && profile.height_cm != null
      && profile.current_weight_kg != null,
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <button
      type="button"
      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      onClick={onEdit}
    >
      <span className="min-w-0 flex-1 text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[55%] truncate text-right text-sm font-medium">{value}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function SectionHeading({ icon: Icon, title, description }: { icon: typeof UserRound; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 px-4 pb-3 pt-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function ProfileOverview({ profile, email, latestWaistCm }: {
  profile: Profile | null;
  email: string | null;
  latestWaistCm: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const closeEditor = useCallback(() => setEditing(false), []);
  const openEditor = useCallback(() => setEditing(true), []);
  const displayName = profile?.display_name?.trim() || "Tu perfil";
  const hasBodySummary = profile?.current_weight_kg != null || latestWaistCm != null;

  return (
    <>
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm outline-none ring-1 ring-foreground/8 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
        onClick={openEditor}
      >
        <ProfileInitial name={displayName} className="size-16" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{displayName}</span>
          <span className="block truncate text-sm text-muted-foreground">{email ?? "—"}</span>
          {isProfileComplete(profile) ? (
            <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" aria-hidden /> Perfil completo
            </span>
          ) : null}
        </span>
        <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <section className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/8">
        <SectionHeading icon={UserRound} title="Datos personales" description="Editá tu información personal." />
        <div className="divide-y divide-border/70 border-t border-border/70">
          <SummaryRow label="Cómo querés que te llamemos" value={displayName} onEdit={openEditor} />
          <SummaryRow label="Nacimiento" value={formatDate(profile?.birth_date ?? null)} onEdit={openEditor} />
          <SummaryRow label="Género" value={sexLabel(profile?.sex ?? null)} onEdit={openEditor} />
        </div>
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Datos físicos</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Estos datos se usan para calcular tus necesidades.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="rounded-xl bg-muted/45 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={openEditor}>
            <Ruler className="size-4 text-primary" aria-hidden />
            <span className="mt-2 block text-xs text-muted-foreground">Altura</span>
            <span className="metric-number mt-0.5 block text-base font-semibold">{shown(profile?.height_cm, "cm")}</span>
          </button>
          <button type="button" className="rounded-xl bg-muted/45 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={openEditor}>
            <Scale className="size-4 text-primary" aria-hidden />
            <span className="mt-2 block text-xs text-muted-foreground">Peso actual</span>
            <span className="metric-number mt-0.5 block text-base font-semibold">{shown(profile?.current_weight_kg, "kg")}</span>
          </button>
        </div>
      </section>

      {profile?.bmr_kcal_current != null ? (
        <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Flame className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Metabolismo basal</h2>
              <p className="text-xs text-muted-foreground">Estimación en reposo a partir de tus datos físicos.</p>
              <p className="metric-number mt-2 text-xl font-semibold">{profile.bmr_kcal_current} kcal</p>
              <p className="mt-1 text-xs text-muted-foreground">Alimenta la estimación automática; no es tu gasto diario ni tu objetivo.</p>
              <Link href="/settings/nutrition/energy" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Ver cálculo energético <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Resumen corporal</h2>
            <p className="text-xs text-muted-foreground">Tus últimos registros y medidas.</p>
          </div>
        </div>
        {hasBodySummary ? (
          <dl className="mt-3 divide-y divide-border/70 border-y border-border/70 text-sm">
            {profile?.current_weight_kg != null ? (
              <div className="flex justify-between gap-3 py-2.5"><dt className="text-muted-foreground">Último peso</dt><dd className="metric-number font-medium">{shown(profile.current_weight_kg, "kg")}</dd></div>
            ) : null}
            {latestWaistCm != null ? (
              <div className="flex justify-between gap-3 py-2.5"><dt className="text-muted-foreground">Cintura</dt><dd className="metric-number font-medium">{shown(latestWaistCm, "cm")}</dd></div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Todavía no registraste peso ni medidas corporales.</p>
        )}
        <Link href="/train/body" className="mt-2 flex min-h-11 items-center justify-between text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Ver progreso corporal <ChevronRight className="size-4" aria-hidden />
        </Link>
      </section>

      <ResponsiveDialog
        open={editing}
        onOpenChange={setEditing}
        title="Editar perfil"
        description="Actualizá tus datos personales y físicos."
        closeLabel="Cerrar edición de perfil"
      >
        <ProfileForm profile={profile} onSaved={closeEditor} />
      </ResponsiveDialog>
    </>
  );
}
