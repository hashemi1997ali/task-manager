"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  variant = "modal",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  variant?: "modal" | "drawer";
}) {
  const { locale } = usePreferences();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-[#090c18]/65 backdrop-blur-md data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <DialogPrimitive.Content
          className={cn(
            variant === "drawer"
              ? "surface-shadow fixed inset-0 z-[100] overflow-y-auto bg-[var(--surface)] p-5 outline-none sm:inset-y-3 sm:left-auto sm:right-3 sm:w-[min(92vw,34rem)] sm:rounded-[1.65rem] sm:border sm:p-7"
              : "surface-shadow fixed inset-x-3 top-1/2 z-[100] max-h-[92vh] -translate-y-1/2 overflow-y-auto rounded-[1.6rem] border bg-[var(--surface)] p-5 outline-none sm:inset-x-auto sm:left-1/2 sm:w-[min(92vw,38rem)] sm:-translate-x-1/2 sm:p-7",
            className,
          )}
        >
          <div className="mb-6 pr-10">
            <DialogPrimitive.Title className="text-xl font-extrabold tracking-[-0.035em] text-[var(--foreground)]">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1 text-sm leading-6 text-[var(--muted)]">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          {children}
          <DialogPrimitive.Close className="focus-ring absolute right-4 top-4 grid size-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/8">
            <X className="size-4" />
            <span className="sr-only">{locale === "de" ? "Schließen" : "Close"}</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
