"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Dumbbell, House, LineChart, Utensils } from "lucide-react";
import {
  bottomNavItems,
  getActiveBottomNavIndex,
  isBottomNavItemActive,
  type BottomNavItemId,
} from "@/components/layout/bottom-nav-config";
import { cn } from "@/lib/utils";

const icons: Record<BottomNavItemId, React.ComponentType<{ className?: string }>> = {
  home: House,
  train: Dumbbell,
  nutrition: Utensils,
  progress: LineChart,
};

export function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const context = { fromProgress: searchParams.get("from") === "progress" };
  const activeIndex = getActiveBottomNavIndex(pathname, context);

  return (
    <nav
      className="liquid-nav-wrapper pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Navegación principal"
    >
      <div className="liquid-nav-edge" aria-hidden />
      <div
        className="liquid-nav pointer-events-auto mx-auto grid h-[3.75rem] max-w-[406px] grid-cols-4 p-1"
        style={{ "--liquid-nav-index": activeIndex >= 0 ? activeIndex : 0 } as React.CSSProperties}
      >
        <span
          className={cn("liquid-nav-indicator", activeIndex < 0 && "opacity-0")}
          aria-hidden
        />
        {bottomNavItems.map(({ id, href, label }) => {
          const Icon = icons[id];
          const active = isBottomNavItemActive(pathname, href, context);

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
