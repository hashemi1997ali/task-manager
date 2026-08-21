"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, Inbox, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/form-controls";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { getUsersRequest } from "@/features/admin/api";
import { useAuth } from "@/features/auth/auth-provider";
import { openStaffTicketChatRequest } from "@/features/chat/api";
import { requestTicketSupport } from "@/features/chat/ticket-support-event";
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
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TicketCategory,
  TicketSource,
} from "@/lib/types";
import { formatNumber, getId } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    adminTitle: "Ticket queue",
    userTitle: "My requests",
    adminDescription:
      "Triage, assign, and resolve every customer request from one live queue.",
    userDescription:
      "Track your support requests, response targets, and every status update.",
    searchPlaceholder: "Search ticket number, subject, or details …",
    searchLabel: "Search tickets",
    statusFilter: "Filter by status",
    allStatuses: "All statuses",
    todo: "Open",
    inProgress: "In progress",
    waitingCustomer: "Waiting on customer",
    done: "Resolved",
    priorityFilter: "Filter by priority",
    allPriorities: "All priorities",
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
    categoryFilter: "Filter by category",
    allCategories: "All categories",
    general: "General",
    account: "Account",
    technical: "Technical",
    billing: "Billing",
    feature: "Feature request",
    sourceFilter: "Filter by source",
    allSources: "All sources",
    manual: "Portal",
    assistant: "AI assistant",
    chat: "Live chat",
    attentionFilter: "Filter by time signal",
    allAttention: "All time signals",
    firstResponseBreached: "First response breached",
    resolutionBreached: "Resolution SLA breached",
    requestedOverdue: "Requested deadline passed",
    clearFilters: "Clear",
    filters: "Ticket filters",
    noResults: "No matching tickets",
    noTickets: "No requests yet",
    noResultsDescription: "Try a different phrase or adjust the queue filters.",
    noAdminTicketsDescription: "No customer requests have arrived yet.",
    noUserTicketsDescription:
      "Submit a request when you need help. Its status and SLA will stay visible here.",
    firstTicket: "Submit first request",
    page: "Page",
    of: "of",
    ticket: "ticket",
    tickets: "tickets",
    previous: "Previous",
    next: "Next",
    editDialog: "Edit ticket",
    createDialog: "Submit a support request",
    dialogDescription:
      "Give the support team enough context to understand and resolve the request.",
    deleteDialog: "Delete ticket",
    deleteDescription: (title: string) => `“${title}” will be permanently deleted.`,
    saved: "Ticket changes saved.",
    statusUpdated: "Ticket status updated.",
    created: "Request submitted.",
    deleted: "Ticket deleted.",
    newTicket: "New request",
    sort: "Sort",
    newest: "Newest",
    recentlyUpdated: "Recently updated",
    slaSoon: "SLA due soon",
    responseSoon: "First response due",
    requestedSoon: "Requested date",
    titleSort: "Subject",
    conversationOpened: "Support conversation opened.",
  },
  de: {
    adminTitle: "Ticket-Warteschlange",
    userTitle: "Meine Anfragen",
    adminDescription:
      "Kundenanfragen in einer Live-Warteschlange prüfen, zuweisen und lösen.",
    userDescription:
      "Verfolge deine Support-Anfragen, Reaktionsziele und Statusänderungen.",
    searchPlaceholder: "Ticketnummer, Betreff oder Details durchsuchen …",
    searchLabel: "Tickets durchsuchen",
    statusFilter: "Nach Status filtern",
    allStatuses: "Alle Status",
    todo: "Offen",
    inProgress: "In Bearbeitung",
    waitingCustomer: "Wartet auf Kunden",
    done: "Gelöst",
    priorityFilter: "Nach Priorität filtern",
    allPriorities: "Alle Prioritäten",
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
    urgent: "Dringend",
    categoryFilter: "Nach Kategorie filtern",
    allCategories: "Alle Kategorien",
    general: "Allgemein",
    account: "Konto",
    technical: "Technisch",
    billing: "Abrechnung",
    feature: "Funktionswunsch",
    sourceFilter: "Nach Quelle filtern",
    allSources: "Alle Quellen",
    manual: "Portal",
    assistant: "KI-Assistent",
    chat: "Live-Chat",
    attentionFilter: "Nach Zeitsignal filtern",
    allAttention: "Alle Zeitsignale",
    firstResponseBreached: "Erstreaktion überschritten",
    resolutionBreached: "Lösungs-SLA überschritten",
    requestedOverdue: "Wunschtermin überschritten",
    clearFilters: "Zurücksetzen",
    filters: "Ticketfilter",
    noResults: "Keine passenden Tickets",
    noTickets: "Noch keine Anfragen",
    noResultsDescription: "Passe die Filter an oder versuche einen anderen Begriff.",
    noAdminTicketsDescription: "Es sind noch keine Kundenanfragen eingegangen.",
    noUserTicketsDescription:
      "Sende eine Anfrage, wenn du Hilfe brauchst. Status und SLA bleiben hier sichtbar.",
    firstTicket: "Erste Anfrage senden",
    page: "Seite",
    of: "von",
    ticket: "Ticket",
    tickets: "Tickets",
    previous: "Zurück",
    next: "Weiter",
    editDialog: "Ticket bearbeiten",
    createDialog: "Support-Anfrage senden",
    dialogDescription:
      "Gib dem Support-Team genug Kontext, um die Anfrage schnell zu lösen.",
    deleteDialog: "Ticket löschen",
    deleteDescription: (title: string) => `„${title}“ wird dauerhaft gelöscht.`,
    saved: "Ticketänderungen gespeichert.",
    statusUpdated: "Ticketstatus aktualisiert.",
    created: "Anfrage gesendet.",
    deleted: "Ticket gelöscht.",
    newTicket: "Neue Anfrage",
    sort: "Sortieren",
    newest: "Neueste",
    recentlyUpdated: "Zuletzt aktualisiert",
    slaSoon: "SLA zuerst fällig",
    responseSoon: "Erstreaktion zuerst fällig",
    requestedSoon: "Gewünschter Termin",
    titleSort: "Betreff",
    conversationOpened: "Support-Gespräch geöffnet.",
  },
} as const;

