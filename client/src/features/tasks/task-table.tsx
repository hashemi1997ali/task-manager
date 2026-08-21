"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  TaskPriorityBadge,
  TaskStatusBadge,
  taskStatusBadgeClassName,
} from "@/components/ui/domain-badge";
import { getTaskPriorityLabel, getTaskStatusLabel } from "@/lib/domain-labels";
import type { Task, TaskStatus } from "@/lib/types";
import { formatDate, getId } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    task: "Task",
    owner: "Owner",
    status: "Status",
    priority: "Priority",
    due: "Due",
    updated: "Updated",
    actions: "Actions",
    edit: "Edit task",
    delete: "Delete task",
    setStatus: "Change status to",
  },
  de: {
    task: "Aufgabe",
    owner: "Besitzer",
    status: "Status",
    priority: "Priorität",
    due: "Fällig",
    updated: "Aktualisiert",
    actions: "Aktionen",
    edit: "Aufgabe bearbeiten",
    delete: "Aufgabe löschen",
    setStatus: "Status ändern zu",
  },
} as const;

const nextStatus = (status: TaskStatus): TaskStatus =>
  status === "todo" ? "in-progress" : status === "in-progress" ? "done" : "todo";

const statusStripeClasses: Record<TaskStatus, string> = {
  todo: "bg-slate-700 dark:bg-slate-300",
  "in-progress": "bg-amber-700 dark:bg-amber-300",
  done: "bg-emerald-700 dark:bg-emerald-300",
};

export function TaskTable({
  tasks,
  referenceTime,
  showOwner = false,
  onEdit,
  onDelete,
  onStatusChange,
  isStatusUpdating,
}: {
  tasks: Task[];
  referenceTime: number;
  showOwner?: boolean;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onStatusChange?: (task: Task, status: TaskStatus) => void;
  isStatusUpdating?: (task: Task) => boolean;
}) {
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const showActions = Boolean(onEdit || onDelete);
  const gridClassName = showOwner
    ? showActions
      ? "grid-cols-[minmax(0,1.45fr)_minmax(7rem,1fr)_7rem_7rem_8rem_8rem_5.5rem]"
      : "grid-cols-[minmax(0,1.45fr)_minmax(7rem,1fr)_7rem_7rem_8rem_8rem]"
    : showActions
      ? "grid-cols-[minmax(0,1.7fr)_7rem_7rem_8rem_8rem_5.5rem]"
      : "grid-cols-[minmax(0,1.7fr)_7rem_7rem_8rem_8rem]";

  return (
    <div className="hidden overflow-hidden rounded-[var(--container-radius)] border bg-[var(--surface)] xl:block">
      <div
        className={`grid gap-3 border-b bg-[var(--surface-muted)] px-4 py-3 text-xs font-semibold text-[var(--muted)] ${gridClassName}`}
      >
        <span>{t.task}</span>
        {showOwner && <span>{t.owner}</span>}
        <span>{t.status}</span>
        <span>{t.priority}</span>
        <span>{t.due}</span>
        <span>{t.updated}</span>
        {showActions && <span className="sr-only">{t.actions}</span>}
      </div>
      <div className="divide-y">
        {tasks.map((task) => {
          const updating = isStatusUpdating?.(task) ?? false;
          const owner = typeof task.owner === "object" ? task.owner : null;
          const overdue = Boolean(
            task.status !== "done" &&
            task.dueDate &&
            new Date(task.dueDate).getTime() < referenceTime,
          );

          return (
            <article
              key={getId(task)}
              className={`relative grid items-center gap-3 overflow-hidden p-4 transition-colors hover:bg-[var(--surface-muted)] ${gridClassName}`}
            >
              <span
                className={`absolute inset-y-0 left-0 w-1.5 ${
                  overdue
                    ? "bg-rose-600 dark:bg-rose-300"
                    : statusStripeClasses[task.status]
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{task.title}</h3>
                <p className="mt-1 truncate text-xs text-[var(--muted)]">
                  {task.description || "—"}
                </p>
              </div>
              {showOwner && (
                <div className="min-w-0">
                  {owner ? (
                    <Link
                      href={`/admin/users/${getId(owner)}`}
                      className="focus-ring flex min-w-0 items-center rounded-[var(--control-radius)] py-0.5 text-xs font-semibold hover:text-[var(--primary)]"
                    >
                      <span className="truncate">
                        {owner.firstName} {owner.lastName}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </div>
              )}
              {onStatusChange ? (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => onStatusChange(task, nextStatus(task.status))}
                  aria-label={`${t.setStatus}: ${getTaskStatusLabel(nextStatus(task.status), locale)}`}
                  className={taskStatusBadgeClassName(
                    task.status,
                    "focus-ring justify-self-start disabled:cursor-wait disabled:opacity-60",
                  )}
                >
                  {getTaskStatusLabel(task.status, locale)}
                </button>
              ) : (
                <TaskStatusBadge status={task.status} className="justify-self-start">
                  {getTaskStatusLabel(task.status, locale)}
                </TaskStatusBadge>
              )}
              <TaskPriorityBadge priority={task.priority} className="justify-self-start">
                {getTaskPriorityLabel(task.priority, locale)}
              </TaskPriorityBadge>
              <span className="text-xs text-[var(--muted)]">
                {task.dueDate ? formatDate(task.dueDate, intlLocale) : "—"}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {formatDate(task.updatedAt, intlLocale)}
              </span>
              {showActions && (
                <div className="flex justify-end gap-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t.edit}
                      onClick={() => onEdit(task)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="danger"
                      size="icon"
                      aria-label={t.delete}
                      onClick={() => onDelete(task)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
