"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Switch from "@radix-ui/react-switch";
import { useQuery } from "@tanstack/react-query";
import { Ban, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { Card } from "@/components/ui/card";
import { AccountStatusBadge, RoleBadge } from "@/components/ui/domain-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { getUsersRequest, type UserFilters } from "@/features/admin/api";
import { useAuth } from "@/features/auth/auth-provider";
import { createProfileSchema, type ProfileFormValues } from "@/features/auth/schemas";
import { getErrorMessage } from "@/lib/api-error";
import { getBanReasonLabel } from "@/lib/domain-labels";
import type { BanReason, User } from "@/lib/types";
import { formatNumber, getId } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const banReasons: BanReason[] = [
  "spam",
  "abusive-behavior",
  "harassment",
  "fraud",
  "terms-violation",
  "security",
  "other",
];

const copy = {
  en: {
    eyebrow: "Access and safety",
    title: "Customers & team",
    description: "Manage customer accounts, support roles, profiles, and access.",
    search: "Search by name or email…",
    allRoles: "All roles",
    user: "Customer",
    admin: "Support agent",
    superAdmin: "Supervisor",
    allStates: "All account states",
    status: "Status",
    active: "Active",
    banned: "Banned",
    loading: "Loading people…",
    emptyTitle: "No customers or team members found",
    emptyDescription: "Try another search or filter.",
    joined: "Joined",
    role: "Role",
    actions: "Actions",
    you: "You",
    edit: "Edit person",
    editDescription: "Update this customer's or team member's details.",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    save: "Save changes",
    saved: "User details saved.",
    adminAccess: "Support agent access",
    adminAccessDescription: "Grant or remove support workspace access.",
    promoteTitle: "Make this person a support agent?",
    promoteDescription: (name: string) =>
      `${name} will be able to manage tickets, customers, and support conversations.`,
    promoteConfirm: "Make support agent",
    demoteTitle: "Remove support agent access?",
    demoteDescription: (name: string) =>
      `${name} will return to a customer account and lose support workspace access.`,
    demoteConfirm: "Remove access",
    roleEnabled: "Support agent access enabled.",
    roleRemoved: "Support agent access removed.",
    deleted: "Account and related data deleted.",
    banTitle: "Ban account",
    banDescription: "The account will be signed out on every active device.",
    reason: "Ban reason",
    banAction: "Ban account",
    bannedDone: "The account was banned and active sessions were revoked.",
    unbannedDone: "The account was unbanned and ban metadata was cleared.",
    unbanTitle: "Unban user",
    unbanDescription: "All ban metadata will be cleared from the account.",
    deleteTitle: "Delete account",
    deleteDescription: (name: string) =>
      `${name}'s account, sessions, tickets, and profile image will be permanently deleted.`,
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    users: "people",
    viewProfile: "Open profile and tickets",
    bannedReason: "Reason",
  },
  de: {
    eyebrow: "Zugriff und Sicherheit",
    title: "Kunden & Team",
    description: "Verwalte Kundenkonten, Support-Rollen, Profile und Zugriffe.",
    search: "Nach Name oder E-Mail suchen…",
    allRoles: "Alle Rollen",
    user: "Kunde",
    admin: "Support-Agent",
    superAdmin: "Leitung",
    allStates: "Alle Kontostatus",
    status: "Status",
    active: "Aktiv",
    banned: "Gesperrt",
    loading: "Personen werden geladen…",
    emptyTitle: "Keine Kunden oder Teammitglieder gefunden",
    emptyDescription: "Versuche eine andere Suche oder einen anderen Filter.",
    joined: "Registriert",
    role: "Rolle",
    actions: "Aktionen",
    you: "Du",
    edit: "Person bearbeiten",
    editDescription: "Kunden- oder Teamdaten aktualisieren.",
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail",
    save: "Änderungen speichern",
    saved: "Benutzerdaten gespeichert.",
    adminAccess: "Support-Agent-Zugriff",
    adminAccessDescription:
      "Zugriff auf den Support-Arbeitsbereich vergeben oder entfernen.",
    promoteTitle: "Diese Person zum Support-Agenten machen?",
    promoteDescription: (name: string) =>
      `${name} kann Tickets, Kunden und Support-Unterhaltungen verwalten.`,
    promoteConfirm: "Zum Support-Agenten machen",
    demoteTitle: "Support-Agent-Zugriff entfernen?",
    demoteDescription: (name: string) =>
      `${name} wird wieder zum Kundenkonto und verliert den Support-Zugriff.`,
    demoteConfirm: "Zugriff entfernen",
    roleEnabled: "Support-Agent-Zugriff aktiviert.",
    roleRemoved: "Support-Agent-Zugriff entfernt.",
    deleted: "Konto und zugehörige Daten gelöscht.",
    banTitle: "Konto sperren",
    banDescription: "Das Konto wird auf allen aktiven Geräten abgemeldet.",
    reason: "Sperrgrund",
    banAction: "Konto sperren",
    bannedDone: "Das Konto wurde gesperrt und aktive Sitzungen wurden beendet.",
    unbannedDone: "Die Sperre und alle Sperrdaten wurden entfernt.",
    unbanTitle: "Sperre aufheben",
    unbanDescription: "Alle Sperrdaten werden aus dem Konto entfernt.",
    deleteTitle: "Konto löschen",
    deleteDescription: (name: string) =>
      `Konto, Sitzungen, Tickets und Anhänge von ${name} werden dauerhaft gelöscht.`,
    previous: "Zurück",
    next: "Weiter",
    page: "Seite",
    of: "von",
    users: "Personen",
    viewProfile: "Profil und Tickets öffnen",
    bannedReason: "Grund",
  },
} as const;

export function EditUserDialog({
  user,
  loading,
  canChangeAdminRole,
  onClose,
  onSave,
}: {
  user: User | null;
  loading: boolean;
  canChangeAdminRole: boolean;
  onClose: () => void;
  onSave: (values: ProfileFormValues, isAdmin: boolean | null) => Promise<void>;
}) {
  const { locale } = usePreferences();
  const t = copy[locale];
  const schema = useMemo(() => createProfileSchema(locale), [locale]);
  const [selectedAdminRole, setSelectedAdminRole] = useState(
    () => user?.roles.includes("admin") ?? false,
  );
  const [pendingAdminRole, setPendingAdminRole] = useState<boolean | null>(null);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", email: "" },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      });
    }
  }, [user, form]);

  const userIsAdmin = user?.roles.includes("admin") ?? false;
  const userName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
  const submitChanges = async (values: ProfileFormValues) => {
    const changedAdminRole =
      canChangeAdminRole && selectedAdminRole !== userIsAdmin ? selectedAdminRole : null;
    await onSave(values, changedAdminRole);
  };

  return (
    <>
      <Dialog
        open={Boolean(user)}
        onOpenChange={(open) => !open && onClose()}
        title={t.edit}
        description={t.editDescription}
      >
        <form className="grid gap-4" onSubmit={form.handleSubmit(submitChanges)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.firstName} error={form.formState.errors.firstName?.message}>
              <Input {...form.register("firstName")} autoComplete="off" />
            </Field>
            <Field label={t.lastName} error={form.formState.errors.lastName?.message}>
              <Input {...form.register("lastName")} autoComplete="off" />
            </Field>
          </div>
          <Field label={t.email} error={form.formState.errors.email?.message}>
            <Input {...form.register("email")} type="email" autoComplete="off" />
          </Field>
          {canChangeAdminRole && (
            <div className="desk-panel-soft flex min-w-0 items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="desk-icon-well shrink-0 text-[var(--primary)]">
                  <ShieldCheck className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="desk-section-title">{t.adminAccess}</p>
                  <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">
                    {t.adminAccessDescription}
                  </p>
                </div>
              </div>
              <Switch.Root
                checked={selectedAdminRole}
                disabled={loading}
                onCheckedChange={setPendingAdminRole}
                aria-label={t.adminAccess}
                className="focus-ring relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition data-[state=checked]:bg-[var(--primary)] disabled:opacity-50 dark:bg-slate-700"
              >
                <Switch.Thumb className="block size-6 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[1.375rem]" />
              </Switch.Root>
            </div>
          )}
          <div className="flex justify-end border-t border-[var(--border)] pt-4">
            <Button type="submit" loading={loading} className="w-full sm:w-auto">
              {t.save}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(user) && pendingAdminRole !== null}
        onOpenChange={(open) => !open && setPendingAdminRole(null)}
        title={pendingAdminRole ? t.promoteTitle : t.demoteTitle}
        description={
          pendingAdminRole
            ? t.promoteDescription(userName)
            : t.demoteDescription(userName)
        }
        confirmLabel={pendingAdminRole ? t.promoteConfirm : t.demoteConfirm}
        confirmVariant={pendingAdminRole ? "primary" : "danger"}
        onConfirm={() => {
          if (pendingAdminRole === null) return;
          setSelectedAdminRole(pendingAdminRole);
          setPendingAdminRole(null);
        }}
      />
    </>
  );
}

