"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Headphones,
  ListTodo,
  Mail,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { Badge, Card } from "@/components/ui/card";
import { PageHeading } from "@/components/ui/page-heading";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { TrendChart } from "@/components/ui/trend-chart";
import { getAdminOverviewRequest } from "@/features/admin/api";
import { getErrorMessage } from "@/lib/api-error";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    title: "Admin overview",
    subtitle: "Monitor task progress and administrative queues.",
    totalUsers: "Total users",
    totalTasks: "Total tasks",
    completedToday: "Completed today",
    completionRate: "Overall task completion",
    completionDetail: (completed: string, total: string) =>
      `${completed} of ${total} tasks completed`,
    adminQueues: "Admin queues",
    queueSummary: (count: string) => `${count} items`,
    overdue: "Overdue tasks",
    support: "Waiting support chats",
    contact: "Unanswered contact forms",
    banned: "Banned users",
    weekly: "Weekly progress",
    lastSevenDays: "Last 7 days",
    completedTasks: (count: number) => `${count} task${count === 1 ? "" : "s"} completed`,
  },
  de: {
    title: "Admin-Übersicht",
    subtitle: "Überwache den Aufgabenfortschritt und administrative Vorgänge.",
    totalUsers: "Benutzer gesamt",
    totalTasks: "Aufgaben gesamt",
    completedToday: "Heute abgeschlossen",
    completionRate: "Gesamte Aufgabenerledigung",
    completionDetail: (completed: string, total: string) =>
      `${completed} von ${total} Aufgaben erledigt`,
    adminQueues: "Admin-Warteschlangen",
    queueSummary: (count: string) => `${count} Einträge`,
    overdue: "Überfällige Aufgaben",
    support: "Wartende Support-Chats",
    contact: "Unbeantwortete Kontaktformulare",
    banned: "Gesperrte Benutzer",
    weekly: "Wochenfortschritt",
    lastSevenDays: "Letzte 7 Tage",
    completedTasks: (count: number) =>
      `${count} Aufgabe${count === 1 ? "" : "n"} erledigt`,
  },
} as const;

export function AdminOverviewView() {
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const query = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: getAdminOverviewRequest,
  });

  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <ErrorState
        message={getErrorMessage(query.error, locale)}
        retry={() => void query.refetch()}
      />
    );

  const stats = [
    {
      label: t.totalUsers,
      value: formatNumber(query.data.totalUsers, intlLocale),
      icon: UsersRound,
      iconClassName: "bg-[var(--primary-soft)] text-[var(--primary)]",
    },
    {
      label: t.totalTasks,
      value: formatNumber(query.data.totalTasks, intlLocale),
      icon: ListTodo,
      iconClassName:
        "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]",
    },
    {
      label: t.completedToday,
      value: formatNumber(query.data.completedToday, intlLocale),
      icon: CheckCircle2,
      iconClassName:
        "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]",
    },
    {
      label: t.overdue,
      value: formatNumber(query.data.overdueTasks, intlLocale),
      icon: AlertTriangle,
      iconClassName:
        "bg-[color-mix(in_srgb,var(--danger)_11%,transparent)] text-[var(--danger)]",
    },
  ];
  const attention = [
    {
      label: t.support,
      value: query.data.waitingSupport,
      href: "/admin/support",
      icon: Headphones,
      iconClassName: "bg-[var(--primary-soft)] text-[var(--primary)]",
    },
    {
      label: t.contact,
      value: query.data.unansweredContacts,
      href: "/admin/contact",
      icon: Mail,
      iconClassName:
        "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]",
    },
    {
      label: t.banned,
      value: query.data.bannedUsers,
      href: "/admin/users?banned=true",
      icon: UsersRound,
      iconClassName:
        "bg-[color-mix(in_srgb,var(--danger)_11%,transparent)] text-[var(--danger)]",
    },
  ];
  const completionPercent = Math.min(100, Math.max(0, query.data.completionRate * 100));
  const formattedCompletedTasks = formatNumber(query.data.completedTasks, intlLocale);
  const formattedTotalTasks = formatNumber(query.data.totalTasks, intlLocale);
  const queueTotal = attention.reduce((total, item) => total + item.value, 0);

  return (
    <div className="desk-reveal space-y-5">
      <PageHeading title={t.title} description={t.subtitle} />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))]">
        <Card className="relative col-span-2 h-28 overflow-hidden border-[color-mix(in_srgb,var(--primary)_22%,var(--border))] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--primary-soft)_68%,var(--surface)),var(--surface))] p-4 md:col-span-4 xl:col-span-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_8px_20px_var(--primary-glow)]">
                <CheckCircle2 className="size-4" aria-hidden="true" />
              </span>
              <p className="text-xs font-bold text-[var(--muted)]">{t.completionRate}</p>
            </div>
            <p className="text-2xl font-black tracking-[-0.04em] tabular-nums">
              {formatPercent(query.data.completionRate, intlLocale)}
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
            {t.completionDetail(formattedCompletedTasks, formattedTotalTasks)}
          </p>
        </Card>

        {stats.map(({ label, value, icon: Icon, iconClassName }) => (
          <Card
            key={label}
            className="flex h-28 min-w-0 flex-col justify-between overflow-hidden p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={cn("grid size-9 place-items-center rounded-xl", iconClassName)}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
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
            <h2 className="desk-section-title min-w-0 truncate">{t.adminQueues}</h2>
            <span
              className="max-w-[55%] shrink-0 truncate whitespace-nowrap rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-[10px] font-bold text-[var(--muted)]"
              title={t.queueSummary(formatNumber(queueTotal, intlLocale))}
            >
              {t.queueSummary(formatNumber(queueTotal, intlLocale))}
            </span>
          </div>
          <div className="divide-y">
            {attention.map(({ label, value, href, icon: Icon, iconClassName }) => (
              <Link
                key={label}
                href={href}
                className="focus-ring flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-muted)] sm:px-5"
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg",
                    iconClassName,
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <p className="min-w-0 flex-1 text-sm leading-5 font-semibold">{label}</p>
                <Badge className="border-[var(--primary)]/15 bg-[var(--primary-soft)] text-[var(--primary)]">
                  {formatNumber(value, intlLocale)}
                </Badge>
              </Link>
            ))}
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
              data={query.data.weeklyProgress.map((item) => {
                const date = new Date(`${item.date}T12:00:00Z`);
                const dateLabel = new Intl.DateTimeFormat(intlLocale, {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }).format(date);
                return {
                  key: item.date,
                  value: item.completed,
                  shortLabel: new Intl.DateTimeFormat(intlLocale, {
                    weekday: "narrow",
                    timeZone: "UTC",
                  }).format(date),
                  accessibleLabel: `${dateLabel}: ${t.completedTasks(item.completed)}`,
                };
              })}
              label={t.weekly}
              className="h-48 xl:h-40"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
