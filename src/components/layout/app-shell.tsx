import { BottomNav } from "@/components/layout/bottom-nav";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <DesktopSidebar />
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-0.5 motion-safe:duration-200 lg:max-w-[1400px] lg:px-8 lg:py-8 xl:px-10">
        <div className="w-full">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
