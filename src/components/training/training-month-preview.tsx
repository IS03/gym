import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildMonthGrid,
  formatMonthLabel,
  trainingDayHref,
  type TrainingMonthDay,
} from "@/lib/phase2/training-calendar";
import { cn } from "@/lib/utils";
import { routineColorCssVariable } from "@/lib/phase2/routine-colors";

type TrainingMonthPreviewProps = {
  month: `${number}-${number}`;
  today: string;
  trainedDays: Map<string, string[]>;
};

const weekdayLabels = ["L", "M", "X", "J", "V", "S", "D"];

function DayCell({
  day,
  today,
  colors,
}: {
  day: TrainingMonthDay;
  today: string;
  colors: string[];
}) {
  const isToday = day.date === today;
  const trained = colors.length > 0;
  const canOpen = day.inMonth && day.date <= today;
  const className = cn(
    "flex min-h-9 flex-col items-center justify-center rounded-lg text-xs font-medium leading-none outline-none transition-colors",
    !day.inMonth && "text-muted-foreground/35",
    day.inMonth && !isToday && day.date <= today && "text-foreground hover:bg-muted/60",
    day.inMonth && day.date > today && "text-muted-foreground/45",
    isToday && "bg-primary/10 text-primary ring-1 ring-primary/45 hover:bg-primary/15",
    canOpen && "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
  );
  const content = (
    <>
      <span>{day.date.slice(8, 10)}</span>
      <span className="mt-1 flex h-1.5 items-center justify-center gap-0.5" aria-hidden>
        {colors.slice(0, 3).map((color) => (
          <span
            key={color}
            className="size-1.5 rounded-full ring-1 ring-foreground/10"
            style={{ backgroundColor: routineColorCssVariable(color) }}
          />
        ))}
      </span>
    </>
  );

  if (canOpen) {
    return (
      <Link
        href={trainingDayHref(day.date, { source: "train" })}
        className={className}
        aria-label={`${day.date}${isToday ? ", hoy" : ""}${trained ? ", entrenaste" : ", sin entrenamiento"}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <span
      className={className}
      aria-label={day.inMonth ? `${day.date}, fecha futura` : undefined}
    >
      {content}
    </span>
  );
}

export function TrainingMonthPreview({
  month,
  today,
  trainedDays,
}: TrainingMonthPreviewProps) {
  const label = formatMonthLabel(month);
  const days = buildMonthGrid(month);
  const activeDayCount = [...trainedDays.keys()].filter(
    (date) => date.startsWith(`${month}-`) && date <= today,
  ).length;
  const activityLabel = activeDayCount === 1
    ? "1 día con entrenamiento"
    : `${activeDayCount} días con entrenamiento`;

  return (
    <Card size="sm" className="surface-elevated border">
      <CardContent className="py-0">
        <div className="mb-2.5">
          <p className="text-base font-semibold tracking-tight">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{activityLabel}</p>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground">
          {weekdayLabels.map((weekday) => (
            <span key={weekday} className="pb-1">{weekday}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map((day) => (
            <DayCell
              key={day.date}
              day={day}
              today={today}
              colors={day.inMonth ? trainedDays.get(day.date) ?? [] : []}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
