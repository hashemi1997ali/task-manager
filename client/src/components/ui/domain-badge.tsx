import type { ReactNode } from "react";

import type { TaskPriority, TaskStatus, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const base =
  "inline-flex h-7 w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3 text-xs font-bold leading-none";

const taskStatusClasses: Record<TaskStatus, string> = {
  todo: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/25 dark:bg-slate-500/15 dark:text-slate-300",
  "in-progress":
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/15 dark:text-amber-300",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/15 dark:text-emerald-300",
};

const taskPriorityClasses: Record<TaskPriority, string> = {
  low: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/25 dark:bg-sky-500/15 dark:text-sky-300",
  medium: "border-[var(--primary)]/20 bg-[var(--primary-soft)] text-[var(--primary)]",
  high: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/15 dark:text-rose-300",
};

export const taskStatusBadgeClassName = (
  status: TaskStatus,
  className?: string,
): string => cn(base, taskStatusClasses[status], className);

export const taskPriorityBadgeClassName = (
  priority: TaskPriority,
  className?: string,
): string => cn(base, taskPriorityClasses[priority], className);

export function TaskStatusBadge({
  status,
  children,
  className,
}: {
  status: TaskStatus;
  children: ReactNode;
  className?: string;
}) {
  return <span className={taskStatusBadgeClassName(status, className)}>{children}</span>;
}

export function TaskPriorityBadge({
  priority,
  children,
  className,
}: {
  priority: TaskPriority;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={taskPriorityBadgeClassName(priority, className)}>{children}</span>
  );
}

export function RoleBadge({
  role,
  children,
  className,
}: {
  role: UserRole;
  children: ReactNode;
  className?: string;
}) {
  const classNames =
    role === "super_admin"
      ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/15 dark:text-violet-300"
      : role === "admin"
        ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-300"
        : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/25 dark:bg-slate-500/15 dark:text-slate-300";
  return <span className={cn(base, classNames, className)}>{children}</span>;
}

export function UserTypeBadge({
  type,
  children,
  className,
}: {
  type: UserRole | "guest";
  children: ReactNode;
  className?: string;
}) {
  if (type !== "guest") {
    return (
      <RoleBadge role={type} className={className}>
        {children}
      </RoleBadge>
    );
  }
  return (
    <span
      className={cn(
        base,
        "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-500/15 dark:text-cyan-300",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ChatStatusBadge({
  status,
  children,
  className,
}: {
  status: "assistant" | "open" | "active" | "ended";
  children: ReactNode;
  className?: string;
}) {
  const classNames =
    status === "open"
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/15 dark:text-amber-300"
      : status === "active"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/15 dark:text-emerald-300"
        : status === "ended"
          ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/25 dark:bg-slate-500/15 dark:text-slate-300"
          : "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/15 dark:text-violet-300";
  return <span className={cn(base, classNames, className)}>{children}</span>;
}

export function FormStatusBadge({
  status,
  children,
  className,
}: {
  status: "open" | "answered";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        base,
        status === "open"
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/15 dark:text-amber-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/15 dark:text-emerald-300",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AccountStatusBadge({
  banned,
  children,
  className,
  title,
}: {
  banned: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn(
        base,
        banned
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/15 dark:text-rose-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/15 dark:text-emerald-300",
        className,
      )}
      title={title}
    >
      {children}
    </span>
  );
}
