import { Input } from "@/components/ui/input";
import type { ComponentProps } from "react";

function DateInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return <Input type="date" className={className} {...props} />;
}

export { DateInput };
