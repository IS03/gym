"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  closeLabel: string;
  children: React.ReactNode;
};

export function ResponsiveDialog({ open, onOpenChange, title, description, closeLabel, children }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 opacity-100 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[81] flex items-end justify-center overflow-hidden pt-[max(0.75rem,env(safe-area-inset-top))] lg:items-center lg:p-6">
          <Dialog.Popup className="flex max-h-[calc(100dvh-0.75rem-env(safe-area-inset-top))] w-full min-w-0 flex-col overflow-hidden rounded-t-[1.75rem] bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none lg:max-h-[min(80dvh,46rem)] lg:max-w-lg lg:rounded-2xl lg:border lg:data-[ending-style]:translate-y-2 lg:data-[ending-style]:scale-[0.98] lg:data-[starting-style]:translate-y-2 lg:data-[starting-style]:scale-[0.98]">
            <header className="relative shrink-0 border-b border-border/70 px-4 pb-4 pt-3 sm:px-5 lg:pt-5">
              <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" aria-hidden />
              <Dialog.Title className="text-xl font-semibold tracking-tight">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 pr-10 text-sm text-muted-foreground">{description}</Dialog.Description>
              <Dialog.Close
                type="button"
                aria-label={closeLabel}
                className="absolute right-3 top-7 flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:top-4"
              >
                <X className="size-4" aria-hidden />
              </Dialog.Close>
            </header>
            <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 [scrollbar-gutter:stable] sm:px-5">
              {children}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
