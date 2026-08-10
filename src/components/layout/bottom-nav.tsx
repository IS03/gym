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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-20px_color-mix(in_oklch,var(--foreground)_45%,transparent)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75"
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex h-14 max-w-[430px] items-stretch justify-between gap-1 px-2">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/home" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.96]",
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
