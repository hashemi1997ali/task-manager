"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  Calendar,
  TicketCheck,
  Edit3,
  Monitor,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { AccountStatusBadge, RoleBadge } from "@/components/ui/domain-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  banUserRequest,
  deleteUserRequest,
  deleteUserTaskRequest,
  getUserRequest,
  getUserTasksRequest,
  getUsersRequest,
  setAdminRoleRequest,
  unbanUserRequest,
  updateUserRequest,
  updateUserTaskRequest,
} from "@/features/admin/api";
import { BanUserDialog, EditUserDialog } from "@/features/admin/admin-users-view";
import { useAuth } from "@/features/auth/auth-provider";
import type { ProfileFormValues } from "@/features/auth/schemas";
import { openStaffTicketChatRequest } from "@/features/chat/api";
import { TaskCard } from "@/features/tasks/task-card";
import { TaskForm } from "@/features/tasks/task-form";
import { TaskTable } from "@/features/tasks/task-table";
import { getErrorMessage } from "@/lib/api-error";
import { getBanReasonLabel, getUserRoleLabel } from "@/lib/domain-labels";
import type { BanReason, Task, User } from "@/lib/types";
import { formatNumber, getId } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    back: "Back to customers & team",
    tasks: "Tickets",
    tasksHeading: (name: string) => `${name}'s tickets`,
    taskCount: "Tickets",
    sessions: "Active sessions",
    joined: "Joined",
    active: "Active",
    banned: "Banned",
    banReason: "Ban reason",
    noTasks: "This customer has no tickets yet.",
    loading: "Loading customer profile…",
    edit: "Edit ticket",
    delete: "Delete ticket",
    deleteTitle: "Delete this customer's ticket?",
    deleteDescription: "This action permanently deletes the selected ticket.",
    saved: "Ticket updated.",
    deleted: "Ticket deleted.",
    editUser: "Edit profile",
    banUser: "Ban user",
    unbanUser: "Unban user",
    deleteUser: "Delete account",
    deleteUserTitle: "Delete this user account?",
    deleteUserDescription: (name: string) =>
      `${name}'s account and all related tickets, chats, sessions, and assistant conversations will be permanently deleted.`,
    userDeleted: "User and related data deleted.",
    userSaved: "User details saved.",
    bannedDone: "The account was banned.",
    unbannedDone: "The account was unbanned.",
    page: "Page",
    of: "of",
    previous: "Previous",
    next: "Next",
    conversationOpened: "Support conversation opened.",
  },
  de: {
    back: "Zurück zu Kunden & Team",
    tasks: "Tickets",
    tasksHeading: (name: string) => `Tickets von ${name}`,
    taskCount: "Tickets",
    sessions: "Aktive Sitzungen",
    joined: "Registriert",
    active: "Aktiv",
    banned: "Gesperrt",
    banReason: "Sperrgrund",
    noTasks: "Dieser Kunde hat noch keine Tickets.",
    loading: "Kundenprofil wird geladen…",
    edit: "Ticket bearbeiten",
    delete: "Ticket löschen",
    deleteTitle: "Dieses Kundenticket löschen?",
    deleteDescription: "Das ausgewählte Ticket wird dauerhaft gelöscht.",
    saved: "Ticket aktualisiert.",
    deleted: "Ticket gelöscht.",
    editUser: "Profil bearbeiten",
    banUser: "Benutzer sperren",
    unbanUser: "Sperre aufheben",
    deleteUser: "Konto löschen",
    deleteUserTitle: "Dieses Benutzerkonto löschen?",
    deleteUserDescription: (name: string) =>
      `Das Konto von ${name} und alle zugehörigen Tickets, Chats, Sitzungen und Assistent-Unterhaltungen werden dauerhaft gelöscht.`,
    userDeleted: "Benutzer und zugehörige Daten gelöscht.",
    userSaved: "Benutzerdaten gespeichert.",
    bannedDone: "Das Konto wurde gesperrt.",
    unbannedDone: "Die Sperre wurde aufgehoben.",
    page: "Seite",
    of: "von",
    previous: "Zurück",
    next: "Weiter",
    conversationOpened: "Support-Gespräch geöffnet.",
  },
} as const;

