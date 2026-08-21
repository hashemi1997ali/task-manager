"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Headphones,
  Mail,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { Badge, Card } from "@/components/ui/card";
import { PageHeading } from "@/components/ui/page-heading";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { TrendChart } from "@/components/ui/trend-chart";
import { getAdminOverviewRequest } from "@/features/admin/api";
import { getErrorMessage } from "@/lib/api-error";
import { formatNumber } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    title: "Admin overview",
    subtitle: "Monitor workspace health and items that need attention.",
    totalUsers: "Total users",
    activeUsers: "Active users",
    totalTasks: "Total tasks",
    openTasks: "Open tasks",
    attention: "Attention required",
    overdue: "Overdue tasks",
    support: "Waiting support",
    contact: "Unanswered contacts",
    banned: "Banned users",
    workspaceHealth: "Workspace health",
    currentSnapshot: "Current snapshot",
    weekly: "Weekly progress",
    lastSevenDays: "Last 7 days",
    completedTasks: (count: number) => `${count} task${count === 1 ? "" : "s"} completed`,
  },
  de: {
    title: "Admin-Übersicht",
    subtitle: "Überwache den Arbeitsbereich und offene Vorgänge.",
    totalUsers: "Benutzer gesamt",
    activeUsers: "Aktive Benutzer",
    totalTasks: "Aufgaben gesamt",
    openTasks: "Offene Aufgaben",
    attention: "Handlungsbedarf",
    overdue: "Überfällige Aufgaben",
    support: "Wartender Support",
    contact: "Unbeantwortete Kontakte",
    banned: "Gesperrte Benutzer",
    workspaceHealth: "Arbeitsbereich",
    currentSnapshot: "Aktueller Stand",
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
    { label: t.totalUsers, value: query.data.totalUsers, icon: UsersRound },
    { label: t.activeUsers, value: query.data.activeUsers, icon: UserRoundCheck },
    { label: t.openTasks, value: query.data.openTasks, icon: AlertTriangle },
    { label: t.support, value: query.data.waitingSupport, icon: Headphones },
  ];
  const attention = [
    {
      label: t.overdue,
      value: query.data.overdueTasks,
      href: "/admin/tasks",
      icon: AlertTriangle,
    },
    {
      label: t.support,
      value: query.data.waitingSupport,
      href: "/admin/support",
      icon: Headphones,
    },
    {
      label: t.contact,
      value: query.data.unansweredContacts,
      href: "/admin/contact",
      icon: Mail,
    },
    {
      label: t.banned,
      value: query.data.bannedUsers,
      href: "/admin/users?banned=true",
      icon: UsersRound,
    },
  ];

  return (
    <div>
      <PageHeading title={t.title} description={t.subtitle} />
      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="min-h-[7.5rem] p-4">
            <span className="grid size-9 place-items-center rounded-[9px] bg-[var(--primary-soft)] text-[var(--primary)]">
              <Icon className="size-4" />
            </span>
            <p className="mt-3 text-xs font-semibold text-[var(--muted)]">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatNumber(value, intlLocale)}
            </p>
          </Card>
        ))}
      </section>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-4 sm:px-5">
            <h3 className="font-semibold">{t.attention}</h3>
          </div>
          <div className="divide-y">
            {attention.map(({ label, value, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="focus-ring flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-muted)] sm:px-5"
              >
                <Icon className="size-4 text-[var(--primary)]" />
                <p className="min-w-0 flex-1 text-sm font-medium">{label}</p>
                <Badge className="border-[var(--primary)]/15 bg-[var(--primary-soft)] text-[var(--primary)]">
                  {formatNumber(value, intlLocale)}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{t.weekly}</h3>
            <span className="text-xs text-[var(--muted)]">{t.lastSevenDays}</span>
          </div>
          <div className="mt-4">
            <TrendChart
              showLabels
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
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
