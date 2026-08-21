import type { HydratedDocument, QueryFilter } from "mongoose";

import { SupportChat, type ISupportChat, type SupportChatLocale } from "#models";
import { getPositiveIntegerEnv, isAdminRoles } from "#utils";

export const CHAT_WELCOME_SENDER = "welcome";
export type SupportAudience = "all-staff" | "super-admin";

export const resolveSupportAudience = (roles: readonly string[]): SupportAudience =>
  isAdminRoles(roles) ? "super-admin" : "all-staff";

export const chatWelcomeMessage = (locale: SupportChatLocale): string =>
  locale === "de"
    ? "Hallo! Ich bin der AI Assistant. Wie kann ich dir heute helfen?"
    : "Hello! I'm the AI Assistant. How can I help you today?";

export const assistantIdleSystemMessage = (locale: SupportChatLocale): string =>
  locale === "de"
    ? "Dieser Chat wurde automatisch beendet, weil längere Zeit keine Antwort eingegangen ist. Du kannst jederzeit einen neuen Chat starten."
    : "This chat was ended automatically because no reply was received for a while. You can start a new chat at any time.";

export const getAssistantIdleDeadline = (
  now = new Date(),
  timeoutMinutes = getPositiveIntegerEnv("ASSISTANT_CHAT_IDLE_TIMEOUT_MINUTES", 30),
): Date => new Date(now.getTime() + timeoutMinutes * 60 * 1000);

export const scheduleAssistantIdleClose = (
  chat: HydratedDocument<ISupportChat>,
  now = new Date(),
): void => {
  chat.assistantIdleExpiresAt = getAssistantIdleDeadline(now);
};

export const clearAssistantIdleClose = (chat: HydratedDocument<ISupportChat>): void => {
  chat.assistantIdleExpiresAt = null;
};

export const hasReachedHumanSupport = (
  chat: Pick<ISupportChat, "status" | "assignedTo" | "escalationReason"> & {
    messages: ReadonlyArray<Pick<ISupportChat["messages"][number], "sender">>;
  },
): boolean =>
  chat.status === "open" ||
  chat.status === "active" ||
  chat.assignedTo !== null ||
  chat.escalationReason !== null ||
  chat.messages.some((message) => message.sender === "staff");

export const closeInactiveAssistantChats = async (
  extraFilter: QueryFilter<ISupportChat> = {},
  now = new Date(),
): Promise<number> => {
  const deletedAssistantOnlyChats = await SupportChat.deleteMany({
    ...extraFilter,
    status: "ended",
    assignedTo: null,
    escalationReason: null,
    "messages.sender": { $ne: "staff" },
  });
  let affectedCount = deletedAssistantOnlyChats.deletedCount;

  for (const locale of ["en", "de"] as const) {
    const result = await SupportChat.updateMany(
      {
        ...extraFilter,
        locale,
        status: "assistant",
        assistantIdleExpiresAt: { $lte: now },
      },
      {
        $set: {
          status: "ended",
          endedAt: now,
          // These chats never reached human support. MongoDB's TTL monitor
          // removes them shortly after the user has received the closing state.
          expiresAt: now,
          assistantIdleExpiresAt: null,
        },
        $push: {
          messages: {
            sender: "system",
            senderName: null,
            content: assistantIdleSystemMessage(locale),
            createdAt: now,
          },
        },
      },
    );
    affectedCount += result.modifiedCount;
  }

  return affectedCount;
};

let lifecycleTimer: ReturnType<typeof setInterval> | null = null;

export const startAssistantChatLifecycle = (): void => {
  if (lifecycleTimer) return;

  const sweep = async (): Promise<void> => {
    try {
      await closeInactiveAssistantChats();
    } catch (error) {
      console.error("Failed to close inactive assistant chats:", error);
    }
  };

  void sweep();
  lifecycleTimer = setInterval(
    () => void sweep(),
    getPositiveIntegerEnv("ASSISTANT_CHAT_IDLE_SWEEP_INTERVAL_MS", 60_000),
  );
  lifecycleTimer.unref();
};
