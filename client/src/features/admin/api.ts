import { apiRequest } from "@/lib/api-client";
import type { BanReason, Pagination, User, UserRole } from "@/lib/types";

export interface UserFilters {
  page: number;
  limit?: number;
  search?: string;
  role?: UserRole | "";
  banned?: "true" | "false" | "";
}

export interface AdminUserDetail {
  user: User;
  stats: { taskCount: number; activeSessionCount: number };
}

export interface AdminOverview {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  openTasks: number;
  overdueTasks: number;
  waitingSupport: number;
  unansweredContacts: number;
  bannedUsers: number;
  totalTickets: number;
  openTickets: number;
  overdueRequestedDeadlines: number;
  waitingCustomerTickets: number;
  urgentOpenTickets: number;
  unassignedTickets: number;
  firstResponseBreaches: number;
  resolutionBreaches: number;
  breachedSlaTickets: number;
  resolvedToday: number;
  averageFirstResponseMinutes: number | null;
  weeklyProgress: Array<{ date: string; completed: number }>;
}

export const getAdminOverviewRequest = () => apiRequest<AdminOverview>("/admin/overview");

export const getUsersRequest = async (
  filters: UserFilters,
): Promise<{ users: User[]; pagination: Pagination }> => {
  const query = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit ?? 10),
  });
  if (filters.search) query.set("search", filters.search);
  if (filters.role) query.set("role", filters.role);
  if (filters.banned) query.set("banned", filters.banned);
  const data = await apiRequest<{
    users: User[];
    pagination?: Pagination;
    total?: number;
  }>(`/admin/users?${query.toString()}`);

  return {
    users: data.users,
    pagination: data.pagination ?? {
      total: data.total ?? data.users.length,
      page: filters.page,
      limit: filters.limit ?? 10,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: filters.page > 1,
    },
  };
};

export const getUserRequest = (id: string): Promise<AdminUserDetail> =>
  apiRequest<AdminUserDetail>(`/admin/users/${id}`);

export const updateUserRequest = async (
  id: string,
  values: {
    firstName: string;
    lastName: string;
    email: string;
    profileImage?: File | null;
  },
): Promise<User> => {
  const formData = new FormData();
  formData.set("firstName", values.firstName);
  formData.set("lastName", values.lastName);
  formData.set("email", values.email);
  if (values.profileImage) formData.set("profileImage", values.profileImage);

  const data = await apiRequest<{ user: User }>(`/admin/users/${id}`, {
    method: "PATCH",
    body: formData,
  });
  return data.user;
};

export const setAdminRoleRequest = async (
  id: string,
  isAdmin: boolean,
): Promise<User> => {
  const data = await apiRequest<{ user: User }>(`/admin/users/${id}/admin-role`, {
    method: "PATCH",
    json: { isAdmin },
  });
  return data.user;
};

export const banUserRequest = async (id: string, reason: BanReason): Promise<User> => {
  const data = await apiRequest<{ user: User }>(`/admin/users/${id}/ban`, {
    method: "POST",
    json: { reason },
  });
  return data.user;
};

export const unbanUserRequest = async (id: string): Promise<User> => {
  const data = await apiRequest<{ user: User }>(`/admin/users/${id}/unban`, {
    method: "POST",
  });
  return data.user;
};

export const deleteUserRequest = (id: string): Promise<void> =>
  apiRequest<void>(`/admin/users/${id}`, { method: "DELETE" });

export const getUserTasksRequest = async (
  userId: string,
  page = 1,
  limit = 10,
): Promise<{ tasks: import("@/lib/types").Task[]; pagination: Pagination }> =>
  apiRequest<{ tasks: import("@/lib/types").Task[]; pagination: Pagination }>(
    `/admin/users/${userId}/tasks?page=${page}&limit=${limit}`,
  );

export const updateUserTaskRequest = async (
  userId: string,
  taskId: string,
  values: import("@/features/tasks/api").TaskMutationValues,
): Promise<import("@/lib/types").Task> => {
  const data = await apiRequest<{ task: import("@/lib/types").Task }>(
    `/admin/users/${userId}/tasks/${taskId}`,
    { method: "PATCH", json: values },
  );
  return data.task;
};

export const deleteUserTaskRequest = (userId: string, taskId: string): Promise<void> =>
  apiRequest<void>(`/admin/users/${userId}/tasks/${taskId}`, { method: "DELETE" });