export function AdminUserDetailView({ userId }: { userId: string }) {
  const router = useRouter();
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const {
    user: currentUser,
    isAdmin,
    isSuperAdmin,
    updateUser: updateCurrentUser,
  } = useAuth();
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [banningUser, setBanningUser] = useState<User | null>(null);
  const [unbanningUser, setUnbanningUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [taskPage, setTaskPage] = useState(1);

  const userQuery = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => getUserRequest(userId),
  });
  const tasksQuery = useQuery({
    queryKey: ["admin", "user", userId, "tasks", taskPage],
    queryFn: () => getUserTasksRequest(userId, taskPage, 10),
  });
  const agentsQuery = useQuery({
    queryKey: ["admin", "ticket-assignees", "admin"],
    queryFn: () => getUsersRequest({ page: 1, limit: 100, role: "admin" }),
    enabled: isSuperAdmin,
  });
  const supervisorsQuery = useQuery({
    queryKey: ["admin", "ticket-assignees", "super_admin"],
    queryFn: () => getUsersRequest({ page: 1, limit: 100, role: "super_admin" }),
    enabled: isSuperAdmin,
  });
  const taskPagination = tasksQuery.data?.pagination;
  const availableAssignees = isSuperAdmin
    ? [
        ...(agentsQuery.data?.users ?? []),
        ...(supervisorsQuery.data?.users ?? []),
      ].filter(
        (person, index, people) =>
          people.findIndex((item) => getId(item) === getId(person)) === index,
      )
    : currentUser
      ? [currentUser]
      : [];
  const canManageTicket = (ticket: Task): boolean => {
    if (!isAdmin) return false;
    if (isSuperAdmin || !ticket.assignee) return true;
    const assigneeId =
      typeof ticket.assignee === "object" ? getId(ticket.assignee) : ticket.assignee;
    return Boolean(currentUser && assigneeId === getId(currentUser));
  };

  const updateMutation = useMutation({
    mutationFn: ({
      taskId,
      values,
    }: {
      taskId: string;
      values: import("@/features/tasks/api").TaskMutationValues;
    }) => updateUserTaskRequest(userId, taskId, values),
    onSuccess: async () => {
      setEditingTask(null);
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteUserTaskRequest(userId, taskId),
    onSuccess: async () => {
      setDeletingTask(null);
      const remainingTotal = Math.max(0, (taskPagination?.total ?? 1) - 1);
      const lastPage = Math.max(1, Math.ceil(remainingTotal / 10));
      if (taskPage > lastPage) setTaskPage(lastPage);
      toast.success(t.deleted);
      await queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });
  const openConversationMutation = useMutation({
    mutationFn: (ticket: Task) => openStaffTicketChatRequest(getId(ticket), locale),
    onSuccess: async (chat) => {
      toast.success(t.conversationOpened);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["support", "queue"] }),
      ]);
      router.push(`/admin/support?chat=${encodeURIComponent(chat.id)}`);
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });
  const editUserMutation = useMutation({
    mutationFn: async ({
      user,
      values,
      isAdmin,
    }: {
      user: User;
      values: ProfileFormValues;
      isAdmin: boolean | null;
    }) => {
      let updated = await updateUserRequest(getId(user), values);
      if (isAdmin !== null) updated = await setAdminRoleRequest(getId(user), isAdmin);
      return updated;
    },
    onSuccess: async (updated) => {
      if (currentUser && getId(currentUser) === getId(updated)) {
        updateCurrentUser(updated);
      }
      setEditingUser(null);
      toast.success(t.userSaved);
      await queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });
  const banMutation = useMutation({
    mutationFn: ({ user, reason }: { user: User; reason: BanReason }) =>
      banUserRequest(getId(user), reason),
    onSuccess: async () => {
      setBanningUser(null);
      toast.success(t.bannedDone);
      await queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });
  const unbanMutation = useMutation({
    mutationFn: (user: User) => unbanUserRequest(getId(user)),
    onSuccess: async () => {
      setUnbanningUser(null);
      toast.success(t.unbannedDone);
      await queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });
  const deleteUserMutation = useMutation({
    mutationFn: (user: User) => deleteUserRequest(getId(user)),
    onSuccess: () => {
      setDeletingUser(null);
      toast.success(t.userDeleted);
      router.replace("/admin/users");
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });
  if (userQuery.isPending) return <LoadingState label={t.loading} />;
  if (userQuery.isError) {
    return (
      <ErrorState
        message={getErrorMessage(userQuery.error, locale)}
        retry={() => void userQuery.refetch()}
      />
    );
  }

  const { user, stats } = userQuery.data;
  const self = currentUser ? getId(currentUser) === getId(user) : false;
  const targetSuperAdmin = user.roles.includes("super_admin");
  const targetAdmin = user.roles.includes("admin");
  const highestRole = targetSuperAdmin ? "super_admin" : targetAdmin ? "admin" : "user";
  const mayManageUser = self || (!targetAdmin && !targetSuperAdmin) || isSuperAdmin;
  const mayBanUser = !self && !targetSuperAdmin && (!targetAdmin || isSuperAdmin);
  const mayDeleteUser = isSuperAdmin && !self;
  const canChangeAdminRole = isSuperAdmin && !self && !targetSuperAdmin;
  const tasks = tasksQuery.data?.tasks ?? [];
  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(intlLocale, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "—";

  return (
    <div className="desk-grid-glow space-y-5">
      <Link
        href="/admin/users"
        className="focus-ring desk-toolbar inline-flex min-h-10 items-center gap-2 px-3 text-sm font-bold text-[var(--muted)] hover:text-[var(--primary)]"
        style={{ alignItems: "center", flexDirection: "row" }}
      >
        <ArrowLeft className="size-4" />
        {t.back}
      </Link>

      <div className="min-w-0 space-y-6">
        <Card className="desk-panel relative min-w-0 overflow-hidden p-0">
          <span
            className={`absolute inset-y-0 start-0 z-20 w-1 ${
              user.ban?.isBanned
                ? "bg-rose-500"
                : targetSuperAdmin
                  ? "bg-violet-500"
                  : targetAdmin
                    ? "bg-indigo-500"
                    : "bg-slate-400"
            }`}
            aria-hidden="true"
          />
          <div className="relative border-b border-[var(--border)] bg-[var(--surface-muted)]/55 p-5 sm:p-7">
            <div className="relative z-10 flex min-w-0 flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div className="order-2 flex min-w-0 items-center gap-4 sm:order-1">
                <UserAvatar
                  user={user}
                  className="size-20 shrink-0 ring-4 ring-[var(--surface)] shadow-xl sm:size-24"
                  imageSizes="96px"
                />
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <RoleBadge role={highestRole}>
                      {getUserRoleLabel(highestRole, locale)}
                    </RoleBadge>
                    <AccountStatusBadge banned={Boolean(user.ban?.isBanned)}>
                      {user.ban?.isBanned ? t.banned : t.active}
                    </AccountStatusBadge>
                  </div>
                  <h1 className="mt-3 break-words text-2xl font-black tracking-[-0.035em] sm:text-3xl">
                    {user.firstName} {user.lastName}
                  </h1>
                  <p className="mt-1 break-all text-sm text-[var(--muted)]" dir="ltr">
                    {user.email}
                  </p>
                </div>
              </div>
              {mayManageUser && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="order-1 ms-auto size-11 shrink-0 px-0 sm:order-2 sm:w-auto sm:px-3"
                  onClick={() => setEditingUser(user)}
                  aria-label={t.editUser}
                  title={t.editUser}
                >
                  <Edit3 className="size-4" />
                  <span className="hidden sm:inline">{t.editUser}</span>
                </Button>
              )}
            </div>
            <div
              className="pointer-events-none absolute -end-20 -top-24 size-64 rounded-full bg-[var(--primary)]/10 blur-3xl"
              aria-hidden="true"
            />
          </div>
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)] lg:p-7">
            <div className="min-w-0">
              {user.ban?.isBanned && (
                <p className="w-fit max-w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-300">
                  <span className="font-black">{t.banReason}:</span>{" "}
                  {getBanReasonLabel(user.ban.reason, locale)}
                </p>
              )}

              {(mayBanUser || mayDeleteUser) && (
                <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                  {mayBanUser &&
                    (user.ban?.isBanned ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => setUnbanningUser(user)}
                      >
                        <RotateCcw className="size-4" />
                        {t.unbanUser}
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => setBanningUser(user)}
                      >
                        <Ban className="size-4" />
                        {t.banUser}
                      </Button>
                    ))}
                  {mayDeleteUser && (
                    <Button
                      variant="danger"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setDeletingUser(user)}
                    >
                      <Trash2 className="size-4" />
                      {t.deleteUser}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <dl className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="desk-stat flex min-h-16 items-center justify-between gap-3 p-3">
                <dt className="flex min-w-0 items-center gap-2 text-[var(--muted)]">
                  <span className="desk-icon-well size-9 shrink-0">
                    <TicketCheck className="size-4" />
                  </span>
                  <span className="text-xs font-bold">{t.taskCount}</span>
                </dt>
                <dd className="shrink-0 text-lg font-black">{stats.taskCount}</dd>
              </div>
              <div className="desk-stat flex min-h-16 items-center justify-between gap-3 p-3">
                <dt className="flex min-w-0 items-center gap-2 text-[var(--muted)]">
                  <span className="desk-icon-well size-9 shrink-0">
                    <Monitor className="size-4" />
                  </span>
                  <span className="text-xs font-bold">{t.sessions}</span>
                </dt>
                <dd className="shrink-0 text-lg font-black">
                  {stats.activeSessionCount}
                </dd>
              </div>
              <div className="desk-stat flex min-h-16 items-center justify-between gap-3 p-3 sm:col-span-3 lg:col-span-1 xl:col-span-1">
                <dt className="flex min-w-0 items-center gap-2 text-[var(--muted)]">
                  <span className="desk-icon-well size-9 shrink-0">
                    <Calendar className="size-4" />
                  </span>
                  <span className="text-xs font-bold">{t.joined}</span>
                </dt>
                <dd className="shrink-0 text-right text-xs font-black whitespace-nowrap">
                  {formatDate(user.createdAt)}
                </dd>
              </div>
            </dl>
          </div>
        </Card>

        <div id="tasks" className="min-w-0 scroll-mt-6">
          <div className="desk-panel-soft flex items-center justify-between gap-4 p-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="desk-icon-well text-[var(--primary)]">
                <TicketCheck className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="desk-eyebrow">{t.tasks}</p>
                <h2 className="desk-section-title mt-1 truncate sm:text-lg">
                  {t.tasksHeading(user.firstName)}
                </h2>
              </div>
            </div>
            <span className="desk-stat shrink-0 px-3 py-2 text-sm font-black">
              {formatNumber(stats.taskCount, intlLocale)}
            </span>
          </div>

          {tasksQuery.isPending ? (
            <div className="mt-5">
              <LoadingState label={t.tasks} />
            </div>
          ) : tasksQuery.isError ? (
            <div className="mt-5">
              <ErrorState
                message={getErrorMessage(tasksQuery.error, locale)}
                retry={() => void tasksQuery.refetch()}
              />
            </div>
          ) : tasks.length === 0 ? (
            <Card className="desk-panel mt-4 p-8 text-center text-sm text-[var(--muted)]">
              {t.noTasks}
            </Card>
          ) : (
            <div className="mt-4">
              <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2 xl:hidden">
                {tasks.map((task) => {
                  const taskId = getId(task);
                  return (
                    <TaskCard
                      key={taskId}
                      task={task}
                      referenceTime={tasksQuery.dataUpdatedAt}
                      showUpdatedAt
                      compact
                      onEdit={
                        canManageTicket(task) ? () => setEditingTask(task) : undefined
                      }
                      onDelete={isSuperAdmin ? () => setDeletingTask(task) : undefined}
                      onStatusChange={
                        canManageTicket(task)
                          ? (status) =>
                              updateMutation.mutate({ taskId, values: { status } })
                          : undefined
                      }
                      onDiscussSupport={
                        canManageTicket(task)
                          ? () => openConversationMutation.mutate(task)
                          : undefined
                      }
                      staffSupportAction
                      supportUpdating={Boolean(
                        openConversationMutation.isPending &&
                        openConversationMutation.variables &&
                        getId(openConversationMutation.variables) === taskId,
                      )}
                      statusUpdating={Boolean(
                        updateMutation.isPending &&
                        updateMutation.variables?.taskId === taskId,
                      )}
                    />
                  );
                })}
              </div>
              <TaskTable
                tasks={tasks}
                referenceTime={tasksQuery.dataUpdatedAt}
                onEdit={isAdmin ? setEditingTask : undefined}
                onDelete={isSuperAdmin ? setDeletingTask : undefined}
                onStatusChange={
                  isAdmin
                    ? (task, status) =>
                        updateMutation.mutate({
                          taskId: getId(task),
                          values: { status },
                        })
                    : undefined
                }
                onDiscussSupport={(task) => openConversationMutation.mutate(task)}
                staffSupportAction
                isSupportOpening={(task) =>
                  Boolean(
                    openConversationMutation.isPending &&
                    openConversationMutation.variables &&
                    getId(openConversationMutation.variables) === getId(task),
                  )
                }
                isStatusUpdating={(task) =>
                  Boolean(
                    updateMutation.isPending &&
                    updateMutation.variables?.taskId === getId(task),
                  )
                }
                canManage={canManageTicket}
              />
            </div>
          )}

          {taskPagination && taskPagination.totalPages > 1 && (
            <div className="desk-toolbar mt-5 flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <span className="text-[var(--muted)]">
                {t.page} {formatNumber(taskPagination.page, intlLocale)} {t.of}{" "}
                {formatNumber(taskPagination.totalPages, intlLocale)} ·{" "}
                {formatNumber(taskPagination.total, intlLocale)} {t.tasks}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!taskPagination.hasPreviousPage}
                  onClick={() => setTaskPage((value) => Math.max(1, value - 1))}
                >
                  {t.previous}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!taskPagination.hasNextPage}
                  onClick={() => setTaskPage((value) => value + 1)}
                >
                  {t.next}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(editingTask)}
        onOpenChange={(open) => !open && setEditingTask(null)}
        title={t.edit}
      >
        {editingTask && (
          <TaskForm
            key={`${getId(editingTask)}-${editingTask.updatedAt}`}
            task={editingTask}
            admin
            assignees={availableAssignees}
            loading={updateMutation.isPending}
            onSubmit={(values) =>
              updateMutation.mutate({ taskId: getId(editingTask), values })
            }
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingTask)}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        title={t.deleteTitle}
        description={t.deleteDescription}
        confirmLabel={t.delete}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingTask) deleteMutation.mutate(getId(deletingTask));
        }}
      />
      <EditUserDialog
        key={editingUser ? getId(editingUser) : "closed-user-edit"}
        user={editingUser}
        loading={editUserMutation.isPending}
        canChangeAdminRole={canChangeAdminRole}
        onClose={() => setEditingUser(null)}
        onSave={(values, isAdmin) =>
          editingUser
            ? editUserMutation
                .mutateAsync({ user: editingUser, values, isAdmin })
                .then(() => undefined)
            : Promise.resolve()
        }
      />
      <BanUserDialog
        key={banningUser ? getId(banningUser) : "closed-user-ban"}
        user={banningUser}
        loading={banMutation.isPending}
        onClose={() => setBanningUser(null)}
        onBan={(reason) =>
          banningUser
            ? banMutation.mutateAsync({ user: banningUser, reason }).then(() => undefined)
            : Promise.resolve()
        }
      />
      <ConfirmDialog
        open={Boolean(unbanningUser)}
        onOpenChange={(open) => !open && setUnbanningUser(null)}
        title={t.unbanUser}
        description={t.unbannedDone}
        loading={unbanMutation.isPending}
        onConfirm={() =>
          unbanningUser
            ? unbanMutation.mutateAsync(unbanningUser).then(() => undefined)
            : undefined
        }
      />
      <ConfirmDialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => !open && setDeletingUser(null)}
        title={t.deleteUserTitle}
        description={t.deleteUserDescription(
          `${deletingUser?.firstName ?? ""} ${deletingUser?.lastName ?? ""}`.trim(),
        )}
        confirmLabel={t.deleteUser}
        confirmVariant="danger"
        loading={deleteUserMutation.isPending}
        onConfirm={() =>
          deletingUser
            ? deleteUserMutation.mutateAsync(deletingUser).then(() => undefined)
            : undefined
        }
      />
    </div>
  );
}
