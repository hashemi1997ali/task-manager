import type { HydratedDocument, Types } from "mongoose";

import {
  getTicketSlaDeadlines,
  TASK_PRIORITIES,
  ticketNumberFor,
  type ITask,
  type TaskPriority,
} from "#models";

type SerializableTicket = Partial<ITask> & {
  _id: Types.ObjectId;
  toObject?: () => Record<string, unknown>;
};

const safePriority = (priority: unknown): TaskPriority =>
  TASK_PRIORITIES.includes(priority as TaskPriority)
    ? (priority as TaskPriority)
    : "medium";

/**
 * Keeps API responses complete while an older Task row is being backfilled.
 * This does not grant access; callers must scope and authorise their query first.
 */
export const serializeTicket = (
  ticket: HydratedDocument<ITask> | SerializableTicket,
): Record<string, unknown> => {
  const raw =
    typeof ticket.toObject === "function"
      ? ticket.toObject()
      : ({ ...ticket } as Record<string, unknown>);
  const id = ticket._id;
  const createdAt =
    ticket.createdAt instanceof Date ? ticket.createdAt : id.getTimestamp();
  const deadlines = getTicketSlaDeadlines(safePriority(ticket.priority), createdAt);

  return {
    ...raw,
    ticketNumber: ticket.ticketNumber ?? ticketNumberFor.call({ _id: id }),
    category: ticket.category ?? "general",
    source: ticket.source ?? "manual",
    assignee: ticket.assignee ?? null,
    firstResponseDueAt:
      ticket.firstResponseDueAt === undefined
        ? deadlines.firstResponseDueAt
        : ticket.firstResponseDueAt,
    resolutionDueAt:
      ticket.resolutionDueAt === undefined
        ? deadlines.resolutionDueAt
        : ticket.resolutionDueAt,
    firstRespondedAt: ticket.firstRespondedAt ?? null,
    completedAt: ticket.completedAt ?? null,
  };
};
