import Image from "next/image";
import Link from "next/link";
import { BottomNav } from "@/components/layout/bottom-nav";
import { brandAssets } from "@/lib/brand";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Link
        href="/home"
        aria-label="OWNLEVEL: ir al inicio"
        className="fixed left-6 top-[calc(1.25rem+env(safe-area-inset-top))] z-40 hidden size-10 overflow-hidden rounded-xl ring-1 ring-foreground/10 transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:block"
      >
        <Image
          src={brandAssets.appIcon}
          width={512}
          height={512}
          alt=""
          sizes="40px"
          className="size-full object-cover"
        />
      </Link>
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-0.5 motion-safe:duration-200">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