const ticketStatuses: TaskStatus[] = ["todo", "in-progress", "waiting-customer", "done"];
const ticketPriorities: TaskPriority[] = ["low", "medium", "high", "urgent"];
const ticketCategories: TicketCategory[] = [
  "general",
  "account",
  "technical",
  "billing",
  "feature",
];
const ticketSources: TicketSource[] = ["manual", "assistant", "chat"];
const ticketAttention = [
  "first-response-breached",
  "resolution-breached",
  "requested-overdue",
] as const;
const ticketSorts: Array<NonNullable<TaskFilters["sortBy"]>> = [
  "createdAt",
  "updatedAt",
  "dueDate",
  "firstResponseDueAt",
  "resolutionDueAt",
  "title",
  "status",
];

const fromQuery = <Value extends string>(
  value: string | null,
  allowed: readonly Value[],
): Value | "" => (value && allowed.includes(value as Value) ? (value as Value) : "");

export function TasksView({ admin = false }: { admin?: boolean }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, intlLocale } = usePreferences();
  const { user: currentUser, isSuperAdmin } = useAuth();
  const t = copy[locale];
  const routeSearch = searchParams.get("search") ?? "";
  const routeStatus = fromQuery(searchParams.get("status"), ticketStatuses);
  const routePriority = fromQuery(searchParams.get("priority"), ticketPriorities);
  const routeCategory = fromQuery(searchParams.get("category"), ticketCategories);
  const routeSource = fromQuery(searchParams.get("source"), ticketSources);
  const routeAttention = fromQuery(searchParams.get("attention"), ticketAttention);
  const routeSort = fromQuery(searchParams.get("sortBy"), ticketSorts) || "createdAt";
  const [search, setSearch] = useState(routeSearch);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">(() => routeStatus);
  const [priority, setPriority] = useState<TaskPriority | "">(() => routePriority);
  const [category, setCategory] = useState<TicketCategory | "">(() => routeCategory);
  const [source, setSource] = useState<TicketSource | "">(() => routeSource);
  const [attention, setAttention] = useState<(typeof ticketAttention)[number] | "">(
    () => routeAttention,
  );
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<NonNullable<TaskFilters["sortBy"]>>(routeSort);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [referenceTime, setReferenceTime] = useState(() => Date.now());

  useEffect(() => {
    const update = () => setReferenceTime(Date.now());
    const interval = window.setInterval(update, 30_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSearch(routeSearch);
      setStatus(routeStatus);
      setPriority(routePriority);
      setCategory(routeCategory);
      setSource(routeSource);
      setAttention(routeAttention);
      setSortBy(routeSort);
      setPage(1);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    routeSearch,
    routeStatus,
    routePriority,
    routeCategory,
    routeSource,
    routeAttention,
    routeSort,
  ]);

  const filters = useMemo<TaskFilters>(
    () => ({
      page,
      limit: 10,
      search: debouncedSearch,
      status,
      priority,
      category,
      source,
      attention: admin ? attention : "",
      sortBy,
      order:
        sortBy === "dueDate" ||
        sortBy === "firstResponseDueAt" ||
        sortBy === "resolutionDueAt" ||
        sortBy === "title"
          ? "asc"
          : "desc",
      ownerId: admin ? (searchParams.get("ownerId") ?? undefined) : undefined,
      unassigned: admin && searchParams.get("unassigned") === "true",
    }),
    [
      page,
      debouncedSearch,
      status,
      priority,
      category,
      source,
      attention,
      sortBy,
      admin,
      searchParams,
    ],
  );
  const queryKey = admin ? ["admin", "tickets", filters] : ["tickets", "mine", filters];
  const tasksQuery = useQuery({
    queryKey,
    queryFn: () => getTasksRequest(filters, admin),
    refetchInterval: 30_000,
  });
  const agentsQuery = useQuery({
    queryKey: ["admin", "ticket-assignees", "admin"],
    queryFn: () => getUsersRequest({ page: 1, limit: 100, role: "admin" }),
    enabled: admin && isSuperAdmin,
  });
  const supervisorsQuery = useQuery({
    queryKey: ["admin", "ticket-assignees", "super_admin"],
    queryFn: () => getUsersRequest({ page: 1, limit: 100, role: "super_admin" }),
    enabled: admin && isSuperAdmin,
  });
  const assignees = useMemo(() => {
    if (!admin) return undefined;
    if (!isSuperAdmin) return currentUser ? [currentUser] : [];
    const people = [
      ...(agentsQuery.data?.users ?? []),
      ...(supervisorsQuery.data?.users ?? []),
    ];
    return people.filter(
      (person, index) =>
        people.findIndex((item) => getId(item) === getId(person)) === index,
    );
  }, [
    admin,
    isSuperAdmin,
    currentUser,
    agentsQuery.data?.users,
    supervisorsQuery.data?.users,
  ]);

  const canManageTask = (task: Task): boolean => {
    if (!admin || isSuperAdmin) return true;
    if (!task.assignee) return true;
    const assigneeId =
      typeof task.assignee === "object" ? getId(task.assignee) : task.assignee;
    return Boolean(currentUser && assigneeId === getId(currentUser));
  };

  const refreshLists = async () => {
    await queryClient.invalidateQueries({
      queryKey: admin ? ["admin", "tickets"] : ["tickets"],
    });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    if (admin) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "user"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "overview"] }),
      ]);
    } else {
      await queryClient.invalidateQueries({ queryKey: ["tickets", "summary"] });
    }
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
        router.replace("/tickets", { scroll: false });
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
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) =>
      updateTaskRequest(getId(task), { status }, admin),
    onSuccess: async () => {
      toast.success(t.statusUpdated);
      await refreshLists();
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });
  const openConversationMutation = useMutation({
    mutationFn: (task: Task) => openStaffTicketChatRequest(getId(task), locale),
    onSuccess: async (chat) => {
      toast.success(t.conversationOpened);
      await Promise.all([
        refreshLists(),
        queryClient.invalidateQueries({ queryKey: ["support", "queue"] }),
      ]);
      router.push(`/admin/support?chat=${encodeURIComponent(chat.id)}`);
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const tasks = tasksQuery.data?.tasks ?? [];
  const pagination = tasksQuery.data?.pagination;
  const queryRequestsCreate = !admin && searchParams.get("new") === "1";
  const modalOpen = creating || queryRequestsCreate || Boolean(editingTask);
  const hasFilters = Boolean(
    debouncedSearch ||
    status ||
    priority ||
    category ||
    source ||
    attention ||
    filters.unassigned,
  );
  const renderTaskCard = (task: Task, showUpdatedAt = false) => (
    <TaskCard
      key={getId(task)}
      task={task}
      showOwner={admin}
      showUpdatedAt={showUpdatedAt}
      referenceTime={referenceTime}
      onEdit={canManageTask(task) ? () => setEditingTask(task) : undefined}
      onDelete={!admin || isSuperAdmin ? () => setDeletingTask(task) : undefined}
      onStatusChange={
        canManageTask(task)
          ? (nextStatus) => statusMutation.mutate({ task, status: nextStatus })
          : undefined
      }
      customerStatusOnly={!admin}
      onDiscussSupport={
        admin
          ? canManageTask(task)
            ? () => openConversationMutation.mutate(task)
            : undefined
          : () =>
              requestTicketSupport({
                id: getId(task),
                ticketNumber:
                  task.ticketNumber || `#${getId(task).slice(-6).toUpperCase()}`,
                title: task.title,
              })
      }
      staffSupportAction={admin}
      supportUpdating={Boolean(
        openConversationMutation.isPending &&
        openConversationMutation.variables &&
        getId(openConversationMutation.variables) === getId(task),
      )}
      statusUpdating={Boolean(
        statusMutation.isPending &&
        statusMutation.variables &&
        getId(statusMutation.variables.task) === getId(task),
      )}
      compact
    />
  );

  return (
    <div className="desk-grid-glow space-y-6">
      <header className="desk-page-header relative !mb-0 overflow-hidden rounded-[var(--container-radius)] border border-[var(--border)]/80 bg-[var(--surface)]/75 p-5 shadow-[var(--shadow-panel)] backdrop-blur sm:p-6">
        <div className="min-w-0">
          <div className="desk-eyebrow">
            <span className="desk-live-dot" aria-hidden="true" />
            {t.filters}
          </div>
          <h1 className="mt-3 text-[clamp(1.75rem,4vw,2.75rem)] leading-none font-black tracking-[-0.045em]">
            {admin ? t.adminTitle : t.userTitle}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {admin ? t.adminDescription : t.userDescription}
          </p>
        </div>
        {!admin && (
          <Button
            className="w-full self-end shadow-lg shadow-[var(--primary)]/15 sm:w-auto"
            onClick={() => setCreating(true)}
          >
            <Plus className="size-4" /> {t.newTicket}
          </Button>
        )}
      </header>

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

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="desk-eyebrow">{admin ? t.adminTitle : t.userTitle}</p>
            <h2 className="desk-section-title mt-1">
              {pagination ? (
                <>
                  {formatNumber(pagination.total, intlLocale)}{" "}
                  {pagination.total === 1 ? t.ticket : t.tickets}
                </>
              ) : admin ? (
                t.adminTitle
              ) : (
                t.userTitle
              )}
            </h2>
          </div>
          {hasFilters && (
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-bold text-[var(--primary)]">
              <Filter className="size-3.5" />
              {t.filters}
            </span>
          )}
        </div>
        {tasksQuery.isPending ? (
          <LoadingState />
        ) : tasksQuery.isError ? (
          <ErrorState
            message={getErrorMessage(tasksQuery.error, locale)}
            retry={() => void tasksQuery.refetch()}
          />
        ) : tasks.length === 0 ? (
          <EmptyState
            title={hasFilters ? t.noResults : t.noTickets}
            description={
              hasFilters
                ? t.noResultsDescription
                : admin
                  ? t.noAdminTicketsDescription
                  : t.noUserTicketsDescription
            }
            action={
              !admin && !hasFilters ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="size-4" /> {t.firstTicket}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="grid items-start gap-4 md:grid-cols-2 xl:hidden">
              {tasks.map((task) => renderTaskCard(task, true))}
            </div>
            <TaskTable
              tasks={tasks}
              referenceTime={referenceTime}
              showOwner={admin}
              onEdit={setEditingTask}
              onDelete={!admin || isSuperAdmin ? setDeletingTask : undefined}
              onStatusChange={(task, nextStatus) =>
                statusMutation.mutate({ task, status: nextStatus })
              }
              customerStatusOnly={!admin}
              onDiscussSupport={
                admin
                  ? (task) => openConversationMutation.mutate(task)
                  : (task) =>
                      requestTicketSupport({
                        id: getId(task),
                        ticketNumber:
                          task.ticketNumber || `#${getId(task).slice(-6).toUpperCase()}`,
                        title: task.title,
                      })
              }
              staffSupportAction={admin}
              isSupportOpening={(task) =>
                Boolean(
                  openConversationMutation.isPending &&
                  openConversationMutation.variables &&
                  getId(openConversationMutation.variables) === getId(task),
                )
              }
              isStatusUpdating={(task) =>
                Boolean(
                  statusMutation.isPending &&
                  statusMutation.variables &&
                  getId(statusMutation.variables.task) === getId(task),
                )
              }
              canManage={canManageTask}
            />
          </>
        )}
      </section>

      {pagination && pagination.totalPages > 1 && (
        <div className="glass-panel mt-7 flex flex-wrap items-center justify-between gap-3 rounded-[var(--container-radius)] p-3 text-sm">
          <span className="text-slate-500">
            {t.page} {formatNumber(pagination.page, intlLocale)} {t.of}{" "}
            {formatNumber(pagination.totalPages, intlLocale)} ·{" "}
            {formatNumber(pagination.total, intlLocale)}{" "}
            {pagination.total === 1 ? t.ticket : t.tickets}
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
        </nav>
      )}

      <Dialog
        open={modalOpen}
        variant="drawer"
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditingTask(null);
            if (queryRequestsCreate) router.replace("/tickets", { scroll: false });
          }
        }}
        title={editingTask ? t.editDialog : t.createDialog}
        description={t.dialogDescription}
      >
        <TaskForm
          key={editingTask ? getId(editingTask) : "new"}
          task={editingTask}
          admin={admin}
          assignees={assignees}
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
