import { z } from "zod";

import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TICKET_CATEGORIES,
  TICKET_SOURCES,
} from "#models";

const dateSchema = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const optionalDateSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  dateSchema.optional(),
);

const nullableOptionalDateSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.union([dateSchema, z.null()]).optional(),
);

const optionalQueryDateSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  dateSchema.optional(),
);

const optionalSearchSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().max(100).optional(),
);

export const taskQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  source: z.enum(TICKET_SOURCES).optional(),
  search: optionalSearchSchema,
  dueBefore: optionalQueryDateSchema,
  dueAfter: optionalQueryDateSchema,
  page: z.preprocess(
    (value) => (value === undefined ? 1 : value),
    z.coerce.number().int().min(1),
  ),
  limit: z.preprocess(
    (value) => (value === undefined ? 10 : value),
    z.coerce.number().int().min(1).max(100),
  ),
  sortBy: z
    .enum([
      "createdAt",
      "updatedAt",
      "dueDate",
      "firstResponseDueAt",
      "resolutionDueAt",
      "title",
      "ticketNumber",
      "status",
      "priority",
    ])
    .optional()
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const createTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Ticket title must be at least 3 characters long")
      .max(100, "Ticket title cannot exceed 100 characters"),
    description: z
      .string()
      .trim()
      .max(2000, "Ticket description cannot exceed 2000 characters")
      .optional()
      .default(""),
    priority: z.enum(TASK_PRIORITIES).optional().default("medium"),
    category: z.enum(TICKET_CATEGORIES).optional().default("general"),
    dueDate: optionalDateSchema,
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Ticket title must be at least 3 characters long")
      .max(100, "Ticket title cannot exceed 100 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Ticket description cannot exceed 2000 characters")
      .optional(),
    // Customers may close or reopen their own ticket. Queue-only states are
    // controlled by authorised staff and chat lifecycle handlers.
    status: z.enum(["todo", "done"]).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    dueDate: nullableOptionalDateSchema,
  })
  .strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
