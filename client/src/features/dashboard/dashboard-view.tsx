"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Hourglass,
  MessageSquareReply,
  Sparkles,
  TicketCheck,
} from "lucide-react";
import Link from "next/link";

import { buttonClassName } from "@/components/ui/button";
import {
  TaskPriorityBadge,
  TaskStatusBadge,
  TicketCategoryBadge,
} from "@/components/ui/domain-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { TrendChart } from "@/components/ui/trend-chart";
import { useAuth } from "@/features/auth/auth-provider";
import { SlaCountdown } from "@/features/tasks/sla-countdown";
import { getTodayDashboardRequest } from "@/features/tasks/api";
import { getErrorMessage } from "@/lib/api-error";
import {
  getTaskPriorityLabel,
  getTaskStatusLabel,
  getTicketCategoryLabel,
} from "@/lib/domain-labels";
import type { TodayDashboard } from "@/lib/types";
import { cn, formatDateTime, formatNumber, getId } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    greetings: {
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening",
    },
    intro: "Here is the latest on your support requests.",
    openTickets: "Open requests",
    waitingCustomer: "Waiting for you",
    slaBreached: "SLA at risk",
    resolvedToday: "Resolved today",
    timeline: "Today's SLA timeline",
    timelineDescription: "Deadlines in your local support day",
    noTimeline: "No response, resolution, or requested deadlines today.",
    responseDeadline: "Response",
    resolutionDeadline: "Resolution",
    requestedDeadline: "Requested",
    now: "Current hour",
    attention: "Needs attention",
    upcoming: "Upcoming requested dates",
    aiBrief: "Request summary",
    aiAction: "Review my requests",
    askAi: "Ask AI about a request",
    weekly: "Resolved this week",
    lastSevenDays: "Last 7 days",
    noTickets: "No open requests need your attention.",
    dueToday: "Requested today",
    overdueLabel: "Past requested date",
    noUpcoming: "No requests",
    scheduledTickets: (count: number) =>
      `${count} request${count === 1 ? "" : "s"} requested`,
    resolvedTickets: (count: number) =>
      `${count} ticket${count === 1 ? "" : "s"} resolved`,
    requestedFor: "Requested resolution",
    brief: ({
      overdue,
      highPriority,
      dueToday,
      scheduleConflicts,
    }: TodayDashboard["dailyBrief"]) => {
      const details = [
        overdue > 0 ? `${overdue} past-due request${overdue === 1 ? "" : "s"}` : null,
        dueToday > 0
          ? `${dueToday} request${dueToday === 1 ? "" : "s"} requested for today`
          : null,
        highPriority > 0
          ? `${highPriority} high-priority ticket${highPriority === 1 ? "" : "s"}`
          : null,
        scheduleConflicts > 0
          ? `${scheduleConflicts} overlapping requested deadline${scheduleConflicts === 1 ? "" : "s"}`
          : null,
      ].filter(Boolean);
      return details.length
        ? `Karino found ${details.join(", ")}.`
        : "Your request queue is clear. You can ask the assistant for help or submit a new request.";
    },
  },
  de: {
    greetings: {
      morning: "Guten Morgen",
      afternoon: "Guten Tag",
      evening: "Guten Abend",
    },
    intro: "Hier ist der aktuelle Stand deiner Support-Anfragen.",
    openTickets: "Offene Anfragen",
    waitingCustomer: "Wartet auf dich",
    slaBreached: "SLA gefährdet",
    resolvedToday: "Heute gelöst",
    timeline: "Heutige SLA-Zeitleiste",
    timelineDescription: "Fristen in deinem lokalen Support-Tag",
    noTimeline: "Heute gibt es keine Reaktions-, Lösungs- oder Wunschtermine.",
    responseDeadline: "Reaktion",
    resolutionDeadline: "Lösung",
    requestedDeadline: "Gewünscht",
    now: "Aktuelle Stunde",
    attention: "Benötigt Aufmerksamkeit",
    upcoming: "Kommende Wunschtermine",
    aiBrief: "Anfragenübersicht",
    aiAction: "Meine Anfragen prüfen",
    askAi: "KI zu einer Anfrage fragen",
    weekly: "Diese Woche gelöst",
    lastSevenDays: "Letzte 7 Tage",
    noTickets: "Keine offenen Anfragen benötigen deine Aufmerksamkeit.",
    dueToday: "Für heute gewünscht",
    overdueLabel: "Gewünschter Termin vorbei",
    noUpcoming: "Keine Anfragen",
    scheduledTickets: (count: number) =>
      `${count} Anfrage${count === 1 ? "" : "n"} gewünscht`,
    resolvedTickets: (count: number) => `${count} Ticket${count === 1 ? "" : "s"} gelöst`,
    requestedFor: "Gewünschte Lösung",
    brief: ({
      overdue,
      highPriority,
      dueToday,
      scheduleConflicts,
    }: TodayDashboard["dailyBrief"]) => {
      const details = [
        overdue > 0 ? `${overdue} überfällige Anfrage${overdue === 1 ? "" : "n"}` : null,
        dueToday > 0
          ? `${dueToday} für heute gewünschte Anfrage${dueToday === 1 ? "" : "n"}`
          : null,
        highPriority > 0
          ? `${highPriority} Ticket${highPriority === 1 ? "" : "s"} mit hoher Priorität`
          : null,
        scheduleConflicts > 0
          ? `${scheduleConflicts} überschneidende Wunschtermin${scheduleConflicts === 1 ? "" : "e"}`
          : null,
      ].filter(Boolean);
      return details.length
        ? `Karino hat ${details.join(", ")} gefunden.`
        : "Deine Anfragenübersicht ist frei. Frage den Assistenten oder sende eine neue Anfrage.";
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
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "today"],
    queryFn: getTodayDashboardRequest,
    refetchInterval: 30_000,
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
      label: t.openTickets,
      value: formatNumber(dashboard.stats.openTickets, intlLocale),
      icon: TicketCheck,
    },
    {
      label: t.waitingCustomer,
      value: formatNumber(dashboard.stats.waitingCustomer, intlLocale),
      icon: Hourglass,
    },
    {
      label: t.slaBreached,
      value: formatNumber(dashboard.stats.slaAtRisk, intlLocale),
      icon: AlertTriangle,
    },
    {
      label: t.resolvedToday,
      value: formatNumber(dashboard.stats.resolvedToday, intlLocale),
      icon: CheckCircle2,
    },
  ];
  const dashboardNow = Date.parse(dashboard.generatedAt);
  const currentHour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: dashboard.timeZone,
    })
      .formatToParts(new Date(dashboard.generatedAt))
      .find((part) => part.type === "hour")?.value ?? 0,
  );
  const scheduledHours = dashboard.hourlySchedule.filter(
    (item) =>
      item.requestedDeadlines > 0 ||
      item.firstResponseDeadlines > 0 ||
      item.resolutionDeadlines > 0,
  );
  const attentionTickets = dashboard.needsAttention ?? dashboard.focusTasks;

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
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.08em] text-[var(--muted)] uppercase">
                {label}
              </p>
              <p className="mt-1 text-2xl font-black tracking-[-0.04em] tabular-nums sm:text-3xl">
                {value}
              </p>
            </div>
          </article>
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
                            "flex items-center gap-1.5 text-[var(--muted)]",
                            requestedOverdue && "font-bold text-[var(--danger)]",
                          )}
                        >
                          <CalendarClock className="size-3.5" aria-hidden="true" />
                          {ticket.dueDate ? (
                            <time dateTime={ticket.dueDate}>
                              {t.requestedFor}:{" "}
                              {formatDateTime(ticket.dueDate, intlLocale)}
                            </time>
                          ) : (
                            <span>—</span>
                          )}
                          {requestedOverdue && <span>· {t.overdueLabel}</span>}
                        </p>
                        <SlaCountdown
                          ticket={ticket}
                          compact
                          referenceTime={dashboardNow}
                        />
                      </div>
                    </div>
                    <div className="flex items-start gap-2 sm:justify-end">
                      <TaskPriorityBadge priority={ticket.priority}>
                        {getTaskPriorityLabel(ticket.priority, locale)}
                      </TaskPriorityBadge>
                      <TaskStatusBadge status={ticket.status}>
                        {getTaskStatusLabel(ticket.status, locale)}
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
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <Card className="desk-panel-soft relative overflow-hidden p-5 sm:p-6">
            <div className="absolute -top-12 -right-12 size-36 rounded-full bg-[var(--primary)]/12 blur-3xl" />
            <div className="flex items-center gap-2">
              <span className="desk-icon-well">
                <Bot className="size-5" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-semibold">{t.aiBrief}</h2>
            </div>
            <p className="relative mt-5 text-sm leading-6 text-[var(--muted)]">
              {t.brief(dashboard.dailyBrief)}
            </p>
            <Link
              href="/assistant"
              className={buttonClassName({ className: "relative mt-5 flex w-full" })}
            >
              <Sparkles className="size-4" />
              {t.aiAction}
            </Link>
          </section>

          <Card className="desk-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{t.weekly}</h2>
              <span className="text-xs text-[var(--muted)]">{t.lastSevenDays}</span>
            </div>
            <div className="mt-5">
              <TrendChart
                data={dashboard.weeklyProgress.map((item) => ({
                  key: item.date,
                  value: item.completed,
                  accessibleLabel: `${new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${item.date}T12:00:00Z`))}: ${t.resolvedTickets(item.completed)}`,
                }))}
                label={t.weekly}
              />
            </div>
          </section>
        </aside>
      </div>

      <section className="desk-panel overflow-hidden">
        <div className="border-b border-[var(--border)]/75 px-4 py-4 sm:px-5">
          <p className="desk-eyebrow">{t.requestedDeadline}</p>
          <h2 className="desk-section-title mt-1">{t.upcoming}</h2>
        </div>
        <div className="grid grid-cols-5 divide-x divide-[var(--border)]/70 p-2 sm:p-3">
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
                className="flex min-w-0 flex-col items-center rounded-xl px-1 py-3 text-center sm:py-4"
                aria-label={`${dateLabel}: ${day.count ? t.scheduledTickets(day.count) : t.noUpcoming}`}
              >
                <span className="text-[10px] font-bold tracking-wider text-[var(--muted)] uppercase sm:text-xs">
                  {new Intl.DateTimeFormat(intlLocale, {
                    weekday: "short",
                    timeZone: "UTC",
                  }).format(date)}
                </span>
                <span className="mt-2 text-xl font-black tracking-tight tabular-nums sm:text-2xl">
                  {new Intl.DateTimeFormat(intlLocale, {
                    day: "numeric",
                    timeZone: "UTC",
                  }).format(date)}
                </span>
                <span
                  className={cn(
                    "mt-2 min-w-6 rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums",
                    day.count
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "bg-[var(--surface-muted)] text-[var(--muted)]",
                  )}
                >
                  {day.count > 0 ? formatNumber(day.count, intlLocale) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
