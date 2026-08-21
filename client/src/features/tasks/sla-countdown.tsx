"use client";

import { AlarmClock, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Task } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

export const getActiveSlaDeadline = (
  ticket: Pick<
    Task,
    "status" | "firstRespondedAt" | "firstResponseDueAt" | "resolutionDueAt"
  >,
): { deadline: string; phase: "response" | "resolution" } | null => {
  if (ticket.status === "done") return null;
  if (!ticket.firstRespondedAt && ticket.firstResponseDueAt) {
    return { deadline: ticket.firstResponseDueAt, phase: "response" };
  }
  if (ticket.resolutionDueAt) {
    return { deadline: ticket.resolutionDueAt, phase: "resolution" };
  }
  return null;
};

export const isTicketSlaBreached = (
  ticket: Pick<
    Task,
    "status" | "firstRespondedAt" | "firstResponseDueAt" | "resolutionDueAt"
  >,
  now: number,
): boolean => {
  const active = getActiveSlaDeadline(ticket);
  return Boolean(active && Date.parse(active.deadline) < now);
};

const formatDuration = (milliseconds: number, locale: "en" | "de") => {
  const absoluteMinutes = Math.max(0, Math.ceil(Math.abs(milliseconds) / 60_000));
  const days = Math.floor(absoluteMinutes / 1_440);
  const hours = Math.floor((absoluteMinutes % 1_440) / 60);
  const minutes = absoluteMinutes % 60;

  if (days > 0) {
    return locale === "de" ? `${days} T. ${hours} Std.` : `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return locale === "de" ? `${hours} Std. ${minutes} Min.` : `${hours}h ${minutes}m`;
  }
  return locale === "de" ? `${minutes} Min.` : `${minutes}m`;
};

export function SlaCountdown({
  ticket,
  className,
  compact = false,
  referenceTime,
}: {
  ticket: Task;
  className?: string;
  compact?: boolean;
  referenceTime?: number;
}) {
  const { locale, intlLocale } = usePreferences();
  const [liveNow, setLiveNow] = useState(() => Date.now());

  useEffect(() => {
    if (referenceTime !== undefined) return;
    const update = () => setLiveNow(Date.now());
    const interval = window.setInterval(update, 30_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [referenceTime]);

  const active = useMemo(() => getActiveSlaDeadline(ticket), [ticket]);
  const now = referenceTime ?? liveNow;

  if (ticket.status === "done") {
    return (
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-[var(--success)]",
          className,
        )}
      >
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{locale === "de" ? "Gelöst" : "Resolved"}</span>
      </span>
    );
  }

  if (!active) {
    return (
      <span
        className={cn(
          "inline-flex min-w-0 rounded-full border border-[var(--border)]/80 bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] text-[var(--muted)]",
          className,
        )}
      >
        —
      </span>
    );
  }

  const difference = Date.parse(active.deadline) - now;
  const breached = difference < 0;
  const atRisk = !breached && difference <= 4 * 60 * 60 * 1_000;
  const phase =
    active.phase === "response"
      ? locale === "de"
        ? "Erstreaktion"
        : "First response"
      : locale === "de"
        ? "Lösung"
        : "Resolution";
  const duration = formatDuration(difference, locale);
  const remainingStatus = breached
    ? locale === "de"
      ? `${duration} überschritten`
      : `${duration} overdue`
    : locale === "de"
      ? `noch ${duration}`
      : `${duration} left`;
  const status = atRisk
    ? locale === "de"
      ? `Gefährdet · ${remainingStatus}`
      : `At risk · ${remainingStatus}`
    : remainingStatus;

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tabular-nums",
        breached
          ? "border-rose-500/20 bg-rose-500/10 text-[var(--danger)]"
          : atRisk
            ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-[var(--border)]/80 bg-[var(--surface-muted)] text-[var(--muted)]",
        className,
      )}
      title={`${phase}: ${formatDateTime(active.deadline, intlLocale)}`}
    >
      <AlarmClock className="size-3.5 shrink-0" aria-hidden="true" />
      <span className={cn(compact && "truncate")}>
        {compact ? status : `${phase} · ${status}`}
      </span>
    </span>
  );
}
