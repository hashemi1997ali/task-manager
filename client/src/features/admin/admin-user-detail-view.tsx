"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  Calendar,
  CheckSquare2,
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
  setAdminRoleRequest,
  unbanUserRequest,
  updateUserRequest,
  updateUserTaskRequest,
} from "@/features/admin/api";
import { BanUserDialog, EditUserDialog } from "@/features/admin/admin-users-view";
import { useAuth } from "@/features/auth/auth-provider";
import type { ProfileFormValues } from "@/features/auth/schemas";
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
    back: "Back to users",
    tasks: "Tasks",
    tasksHeading: (name: string) => `${name}'s tasks`,
    taskCount: "Tasks",
    sessions: "Active sessions",
    joined: "Joined",
    active: "Active",
    banned: "Banned",
    banReason: "Ban reason",
    noTasks: "This user has no tasks yet.",
    loading: "Loading user profile…",
    edit: "Edit task",
    delete: "Delete task",
    deleteTitle: "Delete this user's task?",
    deleteDescription: "This action permanently deletes the selected task.",
    saved: "Task updated.",
    deleted: "Task deleted.",
    editUser: "Edit profile",
    banUser: "Ban user",
    unbanUser: "Unban user",
    deleteUser: "Delete account",
    deleteUserTitle: "Delete this user account?",
    deleteUserDescription: (name: string) =>
      `${name}'s account and all related tasks, chats, sessions, and assistant conversations will be permanently deleted.`,
    userDeleted: "User and related data deleted.",
    userSaved: "User details saved.",
    bannedDone: "The account was banned.",
    unbannedDone: "The account was unbanned.",
    page: "Page",
    of: "of",
    previous: "Previous",
    next: "Next",
  },
  de: {
    back: "Zurück zu Benutzern",
    tasks: "Aufgaben",
    tasksHeading: (name: string) => `Aufgaben von ${name}`,
    taskCount: "Aufgaben",
    sessions: "Aktive Sitzungen",
    joined: "Registriert",
    active: "Aktiv",
    banned: "Gesperrt",
    banReason: "Sperrgrund",
    noTasks: "Dieser Benutzer hat noch keine Aufgaben.",
    loading: "Benutzerprofil wird geladen…",
    edit: "Aufgabe bearbeiten",
    delete: "Aufgabe löschen",
    deleteTitle: "Diese Benutzeraufgabe löschen?",
    deleteDescription: "Die ausgewählte Aufgabe wird dauerhaft gelöscht.",
    saved: "Aufgabe aktualisiert.",
    deleted: "Aufgabe gelöscht.",
    editUser: "Profil bearbeiten",
    banUser: "Benutzer sperren",
    unbanUser: "Sperre aufheben",
    deleteUser: "Konto löschen",
    deleteUserTitle: "Dieses Benutzerkonto löschen?",
    deleteUserDescription: (name: string) =>
      `Das Konto von ${name} und alle zugehörigen Aufgaben, Chats, Sitzungen und Assistent-Unterhaltungen werden dauerhaft gelöscht.`,
    userDeleted: "Benutzer und zugehörige Daten gelöscht.",
    userSaved: "Benutzerdaten gespeichert.",
    bannedDone: "Das Konto wurde gesperrt.",
    unbannedDone: "Die Sperre wurde aufgehoben.",
    page: "Seite",
    of: "von",
    previous: "Zurück",
    next: "Weiter",
  },
} as const;

