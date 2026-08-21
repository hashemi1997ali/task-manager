"use client";

import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Edit3,
  LoaderCircle,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import {
  TaskPriorityBadge,
  TaskStatusBadge,
  taskStatusBadgeClassName,
} from "@/components/ui/domain-badge";
import type { Task, TaskStatus } from "@/lib/types";
import { cn, formatDateTime, getId } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    status: { todo: "To do", "in-progress": "In progress", done: "Done" },
    priority: { low: "Low", medium: "Medium", high: "High" },
    edit: "Edit",
    delete: "Delete",
    completedOn: "Completed on",
    overdue: "Overdue",
    quickStatus: "Quick status",
    setStatus: "Change status to",
    updated: "Updated",
    id: "ID",
  },
  de: {
    status: { todo: "Offen", "in-progress": "In Bearbeitung", done: "Erledigt" },
    priority: {
      low: "Niedrig",
      medium: "Mittel",
      high: "Hoch",
    },
    edit: "Bearbeiten",
    delete: "Löschen",
    completedOn: "Erledigt am",
    overdue: "Überfällig",
    quickStatus: "Schnellstatus",
    setStatus: "Status ändern zu",
    updated: "Aktualisiert",
    id: "ID",
  },
} as const;

const statusClasses: Record<TaskStatus, { className: string; icon: typeof Circle }> = {
  todo: { className: "bg-[var(--surface-muted)] text-[var(--muted)]", icon: Circle },
  "in-progress": {
    className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    icon: Clock3,
  },
  done: {
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    icon: CheckCircle2,
  },
};

const quickStatusClasses: Record<TaskStatus, string> = {
  todo: "bg-[var(--surface)] text-[var(--foreground)] shadow-sm",
  "in-progress":
    "bg-amber-50 text-amber-700 shadow-sm dark:bg-amber-500/15 dark:text-amber-300",
  done: "bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-500/15 dark:text-emerald-300",
};

const statusStripeClasses: Record<TaskStatus, string> = {
  todo: "bg-slate-700 dark:bg-slate-300",
  "in-progress": "bg-amber-700 dark:bg-amber-300",
  done: "bg-emerald-700 dark:bg-emerald-300",
};

const statusOrder: TaskStatus[] = ["todo", "in-progress", "done"];

export function TaskCard({
  task,
  showOwner,
  referenceTime,
  onEdit,
  onDelete,
  onStatusChange,
  statusUpdating,
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
  compact?: boolean;
  showUpdatedAt?: boolean;
}) {
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const owner = typeof task.owner === "object" ? task.owner : null;
  const overdue =
    task.status !== "done" &&
    task.dueDate &&
    new Date(task.dueDate).getTime() < referenceTime;
  const nextTaskStatus: TaskStatus =
    task.status === "todo"
      ? "in-progress"
      : task.status === "in-progress"
        ? "done"
        : "todo";

  return (
    <Card
      spotlight={!compact}
      className={cn(
        "relative flex flex-col overflow-hidden transition-colors duration-200 hover:border-[var(--primary)]/50",
        compact ? "min-h-0 p-4" : "min-h-72 p-5",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          overdue ? "bg-rose-600 dark:bg-rose-300" : statusStripeClasses[task.status],
        )}
        aria-hidden="true"
      />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            {onStatusChange ? (
              <button
                type="button"
                onClick={() => onStatusChange(nextTaskStatus)}
                disabled={statusUpdating}
                aria-label={`${t.setStatus}: ${t.status[nextTaskStatus]}`}
                className={taskStatusBadgeClassName(
                  task.status,
                  "focus-ring disabled:cursor-wait disabled:opacity-60",
                )}
              >
                {t.status[task.status]}
              </button>
            ) : (
              <TaskStatusBadge status={task.status}>
                {t.status[task.status]}
              </TaskStatusBadge>
            )}
            <TaskPriorityBadge priority={task.priority}>
              {t.priority[task.priority]}
            </TaskPriorityBadge>
          </div>
          <h3
            className={cn(
              "font-bold tracking-tight text-[var(--foreground)]",
              compact
                ? "mt-3 truncate text-sm leading-5"
                : "mt-4 line-clamp-2 text-lg leading-7",
            )}
            dir="auto"
          >
            {task.title}
          </h3>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex shrink-0 gap-1">
            {onEdit && (
              <button
                onClick={onEdit}
                className="focus-ring grid size-11 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
                aria-label={`${t.edit}: ${task.title}`}
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
        {t.id}: {getId(task)}
      </span>
    </Card>
  );
}
