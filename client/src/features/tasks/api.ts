import { apiRequest } from "@/lib/api-client";
import type {
  Pagination,
  Task,
  TaskPriority,
  TaskStatus,
  TaskSummary,
  TodayDashboard,
} from "@/lib/types";

export interface TaskFilters {
  page: number;
  limit?: number;
  search?: string;
  status?: TaskStatus | "";
  priority?: TaskPriority | "";
  sortBy?: "createdAt" | "updatedAt" | "dueDate" | "title" | "status";
  order?: "asc" | "desc";
  ownerId?: string;
}

export interface TaskListResult {
  tasks: Task[];
  pagination: Pagination;
}

export interface TaskMutationValues {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

const toQuery = (filters: TaskFilters): string => {
  const query = new URLSearchParams();
  query.set("page", String(filters.page));
  query.set("limit", String(filters.limit ?? 10));
  if (filters.search) query.set("search", filters.search);
  if (filters.status) query.set("status", filters.status);
  if (filters.priority) query.set("priority", filters.priority);
  if (filters.sortBy) query.set("sortBy", filters.sortBy);
  if (filters.order) query.set("order", filters.order);
  if (filters.ownerId) query.set("ownerId", filters.ownerId);
  return query.toString();
};

export const getTasksRequest = async (
  filters: TaskFilters,
  admin = false,
): Promise<TaskListResult> => {
  const data = await apiRequest<{
    tasks: Task[];
    pagination?: Pagination;
    total?: number;
  }>(`${admin ? "/admin/tasks" : "/tasks"}?${toQuery(filters)}`);

  return {
    tasks: data.tasks,
    pagination: data.pagination ?? {
      total: data.total ?? data.tasks.length,
      page: filters.page,
      limit: filters.limit ?? 10,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: filters.page > 1,
    },
  };
};

export const getTaskSummaryRequest = async (): Promise<TaskSummary> => {
  const data = await apiRequest<{ summary: TaskSummary }>("/tasks/summary");
  return data.summary;
};

export const getTodayDashboardRequest = async (): Promise<TodayDashboard> => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const data = await apiRequest<{ dashboard: TodayDashboard }>(
    `/tasks/dashboard?timeZone=${encodeURIComponent(timeZone)}`,
  );
  return data.dashboard;
};

export const createTaskRequest = async (values: TaskMutationValues): Promise<Task> => {
  const data = await apiRequest<{ task: Task }>("/tasks", {
    method: "POST",
    json: values,
  });
  return data.task;
};

export const updateTaskRequest = async (
  id: string,
  values: TaskMutationValues,
  admin = false,
): Promise<Task> => {
  const data = await apiRequest<{ task: Task }>(
    `${admin ? "/admin/tasks" : "/tasks"}/${id}`,
    { method: "PATCH", json: values },
  );
  return data.task;
};

export const deleteTaskRequest = (id: string, admin = false): Promise<void> =>
  apiRequest<void>(`${admin ? "/admin/tasks" : "/tasks"}/${id}`, {
    method: "DELETE",
  });