export function AdminUserDetailView({ userId }: { userId: string }) {
  const router = useRouter();
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const { user: currentUser, isSuperAdmin, updateUser: updateCurrentUser } = useAuth();
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
  const taskPagination = tasksQuery.data?.pagination;

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
    <div>
      <Link
        href="/admin/users"
        className="focus-ring inline-flex items-center gap-2 rounded-full text-sm font-bold text-[var(--muted)] hover:text-[var(--primary)]"
      >
        <ArrowLeft className="size-4" />
        {t.back}
      </Link>

      <div className="mt-6 min-w-0">
        <Card className="min-w-0 overflow-hidden p-5 md:p-6">
          <div className="min-w-0">
            <div className="min-w-0">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <RoleBadge role={highestRole}>
                    {getUserRoleLabel(highestRole, locale)}
                  </RoleBadge>
                  <AccountStatusBadge banned={Boolean(user.ban?.isBanned)}>
                    {user.ban?.isBanned ? t.banned : t.active}
                  </AccountStatusBadge>
                </div>
                {mayManageUser && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="size-11 shrink-0 px-0 sm:w-auto sm:px-3"
                    onClick={() => setEditingUser(user)}
                    aria-label={t.editUser}
                    title={t.editUser}
                  >
                    <Edit3 className="size-4" />
                    <span className="hidden sm:inline">{t.editUser}</span>
                  </Button>
                )}
              </div>

              <div className="mt-4 flex min-w-0 items-center gap-4">
                <UserAvatar user={user} className="size-16 shrink-0" imageSizes="64px" />
                <div className="min-w-0">
                  <h1 className="break-words text-2xl font-black">
                    {user.firstName} {user.lastName}
                  </h1>
                  <p className="mt-1 break-all text-sm text-[var(--muted)]">
                    {user.email}
                  </p>
                </div>
              </div>

              {user.ban?.isBanned && (
                <p className="mt-3 w-fit max-w-full rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                  <span className="font-black">{t.banReason}:</span>{" "}
                  {getBanReasonLabel(user.ban.reason, locale)}
                </p>
              )}

              {(mayBanUser || mayDeleteUser) && (
                <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
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

            <dl className="mt-6 grid gap-2 text-sm xl:grid-cols-3">
              <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                <dt className="flex min-w-0 items-center gap-2 text-[var(--muted)]">
                  <CheckSquare2 className="size-4 shrink-0" /> {t.taskCount}
                </dt>
                <dd className="shrink-0 font-black">{stats.taskCount}</dd>
              </div>
              <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                <dt className="flex min-w-0 items-center gap-2 text-[var(--muted)]">
                  <Monitor className="size-4 shrink-0" /> {t.sessions}
                </dt>
                <dd className="shrink-0 font-black">{stats.activeSessionCount}</dd>
              </div>
              <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
                <dt className="flex min-w-0 items-center gap-2 text-[var(--muted)]">
                  <Calendar className="size-4 shrink-0" /> {t.joined}
                </dt>
                <dd className="shrink-0 text-right text-xs font-black whitespace-nowrap">
                  {formatDate(user.createdAt)}
                </dd>
              </div>
            </dl>
          </div>
        </Card>

        <div id="tasks" className="mt-8 min-w-0 scroll-mt-6">
          <h2 className="text-2xl font-black">{t.tasksHeading(user.firstName)}</h2>

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
            <Card className="mt-5 p-8 text-center text-sm text-[var(--muted)]">
              {t.noTasks}
            </Card>
          ) : (
            <div className="mt-5">
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
                      onEdit={isSuperAdmin ? () => setEditingTask(task) : undefined}
                      onDelete={isSuperAdmin ? () => setDeletingTask(task) : undefined}
                      onStatusChange={
                        isSuperAdmin
                          ? (status) =>
                              updateMutation.mutate({ taskId, values: { status } })
                          : undefined
                      }
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
                onEdit={isSuperAdmin ? setEditingTask : undefined}
                onDelete={isSuperAdmin ? setDeletingTask : undefined}
                onStatusChange={
                  isSuperAdmin
                    ? (task, status) =>
                        updateMutation.mutate({
                          taskId: getId(task),
                          values: { status },
                        })
                    : undefined
                }
                isStatusUpdating={(task) =>
                  Boolean(
                    updateMutation.isPending &&
                    updateMutation.variables?.taskId === getId(task),
                  )
                }
              />
            </div>
          )}

          {taskPagination && taskPagination.totalPages > 1 && (
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-[var(--surface)] p-3 text-sm">
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
