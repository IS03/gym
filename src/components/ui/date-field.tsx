"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps } from "react";

import { formatDateFieldValue } from "@/lib/date-field-display";
import { cn } from "@/lib/utils";

function asLogicalDate(value: string | number | readonly string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export { formatDateFieldValue } from "@/lib/date-field-display";

type DateFieldProps = Omit<ComponentProps<"input">, "type"> & {
  placeholder?: string;
};

/**
 * Ownlevel's visible date field. The browser still owns only the native picker;
 * the logical date, layout and focus treatment stay consistent across platforms.
 */
function DateField({
  className,
  defaultValue,
  disabled = false,
  onChange,
  placeholder,
  value,
  ...props
}: DateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const controlled = value !== undefined;
  const defaultDate = asLogicalDate(defaultValue);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultDate);
  const visibleValue = controlled ? asLogicalDate(value) : uncontrolledValue;

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form || controlled) return;

    const syncAfterReset = () => {
      queueMicrotask(() => setUncontrolledValue(input.value));
    };
    form.addEventListener("reset", syncAfterReset);
    return () => form.removeEventListener("reset", syncAfterReset);
  }, [controlled]);

  return (
    <div
      className={cn(
        "relative flex h-11 w-full min-w-0 items-center rounded-lg border border-input bg-transparent px-3 text-base transition-[color,border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm dark:bg-input/30",
        disabled && "cursor-not-allowed bg-input/50 opacity-50 dark:bg-input/80",
        className,
      )}
    >
      <span className={cn("min-w-0 flex-1 truncate", !visibleValue && "text-muted-foreground")} aria-hidden>
        {formatDateFieldValue(visibleValue, placeholder ?? "Elegir fecha")}
      </span>
      <ChevronDown className="ml-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        {...props}
        ref={inputRef}
        type="date"
        value={controlled ? visibleValue : undefined}
        defaultValue={controlled ? undefined : defaultDate}
        disabled={disabled}
        onChange={(event) => {
          if (!controlled) setUncontrolledValue(event.currentTarget.value);
          onChange?.(event);
        }}
        className="absolute inset-0 h-full w-full min-w-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
}

export { DateField };
