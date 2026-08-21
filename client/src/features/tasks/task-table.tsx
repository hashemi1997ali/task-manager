"use client";

import { Headset, LoaderCircle, Pencil, Trash2, UserRoundCheck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  TaskPriorityBadge,
  TaskStatusBadge,
  taskStatusBadgeClassName,
  TicketCategoryBadge,
} from "@/components/ui/domain-badge";
import { SlaCountdown, isTicketSlaBreached } from "@/features/tasks/sla-countdown";
import {
  getTaskPriorityLabel,
  getTaskStatusLabel,
  getTicketCategoryLabel,
  getTicketSourceLabel,
} from "@/lib/domain-labels";
import type { Task, TaskStatus } from "@/lib/types";
import { formatDateTime, getId } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    ticket: "Ticket",
    requester: "Requester",
    status: "Status",
    priority: "Priority",
    category: "Category",
    sla: "Active SLA",
    requested: "Requested deadline",
    agent: "Agent",
    actions: "Actions",
    edit: "Edit ticket",
    delete: "Delete ticket",
    setStatus: "Change status to",
    unassigned: "Unassigned",
    closeRequest: "Close request",
    reopenRequest: "Reopen request",
    discussSupport: "Discuss with support",
    openConversation: "Open conversation",
  },
  de: {
    ticket: "Ticket",
    requester: "Anfragende Person",
    status: "Status",
    priority: "Priorität",
    category: "Kategorie",
    sla: "Aktives SLA",
    requested: "Gewünscht bis",
    agent: "Agent",
    actions: "Aktionen",
    edit: "Ticket bearbeiten",
    delete: "Ticket löschen",
    setStatus: "Status ändern zu",
    unassigned: "Nicht zugewiesen",
    closeRequest: "Anfrage schließen",
    reopenRequest: "Anfrage wieder öffnen",
    discussSupport: "Mit Support besprechen",
    openConversation: "Gespräch öffnen",
  },
} as const;

const statusOrder: TaskStatus[] = ["todo", "in-progress", "waiting-customer", "done"];
const nextStatus = (status: TaskStatus): TaskStatus => {
  const index = statusOrder.indexOf(status);
  return statusOrder[(index + 1) % statusOrder.length];
};

const statusStripeClasses: Record<TaskStatus, string> = {
  todo: "bg-slate-700 dark:bg-slate-300",
  "in-progress": "bg-amber-600 dark:bg-amber-300",
  "waiting-customer": "bg-violet-600 dark:bg-violet-300",
  done: "bg-emerald-600 dark:bg-emerald-300",
};

