export type UserRole = "user" | "admin" | "super_admin";
export type BanReason =
  | "spam"
  | "abusive-behavior"
  | "harassment"
  | "fraud"
  | "terms-violation"
  | "security"
  | "other";

export interface UserBan {
  isBanned: boolean;
  reason: BanReason;
  bannedAt: string;
}

export interface User {
  id: string;
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: UserRole[];
  profileImage: { url: string; publicId: string } | null;
  ban?: UserBan | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = "todo" | "in-progress" | "waiting-customer" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory = "general" | "account" | "technical" | "billing" | "feature";
export type TicketSource = "manual" | "assistant" | "chat" | "contact";

export type TicketAssignee =
  | string
  | Pick<User, "id" | "firstName" | "lastName" | "email" | "roles" | "profileImage">;

export interface Task {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  ticketNumber: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TicketCategory;
  source: TicketSource;
  dueDate: string | null;
  assignee: TicketAssignee | null;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstRespondedAt: string | null;
  completedAt: string | null;
  owner:
    | string
    | Pick<User, "id" | "firstName" | "lastName" | "email" | "roles" | "profileImage">;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface TaskSummary {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  low: number;
  medium: number;
  high: number;
  urgent?: number;
  waitingCustomer?: number;
  slaBreached?: number;
  overdue: number;
}

export interface TodayDashboard {
  generatedAt: string;
  timeZone: string;
  stats: {
    tasksToday: number;
    completed: number;
    overdue: number;
    completionRate: number;
    openTickets: number;
    waitingCustomer: number;
    urgentOpen: number;
    unassigned: number;
    slaBreached: number;
    slaAtRisk: number;
    resolvedToday: number;
  };
  focusTasks: Task[];
  needsAttention?: Task[];
  upcoming: Array<{
    date: string;
    count: number;
  }>;
  weeklyProgress: Array<{
    date: string;
    completed: number;
  }>;
  hourlySchedule: Array<{
    hour: number;
    requestedDeadlines: number;
    firstResponseDeadlines: number;
    resolutionDeadlines: number;
  }>;
  sla: {
    firstResponseBreaches: number;
    resolutionBreaches: number;
    breachedTickets: number;
    atRiskTickets: number;
  };
  dailyBrief: {
    overdue: number;
    highPriority: number;
    dueToday: number;
    scheduleConflicts: number;
  };
}

export interface RefreshSession {
  id: string;
  _id?: string;
  isCurrent: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  rotationCounter: number;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export type ChatStatus = "assistant" | "open" | "active" | "ended";
export type ChatSender = "user" | "ai" | "staff" | "system";

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  senderId: string | null;
  senderName: string | null;
  content: string;
  createdAt: string;
}

export interface SupportRating {
  score: number;
  reason: string;
}

export type SupportEscalationReason =
  | "account_banned"
  | "account_access"
  | "security"
  | "human_requested"
  | "permission"
  | "unresolved";

export interface SupportChat {
  id: string;
  user:
    | string
    | Pick<
        User,
        "id" | "firstName" | "lastName" | "email" | "roles" | "profileImage" | "ban"
      >
    | null;
  guest: { id: string | null; email: string | null; label: string } | null;
  ticketId: string | null;
  linkedTicket:
    | (Pick<
        Task,
        | "ticketNumber"
        | "title"
        | "status"
        | "priority"
        | "category"
        | "assignee"
        | "firstResponseDueAt"
        | "resolutionDueAt"
      > & { id: string })
    | null;
  origin: "user" | "admin" | "guest";
  locale: "en" | "de";
  subject: string;
  status: ChatStatus;
  assignedTo: string | null;
  assignedToName: string | null;
  requiresSuperAdmin: boolean;
  escalationReason: SupportEscalationReason | null;
  lastAgent: string | null;
  messages: ChatMessage[];
  rating: SupportRating | null;
  assistantIdleExpiresAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AssistantProposalStatus = "pending" | "creating" | "created" | "dismissed";

export interface AssistantTaskProposal {
  title: string;
  description: string;
  priority: TaskPriority;
  category?: TicketCategory;
  source?: TicketSource;
  dueDate: string | null;
  status: AssistantProposalStatus;
  taskId: string | null;
}

// The API keeps the historical `Task` payload name for backwards compatibility,
// while the product presents these records as support tickets.
export type Ticket = Task;
export type TicketStatus = TaskStatus;
export type TicketPriority = TaskPriority;

export interface AssistantMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  taskProposal: AssistantTaskProposal | null;
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  locale: "en" | "de";
  subject: string;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactMessage {
  id: string;
  sender: "visitor" | "staff";
  senderName: string;
  senderId: string | null;
  content: string;
  emailMessageId: string | null;
  createdAt: string;
}

export interface ContactSubmission {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  locale: "en" | "de";
  status: "open" | "answered";
  messages: ContactMessage[];
  lastRepliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
