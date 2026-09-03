"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
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
import { Badge, Card } from "@/components/ui/card";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/ui/domain-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { TrendChart } from "@/components/ui/trend-chart";
import { useAuth } from "@/features/auth/auth-provider";
import { getTodayDashboardRequest, updateTaskRequest } from "@/features/tasks/api";
import { getErrorMessage } from "@/lib/api-error";
import type { Task } from "@/lib/types";
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
    tasksToday: "Due today",
    completed: "Completed today",
    overdue: "Overdue",
    completionRate: "Overall completion",
    overallProgressDetail: (completed: string, total: string) =>
      `${completed} of ${total} tasks completed`,
    focus: "Today focus",
    focusCount: (count: number) => `${count} in focus`,
    upcoming: "Next 7 days",
    upcomingSummary: (count: string) => `${count} open in the next 7 days`,
    aiBrief: "AI Daily Brief",
    aiMeta: "Karino AI",
    aiAction: "Fix my schedule",
    weekly: "Weekly progress",
    lastSevenDays: "Last 7 days",
    noTasks: "No active tasks need your attention.",
    today: "Today",
    overdueLabel: "Overdue",
    noUpcoming: "No tasks",
    taskCountShort: (count: string, value: number) =>
      `${count} task${value === 1 ? "" : "s"}`,
    openTasks: (count: number) => `${count} open task${count === 1 ? "" : "s"}`,
    completedTasks: (count: number) => `${count} task${count === 1 ? "" : "s"} completed`,
    priority: { low: "Low", medium: "Medium", high: "High" },
    status: { todo: "To do", "in-progress": "In progress", done: "Done" },
  },
  de: {
    greetings: {
      morning: "Guten Morgen",
      afternoon: "Guten Tag",
      evening: "Guten Abend",
    },
    intro: "Das benötigt heute deine Aufmerksamkeit.",
    tasksToday: "Heute fällig",
    completed: "Heute abgeschlossen",
    overdue: "Überfällig",
    completionRate: "Gesamter Fortschritt",
    overallProgressDetail: (completed: string, total: string) =>
      `${completed} von ${total} Aufgaben erledigt`,
    focus: "Fokus für heute",
    focusCount: (count: number) => `${count} im Fokus`,
    upcoming: "Nächste 7 Tage",
    upcomingSummary: (count: string) => `${count} offen in den nächsten 7 Tagen`,
    aiBrief: "KI-Tagesübersicht",
    aiMeta: "Karino KI",
    aiAction: "Zeitplan optimieren",
    weekly: "Wochenfortschritt",
    lastSevenDays: "Letzte 7 Tage",
    noTasks: "Keine aktiven Aufgaben benötigen deine Aufmerksamkeit.",
    today: "Heute",
    overdueLabel: "Überfällig",
    noUpcoming: "Keine Aufgaben",
    taskCountShort: (count: string, value: number) =>
      `${count} Aufgabe${value === 1 ? "" : "n"}`,
    openTasks: (count: number) => `${count} offene Aufgabe${count === 1 ? "" : "n"}`,
    completedTasks: (count: number) =>
      `${count} Aufgabe${count === 1 ? "" : "n"} erledigt`,
    priority: { low: "Niedrig", medium: "Mittel", high: "Hoch" },
    status: { todo: "Offen", "in-progress": "In Bearbeitung", done: "Erledigt" },
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
  const dailyStats = [
    {
      label: t.tasksToday,
      value: formatNumber(dashboard.stats.tasksToday, intlLocale),
      icon: Clock3,
      iconClassName: "bg-[var(--primary-soft)] text-[var(--primary)]",
    },
    {
      label: t.completed,
      value: formatNumber(dashboard.stats.completed, intlLocale),
      icon: CheckCircle2,
      iconClassName:
        "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]",
    },
    {
      label: t.overdue,
      value: formatNumber(dashboard.stats.overdue, intlLocale),
      icon: AlertTriangle,
      iconClassName:
        "bg-[color-mix(in_srgb,var(--danger)_11%,transparent)] text-[var(--danger)]",
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
  const upcomingTaskTotal = dashboard.upcoming.reduce(
    (total, day) => total + day.count,
    0,
  );
  const formattedTotalTasks = formatNumber(dashboard.stats.totalTasks, intlLocale);
  const formattedCompletedTasks = formatNumber(
    dashboard.stats.totalCompleted,
    intlLocale,
  );
  const completionPercent = Math.min(
    100,
    Math.max(0, dashboard.stats.completionRate * 100),
  );

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

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[1.35fr_repeat(3,minmax(0,1fr))]">
        <Card className="relative col-span-2 h-28 overflow-hidden border-[color-mix(in_srgb,var(--primary)_22%,var(--border))] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--primary-soft)_68%,var(--surface)),var(--surface))] p-4 md:col-span-3 xl:col-span-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_8px_20px_var(--primary-glow)]">
                <ListTodo className="size-4" aria-hidden="true" />
              </span>
              <p className="text-xs font-bold text-[var(--muted)]">{t.completionRate}</p>
            </div>
            <p className="text-2xl font-black tracking-[-0.04em] tabular-nums">
              {formatPercent(dashboard.stats.completionRate, intlLocale)}
            </p>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,var(--surface))]"
            role="progressbar"
            aria-label={t.completionRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(completionPercent)}
          >
            <span
              className="block h-full rounded-full bg-[var(--primary)] transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <p className="mt-2.5 text-[10px] font-semibold text-[var(--muted)]">
            {t.overallProgressDetail(formattedCompletedTasks, formattedTotalTasks)}
          </p>
        </Card>

        <Card className="col-span-2 overflow-hidden p-0 md:hidden">
          <dl className="divide-y">
            {dailyStats.map(({ label, value, icon: Icon, iconClassName }) => (
              <div key={label} className="flex min-h-16 items-center gap-3 px-4">
                <dt className="flex min-w-0 flex-1 items-center gap-3 text-sm font-semibold">
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-lg",
                      iconClassName,
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="truncate">{label}</span>
                </dt>
                <dd className="shrink-0">
                  <Badge className="border-[var(--primary)]/15 bg-[var(--primary-soft)] text-[var(--primary)]">
                    {value}
                  </Badge>
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        {dailyStats.map(({ label, value, icon: Icon, iconClassName }) => (
          <Card
            key={label}
            className="hidden h-28 flex-col justify-between overflow-hidden p-4 md:flex"
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn("grid size-9 place-items-center rounded-xl", iconClassName)}
              >
                <Icon className="size-4" aria-hidden="true" />
              </div>
              <p className="text-2xl font-black tracking-[-0.04em] tabular-nums">
                {value}
              </p>
            </div>
            <p className="mt-4 text-xs font-bold">{label}</p>
          </Card>
        ))}
      </section>

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.75fr)]">
        <section className="desk-panel flex min-w-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
            <h2 className="desk-section-title min-w-0 truncate">{t.upcoming}</h2>
            <span
              className="max-w-[55%] shrink-0 truncate whitespace-nowrap rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-[10px] font-bold text-[var(--muted)]"
              title={t.upcomingSummary(formatNumber(upcomingTaskTotal, intlLocale))}
            >
              {t.upcomingSummary(formatNumber(upcomingTaskTotal, intlLocale))}
            </span>
          </div>
          <div className="flex flex-1 items-center overflow-x-auto p-3 sm:p-4">
            <div
              className="grid min-w-[32rem] flex-1 grid-cols-7 gap-2 sm:min-w-0"
              role="list"
            >
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
                    className={cn(
                      "flex min-h-28 min-w-0 flex-col rounded-xl border px-2 py-2.5 text-center",
                      day.count
                        ? "border-[color-mix(in_srgb,var(--primary)_20%,var(--border))] bg-[color-mix(in_srgb,var(--primary-soft)_42%,var(--surface))]"
                        : "bg-[var(--surface-muted)]/38",
                    )}
                    role="listitem"
                    aria-label={`${dateLabel}: ${
                      day.count ? t.openTasks(day.count) : t.noUpcoming
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">
                      {new Intl.DateTimeFormat(intlLocale, {
                        weekday: "short",
                        timeZone: "UTC",
                      }).format(date)}
                    </span>
                    <span className="mt-2 text-xl font-black tracking-[-0.04em] tabular-nums">
                      {new Intl.DateTimeFormat(intlLocale, {
                        day: "numeric",
                        timeZone: "UTC",
                      }).format(date)}
                    </span>
                    <span className="text-[9px] font-medium text-[var(--muted)]">
                      {new Intl.DateTimeFormat(intlLocale, {
                        month: "short",
                        timeZone: "UTC",
                      }).format(date)}
                    </span>
                    <span
                      className={cn(
                        "mt-auto rounded-lg px-1.5 py-1 text-[9px] font-bold",
                        day.count
                          ? "bg-[var(--primary)] text-[var(--on-primary)]"
                          : "bg-[var(--surface)] text-[var(--muted)]",
                      )}
                    >
                      {day.count > 0
                        ? t.taskCountShort(formatNumber(day.count, intlLocale), day.count)
                        : t.noUpcoming}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <Card className="desk-panel flex min-w-0 flex-col overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
            <h2 className="desk-section-title min-w-0 truncate">{t.weekly}</h2>
            <span
              className="max-w-[55%] shrink-0 truncate whitespace-nowrap rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-[10px] font-bold text-[var(--muted)]"
              title={t.lastSevenDays}
            >
              {t.lastSevenDays}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 items-center overflow-hidden p-3 sm:p-4">
            <TrendChart
              data={dashboard.weeklyProgress.map((item) => ({
                key: item.date,
                value: item.completed,
                shortLabel: new Intl.DateTimeFormat(intlLocale, {
                  weekday: "short",
                  timeZone: "UTC",
                }).format(new Date(`${item.date}T12:00:00Z`)),
                accessibleLabel: `${new Intl.DateTimeFormat(intlLocale, {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }).format(new Date(`${item.date}T12:00:00Z`))}: ${t.completedTasks(
                  item.completed,
                )}`,
              }))}
              label={t.weekly}
              className="h-48 xl:h-40"
            />
          </div>
        </Card>
      </div>

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.75fr)]">
        <section className="desk-panel flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
            <h2 className="desk-section-title min-w-0 truncate">{t.focus}</h2>
            <span
              className="max-w-[55%] shrink-0 truncate whitespace-nowrap rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-[10px] font-bold text-[var(--muted)]"
              title={t.focusCount(dashboard.focusTasks.length)}
            >
              {t.focusCount(dashboard.focusTasks.length)}
            </span>
          </div>
          {dashboard.focusTasks.length === 0 ? (
            <div className="flex min-h-[4.5rem] items-center justify-center gap-3 px-4 text-center text-sm text-[var(--muted)]">
              <CalendarCheck2 className="size-5 shrink-0 text-[var(--success)]" />
              <span>{t.noTasks}</span>
            </div>
          ) : (
            <div className="divide-y">
              {dashboard.focusTasks.map((task) => {
                const taskDateKey = task.dueDate ? dateKeyFor(task.dueDate) : "";
                return (
                  <article
                    key={getId(task)}
                    className="grid min-h-[4.5rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-3 py-2.5 transition-colors hover:bg-[var(--surface-muted)]/55 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:px-5"
                  >
                    <button
                      type="button"
                      onClick={() => statusMutation.mutate(task)}
                      aria-label={`${t.status[task.status]}: ${task.title}`}
                      disabled={statusMutation.isPending}
                      className="focus-ring row-span-2 grid size-10 place-items-center rounded-full border bg-[var(--surface)] disabled:opacity-50 sm:row-span-1"
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
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="h-32 self-start">
          <Card className="desk-panel flex h-full flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
              <h2 className="desk-section-title min-w-0 truncate">{t.aiBrief}</h2>
              <span
                className="max-w-[55%] shrink-0 truncate whitespace-nowrap rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-[10px] font-bold text-[var(--muted)]"
                title={t.aiMeta}
              >
                {t.aiMeta}
              </span>
            </div>
            <div className="flex min-h-[4.5rem] flex-1 items-center px-4 sm:px-5">
              <Link
                href="/assistant"
                className={buttonClassName({ className: "flex w-full" })}
              >
                <Sparkles className="size-4" />
                {t.aiAction}
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
