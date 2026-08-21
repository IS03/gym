"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  Dumbbell,
  History,
  House,
  ListChecks,
  Settings,
  Utensils,
} from "lucide-react";
import { BrandSymbol } from "@/components/brand/brand-symbol";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "Principal",
    links: [
      { href: "/home", label: "Inicio", icon: House, exact: true },
      { href: "/train", label: "Entrenar", icon: Dumbbell, exact: true },
      { href: "/today", label: "Nutrición", icon: Utensils, exact: false },
    ],
  },
  {
    label: "Planificación",
    links: [
      { href: "/train/routines", label: "Rutinas", icon: ListChecks, exact: false },
    ],
  },
  {
    label: "Análisis",
    links: [
      { href: "/progress", label: "Progreso", icon: ChartNoAxesCombined, exact: false },
      { href: "/calendar", label: "Calendario", icon: CalendarDays, exact: false },
      { href: "/train/progress", label: "Entrenamiento", icon: Dumbbell, exact: false },
      { href: "/train/body", label: "Cuerpo", icon: Activity, exact: false },
      { href: "/history", label: "Historial diario", icon: History, exact: false },
    ],
  },
] as const;

function isActive(pathname: string, href: string, exact: boolean) {
  if (href === "/train") {
    return (
      pathname === "/train" ||
      pathname.startsWith("/train/session") ||
      pathname.startsWith("/train/exercises") ||
      pathname.startsWith("/train/history") ||
      pathname.startsWith("/train/day")
    );
  }
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
      <Link
        href="/home"
        className="flex items-center gap-3 rounded-xl px-3 py-2 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <BrandSymbol decorative className="size-9" />
        <span>
          <span className="block text-sm font-bold tracking-[0.14em]">OWNLEVEL</span>
          <span className="block text-[11px] text-muted-foreground">Entrenamiento y nutrición</span>
        </span>
      </Link>

      <nav className="mt-7 flex flex-1 flex-col gap-6" aria-label="Navegación de escritorio">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {group.label}
            </p>
            {group.links.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(pathname, href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-[color,background-color,transform] duration-150 hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring active:scale-[0.98]",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className={cn("size-[18px]", active && "text-sidebar-primary")} aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <Link
        href="/settings"
        aria-current={pathname.startsWith("/settings") ? "page" : undefined}
        className={cn(
          "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          pathname.startsWith("/settings")
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:text-sidebar-foreground",
        )}
      >
        <Settings className="size-[18px]" aria-hidden />
        Ajustes
      </Link>
    </aside>
  );
}
