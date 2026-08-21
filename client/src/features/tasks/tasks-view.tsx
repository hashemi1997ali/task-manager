"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import {
  createTaskRequest,
  deleteTaskRequest,
  getTasksRequest,
  updateTaskRequest,
  type TaskFilters,
  type TaskMutationValues,
} from "@/features/tasks/api";
import { TaskCard } from "@/features/tasks/task-card";
import { TaskForm } from "@/features/tasks/task-form";
import { TaskTable } from "@/features/tasks/task-table";
import { getErrorMessage } from "@/lib/api-error";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { formatNumber, getId } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    adminEyebrow: "Content management",
    userEyebrow: "Your focus space",
    adminTitle: "All tasks",
    userTitle: "My tasks",
    adminDescription: "View, edit, or delete tasks created by any user.",
    userDescription: "Find your work, keep it organized, and finish one task at a time.",
    searchPlaceholder: "Search titles and descriptions …",
    searchLabel: "Search tasks",
    statusFilter: "Filter by status",
    allStatuses: "All statuses",
    todo: "To do",
    inProgress: "In progress",
    done: "Done",
    priorityFilter: "Filter by priority",
    allPriorities: "All priorities",
    low: "Low",
    medium: "Medium",
    high: "High",
    clearFilters: "Clear filters",
    noResults: "No matching tasks",
    noTasks: "No tasks yet",
    noResultsDescription: "Try a different search phrase or adjust the filters.",
    noAdminTasksDescription: "No user has created a task yet.",
    noUserTasksDescription: "Create your first task and turn your plan into progress.",
    firstTask: "Create first task",
    page: "Page",
    of: "of",
    task: "Task",
    tasks: "tasks",
    previous: "Previous",
    next: "Next",
    editDialog: "Edit task",
    createDialog: "Create a new task",
    dialogDescription: "Add the task details. You can update them at any time.",
    deleteDialog: "Delete task",
    deleteDescription: (title: string) => `“${title}” will be permanently deleted.`,
    saved: "Task changes saved.",
    statusUpdated: "Task status updated.",
    created: "Task created.",
    deleted: "Task deleted.",
    dueDate: "Due date",
    dueLabel: "Due",
    updated: "Updated",
    statusLabel: "Status",
    priorityLabel: "Priority",
    newTask: "New task",
    sort: "Sort",
    newest: "Newest",
    recentlyUpdated: "Recently updated",
    dueSoon: "Due soon",
    titleSort: "Title",
    owner: "Owner",
    actions: "Actions",
  },
  de: {
    adminEyebrow: "Inhaltsverwaltung",
    userEyebrow: "Dein Fokusbereich",
    adminTitle: "Alle Aufgaben",
    userTitle: "Meine Aufgaben",
    adminDescription: "Aufgaben aller Benutzer anzeigen, bearbeiten oder löschen.",
    userDescription:
      "Finde deine Arbeit, halte sie geordnet und erledige sie Schritt für Schritt.",
    searchPlaceholder: "Titel und Beschreibungen durchsuchen …",
    searchLabel: "Aufgaben durchsuchen",
    statusFilter: "Nach Status filtern",
    allStatuses: "Alle Status",
    todo: "Offen",
    inProgress: "In Bearbeitung",
    done: "Erledigt",
    priorityFilter: "Nach Priorität filtern",
    allPriorities: "Alle Prioritäten",
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
    clearFilters: "Filter zurücksetzen",
    noResults: "Keine passenden Aufgaben",
    noTasks: "Noch keine Aufgaben",
    noResultsDescription: "Passe die Filter an oder versuche einen anderen Suchbegriff.",
    noAdminTasksDescription: "Noch kein Benutzer hat eine Aufgabe erstellt.",
    noUserTasksDescription:
      "Erstelle deine erste Aufgabe und setze deinen Plan in Bewegung.",
    firstTask: "Erste Aufgabe erstellen",
    page: "Seite",
    of: "von",
    task: "Aufgabe",
    tasks: "Aufgaben",
    previous: "Zurück",
    next: "Weiter",
    editDialog: "Aufgabe bearbeiten",
    createDialog: "Neue Aufgabe erstellen",
    dialogDescription: "Ergänze die Details. Du kannst sie jederzeit ändern.",
    deleteDialog: "Aufgabe löschen",
    deleteDescription: (title: string) =>
      `„${title}“ und der zugehörige Anhang werden dauerhaft gelöscht.`,
    saved: "Änderungen gespeichert.",
    statusUpdated: "Aufgabenstatus aktualisiert.",
    created: "Aufgabe erstellt.",
    deleted: "Aufgabe gelöscht.",
    dueDate: "Fällig",
    dueLabel: "Fällig",
    updated: "Aktualisiert",
    statusLabel: "Status",
    priorityLabel: "Priorität",
    newTask: "Neue Aufgabe",
    sort: "Sortieren",
    newest: "Neueste",
    recentlyUpdated: "Zuletzt aktualisiert",
    dueSoon: "Bald fÃ¤llig",
    titleSort: "Titel",
    owner: "Besitzer",
    actions: "Aktionen",
  },
} as const;

