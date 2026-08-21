"use client";

import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock3,
  Edit3,
  Headset,
  LoaderCircle,
  PauseCircle,
  RotateCcw,
  Trash2,
  UserRound,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";

import {
  TaskPriorityBadge,
  TaskStatusBadge,
  taskStatusBadgeClassName,
  TicketCategoryBadge,
  TicketSourceBadge,
} from "@/components/ui/domain-badge";
import { SlaCountdown, isTicketSlaBreached } from "@/features/tasks/sla-countdown";
import {
  getTaskPriorityLabel,
  getTaskStatusLabel,
  getTicketCategoryLabel,
  getTicketSourceLabel,
} from "@/lib/domain-labels";
import type { Task, TaskStatus } from "@/lib/types";
import { cn, formatDateTime, getId } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    edit: "Edit ticket",
    delete: "Delete ticket",
    completedOn: "Resolved",
    requestedFor: "Requested resolution",
    overdue: "past requested time",
    quickStatus: "Update status",
    setStatus: "Change status to",
    updated: "Updated",
    requester: "Requester",
    assignee: "Assigned agent",
    unassigned: "Unassigned",
    ticket: "Ticket",
    closeRequest: "Close request",
    reopenRequest: "Reopen request",
    discussSupport: "Discuss with support",
    openConversation: "Open conversation",
  },
  de: {
    edit: "Ticket bearbeiten",
    delete: "Ticket löschen",
    completedOn: "Gelöst",
    requestedFor: "Gewünschte Lösung",
    overdue: "gewünschte Zeit überschritten",
    quickStatus: "Status aktualisieren",
    setStatus: "Status ändern zu",
    updated: "Aktualisiert",
    requester: "Anfragende Person",
    assignee: "Zugewiesener Agent",
    unassigned: "Nicht zugewiesen",
    ticket: "Ticket",
    closeRequest: "Anfrage schließen",
    reopenRequest: "Anfrage wieder öffnen",
    discussSupport: "Mit Support besprechen",
    openConversation: "Gespräch öffnen",
  },
} as const;

const statusOptions: Array<{ status: TaskStatus; icon: typeof Circle }> = [
  { status: "todo", icon: Circle },
  { status: "in-progress", icon: Clock3 },
  { status: "waiting-customer", icon: PauseCircle },
  { status: "done", icon: CheckCircle2 },
];

const statusStripeClasses: Record<TaskStatus, string> = {
  todo: "bg-slate-700 dark:bg-slate-300",
  "in-progress": "bg-amber-600 dark:bg-amber-300",
  "waiting-customer": "bg-violet-600 dark:bg-violet-300",
  done: "bg-emerald-600 dark:bg-emerald-300",
};

const getNextStatus = (status: TaskStatus): TaskStatus => {
  const index = statusOptions.findIndex((option) => option.status === status);
  return statusOptions[(index + 1) % statusOptions.length].status;
};

