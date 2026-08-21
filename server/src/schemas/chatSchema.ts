import { z } from "zod";

const contentSchema = z.string().trim().min(1).max(4000);
const historyItemSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().max(4000),
  })
  .strict();
const withoutEmptyHistoryItems = <T extends { content: string }>(items: T[]): T[] =>
  items.filter((item) => item.content.length > 0);
const assistantHistorySchema = z
  .array(historyItemSchema)
  .max(20)
  .transform(withoutEmptyHistoryItems)
  .optional()
  .default([]);

const supportReasonSchema = z.enum([
  "account_banned",
  "account_access",
  "security",
  "human_requested",
  "permission",
  "unresolved",
]);

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Ticket ID must be a valid MongoDB ObjectId");

export const guestAssistantSchema = z
  .object({
    message: contentSchema,
    history: assistantHistorySchema,
    locale: z.enum(["en", "de"]).optional().default("en"),
  })
  .strict();

export const createChatSchema = z
  .object({
    message: contentSchema,
    history: assistantHistorySchema,
    locale: z.enum(["en", "de"]).optional().default("en"),
  })
  .strict();

export const createGuestSupportChatSchema = z
  .object({
    locale: z.enum(["en", "de"]).optional().default("en"),
    history: z
      .array(historyItemSchema)
      .max(40)
      .transform(withoutEmptyHistoryItems)
      .refine((items) => items.length > 0, "Conversation history is required"),
    reason: supportReasonSchema.optional().default("human_requested"),
  })
  .strict();

export const createSupportChatSchema = createGuestSupportChatSchema.extend({
  ticketId: objectIdSchema.optional(),
});

export const openTicketSupportChatSchema = z
  .object({
    locale: z.enum(["en", "de"]).optional().default("en"),
  })
  .strict();

export const sendChatMessageSchema = z
  .object({
    message: contentSchema,
    locale: z.enum(["en", "de"]).optional().default("en"),
  })
  .strict();

export const supportMessageSchema = z
  .object({
    message: contentSchema,
  })
  .strict();

export const rewriteSupportMessageSchema = z
  .object({
    message: contentSchema,
  })
  .strict();

export const rateChatSchema = z
  .object({
    score: z.number().int().min(1).max(5),
    reason: z.string().trim().max(1000).optional().default(""),
  })
  .strict();

export const supportQueueQuerySchema = z
  .object({
    status: z.enum(["assistant", "open", "active", "ended"]).optional(),
    scope: z.enum(["queue", "all"]).optional().default("queue"),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  })
  .strict();
