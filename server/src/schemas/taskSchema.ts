import { z } from "zod";

import { TASK_PRIORITIES, TASK_STATUSES } from "#models";

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
  z.coerce.date().optional(),
);

const optionalSearchSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().max(100).optional(),
);

const optionalBooleanQuerySchema = z
  .preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.enum(["true", "false"]).optional(),
  )
  .transform((value) => (value === undefined ? undefined : value === "true"));

export const taskQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  overdue: optionalBooleanQuerySchema,
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
    .enum(["createdAt", "updatedAt", "dueDate", "title", "status"])
    .optional()
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const createTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Task title must be at least 3 characters long")
      .max(100, "Task title cannot exceed 100 characters"),
    description: z
      .string()
      .trim()
      .max(2000, "Task description cannot exceed 2000 characters")
      .optional()
      .default(""),
    status: z.enum(TASK_STATUSES).optional().default("todo"),
    priority: z.enum(TASK_PRIORITIES).optional().default("medium"),
    dueDate: optionalDateSchema,
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Task title must be at least 3 characters long")
      .max(100, "Task title cannot exceed 100 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Task description cannot exceed 2000 characters")
      .optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    dueDate: nullableOptionalDateSchema,
  })
  .strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
