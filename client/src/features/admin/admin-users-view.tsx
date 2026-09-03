"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Switch from "@radix-ui/react-switch";
import { useQuery } from "@tanstack/react-query";
import { Ban, CircleDot, RotateCcw, Search, ShieldCheck } from "lucide-react";
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
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { getUsersRequest, type UserFilters } from "@/features/admin/api";
import { useAuth } from "@/features/auth/auth-provider";
import { createProfileSchema, type ProfileFormValues } from "@/features/auth/schemas";
import { getErrorMessage } from "@/lib/api-error";
import { getBanReasonLabel } from "@/lib/domain-labels";
import type { BanReason, User } from "@/lib/types";
import { cn, formatNumber, getId } from "@/lib/utils";
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
    title: "Users",
    description: "Manage user accounts, profiles, and access.",
    search: "Search by name or email…",
    allRoles: "All roles",
    user: "User",
    admin: "Admin",
    superAdmin: "Super Admin",
    allStates: "All account states",
    status: "Status",
    active: "Active",
    banned: "Banned",
    loading: "Loading users…",
    emptyTitle: "No users found",
    emptyDescription: "Try another search or filter.",
    joined: "Joined",
    role: "Role",
    actions: "Actions",
    you: "You",
    edit: "Edit user",
    editDescription: "Update the user's name or email address.",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    save: "Save changes",
    saved: "User details saved.",
    adminAccess: "Administrator access",
    adminAccessDescription: "Grant or remove administrator access for this user.",
    promoteTitle: "Make this user an administrator?",
    promoteDescription: (name: string) =>
      `${name} will be able to access administrator tools and manage regular users.`,
    promoteConfirm: "Make administrator",
    demoteTitle: "Remove administrator access?",
    demoteDescription: (name: string) =>
      `${name} will return to a regular user and lose administrator access.`,
    demoteConfirm: "Remove access",
    roleEnabled: "Administrator access enabled.",
    roleRemoved: "Administrator access removed.",
    deleted: "User and related data deleted.",
    banTitle: "Ban user",
    banDescription: "The user will be signed out on every active device.",
    reason: "Ban reason",
    banAction: "Ban account",
    bannedDone: "The account was banned and active sessions were revoked.",
    unbannedDone: "The account was unbanned and ban metadata was cleared.",
    unbanTitle: "Unban user",
    unbanDescription: "All ban metadata will be cleared from the account.",
    deleteTitle: "Delete user",
    deleteDescription: (name: string) =>
      `${name}'s account, sessions, tasks, and profile image will be permanently deleted.`,
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    users: "users",
    viewProfile: "Open profile and tasks",
    bannedReason: "Reason",
    clearFilters: "Clear filters",
  },
  de: {
    eyebrow: "Zugriff und Sicherheit",
    title: "Benutzer",
    description: "Verwalte Benutzerkonten, Profile und Zugriffe.",
    search: "Nach Name oder E-Mail suchen…",
    allRoles: "Alle Rollen",
    user: "Benutzer",
    admin: "Admin",
    superAdmin: "Super Admin",
    allStates: "Alle Kontostatus",
    status: "Status",
    active: "Aktiv",
    banned: "Gesperrt",
    loading: "Benutzer werden geladen…",
    emptyTitle: "Keine Benutzer gefunden",
    emptyDescription: "Versuche eine andere Suche oder einen anderen Filter.",
    joined: "Registriert",
    role: "Rolle",
    actions: "Aktionen",
    you: "Du",
    edit: "Benutzer bearbeiten",
    editDescription: "Name oder E-Mail-Adresse des Benutzers ändern.",
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail",
    save: "Änderungen speichern",
    saved: "Benutzerdaten gespeichert.",
    adminAccess: "Administratorrechte",
    adminAccessDescription:
      "Administratorrechte für diesen Benutzer vergeben oder entfernen.",
    promoteTitle: "Diesen Benutzer zum Administrator machen?",
    promoteDescription: (name: string) =>
      `${name} erhält Zugriff auf Administratorwerkzeuge und kann Standardbenutzer verwalten.`,
    promoteConfirm: "Zum Administrator machen",
    demoteTitle: "Administratorrechte entfernen?",
    demoteDescription: (name: string) =>
      `${name} wird wieder Standardbenutzer und verliert den Administratorzugriff.`,
    demoteConfirm: "Zugriff entfernen",
    roleEnabled: "Administratorrechte aktiviert.",
    roleRemoved: "Administratorrechte entfernt.",
    deleted: "Benutzer und zugehörige Daten gelöscht.",
    banTitle: "Benutzer sperren",
    banDescription: "Der Benutzer wird auf allen aktiven Geräten abgemeldet.",
    reason: "Sperrgrund",
    banAction: "Konto sperren",
    bannedDone: "Das Konto wurde gesperrt und aktive Sitzungen wurden beendet.",
    unbannedDone: "Die Sperre und alle Sperrdaten wurden entfernt.",
    unbanTitle: "Sperre aufheben",
    unbanDescription: "Alle Sperrdaten werden aus dem Konto entfernt.",
    deleteTitle: "Benutzer löschen",
    deleteDescription: (name: string) =>
      `Konto, Sitzungen, Aufgaben und Anhänge von ${name} werden dauerhaft gelöscht.`,
    previous: "Zurück",
    next: "Weiter",
    page: "Seite",
    of: "von",
    users: "Benutzer",
    viewProfile: "Profil und Aufgaben öffnen",
    bannedReason: "Grund",
    clearFilters: "Filter zurücksetzen",
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
        <form className="space-y-2" onSubmit={form.handleSubmit(submitChanges)}>
          <Field label={t.firstName} error={form.formState.errors.firstName?.message}>
            <Input {...form.register("firstName")} autoComplete="off" />
          </Field>
          <Field label={t.lastName} error={form.formState.errors.lastName?.message}>
            <Input {...form.register("lastName")} autoComplete="off" />
          </Field>
          <Field label={t.email} error={form.formState.errors.email?.message}>
            <Input {...form.register("email")} type="email" autoComplete="off" />
          </Field>
          {canChangeAdminRole && (
            <div className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border bg-[var(--surface-muted)] p-3">
              <div className="min-w-0">
                <p className="text-sm font-black">{t.adminAccess}</p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">
                  {t.adminAccessDescription}
                </p>
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
          <div className="flex justify-end pt-2">
            <Button type="submit" loading={loading}>
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
      <div className="space-y-4">
        <label className="grid gap-2 text-sm font-bold">
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
        <div className="flex justify-end">
          <Button variant="danger" loading={loading} onClick={() => void onBan(reason)}>
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
  const filterFieldClass =
    "border-[color-mix(in_srgb,var(--border)_62%,transparent)] px-3 py-1.5 transition-colors focus-within:text-[var(--foreground)]";
  const filterLabelClass =
    "flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.1em] text-[var(--muted)] uppercase";
  const filterSelectClass =
    "h-7 min-w-0 rounded-none border-0 bg-transparent px-0 shadow-none";
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
    <div>
      <PageHeading title={t.title} description={t.description} />

      <section className="glass-panel mt-6 grid gap-3 rounded-[var(--container-radius)] p-3">
        <label className="relative min-w-0">
          <Search className="pointer-events-none absolute left-4 top-4 size-4 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.search}
            className="h-12 rounded-xl border-transparent bg-[var(--surface-muted)] pl-10 shadow-none"
            aria-label={t.search}
          />
        </label>
        <div className="grid grid-cols-2 gap-0 rounded-xl bg-[var(--surface-muted)] p-1 md:grid-cols-[repeat(2,minmax(0,1fr))_auto]">
          <label className={cn("min-w-0 border-r", filterFieldClass)}>
            <span className={filterLabelClass}>
              <ShieldCheck className="size-3" aria-hidden="true" /> {t.role}
            </span>
            <Select
              value={role}
              onChange={(event) => {
                setRole(event.target.value as UserFilters["role"]);
                setPage(1);
              }}
              className={filterSelectClass}
              aria-label={t.role}
            >
              <option value="">{t.allRoles}</option>
              <option value="user">{t.user}</option>
              <option value="admin">{t.admin}</option>
              <option value="super_admin">{t.superAdmin}</option>
            </Select>
          </label>
          <label className={cn("min-w-0 md:border-r", filterFieldClass)}>
            <span className={filterLabelClass}>
              <CircleDot className="size-3" aria-hidden="true" /> {t.status}
            </span>
            <Select
              value={banned}
              onChange={(event) => {
                setBanned(event.target.value as UserFilters["banned"]);
                setPage(1);
              }}
              className={filterSelectClass}
              aria-label={t.status}
            >
              <option value="">{t.allStates}</option>
              <option value="false">{t.active}</option>
              <option value="true">{t.banned}</option>
            </Select>
          </label>
          <Button
            variant="ghost"
            className="col-span-2 h-auto self-stretch rounded-lg border-t border-[color-mix(in_srgb,var(--border)_62%,transparent)] bg-transparent px-4 py-3 shadow-none md:col-span-1 md:border-t-0 md:py-0"
            onClick={() => {
              setSearch("");
              setDebouncedSearch("");
              setRole("");
              setBanned("");
              setPage(1);
            }}
            aria-label={t.clearFilters}
          >
            <RotateCcw className="size-4" /> {t.clearFilters}
          </Button>
        </div>
      </section>

      <div className="mt-6">
        {usersQuery.isPending ? (
          <Card>
            <LoadingState label={t.loading} />
          </Card>
        ) : usersQuery.isError ? (
          <Card className="p-5">
            <ErrorState
              message={getErrorMessage(usersQuery.error, locale)}
              retry={() => void usersQuery.refetch()}
            />
          </Card>
        ) : users.length === 0 ? (
          <Card className="p-5">
            <EmptyState title={t.emptyTitle} description={t.emptyDescription} />
          </Card>
        ) : (
          <>
            <div className="overflow-hidden rounded-[var(--container-radius)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[var(--surface)] [&>*+*]:border-t [&>*+*]:border-[color-mix(in_srgb,var(--border)_54%,transparent)] lg:grid lg:grid-cols-2 lg:[&>*+*]:border-t-0 lg:[&>*]:border-b lg:[&>*]:border-[color-mix(in_srgb,var(--border)_54%,transparent)] lg:[&>*:nth-child(odd)]:border-r xl:hidden">
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
                    className={cn(
                      "group relative min-h-0 rounded-none border-0 bg-transparent p-4 shadow-none transition-colors duration-200 hover:border-transparent",
                      isBanned
                        ? "hover:bg-rose-50/60 dark:hover:bg-rose-500/8"
                        : "hover:bg-[var(--surface-muted)]",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
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
                    </div>
                    <div className="mt-3 flex min-w-0 items-center gap-3">
                      <UserAvatar user={user} className="size-10" imageSizes="40px" />
                      <div className="flex min-h-10 min-w-0 flex-1 flex-col justify-center">
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
                  </Card>
                );
              })}
            </div>
            <Card className="hidden overflow-hidden border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[var(--surface)] shadow-none hover:border-[color-mix(in_srgb,var(--border)_82%,transparent)] xl:block">
              <div className="grid grid-cols-[minmax(12rem,1.3fr)_minmax(12rem,1.25fr)_7rem_7rem] gap-3 border-b bg-[color-mix(in_srgb,var(--surface-muted)_72%,var(--surface))] px-4 py-3.5 text-[10px] font-extrabold tracking-[0.12em] text-[var(--muted)] uppercase">
                <span>{t.users}</span>
                <span>{t.email}</span>
                <span>{t.role}</span>
                <span>{t.status}</span>
              </div>
              <div className="divide-y divide-[color-mix(in_srgb,var(--border)_54%,transparent)]">
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
                      className={cn(
                        "relative grid min-h-[4.75rem] min-w-0 grid-cols-[minmax(12rem,1.3fr)_minmax(12rem,1.25fr)_7rem_7rem] items-center gap-3 overflow-hidden px-4 py-3 transition-colors duration-200",
                        isBanned
                          ? "hover:bg-rose-50/60 dark:hover:bg-rose-500/8"
                          : "hover:bg-[var(--surface-muted)]",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3 pl-1">
                        <UserAvatar user={user} className="size-8" imageSizes="32px" />
                        <Link
                          href={`/admin/users/${id}`}
                          className="focus-ring min-w-0 truncate rounded text-sm font-bold hover:text-[var(--primary)]"
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
                      <RoleBadge role={roleValue} className="justify-self-start">
                        {roleLabel}
                      </RoleBadge>
                      <AccountStatusBadge
                        banned={isBanned}
                        className="justify-self-start"
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
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-[var(--surface)] p-3 text-sm">
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
