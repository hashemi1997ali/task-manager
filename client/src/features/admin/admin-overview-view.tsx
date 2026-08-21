"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlarmClock,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Headphones,
  Hourglass,
  Mail,
  Timer,
  UserRoundCheck,
  UserRoundX,
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
    title: "Support operations",
    subtitle: "Monitor SLA health, ticket ownership, and the live service queue.",
    openTickets: "Open tickets",
    slaBreached: "SLA breached",
    urgentOpen: "Urgent open",
    unassigned: "Unassigned",
    resolvedToday: "Resolved today",
    averageResponse: "Avg. first response",
    noResponseData: "No response data",
    attention: "Queue attention",
    waitingCustomer: "Waiting on customer",
    firstResponseBreaches: "First-response breaches",
    resolutionBreaches: "Resolution breaches",
    requestedOverdue: "Past requested deadlines",
    waitingSupport: "Waiting live chats",
    accountSnapshot: "Accounts & intake",
    totalCustomers: "Total accounts",
    goodStanding: "Accounts in good standing",
    unansweredContacts: "Unanswered contacts",
    bannedAccounts: "Banned accounts",
    weekly: "Resolved tickets",
    lastSevenDays: "Last 7 days",
    resolvedTickets: (count: number) =>
      `${count} ticket${count === 1 ? "" : "s"} resolved`,
    minutes: (value: number) => `${value}m`,
    hoursMinutes: (hours: number, minutes: number) => `${hours}h ${minutes}m`,
  },
  de: {
    title: "Support-Betrieb",
    subtitle: "Überwache SLA-Zustand, Ticketzuweisung und die Live-Warteschlange.",
    openTickets: "Offene Tickets",
    slaBreached: "SLA überschritten",
    urgentOpen: "Dringend offen",
    unassigned: "Nicht zugewiesen",
    resolvedToday: "Heute gelöst",
    averageResponse: "Ø Erstreaktion",
    noResponseData: "Keine Reaktionsdaten",
    attention: "Warteschlange prüfen",
    waitingCustomer: "Wartet auf Kunden",
    firstResponseBreaches: "Erstreaktion überschritten",
    resolutionBreaches: "Lösungszeit überschritten",
    requestedOverdue: "Wunschtermine überschritten",
    waitingSupport: "Wartende Live-Chats",
    accountSnapshot: "Konten & Eingang",
    totalCustomers: "Konten gesamt",
    goodStanding: "Verfügbare Kundenkonten",
    unansweredContacts: "Unbeantwortete Kontakte",
    bannedAccounts: "Gesperrte Konten",
    weekly: "Gelöste Tickets",
    lastSevenDays: "Letzte 7 Tage",
    resolvedTickets: (count: number) => `${count} Ticket${count === 1 ? "" : "s"} gelöst`,
    minutes: (value: number) => `${value} Min.`,
    hoursMinutes: (hours: number, minutes: number) => `${hours} Std. ${minutes} Min.`,
  },
} as const;

