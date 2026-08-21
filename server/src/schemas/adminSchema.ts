import { z } from "zod";

import { BAN_REASONS, TASK_PRIORITIES, TASK_STATUSES } from "#models";
import { updateTaskSchema } from "./taskSchema.ts";

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "ID must be a valid MongoDB ObjectId");

const pageSchema = z.preprocess(
  (value) => (value === undefined ? 1 : value),
  z.coerce.number().int().min(1),
);

const limitSchema = z.preprocess(
  (value) => (value === undefined ? 20 : value),
  z.coerce.number().int().min(1).max(100),
);

const optionalSearchSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().max(100).optional(),
);

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Please provide a valid email address"));

const nameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters long`)
    .max(50, `${label} cannot exceed 50 characters`);

export const adminTaskQuerySchema = z
  .object({
    search: optionalSearchSchema,
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    ownerId: objectIdSchema.optional(),
    page: pageSchema,
    limit: limitSchema,
    sortBy: z
      .enum(["createdAt", "updatedAt", "dueDate", "title", "status", "priority"])
      .optional()
      .default("createdAt"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .strict();

export const adminUserTaskQuerySchema = adminTaskQuerySchema.omit({ ownerId: true });

export const adminUserQuerySchema = z
  .object({
    search: optionalSearchSchema,
    role: z.enum(["user", "admin", "super_admin"]).optional(),
    banned: z
      .preprocess(
        (value) => (value === "" ? undefined : value),
        z.enum(["true", "false"]).optional(),
      )
      .transform((value) => (value === undefined ? undefined : value === "true")),
    page: pageSchema,
    limit: limitSchema,
  })
  .strict();

export const adminUpdateUserSchema = z
  .object({
    firstName: nameSchema("First name").optional(),
    lastName: nameSchema("Last name").optional(),
    email: emailSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one user field must be provided",
  });

export const adminRoleSchema = z
  .object({
    isAdmin: z.boolean(),
  })
  .strict();

export const adminBanSchema = z
  .object({
    reason: z.enum(BAN_REASONS),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const adminUpdateTaskSchema = updateTaskSchema;

export type AdminTaskQuery = z.infer<typeof adminTaskQuerySchema>;
export type AdminUserTaskQuery = z.infer<typeof adminUserTaskQuerySchema>;
export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
