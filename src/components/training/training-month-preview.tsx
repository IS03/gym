import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildMonthGrid,
  formatMonthLabel,
  type TrainingMonthDay,
} from "@/lib/phase2/training-calendar";
import { cn } from "@/lib/utils";

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

  return (
    <span
      className={cn(
        "flex min-h-8 flex-col items-center justify-center rounded-lg text-xs font-medium leading-none",
        !day.inMonth && "text-muted-foreground/35",
        day.inMonth && !isToday && "text-foreground",
        isToday && "bg-primary/10 text-primary ring-1 ring-primary/45",
      )}
      aria-label={
        day.inMonth
          ? `${day.date}${isToday ? ", hoy" : ""}${trained ? ", entrenaste" : ""}`
          : undefined
      }
    >
      <span>{day.date.slice(8, 10)}</span>
      <span className="mt-1 flex h-1.5 items-center justify-center gap-0.5" aria-hidden>
        {colors.slice(0, 3).map((color) => (
          <span
            key={color}
            className="size-1.5 rounded-full ring-1 ring-foreground/10"
            style={{ backgroundColor: color }}
          />
        ))}
      </span>
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

  return (
    <Link
      href={`/train/calendar?month=${month}`}
      aria-label={`Ver calendario de ${label}`}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="surface-elevated border transition-[border-color,transform,box-shadow] duration-150 hover:border-primary/25 hover:shadow-md active:scale-[0.99]">
        <CardContent className="pt-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold tracking-tight">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Constancia del mes</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground">
            {weekdayLabels.map((label) => (
              <span key={label} className="pb-1.5">{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
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
    </Link>
  );
}