export function BanUserDialog({
  user,
  loading,
  onClose,
  onBan,
}: {
  user: User | null;
  loading: boolean;
  onClose: () => void;
  onBan: (reason: BanReason) => Promise<void>;
}) {
  const { locale } = usePreferences();
  const t = copy[locale];
  const [reason, setReason] = useState<BanReason>("terms-violation");

  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(open) => !open && onClose()}
      title={t.banTitle}
      description={t.banDescription}
    >
      <div className="grid gap-4">
        <label className="desk-panel-soft grid gap-2 p-4 text-sm font-bold">
          {t.reason}
          <Select
            value={reason}
            onChange={(event) => setReason(event.target.value as BanReason)}
          >
            {banReasons.map((value) => (
              <option key={value} value={value}>
                {getBanReasonLabel(value, locale)}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex justify-end border-t border-[var(--border)] pt-4">
          <Button
            className="w-full sm:w-auto"
            variant="danger"
            loading={loading}
            onClick={() => void onBan(reason)}
          >
            <Ban className="size-4" />
            {t.banAction}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function AdminUsersView() {
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState<UserFilters["role"]>("");
  const [banned, setBanned] = useState<UserFilters["banned"]>("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filters = useMemo<UserFilters>(
    () => ({ page, limit: 10, search: debouncedSearch, role, banned }),
    [page, debouncedSearch, role, banned],
  );
  const usersQuery = useQuery({
    queryKey: ["admin", "users", filters],
    queryFn: () => getUsersRequest(filters),
  });

  const users = usersQuery.data?.users ?? [];
  const pagination = usersQuery.data?.pagination;

  return (
    <div className="desk-grid-glow space-y-5">
      <header
        className="desk-page-header desk-panel relative overflow-hidden p-5 sm:p-7"
        style={{ marginBottom: 0 }}
      >
        <div className="relative z-10 flex w-full flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="desk-eyebrow">{t.eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              {t.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">
              {t.description}
            </p>
          </div>
          {pagination && (
            <div className="desk-stat min-w-36 p-3">
              <span className="text-xs font-bold text-[var(--muted)]">{t.users}</span>
              <strong className="mt-1 block text-2xl font-black tracking-tight">
                {formatNumber(pagination.total, intlLocale)}
              </strong>
            </div>
          )}
        </div>
        <div
          className="pointer-events-none absolute -end-16 -top-20 size-56 rounded-full bg-[var(--primary)]/10 blur-3xl"
          aria-hidden="true"
        />
      </header>

      <section className="desk-toolbar gap-3 p-3">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.search}
            className="ps-10"
          />
        </label>
        <Select
          className="md:w-48"
          value={role}
          onChange={(event) => {
            setRole(event.target.value as UserFilters["role"]);
            setPage(1);
          }}
        >
          <option value="">{t.allRoles}</option>
          <option value="user">{t.user}</option>
          <option value="admin">{t.admin}</option>
          <option value="super_admin">{t.superAdmin}</option>
        </Select>
        <Select
          className="md:w-52"
          value={banned}
          onChange={(event) => {
            setBanned(event.target.value as UserFilters["banned"]);
            setPage(1);
          }}
        >
          <option value="">{t.allStates}</option>
          <option value="false">{t.active}</option>
          <option value="true">{t.banned}</option>
        </Select>
      </section>

      <div>
        {usersQuery.isPending ? (
          <Card className="desk-panel">
            <LoadingState label={t.loading} />
          </Card>
        ) : usersQuery.isError ? (
          <Card className="desk-panel p-5">
            <ErrorState
              message={getErrorMessage(usersQuery.error, locale)}
              retry={() => void usersQuery.refetch()}
            />
          </Card>
        ) : users.length === 0 ? (
          <Card className="desk-panel p-5">
            <EmptyState title={t.emptyTitle} description={t.emptyDescription} />
          </Card>
        ) : (
          <>
            <div className="grid items-start gap-3 lg:grid-cols-2 xl:hidden">
              {users.map((user) => {
                const id = getId(user);
                const self = id === currentUser?.id || id === currentUser?._id;
                const superAdmin = user.roles.includes("super_admin");
                const admin = user.roles.includes("admin");
                const roleLabel = superAdmin ? t.superAdmin : admin ? t.admin : t.user;
                const roleValue = superAdmin ? "super_admin" : admin ? "admin" : "user";
                const isBanned = Boolean(user.ban?.isBanned);

                return (
                  <Card
                    key={id}
                    className="desk-panel group relative overflow-hidden p-0 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--primary)]/40 hover:shadow-lg"
                  >
                    <span
                      className={`absolute inset-y-0 start-0 w-1 ${
                        isBanned
                          ? "bg-rose-700 dark:bg-rose-300"
                          : superAdmin
                            ? "bg-violet-700 dark:bg-violet-300"
                            : admin
                              ? "bg-indigo-700 dark:bg-indigo-300"
                              : "bg-slate-700 dark:bg-slate-300"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="flex items-start justify-between gap-4 p-5 pb-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                          user={user}
                          className="size-12 ring-2 ring-[var(--surface-muted)]"
                          imageSizes="48px"
                        />
                        <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
                          <Link
                            href={`/admin/users/${id}`}
                            className="focus-ring min-w-0 truncate rounded-[var(--control-radius)] text-sm font-bold hover:text-[var(--primary)]"
                            title={t.viewProfile}
                            dir="auto"
                          >
                            {user.firstName} {user.lastName}
                            {self && (
                              <span className="ms-1 text-xs font-normal text-[var(--muted)]">
                                ({t.you})
                              </span>
                            )}
                          </Link>
                          <p
                            className="mt-1 truncate text-xs text-[var(--muted)]"
                            dir="ltr"
                            title={user.email}
                          >
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <AccountStatusBadge
                        banned={isBanned}
                        title={
                          user.ban?.isBanned
                            ? `${t.bannedReason}: ${getBanReasonLabel(user.ban.reason, locale)}`
                            : undefined
                        }
                      >
                        {isBanned ? t.banned : t.active}
                      </AccountStatusBadge>
                    </div>
                    <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-muted)]/45 px-5 py-3">
                      <span className="text-xs font-semibold text-[var(--muted)]">
                        {t.role}
                      </span>
                      <RoleBadge role={roleValue}>{roleLabel}</RoleBadge>
                    </div>
                  </Card>
                );
              })}
            </div>
            <Card className="desk-panel desk-table-shell hidden overflow-hidden p-0 xl:block">
              <div className="grid grid-cols-[minmax(12rem,1.3fr)_minmax(12rem,1.25fr)_8rem_8rem] gap-3 border-b bg-[var(--surface-muted)]/70 px-5 py-3.5 text-[0.68rem] font-black tracking-[0.08em] text-[var(--muted)] uppercase">
                <span>{t.users}</span>
                <span>{t.email}</span>
                <span>{t.role}</span>
                <span>{t.status}</span>
              </div>
              <div className="divide-y">
                {users.map((user) => {
                  const id = getId(user);
                  const self = id === currentUser?.id || id === currentUser?._id;
                  const superAdmin = user.roles.includes("super_admin");
                  const admin = user.roles.includes("admin");
                  const roleLabel = superAdmin ? t.superAdmin : admin ? t.admin : t.user;
                  const roleValue = superAdmin ? "super_admin" : admin ? "admin" : "user";
                  const isBanned = Boolean(user.ban?.isBanned);
                  return (
                    <article
                      key={id}
                      className="relative grid min-w-0 grid-cols-[minmax(12rem,1.3fr)_minmax(12rem,1.25fr)_8rem_8rem] items-center gap-3 overflow-hidden px-5 py-4 transition-colors hover:bg-[var(--surface-muted)]/70"
                    >
                      <span
                        className={`absolute inset-y-0 start-0 w-1 ${
                          isBanned
                            ? "bg-rose-700 dark:bg-rose-300"
                            : superAdmin
                              ? "bg-violet-700 dark:bg-violet-300"
                              : admin
                                ? "bg-indigo-700 dark:bg-indigo-300"
                                : "bg-slate-700 dark:bg-slate-300"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                          user={user}
                          className="size-10 ring-2 ring-[var(--surface-muted)]"
                          imageSizes="40px"
                        />
                        <Link
                          href={`/admin/users/${id}`}
                          className="focus-ring min-w-0 truncate rounded text-sm font-semibold hover:text-[var(--primary)]"
                          title={t.viewProfile}
                        >
                          {user.firstName} {user.lastName}
                          {self && (
                            <span className="ms-1 text-xs font-normal text-[var(--muted)]">
                              ({t.you})
                            </span>
                          )}
                        </Link>
                      </div>
                      <p
                        className="min-w-0 truncate text-xs text-[var(--muted)]"
                        dir="ltr"
                      >
                        {user.email}
                      </p>
                      <RoleBadge role={roleValue}>{roleLabel}</RoleBadge>
                      <AccountStatusBadge
                        banned={isBanned}
                        title={
                          user.ban?.isBanned
                            ? `${t.bannedReason}: ${getBanReasonLabel(user.ban.reason, locale)}`
                            : undefined
                        }
                      >
                        {isBanned ? t.banned : t.active}
                      </AccountStatusBadge>
                    </article>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="desk-toolbar flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
          <span className="text-[var(--muted)]">
            {t.page} {formatNumber(pagination.page, intlLocale)} {t.of}{" "}
            {formatNumber(pagination.totalPages, intlLocale)} ·{" "}
            {formatNumber(pagination.total, intlLocale)} {t.users}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              {t.previous}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((value) => value + 1)}
            >
              {t.next}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
