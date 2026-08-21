"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CalendarCheck2,
  CheckCircle2,
  Circle,
  Clock3,
  ListTodo,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/ui/domain-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { TrendChart } from "@/components/ui/trend-chart";
import { useAuth } from "@/features/auth/auth-provider";
import { getTodayDashboardRequest, updateTaskRequest } from "@/features/tasks/api";
import { getErrorMessage } from "@/lib/api-error";
import type { Task, TodayDashboard } from "@/lib/types";
import { cn, formatNumber, formatPercent, getId } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    greetings: {
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening",
    },
    intro: "Here’s what needs your attention today.",
    tasksToday: "Tasks today",
    completed: "Completed",
    overdue: "Overdue",
    completionRate: "Completion rate",
    focus: "Today focus",
    upcoming: "Upcoming",
    aiBrief: "AI Daily Brief",
    aiAction: "Fix my schedule",
    askAi: "Ask AI about my day",
    weekly: "Weekly progress",
    lastSevenDays: "Last 7 days",
    noTasks: "No active tasks need your attention.",
    today: "Today",
    overdueLabel: "Overdue",
    noUpcoming: "No tasks",
    scheduledTasks: (count: number) => `${count} task${count === 1 ? "" : "s"} scheduled`,
    completedTasks: (count: number) => `${count} task${count === 1 ? "" : "s"} completed`,
    priority: { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" },
    status: {
      todo: "To do",
      "in-progress": "In progress",
      "waiting-customer": "Waiting on customer",
      done: "Done",
    },
    brief: ({
      overdue,
      highPriority,
      dueToday,
      scheduleConflicts,
    }: TodayDashboard["dailyBrief"]) => {
      const details = [
        overdue > 0 ? `${overdue} overdue task${overdue === 1 ? "" : "s"}` : null,
        dueToday > 0
          ? `${dueToday} task${dueToday === 1 ? "" : "s"} still due today`
          : null,
        highPriority > 0
          ? `${highPriority} high-priority item${highPriority === 1 ? "" : "s"}`
          : null,
        scheduleConflicts > 0
          ? `${scheduleConflicts} potential scheduling conflict${scheduleConflicts === 1 ? "" : "s"}`
          : null,
      ].filter(Boolean);
      return details.length
        ? `Karino found ${details.join(", ")}.`
        : "Your schedule looks clear. Choose one meaningful task to move forward.";
    },
  },
  de: {
    greetings: {
      morning: "Guten Morgen",
      afternoon: "Guten Tag",
      evening: "Guten Abend",
    },
    intro: "Das benötigt heute deine Aufmerksamkeit.",
    tasksToday: "Aufgaben heute",
    completed: "Erledigt",
    overdue: "Überfällig",
    completionRate: "Erledigungsquote",
    focus: "Fokus für heute",
    upcoming: "Demnächst",
    aiBrief: "KI-Tagesübersicht",
    aiAction: "Zeitplan optimieren",
    askAi: "KI zu meinem Tag fragen",
    weekly: "Wochenfortschritt",
    lastSevenDays: "Letzte 7 Tage",
    noTasks: "Keine aktiven Aufgaben benötigen deine Aufmerksamkeit.",
    today: "Heute",
    overdueLabel: "Überfällig",
    noUpcoming: "Keine Aufgaben",
    scheduledTasks: (count: number) =>
      `${count} Aufgabe${count === 1 ? "" : "n"} geplant`,
    completedTasks: (count: number) =>
      `${count} Aufgabe${count === 1 ? "" : "n"} erledigt`,
    priority: {
      low: "Niedrig",
      medium: "Mittel",
      high: "Hoch",
      urgent: "Dringend",
    },
    status: {
      todo: "Offen",
      "in-progress": "In Bearbeitung",
      "waiting-customer": "Wartet auf Kunden",
      done: "Erledigt",
    },
    brief: ({
      overdue,
      highPriority,
      dueToday,
      scheduleConflicts,
    }: TodayDashboard["dailyBrief"]) => {
      const details = [
        overdue > 0 ? `${overdue} überfällige Aufgabe${overdue === 1 ? "" : "n"}` : null,
        dueToday > 0
          ? `${dueToday} heute noch fällige Aufgabe${dueToday === 1 ? "" : "n"}`
          : null,
        highPriority > 0
          ? `${highPriority} Eintrag${highPriority === 1 ? "" : "e"} mit hoher Priorität`
          : null,
        scheduleConflicts > 0
          ? `${scheduleConflicts} mögliche${scheduleConflicts === 1 ? "r" : ""} Terminkonflikt${scheduleConflicts === 1 ? "" : "e"}`
          : null,
      ].filter(Boolean);
      return details.length
        ? `Karino hat ${details.join(", ")} gefunden.`
        : "Dein Zeitplan ist übersichtlich. Wähle eine wichtige Aufgabe als nächsten Schritt.";
    },
  },
} as const;

