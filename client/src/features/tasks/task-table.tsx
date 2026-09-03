"use client";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ListTodo,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  TaskPriorityBadge,
  TaskStatusBadge,
  taskStatusBadgeClassName,
} from "@/components/ui/domain-badge";
import { getTaskPriorityLabel, getTaskStatusLabel } from "@/lib/domain-labels";
import type { Task, TaskStatus } from "@/lib/types";
import { cn, formatDate, formatTime, getId } from "@/lib/utils";
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
  polished = false,
  onEdit,
  onDelete,
  onStatusChange,
  isStatusUpdating,
}: {
  tasks: Task[];
  referenceTime: number;
  showOwner?: boolean;
  polished?: boolean;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onStatusChange?: (task: Task, status: TaskStatus) => void;
  isStatusUpdating?: (task: Task) => boolean;
}) {
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const showActions = Boolean(onEdit || onDelete);
  const gridClassName = polished
    ? showOwner
      ? showActions
        ? "grid-cols-[minmax(10rem,1.5fr)_minmax(6rem,.9fr)_7rem_6.5rem_7.5rem_7.5rem_4.75rem]"
        : "grid-cols-[minmax(10rem,1.5fr)_minmax(6rem,.9fr)_7rem_6.5rem_7.5rem_7.5rem]"
      : showActions
        ? "grid-cols-[minmax(15rem,1.8fr)_8rem_7rem_9rem_9rem_5rem]"
        : "grid-cols-[minmax(15rem,1.8fr)_8rem_7rem_9rem_9rem]"
    : showOwner
      ? showActions
        ? "grid-cols-[minmax(0,1.45fr)_minmax(7rem,1fr)_7rem_7rem_8rem_8rem_5.5rem]"
        : "grid-cols-[minmax(0,1.45fr)_minmax(7rem,1fr)_7rem_7rem_8rem_8rem]"
      : showActions
        ? "grid-cols-[minmax(0,1.7fr)_7rem_7rem_8rem_8rem_5.5rem]"
        : "grid-cols-[minmax(0,1.7fr)_7rem_7rem_8rem_8rem]";

  return (
    <div
      className={cn(
        "hidden overflow-hidden rounded-[var(--container-radius)] border bg-[var(--surface)] xl:block",
        polished && "border-[color-mix(in_srgb,var(--border)_82%,transparent)]",
      )}
    >
      <div
        className={cn(
          "grid gap-3 border-b bg-[var(--surface-muted)] px-4 py-3 text-xs font-semibold text-[var(--muted)]",
          polished &&
            "bg-[color-mix(in_srgb,var(--surface-muted)_72%,var(--surface))] py-3.5 text-[10px] font-extrabold tracking-[0.12em] uppercase",
          gridClassName,
        )}
      >
        <span>{t.task}</span>
        {showOwner && <span>{t.owner}</span>}
        <span>{t.status}</span>
        <span>{t.priority}</span>
        <span>{t.due}</span>
        <span>{t.updated}</span>
        {showActions && (
          <span className={polished ? "text-right" : "sr-only"}>{t.actions}</span>
        )}
      </div>
      <div
        className={
          polished
            ? "divide-y divide-[color-mix(in_srgb,var(--border)_54%,transparent)]"
            : "divide-y"
        }
      >
        {tasks.map((task) => {
          const updating = isStatusUpdating?.(task) ?? false;
          const owner = typeof task.owner === "object" ? task.owner : null;
          const completed = task.status === "done";
          const overdue = Boolean(
            task.status !== "done" &&
            task.dueDate &&
            new Date(task.dueDate).getTime() < referenceTime,
          );

          return (
            <article
              key={getId(task)}
              className={cn(
                "relative grid items-center gap-3 overflow-hidden transition-[background-color,border-color,box-shadow,transform] duration-200",
                polished
                  ? overdue
                    ? "min-h-[4.75rem] px-4 py-3 hover:bg-rose-50/60 dark:hover:bg-rose-500/8"
                    : "min-h-[4.75rem] px-4 py-3 hover:bg-[var(--surface-muted)]"
                  : "p-4 hover:bg-[var(--surface-muted)]",
                gridClassName,
              )}
            >
              {!polished && (
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 w-1.5",
                    overdue
                      ? "bg-rose-600 dark:bg-rose-300"
                      : statusStripeClasses[task.status],
                  )}
                  aria-hidden="true"
                />
              )}
              <div className={cn("min-w-0", polished && "flex items-center gap-3 pl-1")}>
                {polished && (
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center text-[var(--muted)]",
                      overdue && "text-rose-600 dark:text-rose-300",
                    )}
                    aria-hidden="true"
                  >
                    <ListTodo className="size-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold" dir="auto">
                    {task.title}
                  </h3>
                  <p
                    className="mt-1 truncate text-xs leading-5 text-[var(--muted)]"
                    dir="auto"
                  >
                    {task.description || "—"}
                  </p>
                </div>
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
              <TaskPriorityBadge
                priority={task.priority}
                className={cn(
                  "justify-self-start",
                  polished &&
                    "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)] dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--muted)]",
                )}
              >
                {getTaskPriorityLabel(task.priority, locale)}
              </TaskPriorityBadge>
              <span
                className={cn(
                  "text-xs text-[var(--muted)]",
                  polished && "flex items-center gap-2 font-semibold",
                  overdue && "text-rose-700 dark:text-rose-300",
                )}
              >
                {polished && <CalendarDays className="size-3.5 shrink-0" />}
                {task.dueDate ? (
                  <span className="min-w-0">
                    <span className="block">{formatDate(task.dueDate, intlLocale)}</span>
                    <span className="mt-0.5 block text-[10px] font-normal opacity-75">
                      {formatTime(task.dueDate, intlLocale)}
                    </span>
                  </span>
                ) : (
                  <span>—</span>
                )}
              </span>
              <span
                className={cn(
                  "text-xs text-[var(--muted)]",
                  polished && "flex items-center gap-2",
                  completed && "font-semibold text-emerald-700 dark:text-emerald-300",
                )}
              >
                {polished &&
                  (completed ? (
                    <CheckCircle2 className="size-3.5 shrink-0" />
                  ) : (
                    <Clock3 className="size-3.5 shrink-0" />
                  ))}
                <span className="min-w-0">
                  <span className="block">{formatDate(task.updatedAt, intlLocale)}</span>
                  <span className="mt-0.5 block text-[10px] font-normal opacity-75">
                    {formatTime(task.updatedAt, intlLocale)}
                  </span>
                </span>
              </span>
              {showActions && (
                <div className="flex justify-end gap-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t.edit}
                      onClick={() => onEdit(task)}
                      className={polished ? "size-9 rounded-xl" : undefined}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant={polished ? "ghost" : "danger"}
                      size="icon"
                      aria-label={t.delete}
                      onClick={() => onDelete(task)}
                      className={
                        polished
                          ? "size-9 rounded-xl text-[var(--muted)] hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
                          : undefined
                      }
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
