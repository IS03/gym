import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const mealFieldControlClass =
  "h-12 rounded-xl border-input px-3 text-base placeholder:text-muted-foreground/55 focus-visible:ring-2 focus-visible:ring-ring/35 md:text-sm";

export const mealTextareaClass =
  "min-h-24 w-full resize-y rounded-xl border border-input bg-transparent px-3 py-3 text-base outline-none transition-[color,border-color,box-shadow] duration-150 placeholder:text-muted-foreground/55 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30";

export function MealField({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("group relative min-w-0 pt-2", className)}>
      <Label
        htmlFor={id}
        className="absolute left-3 top-0 z-10 bg-card px-1 text-xs font-normal leading-4 text-muted-foreground transition-colors duration-150 group-focus-within:text-primary"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
