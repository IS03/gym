"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";

export function ExerciseFilterForm(props: {
  group: string;
  options: Array<{ value: string; label: string }>;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <form ref={formRef} action="/train/exercises" className="flex gap-2">
      <select
        name="group"
        defaultValue={props.group}
        className="h-11 flex-1 rounded-md border bg-background px-3 text-sm"
        onChange={() => formRef.current?.requestSubmit()}
      >
        {props.options.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Button className="h-11" type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  );
}

