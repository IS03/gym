import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export function NutritionFeatureHeader({ backHref, backLabel, title, description, icon: Icon }: {
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <header className="space-y-3">
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight className="size-4 rotate-180" aria-hidden /> {backLabel}
      </Link>
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-6" aria-hidden /></span>
        <div className="min-w-0"><h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">{title}</h1><p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p></div>
      </div>
    </header>
  );
}
