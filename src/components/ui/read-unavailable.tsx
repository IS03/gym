"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReadUnavailable({
  message,
  className,
  inverted = false,
}: {
  message: string;
  className?: string;
  inverted?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-muted/25 p-4",
        inverted && "border-primary-foreground/25 bg-primary-foreground/10",
        className,
      )}
      role="status"
    >
      <p className={cn(
        "text-sm text-muted-foreground",
        inverted && "text-primary-foreground/85",
      )}>
        {message}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(
          "mt-3",
          inverted && "border-primary-foreground/30 bg-primary-foreground text-primary hover:bg-primary-foreground/90 hover:text-primary",
        )}
        disabled={pending}
        aria-busy={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RefreshCw className={cn("size-3.5", pending && "animate-spin motion-reduce:animate-none")} aria-hidden />
        {pending ? "Reintentando…" : "Reintentar"}
      </Button>
    </div>
  );
}
