"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  formatLocalizedDecimal,
  isLocalizedDecimalDraft,
  parseLocalizedDecimal,
} from "@/lib/localized-decimal";

type Props = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange" | "inputMode" | "step"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  maxFractionDigits?: number;
};

export function LocalizedDecimalInput({
  value,
  onValueChange,
  maxFractionDigits = 2,
  onFocus,
  onBlur,
  "aria-invalid": ariaInvalid,
  ...props
}: Props) {
  const focusedRef = React.useRef(false);
  const [raw, setRaw] = React.useState(() => formatLocalizedDecimal(value));
  const [invalid, setInvalid] = React.useState(false);

  React.useEffect(() => {
    if (!focusedRef.current) {
      setRaw(formatLocalizedDecimal(value));
      setInvalid(false);
    }
  }, [value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={raw}
      aria-invalid={ariaInvalid || invalid || undefined}
      onFocus={(event) => {
        focusedRef.current = true;
        onFocus?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (!isLocalizedDecimalDraft(next, maxFractionDigits)) {
          setInvalid(true);
          return;
        }
        setRaw(next);
        setInvalid(false);
        const parsed = parseLocalizedDecimal(next, maxFractionDigits);
        if (parsed !== null || next.trim() === "") onValueChange(parsed);
      }}
      onBlur={(event) => {
        focusedRef.current = false;
        const parsed = parseLocalizedDecimal(raw, maxFractionDigits);
        if (parsed === null && raw.trim() !== "") {
          setInvalid(true);
          setRaw(formatLocalizedDecimal(value));
        } else {
          setInvalid(false);
          onValueChange(parsed);
          setRaw(formatLocalizedDecimal(parsed));
        }
        onBlur?.(event);
      }}
    />
  );
}
