import Image from "next/image";
import { brandSymbolSources } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandSymbolProps = {
  className?: string;
  decorative?: boolean;
};

/** Símbolo OWNLEVEL que elige la variante correcta sin esperar hidratación. */
export function BrandSymbol({ className, decorative = false }: BrandSymbolProps) {
  return (
    <span
      className={cn("inline-flex size-8 shrink-0 items-center justify-center", className)}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": "OWNLEVEL" })}
    >
      <Image
        src={brandSymbolSources.light}
        width={99}
        height={128}
        alt=""
        className="h-full w-auto max-w-full object-contain dark:hidden"
      />
      <Image
        src={brandSymbolSources.dark}
        width={99}
        height={128}
        alt=""
        className="hidden h-full w-auto max-w-full object-contain dark:block"
      />
    </span>
  );
}
