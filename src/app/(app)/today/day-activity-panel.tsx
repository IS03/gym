import {
  BriefcaseBusiness,
  ChevronRight,
  Coffee,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type ActivityContextValues = {
  expenditureLabel: string;
  balanceLabel: string;
  workLabel: string;
  workSourceLabel: string;
  gymLabel: string;
  gymSourceLabel: string;
};

type LabelValue = [label: string, value: string, icon: LucideIcon];

export const getActivityContextItems = (values: ActivityContextValues): LabelValue[] => [
  ["Trabajo", `${values.workLabel} · ${values.workSourceLabel}`, BriefcaseBusiness],
  ["Entrenamiento", `${values.gymLabel} · ${values.gymSourceLabel}`, Dumbbell],
  ["Gasto", values.expenditureLabel, Flame],
  ["Balance parcial", values.balanceLabel, Scale],
];

export function ActivityContextSummary({
  className = "grid grid-cols-2 overflow-hidden rounded-xl border bg-background/35",
  ...values
}: ActivityContextValues & { className?: string }) {
  return (
    <div className={className}>
      {getActivityContextItems(values).map(([label, value, Icon], index) => (
        <div
          key={label}
          className={`flex min-w-0 items-center gap-2.5 p-3 ${index < 2 ? "border-b" : ""} ${index % 2 === 0 ? "border-r" : ""}`}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">{label}</span>
            <span className="block truncate text-sm font-semibold leading-snug">{value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

type Props = ActivityContextValues & {
  activityValuesLabel: { steps: string; water: string; mate: string };
  onOpen: () => void;
};

const activityItems = (values: Props["activityValuesLabel"]): LabelValue[] => [
  ["Pasos", values.steps, Footprints],
  ["Agua", values.water, Droplet],
  ["Mate", values.mate, Coffee],
];

export function DayActivityPanel({ activityValuesLabel, onOpen, expenditureLabel, balanceLabel }: Props) {
  const primaryItems: LabelValue[] = [
    ["Gasto", expenditureLabel, Flame],
    ["Balance parcial", balanceLabel, Scale],
  ];

  return (
    <Card size="sm" className="surface-elevated overflow-hidden">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onOpen}
          aria-label="Abrir actividad de hoy"
          aria-haspopup="dialog"
          className="block w-full p-3.5 text-left outline-none transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="flex min-h-7 items-center justify-between gap-3">
            <span className="text-sm font-semibold">Actividad y balance</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </span>
          <span className="mt-3 grid grid-cols-2 divide-x border-b pb-3">
            {primaryItems.map(([label, value, Icon]) => (
              <span key={label} className="flex min-w-0 items-center gap-2 px-2 first:pl-0 last:pr-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">{label}</span>
                  <span className="metric-number block truncate text-sm font-semibold">{value}</span>
                </span>
              </span>
            ))}
          </span>
          <span className="grid grid-cols-3 divide-x pt-3">
            {activityItems(activityValuesLabel).map(([label, value, Icon]) => (
              <span key={label} className="flex min-w-0 items-center gap-1.5 px-2 first:pl-0 last:pr-0">
                <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[10px] text-muted-foreground">{label}</span>
                  <span className="metric-number block truncate text-xs font-semibold">{value}</span>
                </span>
              </span>
            ))}
          </span>
        </button>
      </CardContent>
    </Card>
  );
}
