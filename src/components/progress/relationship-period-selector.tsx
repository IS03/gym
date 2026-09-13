import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PROGRESS_PERIOD_PRESETS } from "@/lib/progress/analytics";

const visiblePresets = new Set(["2w", "4w", "8w", "3m", "6m", "1y"]);

export function RelationshipPeriodSelector({
  preset,
  start,
  end,
  aKey,
  bKey,
  analyzed,
}: {
  preset: string;
  start: string;
  end: string;
  aKey: string | null;
  bKey: string | null;
  analyzed: boolean;
}) {
  return <form method="get" className="space-y-3 rounded-xl border bg-card p-3">
    <div className="flex items-center gap-2"><CalendarRange className="size-4 text-primary" aria-hidden /><label htmlFor="relationship-period" className="text-sm font-semibold">Período</label></div>
    <select id="relationship-period" name="period" defaultValue={preset} className="h-11 w-full rounded-xl border bg-background px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {PROGRESS_PERIOD_PRESETS.filter((option) => visiblePresets.has(option.value)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      <option value="custom">Personalizado</option>
    </select>
    {preset === "custom" ? <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs text-muted-foreground"><span>Desde</span><input type="date" name="from" defaultValue={start} className="h-11 w-full rounded-xl border bg-background px-2 text-sm text-foreground" /></label><label className="space-y-1 text-xs text-muted-foreground"><span>Hasta</span><input type="date" name="to" defaultValue={end} className="h-11 w-full rounded-xl border bg-background px-2 text-sm text-foreground" /></label></div> : null}
    {aKey ? <input type="hidden" name="a" value={aKey} /> : null}
    {bKey ? <input type="hidden" name="b" value={bKey} /> : null}
    {analyzed ? <input type="hidden" name="analyze" value="1" /> : null}
    <Button type="submit" variant="outline" className="h-11 w-full">Aplicar período</Button>
  </form>;
}
