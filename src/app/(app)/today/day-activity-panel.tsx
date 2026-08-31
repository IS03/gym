import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type ActivityContextValues = {
  expenditureLabel: string;
  balanceLabel: string;
  workLabel: string;
  workSourceLabel: string;
  gymLabel: string;
  gymSourceLabel: string;
};

export const getActivityContextItems = (values: ActivityContextValues) => [
  ["Trabajo", `${values.workLabel} · ${values.workSourceLabel}`],
  ["Entrenamiento", `${values.gymLabel} · ${values.gymSourceLabel}`],
  ["Gasto", values.expenditureLabel],
  ["Balance", values.balanceLabel],
];

export function ActivityContextSummary({
  className = "grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm",
  ...values
}: ActivityContextValues & { className?: string }) {
  return (
    <div className={className}>
      {getActivityContextItems(values).map(([label, value]) => (
        <div key={label} className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate font-semibold leading-snug">{value}</p>
        </div>
      ))}
    </div>
  );
}

type Props = ActivityContextValues & {
  activityValuesLabel: {
    steps: string;
    water: string;
    mate: string;
  };
  onOpen: () => void;
};

export function DayActivityPanel({ activityValuesLabel, onOpen, ...context }: Props) {
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
            <span className="text-sm font-semibold">Actividad de hoy</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </span>

          <span className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            {getActivityContextItems(context).map(([label, value]) => (
              <span key={label} className="min-w-0">
                <span className="block text-xs text-muted-foreground">{label}</span>
                <span className="block truncate font-semibold leading-snug">{value}</span>
              </span>
            ))}
          </span>

          <span className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">Pasos</span>
              <span className="metric-number mt-0.5 block truncate text-sm font-semibold">{activityValuesLabel.steps}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">Agua</span>
              <span className="metric-number mt-0.5 block truncate text-sm font-semibold">{activityValuesLabel.water}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">Mate</span>
              <span className="metric-number mt-0.5 block truncate text-sm font-semibold">{activityValuesLabel.mate}</span>
            </span>
          </span>
        </button>
      </CardContent>
    </Card>
  );
}
