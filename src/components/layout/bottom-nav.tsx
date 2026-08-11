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
  const activeIndex = links.findIndex(
    ({ href }) =>
      pathname === href || (href !== "/home" && pathname.startsWith(href)),
  );

  return (
    <nav
      className="liquid-nav-wrapper pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Navegación principal"
    >
      <div className="liquid-nav-edge" aria-hidden />
      <div
        className="liquid-nav pointer-events-auto mx-auto grid h-[3.75rem] max-w-[406px] grid-cols-4 p-1"
        style={{ "--liquid-nav-index": Math.max(activeIndex, 0) } as React.CSSProperties}
      >
        <span className="liquid-nav-indicator" aria-hidden />
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/home" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "liquid-nav-link relative z-10 flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1rem] px-1 text-[11px] font-medium transition-[color,opacity,transform] duration-200 ease-out active:scale-[0.94]",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-[1.15rem] shrink-0 transition-transform duration-200 ease-out",
                  active && "scale-[1.06]",
                )}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