export function TasksView({ admin = false }: { admin?: boolean }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, intlLocale } = usePreferences();
  const t = copy[locale];
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<NonNullable<TaskFilters["sortBy"]>>("createdAt");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filters = useMemo<TaskFilters>(
    () => ({
      page,
      limit: 10,
      search: debouncedSearch,
      status,
      priority,
      sortBy,
      order: sortBy === "dueDate" || sortBy === "title" ? "asc" : "desc",
      ownerId: admin ? (searchParams.get("ownerId") ?? undefined) : undefined,
    }),
    [page, debouncedSearch, status, priority, sortBy, admin, searchParams],
  );
  const queryKey = admin ? ["admin", "tasks", filters] : ["tasks", "mine", filters];
  const tasksQuery = useQuery({
    queryKey,
    queryFn: () => getTasksRequest(filters, admin),
  });

  const refreshLists = async () => {
    await queryClient.invalidateQueries({
      queryKey: admin ? ["admin", "tasks"] : ["tasks"],
    });
    if (!admin) await queryClient.invalidateQueries({ queryKey: ["tasks", "summary"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (values: TaskMutationValues) => {
      if (editingTask) return updateTaskRequest(getId(editingTask), values, admin);
      return createTaskRequest(values);
    },
    onSuccess: async () => {
      toast.success(editingTask ? t.saved : t.created);
      setEditingTask(null);
      setCreating(false);
      if (!admin && searchParams.get("new") === "1") {
        router.replace("/tasks", { scroll: false });
      }
      await refreshLists();
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const deleteMutation = useMutation({
    mutationFn: (task: Task) => deleteTaskRequest(getId(task), admin),
    onSuccess: async () => {
      toast.success(t.deleted);
      setDeletingTask(null);
      await refreshLists();
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) => {
      return updateTaskRequest(getId(task), { status }, admin);
    },
    onSuccess: async () => {
      toast.success(t.statusUpdated);
      await refreshLists();
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const tasks = tasksQuery.data?.tasks ?? [];
  const pagination = tasksQuery.data?.pagination;
  const queryRequestsCreate = !admin && searchParams.get("new") === "1";
  const modalOpen = creating || queryRequestsCreate || Boolean(editingTask);
  const hasFilters = Boolean(debouncedSearch || status || priority);
  const renderTaskCard = (task: Task, showUpdatedAt = false) => (
    <TaskCard
      key={getId(task)}
      task={task}
      showOwner={admin}
      showUpdatedAt={showUpdatedAt}
      referenceTime={tasksQuery.dataUpdatedAt}
      onEdit={() => setEditingTask(task)}
      onDelete={() => setDeletingTask(task)}
      onStatusChange={(nextStatus) => statusMutation.mutate({ task, status: nextStatus })}
      statusUpdating={Boolean(
        statusMutation.isPending &&
        statusMutation.variables &&
        getId(statusMutation.variables.task) === getId(task),
      )}
      compact
    />
  );

  return (
    <div>
      <PageHeading
        title={admin ? t.adminTitle : t.userTitle}
        description={admin ? t.adminDescription : t.userDescription}
      />

      <section className="glass-panel mt-7 grid gap-3 rounded-[var(--container-radius)] p-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_9rem_9rem_9rem_auto]">
        <label className="relative min-w-0 sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-4 top-4 size-4 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.searchPlaceholder}
            className="pl-10"
            aria-label={t.searchLabel}
          />
        </label>
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as TaskStatus | "");
            setPage(1);
          }}
          aria-label={t.statusFilter}
        >
          <option value="">{t.allStatuses}</option>
          <option value="todo">{t.todo}</option>
          <option value="in-progress">{t.inProgress}</option>
          <option value="done">{t.done}</option>
        </Select>
        <Select
          value={sortBy}
          onChange={(event) => {
            setSortBy(event.target.value as NonNullable<TaskFilters["sortBy"]>);
            setPage(1);
          }}
          aria-label={t.sort}
        >
          <option value="createdAt">{t.newest}</option>
          <option value="updatedAt">{t.recentlyUpdated}</option>
          <option value="dueDate">{t.dueSoon}</option>
          <option value="title">{t.titleSort}</option>
        </Select>
        <Select
          value={priority}
          onChange={(event) => {
            setPriority(event.target.value as TaskPriority | "");
            setPage(1);
          }}
          aria-label={t.priorityFilter}
        >
          <option value="">{t.allPriorities}</option>
          <option value="low">{t.low}</option>
          <option value="medium">{t.medium}</option>
          <option value="high">{t.high}</option>
        </Select>
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            setDebouncedSearch("");
            setStatus("");
            setPriority("");
            setPage(1);
          }}
          aria-label={t.clearFilters}
        >
          <Filter className="size-4" /> {t.clearFilters}
        </Button>
      </section>

      <div className="mt-6">
        {tasksQuery.isPending ? (
          <LoadingState />
        ) : tasksQuery.isError ? (
          <ErrorState
            message={getErrorMessage(tasksQuery.error, locale)}
            retry={() => void tasksQuery.refetch()}
          />
        ) : tasks.length === 0 ? (
          <EmptyState
            title={hasFilters ? t.noResults : t.noTasks}
            description={
              hasFilters
                ? t.noResultsDescription
                : admin
                  ? t.noAdminTasksDescription
                  : t.noUserTasksDescription
            }
            action={
              !admin && !hasFilters ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="size-4" /> {t.firstTask}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="grid items-start gap-4 lg:grid-cols-2 xl:hidden">
              {tasks.map((task) => renderTaskCard(task, true))}
            </div>
            <TaskTable
              tasks={tasks}
              referenceTime={tasksQuery.dataUpdatedAt}
              showOwner={admin}
              onEdit={setEditingTask}
              onDelete={setDeletingTask}
              onStatusChange={(task, nextStatus) =>
                statusMutation.mutate({ task, status: nextStatus })
              }
              isStatusUpdating={(task) =>
                Boolean(
                  statusMutation.isPending &&
                  statusMutation.variables &&
                  getId(statusMutation.variables.task) === getId(task),
                )
              }
            />
          </>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="glass-panel mt-7 flex flex-wrap items-center justify-between gap-3 rounded-[var(--container-radius)] p-3 text-sm">
          <span className="text-slate-500">
            {t.page} {formatNumber(pagination.page, intlLocale)} {t.of}{" "}
            {formatNumber(pagination.totalPages, intlLocale)} ·{" "}
            {formatNumber(pagination.total, intlLocale)}{" "}
            {pagination.total === 1 ? t.task : t.tasks}
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

      <Dialog
        open={modalOpen}
        variant="drawer"
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditingTask(null);
            if (queryRequestsCreate) router.replace("/tasks", { scroll: false });
          }
        }}
        title={editingTask ? t.editDialog : t.createDialog}
        description={t.dialogDescription}
      >
        <TaskForm
          key={editingTask ? getId(editingTask) : "new"}
          task={editingTask}
          loading={saveMutation.isPending}
          onSubmit={(data) => saveMutation.mutateAsync(data).then(() => undefined)}
        />
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingTask)}
        onOpenChange={(open) => {
          if (!open) setDeletingTask(null);
        }}
        title={t.deleteDialog}
        description={t.deleteDescription(deletingTask?.title ?? "")}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingTask) {
            return deleteMutation.mutateAsync(deletingTask).then(() => undefined);
          }
        }}
      />
    </div>
  );
}
