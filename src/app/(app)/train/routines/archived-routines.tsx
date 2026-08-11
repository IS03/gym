"use client";

import Link from "next/link";
import { Archive, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import type { Routine } from "@/lib/phase2/types";
import { RoutineRestoreButton } from "./routine-restore-button";

export function ArchivedRoutines({ routines }: { routines: Routine[] }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  if (routines.length === 0) return null;

  return (
    <section className="border-t pt-2 lg:pt-4" aria-labelledby="archived-routines-title">
      <button
        id="archived-routines-title"
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 text-left outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Archive className="size-4" aria-hidden />
          Archivadas · {routines.length}
        </span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      <div
        id={contentId}
        hidden={!expanded}
        className="pt-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
      >
        <div className="space-y-2">
          {routines.map((routine) => (
            <div
              key={routine.id}
              className="flex min-h-14 items-stretch gap-2 rounded-xl border border-dashed bg-muted/30 px-3 text-muted-foreground"
            >
              <Link
                href={`/train/routines/${routine.id}`}
                className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full border border-foreground/10 opacity-55"
                  style={{ backgroundColor: routine.color ?? "transparent" }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {routine.nombre}
                </span>
                <ChevronDown className="size-4 -rotate-90 opacity-60" aria-hidden />
              </Link>
              <div className="flex items-center">
                <RoutineRestoreButton routineId={routine.id} routineName={routine.nombre} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
