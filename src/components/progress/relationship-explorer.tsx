"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RelationshipPair } from "@/lib/progress/relationships/types";

type ExplorerVariable = {
  key: string;
  domain: "nutrition" | "training" | "body" | "activity";
  label: string;
  isActive: boolean;
  sampleSize: number;
};

const domainLabels = {
  nutrition: "Nutrición",
  training: "Entrenamiento",
  body: "Cuerpo",
  activity: "Actividad y hábitos",
} as const;

export function RelationshipExplorer({
  variables,
  pairs,
  selectedAKey,
  selectedBKey,
  period,
  from,
  to,
}: {
  variables: ExplorerVariable[];
  pairs: RelationshipPair[];
  selectedAKey: string | null;
  selectedBKey: string | null;
  period: string;
  from: string;
  to: string;
}) {
  const availableA = useMemo(() => variables.filter((variable) => (
    variable.sampleSize > 0 && pairs.some((pair) => pair.aKey === variable.key)
  )), [pairs, variables]);
  const initialA = availableA.some((variable) => variable.key === selectedAKey) ? selectedAKey! : availableA[0]?.key ?? "";
  const [aKey, setAKey] = useState(initialA);
  const outcomes = useMemo(() => {
    const keys = new Set(pairs.filter((pair) => pair.aKey === aKey).map((pair) => pair.bKey));
    return variables.filter((variable) => keys.has(variable.key) && variable.sampleSize > 0);
  }, [aKey, pairs, variables]);
  const bKey = outcomes.some((variable) => variable.key === selectedBKey) ? selectedBKey! : outcomes[0]?.key ?? "";

  return <form method="get" className="space-y-4 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
    <input type="hidden" name="period" value={period} />
    {period === "custom" ? <><input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} /></> : null}
    <input type="hidden" name="analyze" value="1" />
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Variable A</span>
      <select name="a" value={aKey} onChange={(event) => setAKey(event.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {Object.entries(domainLabels).map(([domain, label]) => {
          const items = availableA.filter((variable) => variable.domain === domain);
          return items.length ? <optgroup key={domain} label={label}>{items.map((variable) => <option key={variable.key} value={variable.key}>{variable.label}{variable.isActive ? "" : " · histórica"}</option>)}</optgroup> : null;
        })}
      </select>
    </label>
    <div className="flex justify-center text-muted-foreground"><ArrowRight className="size-4" aria-hidden /></div>
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Variable B</span>
      <select key={`${aKey}:${bKey}`} name="b" defaultValue={bKey} className="h-11 w-full rounded-xl border bg-background px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={!outcomes.length}>
        {Object.entries(domainLabels).map(([domain, label]) => {
          const items = outcomes.filter((variable) => variable.domain === domain);
          return items.length ? <optgroup key={domain} label={label}>{items.map((variable) => <option key={variable.key} value={variable.key}>{variable.label}{variable.isActive ? "" : " · histórica"}</option>)}</optgroup> : null;
        })}
      </select>
    </label>
    <p className="text-xs leading-relaxed text-muted-foreground">A → B define el orden temporal del análisis; no implica causalidad.</p>
    <Button type="submit" className="h-11 w-full" disabled={!aKey || !bKey}>Analizar relación</Button>
  </form>;
}