export function TaskCard({
  task,
  showOwner,
  referenceTime,
  onEdit,
  onDelete,
  onStatusChange,
  statusUpdating,
  customerStatusOnly = false,
  onDiscussSupport,
  staffSupportAction = false,
  supportUpdating = false,
  compact = false,
  showUpdatedAt = false,
}: {
  task: Task;
  showOwner?: boolean;
  referenceTime: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: TaskStatus) => void;
  statusUpdating?: boolean;
  customerStatusOnly?: boolean;
  onDiscussSupport?: () => void;
  staffSupportAction?: boolean;
  supportUpdating?: boolean;
  compact?: boolean;
  showUpdatedAt?: boolean;
}) {
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const owner = typeof task.owner === "object" ? task.owner : null;
  const assignee = typeof task.assignee === "object" ? task.assignee : null;
  const category = task.category ?? "general";
  const source = task.source ?? "manual";
  const requestedDateOverdue = Boolean(
    task.status !== "done" &&
    task.dueDate &&
    new Date(task.dueDate).getTime() < referenceTime,
  );
  const slaBreached = isTicketSlaBreached(task, referenceTime);
  const nextTaskStatus = customerStatusOnly
    ? task.status === "done"
      ? "todo"
      : "done"
    : getNextStatus(task.status);
  const ticketNumber = task.ticketNumber || `#${getId(task).slice(-6).toUpperCase()}`;

  return (
    <Card
      spotlight={!compact}
      className={cn(
        "desk-panel group relative flex flex-col overflow-hidden transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--primary)]/35 hover:shadow-[0_18px_42px_rgba(30,36,72,.11)] motion-reduce:transform-none motion-reduce:transition-none",
        compact ? "min-h-0" : "min-h-72",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          slaBreached || requestedDateOverdue
            ? "bg-rose-600 dark:bg-rose-300"
            : statusStripeClasses[task.status],
        )}
        aria-hidden="true"
      />

      <div className={cn("flex flex-1 flex-col", compact ? "p-4 pl-5" : "p-5 pl-6")}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[var(--primary-soft)] px-2 py-1 font-mono text-[10px] font-black tracking-[0.08em] text-[var(--primary)]">
                {ticketNumber}
              </span>
              <TicketCategoryBadge category={category}>
                {getTicketCategoryLabel(category, locale)}
              </TicketCategoryBadge>
              <TicketSourceBadge source={source}>
                {getTicketSourceLabel(source, locale)}
              </TicketSourceBadge>
            </div>
            <h3
              className={cn(
                "font-black tracking-[-0.025em] text-[var(--foreground)]",
                compact
                  ? "mt-3 truncate text-[15px] leading-6"
                  : "mt-4 line-clamp-2 text-xl leading-7",
              )}
              dir="auto"
            >
              {task.title}
            </h3>
            <p
              className={cn(
                "mt-1 text-sm text-[var(--muted)]",
                compact ? "truncate leading-5" : "line-clamp-3 leading-6",
              )}
              dir="auto"
            >
              {task.description || "—"}
            </p>
          </div>
          {(onEdit || onDelete) && (
            <div className="flex shrink-0 gap-1 rounded-xl border border-[var(--border)]/70 bg-[var(--surface-muted)]/70 p-1">
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="focus-ring grid size-9 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--primary)]"
                  aria-label={`${t.edit}: ${task.title}`}
                >
                  <Edit3 className="size-4" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="focus-ring grid size-9 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-rose-500/10 hover:text-[var(--danger)]"
                  aria-label={`${t.delete}: ${task.title}`}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-[var(--border)]/65 py-3">
          {onStatusChange && !customerStatusOnly ? (
            <button
              type="button"
              onClick={() => onStatusChange(nextTaskStatus)}
              disabled={statusUpdating}
              aria-label={`${t.setStatus}: ${getTaskStatusLabel(nextTaskStatus, locale)}`}
              className={taskStatusBadgeClassName(
                task.status,
                "focus-ring disabled:cursor-wait disabled:opacity-60",
              )}
            >
              {statusUpdating && <LoaderCircle className="size-3 animate-spin" />}
              {getTaskStatusLabel(task.status, locale)}
            </button>
          ) : (
            <TaskStatusBadge status={task.status}>
              {getTaskStatusLabel(task.status, locale)}
            </TaskStatusBadge>
          )}
          <TaskPriorityBadge priority={task.priority}>
            {getTaskPriorityLabel(task.priority, locale)}
          </TaskPriorityBadge>
          <SlaCountdown
            ticket={task}
            compact
            className="max-w-full"
            referenceTime={referenceTime}
          />
        </div>

        <dl
          className={cn(
            "mt-4 grid gap-3 text-xs",
            showOwner ? "sm:grid-cols-2" : "grid-cols-1",
          )}
        >
          <div
            className={cn(
              "min-w-0 rounded-xl bg-[var(--surface-muted)]/70 p-3",
              requestedDateOverdue && "bg-rose-500/10 text-[var(--danger)]",
            )}
          >
            <dt className="flex items-center gap-1.5 font-bold text-[var(--muted)]">
              <CalendarClock className="size-3.5 shrink-0" />
              {t.requestedFor}
            </dt>
            <dd className="mt-1.5 truncate font-semibold tabular-nums">
              {task.dueDate ? (
                <time dateTime={task.dueDate}>
                  {formatDateTime(task.dueDate, intlLocale)}
                </time>
              ) : (
                "—"
              )}
              {requestedDateOverdue && <span> · {t.overdue}</span>}
            </dd>
          </div>
          {showOwner && owner && (
            <div className="min-w-0 rounded-xl bg-[var(--surface-muted)]/70 p-3">
              <dt className="flex items-center gap-1.5 font-bold text-[var(--muted)]">
                <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
                {t.requester}
              </dt>
              <dd className="mt-1.5 truncate font-semibold">
                <Link
                  href={`/admin/users/${getId(owner)}`}
                  className="focus-ring rounded hover:text-[var(--primary)]"
                  dir="auto"
                >
                  {owner.firstName} {owner.lastName}
                </Link>
              </dd>
            </div>
          )}
          <div className="min-w-0 rounded-xl bg-[var(--surface-muted)]/70 p-3">
            <dt className="flex items-center gap-1.5 font-bold text-[var(--muted)]">
              <UserRoundCheck className="size-3.5 shrink-0" aria-hidden="true" />
              {t.assignee}
            </dt>
            <dd className="mt-1.5 truncate font-semibold">
              {assignee ? `${assignee.firstName} ${assignee.lastName}` : t.unassigned}
            </dd>
          </div>
          {(task.status === "done" && task.completedAt) || showUpdatedAt ? (
            <div className="min-w-0 rounded-xl bg-[var(--surface-muted)]/70 p-3">
              <dt className="flex items-center gap-1.5 font-bold text-[var(--muted)]">
                {task.status === "done" && task.completedAt ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-[var(--success)]" />
                ) : (
                  <Clock3 className="size-3.5 shrink-0" />
                )}
                {task.status === "done" && task.completedAt ? t.completedOn : t.updated}
              </dt>
              <dd className="mt-1.5 truncate font-semibold tabular-nums">
                <time dateTime={task.completedAt ?? task.updatedAt}>
                  {formatDateTime(task.completedAt ?? task.updatedAt, intlLocale)}
                </time>
              </dd>
            </div>
          ) : null}
        </dl>

        {onStatusChange && !customerStatusOnly && !compact && (
          <div className="mt-4 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-muted)]/60 p-2">
            <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-black tracking-[.1em] text-[var(--muted)] uppercase">
              <span>{t.quickStatus}</span>
              {statusUpdating && <LoaderCircle className="size-3.5 animate-spin" />}
            </div>
            <div
              className="grid grid-cols-2 gap-1 sm:grid-cols-4"
              role="group"
              aria-label={t.quickStatus}
            >
              {statusOptions.map(({ status, icon: OptionIcon }) => {
                const active = task.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => onStatusChange(status)}
                    disabled={statusUpdating || active}
                    aria-pressed={active}
                    aria-label={`${t.setStatus}: ${getTaskStatusLabel(status, locale)}`}
                    className={cn(
                      "focus-ring flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition disabled:cursor-default",
                      active
                        ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                        : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
                    )}
                  >
                    <OptionIcon className="size-3.5 shrink-0" />
                    <span className="truncate">{getTaskStatusLabel(status, locale)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(onStatusChange && customerStatusOnly) || onDiscussSupport ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {onStatusChange && customerStatusOnly && (
              <button
                type="button"
                onClick={() => onStatusChange(nextTaskStatus)}
                disabled={statusUpdating}
                className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-60"
              >
                {task.status === "done" ? (
                  <RotateCcw className="size-3.5" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {task.status === "done" ? t.reopenRequest : t.closeRequest}
              </button>
            )}
            {onDiscussSupport && (
              <button
                type="button"
                onClick={onDiscussSupport}
                disabled={supportUpdating}
                className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--primary-soft)] px-3 text-xs font-bold text-[var(--primary)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--on-primary)] disabled:opacity-60"
              >
                <Edit3 className="size-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="focus-ring grid size-11 place-items-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
                aria-label={`${t.delete}: ${task.title}`}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <p
        className={cn(
          "mt-2 min-h-5 flex-1 text-sm text-[var(--muted)]",
          compact ? "truncate leading-5" : "line-clamp-3 leading-7",
        )}
        dir="auto"
      >
        {task.description || "—"}
      </p>

      {onStatusChange && !compact && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between px-1 text-xs font-extrabold tracking-[.08em] text-[var(--muted)] uppercase">
            <span>{t.quickStatus}</span>
            {statusUpdating && (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            )}
          </div>
          <div
            className="grid grid-cols-3 gap-1 rounded-full bg-[var(--surface-muted)] p-1"
            role="group"
            aria-label={t.quickStatus}
            aria-busy={statusUpdating || undefined}
          >
            {statusOrder.map((nextStatus) => {
              const option = statusClasses[nextStatus];
              const OptionIcon = option.icon;
              const active = task.status === nextStatus;

              return (
                <button
                  key={nextStatus}
                  type="button"
                  onClick={() => onStatusChange(nextStatus)}
                  disabled={statusUpdating || active}
                  aria-pressed={active}
                  aria-label={`${t.setStatus}: ${t.status[nextStatus]}`}
                  className={cn(
                    "focus-ring flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-full px-1.5 py-2 text-xs font-bold transition disabled:cursor-default",
                    active
                      ? quickStatusClasses[nextStatus]
                      : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
                  )}
                >
                  <OptionIcon className="size-3.5 shrink-0" />
                  <span className="truncate">{t.status[nextStatus]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={cn(
          "space-y-2 border-t text-xs text-[var(--muted)]",
          compact ? "mt-3 pt-3" : "mt-5 pt-4",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-start gap-2 leading-5",
            overdue && "font-bold text-rose-600 dark:text-rose-300",
          )}
        >
          <CalendarDays className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            {task.dueDate ? (
              <time dateTime={task.dueDate}>
                {formatDateTime(task.dueDate, intlLocale)}
              </time>
            ) : (
              "—"
            )}
            {overdue && <span> · {t.overdue}</span>}
          </span>
        </div>
        {task.status === "done" && task.completedAt && (
          <div className="flex min-w-0 items-start gap-2 leading-5 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
              {t.completedOn}{" "}
              <time dateTime={task.completedAt}>
                {formatDateTime(task.completedAt, intlLocale)}
              </time>
            </span>
          </div>
        )}
        {showUpdatedAt && !(task.status === "done" && task.completedAt) && (
          <div className="flex min-w-0 items-start gap-2 leading-5">
            <Clock3 className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
              {t.updated}{" "}
              <time dateTime={task.updatedAt}>
                {formatDateTime(task.updatedAt, intlLocale)}
              </time>
            </span>
          </div>
        )}
        {showOwner && owner && (
          <div className="flex min-w-0 items-start gap-2 leading-5">
            <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <Link
              href={`/admin/users/${getId(owner)}`}
              className="focus-ring min-w-0 truncate rounded-[var(--control-radius)] font-bold text-[var(--foreground)] hover:text-[var(--primary)]"
              dir="auto"
            >
              {owner.firstName} {owner.lastName}
            </Link>
          </div>
        )}
      </div>
      <span className="sr-only">
        {t.ticket}: {ticketNumber}
      </span>
    </article>
  );
}
