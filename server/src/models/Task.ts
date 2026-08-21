import { randomBytes } from "node:crypto";

import { model, Schema, type Types } from "mongoose";

// The collection and public `/tasks` routes intentionally keep their original
// names so existing clients and MongoDB documents continue to work. New data
// is treated as a support ticket throughout the application.
export const TASK_STATUSES = ["todo", "in-progress", "waiting-customer", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const TICKET_CATEGORIES = [
  "general",
  "account",
  "technical",
  "billing",
  "feature",
] as const;
export const TICKET_SOURCES = ["manual", "assistant", "chat", "contact"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketSource = (typeof TICKET_SOURCES)[number];

export const ticketNumberFor = function ticketNumberFor(this: {
  _id?: Types.ObjectId;
}): string {
  const date = this._id?.getTimestamp() ?? new Date();
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix =
    this._id?.toString().slice(-8).toUpperCase() ??
    randomBytes(4).toString("hex").toUpperCase();
  return `KRN-${day}-${suffix}`;
};

const SLA_MINUTES: Record<TaskPriority, { firstResponse: number; resolution: number }> = {
  urgent: { firstResponse: 60, resolution: 4 * 60 },
  high: { firstResponse: 4 * 60, resolution: 24 * 60 },
  medium: { firstResponse: 12 * 60, resolution: 3 * 24 * 60 },
  low: { firstResponse: 24 * 60, resolution: 5 * 24 * 60 },
};

export const getTicketSlaDeadlines = (
  priority: TaskPriority,
  startedAt = new Date(),
): { firstResponseDueAt: Date; resolutionDueAt: Date } => ({
  firstResponseDueAt: new Date(
    startedAt.getTime() + SLA_MINUTES[priority].firstResponse * 60_000,
  ),
  resolutionDueAt: new Date(
    startedAt.getTime() + SLA_MINUTES[priority].resolution * 60_000,
  ),
});

export interface ITask {
  /** Human-readable support reference. Missing only on untouched legacy rows. */
  ticketNumber?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TicketCategory;
  source: TicketSource;
  dueDate?: Date | null;
  firstResponseDueAt?: Date | null;
  resolutionDueAt?: Date | null;
  firstRespondedAt?: Date | null;
  completedAt?: Date | null;
  owner: Types.ObjectId;
  assignee?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    ticketNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [32, "Ticket number cannot exceed 32 characters"],
      default: ticketNumberFor,
    },
    title: {
      type: String,
      required: [true, "Ticket title is required"],
      trim: true,
      minlength: [3, "Ticket title must be at least 3 characters long"],
      maxlength: [100, "Ticket title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Ticket description cannot exceed 2000 characters"],
      default: "",
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: "medium",
      index: true,
    },
    category: {
      type: String,
      enum: TICKET_CATEGORIES,
      default: "general",
      index: true,
    },
    source: {
      type: String,
      enum: TICKET_SOURCES,
      default: "manual",
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    firstResponseDueAt: {
      type: Date,
      default: undefined,
      index: true,
    },
    resolutionDueAt: {
      type: Date,
      default: undefined,
      index: true,
    },
    firstRespondedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

taskSchema.pre("validate", function applyTicketDefaults() {
  if (!this.ticketNumber) this.ticketNumber = ticketNumberFor.call(this);

  if (this.isNew) {
    const deadlines = getTicketSlaDeadlines(this.priority, this.createdAt ?? new Date());
    if (this.firstResponseDueAt === undefined) {
      this.firstResponseDueAt = deadlines.firstResponseDueAt;
    }
    if (this.resolutionDueAt === undefined) {
      this.resolutionDueAt = deadlines.resolutionDueAt;
    }
  }

  if (this.isModified("status")) {
    const now = new Date();
    this.completedAt = this.status === "done" ? (this.completedAt ?? now) : null;
  }
});

taskSchema.index(
  { ticketNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { ticketNumber: { $type: "string" } },
  },
);
taskSchema.index({ owner: 1, status: 1, priority: 1 });
taskSchema.index({ owner: 1, createdAt: -1 });
taskSchema.index({ owner: 1, dueDate: 1, status: 1 });
taskSchema.index({ owner: 1, completedAt: 1 });
taskSchema.index({ status: 1, priority: 1, resolutionDueAt: 1 });
taskSchema.index({ assignee: 1, status: 1, updatedAt: -1 });

export const Task = model<ITask>("Task", taskSchema);