export function AdminOverviewView() {
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const query = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: getAdminOverviewRequest,
    refetchInterval: 30_000,
  });

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <ErrorState
        message={getErrorMessage(query.error, locale)}
        retry={() => void query.refetch()}
      />
    );
  }

  const responseMinutes =
    query.data.averageFirstResponseMinutes === null
      ? null
      : Math.max(0, Math.round(query.data.averageFirstResponseMinutes));
  const responseTime =
    responseMinutes === null
      ? t.noResponseData
      : responseMinutes >= 60
        ? t.hoursMinutes(Math.floor(responseMinutes / 60), responseMinutes % 60)
        : t.minutes(responseMinutes);
  const stats = [
    { label: t.openTickets, value: query.data.openTickets, icon: Hourglass },
    { label: t.slaBreached, value: query.data.breachedSlaTickets, icon: AlarmClock },
    { label: t.urgentOpen, value: query.data.urgentOpenTickets, icon: AlertTriangle },
    { label: t.unassigned, value: query.data.unassignedTickets, icon: UserRoundX },
    { label: t.resolvedToday, value: query.data.resolvedToday, icon: CheckCircle2 },
  ];
  const attention = [
    {
      label: t.waitingCustomer,
      value: query.data.waitingCustomerTickets,
      href: "/admin/tickets?status=waiting-customer",
      icon: Hourglass,
    },
    {
      label: t.firstResponseBreaches,
      value: query.data.firstResponseBreaches,
      href: "/admin/tickets?attention=first-response-breached&sortBy=firstResponseDueAt",
      icon: AlarmClock,
    },
    {
      label: t.resolutionBreaches,
      value: query.data.resolutionBreaches,
      href: "/admin/tickets?attention=resolution-breached&sortBy=resolutionDueAt",
      icon: Timer,
    },
    {
      label: t.requestedOverdue,
      value: query.data.overdueRequestedDeadlines,
      href: "/admin/tickets?attention=requested-overdue&sortBy=dueDate",
      icon: AlertTriangle,
    },
    {
      label: t.waitingSupport,
      value: query.data.waitingSupport,
      href: "/admin/support",
      icon: Headphones,
    },
  ];
  const accounts = [
    {
      label: t.totalCustomers,
      value: query.data.totalUsers,
      href: "/admin/users",
      icon: UsersRound,
    },
    {
      label: t.goodStanding,
      value: query.data.activeUsers,
      href: "/admin/users?banned=false",
      icon: UserRoundCheck,
    },
    {
      label: t.unansweredContacts,
      value: query.data.unansweredContacts,
      href: "/admin/contact",
      icon: Mail,
    },
    {
      label: t.bannedAccounts,
      value: query.data.bannedUsers,
      href: "/admin/users?banned=true",
      icon: UserRoundX,
    },
  ];

  return (
    <div className="desk-grid-glow space-y-6">
      <header className="desk-page-header relative !mb-0 overflow-hidden rounded-[var(--container-radius)] border border-[var(--border)]/80 bg-[var(--surface)]/75 p-5 shadow-[var(--shadow-panel)] backdrop-blur sm:p-6">
        <div className="min-w-0">
          <div className="desk-eyebrow">
            <span className="desk-live-dot" aria-hidden="true" />
            {t.attention}
          </div>
          <h1 className="mt-3 text-[clamp(1.75rem,4vw,2.75rem)] leading-none font-black tracking-[-0.045em]">
            {t.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {t.subtitle}
          </p>
        </div>
        <div className="hidden items-center gap-3 self-end rounded-2xl border border-[var(--border)]/80 bg-[var(--surface)]/75 px-4 py-3 backdrop-blur md:flex">
          <span className="desk-icon-well">
            <Timer className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-[var(--muted)] uppercase">
              {t.averageResponse}
            </p>
            <p className="mt-0.5 font-black tabular-nums" title={responseTime}>
              {responseTime}
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map(({ label, value, icon: Icon }, index) => (
          <article key={label} className="desk-stat flex min-h-32 min-w-0 flex-col gap-4">
            <span
              className="desk-icon-well"
              data-tone={index === 1 || index === 2 ? "danger" : undefined}
            >
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold tracking-[0.08em] text-[var(--muted)] uppercase sm:text-[11px]">
                {label}
              </p>
              <p className="mt-1 text-2xl font-black tracking-[-0.04em] tabular-nums">
                {formatNumber(value, intlLocale)}
              </p>
            </div>
          </article>
        ))}
        <article className="desk-stat flex min-h-32 min-w-0 flex-col gap-4">
          <span className="desk-icon-well">
            <Timer className="size-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold tracking-[0.08em] text-[var(--muted)] uppercase sm:text-[11px]">
              {t.averageResponse}
            </p>
            <p
              className="mt-1 truncate text-lg font-black tracking-tight tabular-nums"
              title={responseTime}
            >
              {responseTime}
            </p>
          </div>
        </article>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,.7fr)]">
        <section className="desk-panel overflow-hidden">
          <div className="border-b border-[var(--border)]/75 px-4 py-4 sm:px-5">
            <p className="desk-eyebrow">{t.slaBreached}</p>
            <h2 className="desk-section-title mt-1">{t.attention}</h2>
          </div>
          <div className="grid gap-px bg-[var(--border)]/70 sm:grid-cols-2">
            {attention.map(({ label, value, href, icon: Icon }, index) => (
              <Link
                key={label}
                href={href}
                className={`focus-ring group flex min-h-24 items-center gap-3 bg-[var(--surface)] px-4 py-4 transition-colors hover:bg-[var(--surface-muted)] sm:px-5 ${index === attention.length - 1 ? "sm:col-span-2" : ""}`}
              >
                <Icon className="size-4 text-[var(--primary)]" />
                <p className="min-w-0 flex-1 text-sm font-medium">{label}</p>
                <Badge className="border-[var(--primary)]/15 bg-[var(--primary-soft)] text-[var(--primary)]">
                  {formatNumber(value, intlLocale)}
                </Badge>
              </Link>
            ))}
          </div>
        </section>

        <section className="desk-panel-soft overflow-hidden">
          <div className="border-b border-[var(--border)]/75 px-4 py-4 sm:px-5">
            <p className="desk-eyebrow">{t.totalCustomers}</p>
            <h2 className="desk-section-title mt-1">{t.accountSnapshot}</h2>
          </div>
          <div className="divide-y divide-[var(--border)]/70">
            {accounts.map(({ label, value, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="focus-ring group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface)] sm:px-5"
              >
                <Icon
                  className="size-4 shrink-0 text-[var(--primary)]"
                  aria-hidden="true"
                />
                <p className="min-w-0 flex-1 text-sm font-semibold">{label}</p>
                <span className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-sm font-black tabular-nums shadow-sm">
                  {formatNumber(value, intlLocale)}
                </span>
                <ArrowUpRight className="size-3.5 text-[var(--muted)] transition group-hover:text-[var(--primary)]" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="desk-panel overflow-hidden p-5 sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="desk-eyebrow">{t.lastSevenDays}</p>
            <h2 className="desk-section-title mt-1">{t.weekly}</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-[var(--success)]">
            <span className="desk-live-dot" />
            {t.lastSevenDays}
          </span>
        </div>
        <div className="mt-6">
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
                accessibleLabel: `${dateLabel}: ${t.resolvedTickets(item.completed)}`,
              };
            })}
            label={t.weekly}
          />
        </div>
      </section>
    </div>
  );
}
