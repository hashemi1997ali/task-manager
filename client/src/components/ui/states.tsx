"use client";

import { AlertCircle, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePreferences } from "@/providers/preferences-provider";

export function LoadingState({ label }: { label?: string }) {
  const { locale } = usePreferences();
  const resolvedLabel =
    label ?? (locale === "de" ? "Daten werden geladen …" : "Loading data …");
  return (
    <div className="desk-panel grid min-h-56 place-items-center" role="status">
      <div className="grid justify-items-center gap-3 text-sm font-semibold text-[var(--muted)]">
        <span className="size-9 animate-spin rounded-full border-3 border-[var(--primary-soft)] border-t-[var(--primary)] shadow-[0_0_20px_var(--primary-glow)]" />
        {resolvedLabel}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="desk-panel desk-grid-glow grid min-h-64 place-items-center border-dashed p-8 text-center">
      <div className="grid max-w-sm justify-items-center gap-3">
        <span className="desk-icon-well size-14 rounded-[1.1rem]">
          <Inbox className="size-6" />
        </span>
        <h3 className="font-bold text-[var(--foreground)]">{title}</h3>
        <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
        {action}
      </div>
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const { locale } = usePreferences();
  return (
    <div className="grid min-h-48 place-items-center rounded-[var(--container-radius)] border border-rose-200 bg-[linear-gradient(145deg,rgba(255,241,242,.88),rgba(255,255,255,.72))] p-6 text-center shadow-[var(--shadow-panel)] dark:border-rose-500/30 dark:bg-[linear-gradient(145deg,rgba(80,24,37,.38),rgba(19,23,42,.9))]">
      <div className="grid justify-items-center gap-3">
        <AlertCircle className="size-7 text-rose-600 dark:text-rose-300" />
        <p className="text-sm text-rose-800 dark:text-rose-200">{message}</p>
        {retry && (
          <Button variant="secondary" size="sm" onClick={retry}>
            {locale === "de" ? "Erneut versuchen" : "Try again"}
          </Button>
        )}
      </div>
    </div>
  );
}