const getGreetingKey = (): "morning" | "afternoon" | "evening" => {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
};

export function DashboardView() {
  const { user } = useAuth();
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const queryClient = useQueryClient();
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "today"],
    queryFn: getTodayDashboardRequest,
  });
  const statusMutation = useMutation({
    mutationFn: (task: Task) =>
      updateTaskRequest(getId(task), {
        status: task.status === "done" ? "todo" : "done",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  if (dashboardQuery.isPending) return <LoadingState />;
  if (dashboardQuery.isError) {
    return (
      <ErrorState
        message={getErrorMessage(dashboardQuery.error, locale)}
        retry={() => void dashboardQuery.refetch()}
      />
    );
  }

  const dashboard = dashboardQuery.data;
  const stats = [
    {
      label: t.tasksToday,
      value: formatNumber(dashboard.stats.tasksToday, intlLocale),
      icon: ListTodo,
    },
    {
      label: t.completed,
      value: formatNumber(dashboard.stats.completed, intlLocale),
      icon: CheckCircle2,
    },
    {
      label: t.overdue,
      value: formatNumber(dashboard.stats.overdue, intlLocale),
      icon: AlertTriangle,
    },
    {
      label: t.completionRate,
      value: formatPercent(dashboard.stats.completionRate, intlLocale),
      icon: Clock3,
    },
  ];
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: dashboard.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dashboard.generatedAt));
  const dateKeyFor = (date: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: dashboard.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(date));

  return (
    <div className="desk-reveal space-y-5">
      <header className="desk-page-header">
        <div>
          <h1 className="text-[1.625rem] leading-8 font-bold tracking-[-0.025em]">
            {t.greetings[getGreetingKey()]}, {user?.firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{t.intro}</p>
          <time className="sr-only" dateTime={dashboard.generatedAt}>
            {new Intl.DateTimeFormat(intlLocale, { dateStyle: "full" }).format(
              new Date(dashboard.generatedAt),
            )}
          </time>
        </div>
      </header>

      <Link
        href="/assistant"
        className={buttonClassName({ className: "flex w-full md:hidden" })}
      >
        <Sparkles className="size-4" />
        {t.askAi}
      </Link>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="desk-stat min-h-[8rem] rounded-[1.25rem] p-4">
            <span className="desk-icon-well">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <p className="mt-3 text-xs font-semibold text-[var(--muted)]">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          </Card>
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,.85fr)]">
        <div className="space-y-5">
          <section className="desk-panel overflow-hidden">
            <h2 className="desk-section-title border-b px-4 py-4 sm:px-5">{t.focus}</h2>
            {dashboard.focusTasks.length === 0 ? (
              <Card className="rounded-none border-0 p-8 text-center text-sm text-[var(--muted)] shadow-none">
                <CalendarCheck2 className="mx-auto mb-3 size-6 text-[var(--success)]" />
                {t.noTasks}
              </Card>
            ) : (
              <div className="divide-y">
                {dashboard.focusTasks.map((task) => {
                  const taskDateKey = task.dueDate ? dateKeyFor(task.dueDate) : "";
                  return (
                    <Card
                      key={getId(task)}
                      className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 rounded-none border-0 p-3 shadow-none transition-colors hover:bg-[var(--surface-muted)]/65 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:px-5"
                    >
                      <button
                        type="button"
                        onClick={() => statusMutation.mutate(task)}
                        aria-label={`${t.status[task.status]}: ${task.title}`}
                        disabled={statusMutation.isPending}
                        className="focus-ring row-span-2 grid size-11 place-items-center rounded-full disabled:opacity-50 sm:row-span-1"
                      >
                        {task.status === "done" ? (
                          <CheckCircle2 className="size-5 text-[var(--primary)]" />
                        ) : (
                          <Circle className="size-5 text-[var(--muted)]" />
                        )}
                      </button>
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <h3 className="truncate text-sm font-semibold">{task.title}</h3>
                        <p
                          className={cn(
                            "mt-1 text-xs text-[var(--muted)]",
                            taskDateKey < todayKey &&
                              task.status !== "done" &&
                              "text-[var(--danger)]",
                          )}
                        >
                          {taskDateKey < todayKey && task.status !== "done"
                            ? t.overdueLabel
                            : t.today}
                        </p>
                      </div>
                      <TaskPriorityBadge priority={task.priority}>
                        {t.priority[task.priority]}
                      </TaskPriorityBadge>
                      <TaskStatusBadge status={task.status}>
                        {t.status[task.status]}
                      </TaskStatusBadge>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section className="desk-panel overflow-hidden">
            <h2 className="desk-section-title border-b px-4 py-4 sm:px-5">{t.upcoming}</h2>
            <Card className="grid grid-cols-5 gap-1 rounded-none border-0 p-3 shadow-none sm:p-5">
              {dashboard.upcoming.map((day) => {
                const date = new Date(`${day.date}T12:00:00Z`);
                const dateLabel = new Intl.DateTimeFormat(intlLocale, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  timeZone: "UTC",
                }).format(date);
                return (
                  <div
                    key={day.date}
                    className="flex min-w-0 flex-col items-center rounded-[10px] px-1 py-3 text-center"
                    aria-label={`${dateLabel}: ${
                      day.count ? t.scheduledTasks(day.count) : t.noUpcoming
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-[var(--muted)]">
                      {new Intl.DateTimeFormat(intlLocale, {
                        weekday: "short",
                        timeZone: "UTC",
                      }).format(date)}
                    </span>
                    <span
                      className={cn(
                        "my-4 size-3 rounded-[4px] rotate-45",
                        day.count
                          ? "bg-[var(--primary)]"
                          : "bg-[var(--border)] dark:bg-[var(--surface-strong)]",
                      )}
                    />
                    <span className="text-sm font-bold tabular-nums">
                      {new Intl.DateTimeFormat(intlLocale, {
                        day: "numeric",
                        timeZone: "UTC",
                      }).format(date)}
                    </span>
                    <span className="mt-1 text-[10px] text-[var(--muted)]">
                      {day.count > 0 ? formatNumber(day.count, intlLocale) : "—"}
                    </span>
                  </div>
                );
              })}
            </Card>
          </section>
        </div>

        <aside className="space-y-5">
          <Card className="desk-panel-soft relative overflow-hidden p-5 sm:p-6">
            <div className="absolute -top-12 -right-12 size-36 rounded-full bg-[var(--primary)]/12 blur-3xl" />
            <div className="flex items-center gap-2">
              <span className="desk-icon-well">
                <Bot className="size-5" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-semibold">{t.aiBrief}</h2>
            </div>
            <p className="mt-4 min-h-12 text-sm leading-6 text-[var(--muted)]">
              {t.brief(dashboard.dailyBrief)}
            </p>
            <Link
              href="/assistant"
              className={buttonClassName({ className: "mt-5 flex w-full" })}
            >
              <Sparkles className="size-4" />
              {t.aiAction}
            </Link>
          </Card>

          <Card className="desk-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{t.weekly}</h2>
              <span className="text-xs text-[var(--muted)]">{t.lastSevenDays}</span>
            </div>
            <div className="mt-4">
              <TrendChart
                data={dashboard.weeklyProgress.map((item) => ({
                  key: item.date,
                  value: item.completed,
                  accessibleLabel: `${new Intl.DateTimeFormat(intlLocale, {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(new Date(`${item.date}T12:00:00Z`))}: ${t.completedTasks(
                    item.completed,
                  )}`,
                }))}
                label={t.weekly}
              />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