export function TaskTable({
  tasks,
  referenceTime,
  showOwner = false,
  onEdit,
  onDelete,
  onStatusChange,
  isStatusUpdating,
  customerStatusOnly = false,
  onDiscussSupport,
  staffSupportAction = false,
  isSupportOpening,
  canManage,
}: {
  tasks: Task[];
  referenceTime: number;
  showOwner?: boolean;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onStatusChange?: (task: Task, status: TaskStatus) => void;
  isStatusUpdating?: (task: Task) => boolean;
  customerStatusOnly?: boolean;
  onDiscussSupport?: (task: Task) => void;
  staffSupportAction?: boolean;
  isSupportOpening?: (task: Task) => boolean;
  canManage?: (task: Task) => boolean;
}) {
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const showActions = Boolean(onEdit || onDelete || onDiscussSupport);
  const gridClassName = showOwner
    ? showActions
      ? "grid-cols-[minmax(12.5rem,1.7fr)_minmax(7.5rem,.8fr)_7.75rem_9rem_8.5rem_6.5rem]"
      : "grid-cols-[minmax(12.5rem,1.7fr)_minmax(7.5rem,.8fr)_7.75rem_9rem_8.5rem]"
    : showActions
      ? "grid-cols-[minmax(15rem,2fr)_7.75rem_9rem_8.5rem_6.5rem]"
      : "grid-cols-[minmax(15rem,2fr)_7.75rem_9rem_8.5rem]";

  return (
    <div className="desk-table-shell hidden overflow-x-auto xl:block">
      <div className="min-w-[58rem]">
        <div
          className={`grid gap-4 border-b border-[var(--border)]/80 bg-[var(--surface-muted)]/75 px-5 py-3.5 text-[10px] font-black tracking-[0.1em] text-[var(--muted)] uppercase ${gridClassName}`}
        >
          <span>{t.ticket}</span>
          {showOwner && <span>{t.requester}</span>}
          <span>{t.status}</span>
          <span>{t.sla}</span>
          <span>{t.requested}</span>
          {showActions && <span className="sr-only">{t.actions}</span>}
        </div>
        <div className="divide-y divide-[var(--border)]/65">
          {tasks.map((task) => {
            const updating = isStatusUpdating?.(task) ?? false;
            const manageable = canManage?.(task) ?? true;
            const owner = typeof task.owner === "object" ? task.owner : null;
            const assignee = typeof task.assignee === "object" ? task.assignee : null;
            const category = task.category ?? "general";
            const source = task.source ?? "manual";
            const requestedOverdue = Boolean(
              task.status !== "done" &&
              task.dueDate &&
              new Date(task.dueDate).getTime() < referenceTime,
            );
            const slaBreached = isTicketSlaBreached(task, referenceTime);
            const ticketNumber =
              task.ticketNumber || `#${getId(task).slice(-6).toUpperCase()}`;

            return (
              <article
                key={getId(task)}
                className={`group relative grid min-h-[6.25rem] items-center gap-4 overflow-hidden px-5 py-4 transition-colors hover:bg-[var(--surface-muted)]/65 ${gridClassName}`}
              >
                <span
                  className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${
                    slaBreached || requestedOverdue
                      ? "bg-rose-600 dark:bg-rose-300"
                      : statusStripeClasses[task.status]
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="shrink-0 rounded-md bg-[var(--primary-soft)] px-2 py-1 font-mono text-[10px] font-black tracking-wide text-[var(--primary)]">
                      {ticketNumber}
                    </span>
                    <span className="truncate text-[10px] font-bold tracking-wide text-[var(--muted)] uppercase">
                      {getTicketSourceLabel(source, locale)}
                    </span>
                    <TicketCategoryBadge category={category}>
                      {getTicketCategoryLabel(category, locale)}
                    </TicketCategoryBadge>
                  </div>
                  <h3 className="mt-2 truncate text-sm font-black tracking-[-0.015em] transition-colors group-hover:text-[var(--primary)]">
                    {task.title}
                  </h3>
                  <p className="mt-1 truncate text-[11px] leading-5 text-[var(--muted)]">
                    {task.description || "—"}
                  </p>
                </div>
                {showOwner && (
                  <div className="flex min-w-0 items-center gap-2.5 text-xs">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] font-black text-[var(--primary)]">
                      {owner?.firstName?.slice(0, 1).toUpperCase() ?? "—"}
                    </span>
                    <div className="min-w-0">
                      {owner ? (
                        <Link
                          href={`/admin/users/${getId(owner)}`}
                          className="focus-ring block min-w-0 truncate rounded py-0.5 font-bold hover:text-[var(--primary)]"
                        >
                          {owner.firstName} {owner.lastName}
                        </Link>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                      <span className="mt-1 flex min-w-0 items-center gap-1 truncate text-[10px] font-semibold text-[var(--muted)]">
                        <UserRoundCheck className="size-3 shrink-0" aria-hidden="true" />
                        <span className="sr-only">{t.agent}: </span>
                        {assignee
                          ? `${assignee.firstName} ${assignee.lastName}`
                          : t.unassigned}
                      </span>
                    </div>
                  </div>
                )}
                <div className="grid justify-items-start gap-1.5">
                  {onStatusChange && manageable && !customerStatusOnly ? (
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
                  ) : customerStatusOnly && onStatusChange && manageable ? (
                    <>
                      <TaskStatusBadge status={task.status}>
                        {getTaskStatusLabel(task.status, locale)}
                      </TaskStatusBadge>
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() =>
                          onStatusChange(task, task.status === "done" ? "todo" : "done")
                        }
                        className="focus-ring rounded text-[11px] font-semibold text-[var(--primary)] hover:underline disabled:cursor-wait disabled:opacity-60"
                      >
                        {task.status === "done" ? t.reopenRequest : t.closeRequest}
                      </button>
                    </>
                  ) : (
                    <TaskStatusBadge status={task.status}>
                      {getTaskStatusLabel(task.status, locale)}
                    </TaskStatusBadge>
                  )}
                  <TaskPriorityBadge priority={task.priority}>
                    {getTaskPriorityLabel(task.priority, locale)}
                  </TaskPriorityBadge>
                </div>
                <SlaCountdown
                  ticket={task}
                  compact
                  className="text-xs"
                  referenceTime={referenceTime}
                />
                <time
                  dateTime={task.dueDate ?? undefined}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold tabular-nums ${requestedOverdue ? "bg-rose-500/10 text-[var(--danger)]" : "text-[var(--muted)]"}`}
                >
                  {task.dueDate ? formatDateTime(task.dueDate, intlLocale) : "—"}
                </time>
                {showActions && (
                  <div className="flex justify-end gap-1 rounded-xl border border-[var(--border)]/70 bg-[var(--surface-muted)]/70 p-1">
                    {onDiscussSupport && (!staffSupportAction || manageable) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-lg"
                        aria-label={
                          staffSupportAction ? t.openConversation : t.discussSupport
                        }
                        title={staffSupportAction ? t.openConversation : t.discussSupport}
                        disabled={isSupportOpening?.(task)}
                        onClick={() => onDiscussSupport(task)}
                      >
                        {isSupportOpening?.(task) ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Headset className="size-4" />
                        )}
                      </Button>
                    )}
                    {onEdit && manageable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-lg"
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
                        className="size-9 rounded-lg border-0 bg-transparent"
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
    </div>
  );
}
