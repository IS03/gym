"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, House, LineChart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/home", label: "Inicio", icon: House },
  { href: "/train", label: "Entrenar", icon: Dumbbell },
  { href: "/history", label: "Historial", icon: LineChart },
  { href: "/settings", label: "Ajustes", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      aria-label="Navegación principal"
    >
      <div className="pointer-events-auto mx-auto flex h-14 max-w-[406px] items-stretch justify-between gap-1 rounded-[1.35rem] border border-border/70 bg-background/80 p-1.5 shadow-[0_12px_35px_-18px_color-mix(in_oklch,var(--foreground)_70%,transparent)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/65">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/home" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[0.95rem] px-1 text-[11px] font-medium transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.94]",
                active
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
