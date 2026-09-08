import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsHeader({
  title,
  description,
  backHref,
  backLabel = "Ajustes",
}: {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="space-y-2">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-4 rotate-180" aria-hidden />
          {backLabel}
        </Link>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">{title}</h1>
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
    </header>
  );
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5" aria-label={title}>
      <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/8">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  icon: Icon,
  title,
  description,
  href,
  trailing,
  disabled = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  trailing?: ReactNode;
  disabled?: boolean;
}) {
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
      {href ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
    </>
  );
  const className = cn(
    "flex min-h-[4.75rem] w-full items-center gap-3 px-4 py-3 text-left",
    href && "outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
    disabled && "cursor-default opacity-70",
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className} aria-disabled={disabled || undefined}>
      {content}
    </div>
  );
}

export function ProfileInitial({ name, className }: { name: string; className?: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "U";
  return (
    <span
      className={cn(
        "flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}
