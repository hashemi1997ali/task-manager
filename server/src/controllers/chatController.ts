import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { Request, RequestHandler, Response } from "express";
import mongoose, { type HydratedDocument, type QueryFilter } from "mongoose";

import {
  SupportChat,
  Task,
  type ISupportChat,
  type ITask,
  type IUser,
  type TaskPriority,
  type TaskStatus,
  type TicketCategory,
  type SupportChatLocale,
  type SupportEscalationReason,
  User,
} from "#models";
import {
  clearAssistantIdleClose,
  closeInactiveAssistantChats,
  createReplySuggestions,
  detectMessageLocale,
  hasReachedHumanSupport,
  improveStaffDraft,
  runAssistant,
  resolveSupportAudience,
  type AssistantHistoryMessage,
  type SupportTranscriptMessage,
} from "#services";
import {
  AppError,
  applyTaskStatusTransition,
  getPositiveIntegerEnv,
  isAdminRoles,
  isStaffRoles,
  isSuperAdminRoles,
  normalizeIpAddress,
  recordTicketFirstResponse,
} from "#utils";
import { supportQueueQuerySchema } from "#schemas";

const validateObjectId = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new AppError(`Invalid ${label} ID`, 400);
  }
  return value;
};

const requireAuth = (request: Request): Express.AuthUser => {
  if (!request.user) throw new AppError("Authentication required", 401);
  return request.user;
};

const getCurrentUser = async (request: Request): Promise<HydratedDocument<IUser>> => {
  const auth = requireAuth(request);
  const user = await User.findById(auth.userId);
  if (!user) throw new AppError("User not found", 404);
  if (user.ban?.isBanned) {
    throw new AppError("Your account has been banned", 403).withPublicDetails({
      ban: { reason: user.ban.reason, bannedAt: user.ban.bannedAt },
    });
  }
  request.user!.roles = user.roles;
  return user;
};

const supportName = (user: Pick<IUser, "firstName">): string => user.firstName.trim();

const localized = (locale: SupportChatLocale, english: string, german: string): string =>
  locale === "de" ? german : english;

const systemMessage = (
  locale: SupportChatLocale,
  key:
    | "waiting-super"
    | "waiting-support"
    | "user-ended"
    | "accepted"
    | "transferred"
    | "staff-left"
    | "staff-ended",
  staffName = "",
): string => {
  const messages = {
    "waiting-super": {
      en: "This chat is waiting for a Super Support Agent.",
      de: "Dieser Chat wartet auf einen Super-Support-Agenten.",
    },
    "waiting-support": {
      en: "This chat is waiting for a Human Support Agent.",
      de: "Dieser Chat wartet auf einen Human-Support-Agenten.",
    },
    "user-ended": {
      en: "The user ended this chat.",
      de: "Der Benutzer hat diesen Chat beendet.",
    },
    accepted: {
      en: `${staffName} joined this support chat.`,
      de: `${staffName} ist diesem Support-Chat beigetreten.`,
    },
    transferred: {
      en: `${staffName} transferred this chat to a Super Support Agent.`,
      de: `${staffName} hat diesen Chat an einen Super-Support-Agenten übertragen.`,
    },
    "staff-left": {
      en: `${staffName} left this support chat.`,
      de: `${staffName} hat diesen Support-Chat verlassen.`,
    },
    "staff-ended": {
      en: `${staffName} ended this support chat.`,
      de: `${staffName} hat diesen Support-Chat beendet.`,
    },
  } as const;

  return messages[key][locale];
};

const serializeMessage = (message: ISupportChat["messages"][number]) => ({
  id: String(message._id),
  sender: message.sender,
  senderId: message.senderId ? String(message.senderId) : null,
  senderName: message.senderName,
  content: message.content,
  createdAt: message.createdAt,
});

const TICKET_SUMMARY_FIELDS =
  "ticketNumber title status priority category assignee firstResponseDueAt resolutionDueAt";

const serializeChat = (chat: HydratedDocument<ISupportChat>) => {
  const populatedUser =
    chat.user && typeof chat.user === "object" && "email" in chat.user
      ? (chat.user as unknown as IUser & { _id: unknown })
      : null;
  const populatedTicket =
    chat.ticket && typeof chat.ticket === "object" && "title" in chat.ticket
      ? (chat.ticket as unknown as ITask & { _id: unknown })
      : null;
  const ticketId = populatedTicket
    ? String(populatedTicket._id)
    : chat.ticket
      ? String(chat.ticket)
      : null;

  return {
    id: String(chat._id),
    user: populatedUser
      ? {
          id: String(populatedUser._id),
          firstName: populatedUser.firstName,
          lastName: populatedUser.lastName,
          email: populatedUser.email,
          roles: populatedUser.roles,
          profileImage: populatedUser.profileImage ?? null,
          ban: populatedUser.ban ?? null,
        }
      : chat.user
        ? String(chat.user)
        : null,
    guest:
      chat.origin === "guest"
        ? { id: chat.guestId, email: chat.guestEmail, label: "Guest" }
        : null,
    origin: chat.origin,
    ticketId,
    linkedTicket: populatedTicket
      ? {
          id: ticketId,
          ticketNumber: populatedTicket.ticketNumber,
          title: populatedTicket.title,
          status: populatedTicket.status,
          priority: populatedTicket.priority,
          category: populatedTicket.category,
          assignee: populatedTicket.assignee ? String(populatedTicket.assignee) : null,
          firstResponseDueAt: populatedTicket.firstResponseDueAt ?? null,
          resolutionDueAt: populatedTicket.resolutionDueAt ?? null,
        }
      : null,
    locale: chat.locale,
    subject: chat.subject,
    status: chat.status,
    assignedTo: chat.assignedTo ? String(chat.assignedTo) : null,
    assignedToName: chat.assignedToName,
    requiresSuperAdmin: chat.requiresSuperAdmin,
    escalationReason: chat.escalationReason,
    lastAgent: chat.lastAgent,
    messages: chat.messages.map(serializeMessage),
    rating: chat.rating,
    assistantIdleExpiresAt: chat.assistantIdleExpiresAt ?? null,
    endedAt: chat.endedAt,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
};

type TicketRollback = () => Promise<void>;

const endChatAtomically = async (
  chat: HydratedDocument<ISupportChat>,
  identityFilter: QueryFilter<ISupportChat>,
  message: {
    sender: "system";
    senderName: null;
    content: string;
    createdAt: Date;
  },
): Promise<{ chat: HydratedDocument<ISupportChat>; deleted: boolean }> => {
  const now = new Date();
  const deleteAfterEnd = !hasReachedHumanSupport(chat);
  const filter: QueryFilter<ISupportChat> = {
    ...identityFilter,
    _id: chat._id,
    status: chat.status,
    updatedAt: chat.updatedAt,
  };

  if (deleteAfterEnd) {
    const deletedChat = await SupportChat.findOneAndDelete(filter);
    if (!deletedChat) {
      throw new AppError("The chat changed before it could end", 409);
    }
    deletedChat.status = "ended";
    deletedChat.assistantIdleExpiresAt = null;
    deletedChat.endedAt = now;
    deletedChat.messages.push(message as ISupportChat["messages"][number]);
    return { chat: deletedChat, deleted: true };
  }

  const retentionDays = getPositiveIntegerEnv("SUPPORT_CHAT_RETENTION_DAYS", 90);
  const endedChat = await SupportChat.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "ended",
        assistantIdleExpiresAt: null,
        endedAt: now,
        expiresAt: new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000),
      },
      $push: { messages: message },
    },
    { new: true, runValidators: true },
  );
  if (!endedChat) {
    throw new AppError("The chat changed before it could end", 409);
  }
  return { chat: endedChat, deleted: false };
};

const rollbackTicketAfterChatFailure = async (
  rollback: TicketRollback | null,
  context: string,
): Promise<void> => {
  if (!rollback) return;
  try {
    await rollback();
  } catch (error) {
    console.error(`Failed to roll back the linked ticket after ${context}`, error);
  }
};

const GUEST_SUPPORT_COOKIE_NAME = "guestSupportToken";
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

const hashGuestToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const setGuestSupportCookie = (response: Response, token: string): void => {
  const retentionDays = getPositiveIntegerEnv("SUPPORT_CHAT_RETENTION_DAYS", 90);
  response.cookie(GUEST_SUPPORT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: retentionDays * 24 * 60 * 60 * 1000,
  });
};

const getGuestToken = (request: Request): string | null => {
  const token = request.cookies?.[GUEST_SUPPORT_COOKIE_NAME] as unknown;
  return typeof token === "string" && token.length >= 32 ? token : null;
};

const resolveLocale = (message: string, fallback: SupportChatLocale): SupportChatLocale =>
  detectMessageLocale(message, fallback).locale;

const assistantTurnPayload = (
  assistant: Awaited<ReturnType<typeof runAssistant>>,
  roles: readonly string[],
) => {
  const supportAvailable = !assistant.available || assistant.action === "escalate";
  const reason = assistant.escalationReason ?? "unresolved";
  return {
    message: {
      id: randomUUID(),
      sender: "ai" as const,
      senderId: null,
      senderName: assistant.agent,
      content: assistant.reply,
      createdAt: new Date(),
    },
    provider: assistant.available ? assistant.provider : null,
    available: assistant.available,
    support: {
      available: supportAvailable,
      reason: supportAvailable ? reason : null,
      requiresSuperAdmin:
        resolveSupportAudience(roles) === "super-admin" || assistant.requiresSuperAdmin,
    },
  };
};

const findGuestChat = async (
  request: Request,
  chatId: string,
): Promise<HydratedDocument<ISupportChat>> => {
  const token = getGuestToken(request);
  if (!token) throw new AppError("Guest chat not found", 404);
  const id = validateObjectId(chatId, "chat");
  await closeInactiveAssistantChats({ _id: id, origin: "guest" });
  const chat = await SupportChat.findOne({
    _id: id,
    origin: "guest",
    guestTokenHash: hashGuestToken(token),
  }).select("+guestTokenHash");
  if (!chat) throw new AppError("Guest chat not found", 404);
  return chat;
};

export const guestAssistant: RequestHandler = async (request, response) => {
  const {
    message,
    history,
    locale: requestedLocale,
  } = request.body as {
    message: string;
    history: AssistantHistoryMessage[];
    locale: SupportChatLocale;
  };
  const locale = resolveLocale(message, requestedLocale);
  const assistant = await runAssistant(message, history, {
    roles: [],
    authenticated: false,
    locale,
  });
  response.status(200).json({
    success: true,
    data: assistantTurnPayload(assistant, []),
  });
};

const supportRequiresSuperAdmin = (
  reason: SupportEscalationReason,
  roles: readonly string[],
): boolean => isAdminRoles(roles) || reason === "account_banned" || reason === "security";

const transcriptMessages = (
  history: AssistantHistoryMessage[],
  options: { userId?: mongoose.Types.ObjectId; userName: string },
) =>
  history.map((item) => ({
    sender: item.role === "user" ? ("user" as const) : ("ai" as const),
    senderId: item.role === "user" ? (options.userId ?? null) : null,
    senderName: item.role === "user" ? options.userName : "website-help",
    content: item.content,
    createdAt: new Date(),
  }));

const ticketCategoryFor = (reason: SupportEscalationReason): TicketCategory => {
  if (
    reason === "account_banned" ||
    reason === "account_access" ||
    reason === "permission"
  ) {
    return "account";
  }
  if (reason === "security") return "technical";
  return "general";
};

const ticketPriorityFor = (reason: SupportEscalationReason): TaskPriority => {
  if (reason === "security") return "urgent";
  if (reason === "account_banned" || reason === "account_access") return "high";
  return "medium";
};

const ticketDescriptionFrom = (history: AssistantHistoryMessage[]): string =>
  history
    .slice(-10)
    .map(
      (message) =>
        `${message.role === "user" ? "Customer" : "Assistant"}: ${message.content}`,
    )
    .join("\n")
    .slice(0, 2000);

const createChatTicket = async (
  user: HydratedDocument<IUser>,
  history: AssistantHistoryMessage[],
  reason: SupportEscalationReason,
) => {
  const firstUserMessage = history.find((item) => item.role === "user")?.content.trim();
  const title =
    firstUserMessage && firstUserMessage.length >= 3
      ? firstUserMessage.slice(0, 100)
      : "Support request";
  return Task.create({
    owner: user._id,
    assignee: null,
    title,
    description: ticketDescriptionFrom(history),
    category: ticketCategoryFor(reason),
    priority: ticketPriorityFor(reason),
    source: "chat",
    status: "todo",
    dueDate: null,
    completedAt: null,
  });
};

type LinkedTicketAction =
  "customer-message" | "staff-response" | "transferred" | "resolved";

const syncLinkedTicket = async (
  chat: HydratedDocument<ISupportChat>,
  action: LinkedTicketAction,
  staff?: HydratedDocument<IUser>,
): Promise<TicketRollback | null> => {
  if (!chat.ticket || !chat.user) return null;
  const ticket = await Task.findOne({ _id: chat.ticket, owner: chat.user });
  if (!ticket) return null;

  if (action === "customer-message" || (action === "resolved" && !staff)) {
    const nextStatus =
      action === "customer-message"
        ? ticket.status === "waiting-customer"
          ? "in-progress"
          : undefined
        : "done";
    if (!nextStatus) return null;
    const previousStatus = ticket.status;
    const previousCompletedAt = ticket.completedAt ?? null;
    const previousResolutionDueAt = ticket.resolutionDueAt;
    applyTaskStatusTransition(ticket, nextStatus);
    const updated = await Task.findOneAndUpdate(
      {
        _id: ticket._id,
        owner: ticket.owner,
        status: previousStatus,
        updatedAt: ticket.updatedAt,
      },
      {
        $set: {
          status: nextStatus,
          completedAt: ticket.completedAt ?? null,
          ...(previousStatus === "done" && {
            resolutionDueAt: ticket.resolutionDueAt,
          }),
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw new AppError("The ticket changed before the chat update completed", 409);
    }
    return async (): Promise<void> => {
      const set: Record<string, unknown> = {
        status: previousStatus,
        completedAt: previousCompletedAt,
      };
      const update: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = {
        $set: set,
      };
      if (previousResolutionDueAt === undefined) {
        update.$unset = { resolutionDueAt: 1 };
      } else {
        set.resolutionDueAt = previousResolutionDueAt;
      }
      const result = await Task.updateOne(
        {
          _id: updated._id,
          owner: updated.owner,
          status: nextStatus,
          updatedAt: updated.updatedAt,
        },
        update,
      );
      if (result.matchedCount !== 1) {
        throw new Error("The linked ticket changed before rollback completed");
      }
    };
  }

  if (!staff) {
    throw new AppError("A support agent is required for this ticket update", 403);
  }
  const context = await loadStaffTicketContext(ticket._id, staff);
  if (String(chat.user) !== String(context.ticket.owner)) {
    throw new AppError("The linked chat does not belong to the ticket owner", 409);
  }
  if (String(context.ticket.assignee ?? "") !== String(staff._id)) {
    throw new AppError("This ticket is no longer assigned to you", 403);
  }

  const previousStatus = context.ticket.status;
  const previousAssignee = context.ticket.assignee ?? null;
  const previousCompletedAt = context.ticket.completedAt ?? null;
  const previousFirstRespondedAt = context.ticket.firstRespondedAt;
  const previousResolutionDueAt = context.ticket.resolutionDueAt;
  let nextStatus: TaskStatus | undefined;
  if (action === "staff-response") {
    recordTicketFirstResponse(context.ticket);
    nextStatus = "waiting-customer";
  } else if (action === "transferred") {
    nextStatus = "todo";
  } else if (action === "resolved") {
    nextStatus = "done";
  }

  applyTaskStatusTransition(context.ticket, nextStatus);
  const updated = await Task.findOneAndUpdate(
    {
      _id: context.ticket._id,
      owner: context.ticket.owner,
      status: previousStatus,
      assignee: staff._id,
      updatedAt: context.ticket.updatedAt,
    },
    {
      $set: {
        status: nextStatus,
        assignee: action === "transferred" ? null : staff._id,
        completedAt: context.ticket.completedAt ?? null,
        ...(action === "staff-response" && {
          firstRespondedAt: context.ticket.firstRespondedAt,
        }),
        ...(previousStatus === "done" &&
          nextStatus !== "done" && {
            resolutionDueAt: context.ticket.resolutionDueAt,
          }),
      },
    },
    { new: true, runValidators: true },
  );
  if (!updated) {
    throw new AppError("The ticket changed before the chat update completed", 409);
  }
  return async (): Promise<void> => {
    const set: Record<string, unknown> = {
      status: previousStatus,
      assignee: previousAssignee,
      completedAt: previousCompletedAt,
    };
    const unset: Record<string, 1> = {};
    if (previousFirstRespondedAt === undefined) unset.firstRespondedAt = 1;
    else set.firstRespondedAt = previousFirstRespondedAt;
    if (previousResolutionDueAt === undefined) unset.resolutionDueAt = 1;
    else set.resolutionDueAt = previousResolutionDueAt;

    const update: { $set: Record<string, unknown>; $unset?: Record<string, 1> } = {
      $set: set,
    };
    if (Object.keys(unset).length > 0) update.$unset = unset;
    const result = await Task.updateOne(
      {
        _id: updated._id,
        owner: updated.owner,
        status: nextStatus,
        assignee: action === "transferred" ? null : staff._id,
        updatedAt: updated.updatedAt,
      },
      update,
    );
    if (result.matchedCount !== 1) {
      throw new Error("The linked ticket changed before rollback completed");
    }
  };
};

export const createGuestSupportChat: RequestHandler = async (request, response) => {
  const { history, locale, reason } = request.body as {
    history: AssistantHistoryMessage[];
    locale: SupportChatLocale;
    reason: SupportEscalationReason;
  };
  const token = randomBytes(32).toString("base64url");
  const firstUserMessage = history.find((item) => item.role === "user")?.content ?? "";
  const email = history
    .map((item) => item.content)
    .join(" ")
    .match(EMAIL_PATTERN)?.[0]
    ?.toLowerCase();
  const requiresSuperAdmin = supportRequiresSuperAdmin(reason, []);
  const chat = await SupportChat.create({
    user: null,
    ticket: null,
    origin: "guest",
    guestId: randomUUID(),
    guestTokenHash: hashGuestToken(token),
    guestEmail: email ?? null,
    guestIpAddress: normalizeIpAddress(request.ip),
    guestUserAgent: request.get("user-agent")?.slice(0, 512) ?? null,
    locale,
    subject: firstUserMessage.slice(0, 200),
    status: "open",
    assignedTo: null,
    assignedToName: null,
    escalationReason: reason,
    requiresSuperAdmin,
    lastAgent: "website-help",
    messages: [
      ...transcriptMessages(history, { userName: "Guest" }),
      {
        sender: "system",
        senderName: null,
        content: systemMessage(
          locale,
          requiresSuperAdmin ? "waiting-super" : "waiting-support",
        ),
        createdAt: new Date(),
      },
    ],
  });
  setGuestSupportCookie(response, token);
  response.status(201).json({ success: true, data: { chat: serializeChat(chat) } });
};

export const createSupportChat: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request);
  const { history, locale, reason, ticketId } = request.body as {
    history: AssistantHistoryMessage[];
    locale: SupportChatLocale;
    reason: SupportEscalationReason;
    ticketId?: string;
  };
  const firstUserMessage = history.find((item) => item.role === "user")?.content ?? "";
  const requiresSuperAdmin = supportRequiresSuperAdmin(reason, user.roles);
  let ticket = ticketId ? await Task.findOne({ _id: ticketId, owner: user._id }) : null;
  if (ticketId && !ticket) {
    throw new AppError("Ticket not found", 404);
  }
  if (ticket) {
    const activeChat = await SupportChat.findOne({
      ticket: ticket._id,
      user: user._id,
      status: { $in: ["open", "active"] },
    });
    if (activeChat) {
      await activeChat.populate("ticket", TICKET_SUMMARY_FIELDS);
      response.status(200).json({
        success: true,
        data: { chat: serializeChat(activeChat) },
      });
      return;
    }
    if (ticket.status === "done") {
      applyTaskStatusTransition(ticket, "todo");
      ticket.status = "todo";
      ticket.assignee = null;
      ticket.$where = { updatedAt: ticket.updatedAt };
      try {
        await ticket.save();
      } catch (error) {
        if (error instanceof mongoose.Error.DocumentNotFoundError) {
          throw new AppError(
            "The ticket changed before the support chat could open",
            409,
          );
        }
        throw error;
      }
    }
  }

  const createdTicket = !ticket;
  ticket ??= await createChatTicket(user, history, reason);
  const ticketFenceUpdatedAt = ticket.updatedAt;
  let chat: HydratedDocument<ISupportChat>;
  try {
    chat = await SupportChat.create({
      user: user._id,
      ticket: ticket._id,
      origin:
        isAdminRoles(user.roles) && !isSuperAdminRoles(user.roles) ? "admin" : "user",
      locale,
      subject: firstUserMessage.slice(0, 200),
      status: "assistant",
      assignedTo: null,
      assignedToName: null,
      escalationReason: reason,
      requiresSuperAdmin,
      lastAgent: "website-help",
      messages: [
        ...transcriptMessages(history, {
          userId: user._id,
          userName: supportName(user),
        }),
        {
          sender: "system",
          senderName: null,
          content: systemMessage(
            locale,
            requiresSuperAdmin ? "waiting-super" : "waiting-support",
          ),
          createdAt: new Date(),
        },
      ],
    });
  } catch (error) {
    if (createdTicket) await Task.deleteOne({ _id: ticket._id, owner: user._id });
    throw error;
  }
  const fencedTicket = await Task.findOneAndUpdate(
    {
      _id: ticket._id,
      owner: user._id,
      updatedAt: ticketFenceUpdatedAt,
    },
    { $set: { updatedAt: new Date() } },
    { new: true, runValidators: true },
  );
  if (!fencedTicket) {
    await SupportChat.deleteOne({
      _id: chat._id,
      ticket: ticket._id,
      status: "assistant",
    });
    throw new AppError("The ticket changed before the support chat could open", 409);
  }
  try {
    const activatedChat = await SupportChat.findOneAndUpdate(
      { _id: chat._id, ticket: ticket._id, status: "assistant" },
      { $set: { status: "open" } },
      { new: true, runValidators: true },
    );
    if (!activatedChat) {
      throw new AppError("The support chat changed before it could open", 409);
    }
    chat = activatedChat;
  } catch (error) {
    await SupportChat.deleteOne({ _id: chat._id, status: "assistant" });
    if (isDuplicateActiveTicketChatError(error)) {
      const activeChat = await SupportChat.findOne({
        ticket: ticket._id,
        user: user._id,
        status: { $in: ["open", "active"] },
      });
      if (activeChat) {
        await activeChat.populate("ticket", TICKET_SUMMARY_FIELDS);
        response.status(200).json({
          success: true,
          data: { chat: serializeChat(activeChat) },
        });
        return;
      }
    }
    throw error;
  }
  await chat.populate("ticket", TICKET_SUMMARY_FIELDS);
  response.status(201).json({ success: true, data: { chat: serializeChat(chat) } });
};

export const getGuestChat: RequestHandler = async (request, response) => {
  const chat = await findGuestChat(request, String(request.params.id));
  response.status(200).json({ success: true, data: { chat: serializeChat(chat) } });
};

export const sendGuestMessage: RequestHandler = async (request, response) => {
  const chat = await findGuestChat(request, String(request.params.id));
  if (chat.status !== "open" && chat.status !== "active") {
    throw new AppError("This support chat is not accepting messages", 409);
  }
  const { message } = request.body as { message: string };
  const guestEmail = chat.guestEmail
    ? null
    : (message.match(EMAIL_PATTERN)?.[0]?.toLowerCase() ?? null);
  const updatedChat = await SupportChat.findOneAndUpdate(
    {
      _id: chat._id,
      status: { $in: ["open", "active"] },
      updatedAt: chat.updatedAt,
    },
    {
      ...(guestEmail && { $set: { guestEmail } }),
      $push: {
        messages: {
          sender: "user",
          senderName: "Guest",
          content: message,
          createdAt: new Date(),
        },
      },
    },
    { new: true, runValidators: true },
  );
  if (!updatedChat) {
    throw new AppError("This support chat is no longer accepting messages", 409);
  }
  response.status(200).json({
    success: true,
    data: { chat: serializeChat(updatedChat) },
  });
};

export const endGuestChat: RequestHandler = async (request, response) => {
  let chat = await findGuestChat(request, String(request.params.id));
  let deleted = false;
  if (chat.status !== "ended") {
    const result = await endChatAtomically(
      chat,
      { origin: "guest", guestId: chat.guestId },
      {
        sender: "system",
        senderName: null,
        content: systemMessage(chat.locale, "user-ended"),
        createdAt: new Date(),
      },
    );
    chat = result.chat;
    deleted = result.deleted;
  } else if (!hasReachedHumanSupport(chat)) {
    const result = await SupportChat.deleteOne({
      _id: chat._id,
      origin: "guest",
      guestId: chat.guestId,
      status: "ended",
    });
    deleted = result.deletedCount === 1;
  }
  response
    .status(200)
    .json({ success: true, data: { chat: serializeChat(chat), deleted } });
};

export const createChat: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request);
  const {
    message,
    history,
    locale: requestedLocale,
  } = request.body as {
    message: string;
    history: AssistantHistoryMessage[];
    locale: SupportChatLocale;
  };
  const locale = resolveLocale(message, requestedLocale);
  const assistant = await runAssistant(message, history, {
    roles: user.roles,
    authenticated: true,
    locale,
  });
  response.status(200).json({
    success: true,
    data: assistantTurnPayload(assistant, user.roles),
  });
};

export const listOwnChats: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request);
  await closeInactiveAssistantChats({ user: user._id });
  const chats = await SupportChat.find({
    user: user._id,
    status: { $in: ["open", "active", "ended"] },
  })
    .populate("ticket", TICKET_SUMMARY_FIELDS)
    .sort({ updatedAt: -1 })
    .limit(50);
  response.status(200).json({
    success: true,
    data: { chats: chats.map(serializeChat) },
  });
};

export const getOwnChat: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  await closeInactiveAssistantChats({ _id: chatId, user: user._id });
  const chat = await SupportChat.findOne({ _id: chatId, user: user._id });
  if (!chat) throw new AppError("Chat not found", 404);
  await chat.populate("ticket", TICKET_SUMMARY_FIELDS);
  response.status(200).json({ success: true, data: { chat: serializeChat(chat) } });
};

export const sendOwnMessage: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  const { message, locale: requestedLocale } = request.body as {
    message: string;
    locale: SupportChatLocale;
  };
  await closeInactiveAssistantChats({ _id: chatId, user: user._id });
  const pendingChat = await SupportChat.findOne({ _id: chatId, user: user._id });
  if (!pendingChat) throw new AppError("Chat not found", 404);
  if (pendingChat.status !== "open" && pendingChat.status !== "active") {
    throw new AppError("This support chat is not accepting messages", 409);
  }

  const locale = resolveLocale(message, pendingChat.locale ?? requestedLocale);
  const ticketRollback = await syncLinkedTicket(pendingChat, "customer-message");
  let chat: HydratedDocument<ISupportChat> | null = null;
  try {
    chat = await SupportChat.findOneAndUpdate(
      {
        _id: pendingChat._id,
        user: user._id,
        status: { $in: ["open", "active"] },
        updatedAt: pendingChat.updatedAt,
      },
      {
        $set: { locale },
        $push: {
          messages: {
            sender: "user",
            senderId: user._id,
            senderName: supportName(user),
            content: message,
            createdAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!chat) {
      throw new AppError("This support chat is no longer accepting messages", 409);
    }
  } catch (error) {
    await rollbackTicketAfterChatFailure(ticketRollback, "a customer message failed");
    throw error;
  }
  await chat.populate("ticket", TICKET_SUMMARY_FIELDS);
  response.status(200).json({
    success: true,
    data: {
      chat: serializeChat(chat),
      provider: null,
      escalation: { requested: false, completed: false, reason: null },
    },
  });
};

export const escalateOwnChat: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request);
  if (isSuperAdminRoles(user.roles)) {
    throw new AppError("Super Support Agents manage these requests directly", 400);
  }

  const chatId = validateObjectId(request.params.id, "chat");
  await closeInactiveAssistantChats({ _id: chatId, user: user._id });
  const chat = await SupportChat.findOne({ _id: chatId, user: user._id });
  if (!chat) throw new AppError("Chat not found", 404);
  if (chat.status === "ended") throw new AppError("This chat has ended", 409);
  if (chat.status !== "assistant") {
    throw new AppError("This chat has already been sent to support", 409);
  }

  chat.status = "open";
  clearAssistantIdleClose(chat);
  chat.escalationReason = "human_requested";
  chat.requiresSuperAdmin = isAdminRoles(user.roles);
  chat.messages.push({
    sender: "system",
    senderName: null,
    content: systemMessage(
      chat.locale,
      chat.requiresSuperAdmin ? "waiting-super" : "waiting-support",
    ),
    createdAt: new Date(),
  } as ISupportChat["messages"][number]);

  if (!chat.ticket) {
    const history: AssistantHistoryMessage[] = chat.messages
      .filter((message) => message.sender === "user" || message.sender === "ai")
      .map((message) => ({
        role: message.sender === "user" ? "user" : "assistant",
        content: message.content,
      }));
    const ticket = await createChatTicket(user, history, "human_requested");
    chat.ticket = ticket._id;
  }
  await chat.save();
  await chat.populate("ticket", TICKET_SUMMARY_FIELDS);

  response.status(200).json({ success: true, data: { chat: serializeChat(chat) } });
};

export const endOwnChat: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  await closeInactiveAssistantChats({ _id: chatId, user: user._id });
  let chat = await SupportChat.findOne({ _id: chatId, user: user._id });
  if (!chat) throw new AppError("Chat not found", 404);
  let deleted = false;
  if (chat.status !== "ended") {
    const ticketRollback = hasReachedHumanSupport(chat)
      ? await syncLinkedTicket(chat, "resolved")
      : null;
    try {
      const result = await endChatAtomically(
        chat,
        { user: user._id },
        {
          sender: "system",
          senderName: null,
          content: systemMessage(chat.locale, "user-ended"),
          createdAt: new Date(),
        },
      );
      chat = result.chat;
      deleted = result.deleted;
    } catch (error) {
      await rollbackTicketAfterChatFailure(
        ticketRollback,
        "a customer chat failed to end",
      );
      throw error;
    }
  } else if (!hasReachedHumanSupport(chat)) {
    const result = await SupportChat.deleteOne({
      _id: chat._id,
      user: user._id,
      status: "ended",
    });
    deleted = result.deletedCount === 1;
  }
  if (!deleted) await chat.populate("ticket", TICKET_SUMMARY_FIELDS);
  response
    .status(200)
    .json({ success: true, data: { chat: serializeChat(chat), deleted } });
};

export const rateOwnChat: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  const chat = await SupportChat.findOne({ _id: chatId, user: user._id });
  if (!chat) throw new AppError("Chat not found", 404);
  if (chat.status !== "ended") throw new AppError("End the chat before rating it", 409);
  if (chat.rating) throw new AppError("This chat has already been rated", 409);
  chat.rating = request.body as { score: number; reason: string };
  await chat.save();
  await chat.populate("ticket", TICKET_SUMMARY_FIELDS);
  response.status(200).json({ success: true, data: { chat: serializeChat(chat) } });
};

const ensureStaffMayHandle = (
  chat: Pick<ISupportChat, "requiresSuperAdmin">,
  staff: HydratedDocument<IUser>,
): void => {
  if (chat.requiresSuperAdmin && !isSuperAdminRoles(staff.roles)) {
    throw new AppError("This chat requires a Super Support Agent", 403);
  }
};

type StaffTicketContext = {
  ticket: HydratedDocument<ITask>;
  owner: HydratedDocument<IUser>;
};

const loadStaffTicketContext = async (
  ticketId: string | mongoose.Types.ObjectId,
  staff: HydratedDocument<IUser>,
): Promise<StaffTicketContext> => {
  const ticket = await Task.findById(ticketId);
  if (!ticket) throw new AppError("Ticket not found", 404);

  const owner = await User.findById(ticket.owner);
  if (!owner) throw new AppError("Ticket owner not found", 404);

  if (!isSuperAdminRoles(staff.roles)) {
    if (isStaffRoles(owner.roles)) {
      throw new AppError("Only a Super Support Agent can manage staff tickets", 403);
    }
    if (ticket.assignee && String(ticket.assignee) !== String(staff._id)) {
      throw new AppError("This ticket is assigned to another support agent", 403);
    }
  }

  return { ticket, owner };
};

const assignTicketForStaffResponse = async (
  ticket: HydratedDocument<ITask>,
  staff: HydratedDocument<IUser>,
): Promise<{ rollback: () => Promise<void> }> => {
  const previousStatus = ticket.status;
  const previousAssignee = ticket.assignee ?? null;
  const previousCompletedAt = ticket.completedAt ?? null;
  const previousResolutionDueAt = ticket.resolutionDueAt;
  const transition = {
    status: ticket.status,
    priority: ticket.priority,
    completedAt: ticket.completedAt,
    resolutionDueAt: ticket.resolutionDueAt,
  };
  applyTaskStatusTransition(transition, "in-progress");
  const filter: QueryFilter<ITask> = {
    _id: ticket._id,
    owner: ticket.owner,
    status: previousStatus,
    updatedAt: ticket.updatedAt,
  };
  if (previousAssignee) {
    filter.assignee = previousAssignee;
  } else {
    filter.$or = [{ assignee: null }, { assignee: { $exists: false } }];
  }

  const assigned = await Task.findOneAndUpdate(
    filter,
    {
      $set: {
        assignee: staff._id,
        status: "in-progress",
        completedAt: transition.completedAt ?? null,
        ...(previousStatus === "done" && {
          resolutionDueAt: transition.resolutionDueAt,
        }),
      },
    },
    { new: true, runValidators: true },
  );
  if (!assigned) {
    throw new AppError("The ticket assignment changed before the chat could open", 409);
  }

  return {
    rollback: async (): Promise<void> => {
      const set: Record<string, unknown> = {
        status: previousStatus,
        assignee: previousAssignee,
        completedAt: previousCompletedAt,
      };
      const update: {
        $set: Record<string, unknown>;
        $unset?: Record<string, 1>;
      } = { $set: set };
      if (previousResolutionDueAt === undefined) {
        update.$unset = { resolutionDueAt: 1 };
      } else {
        set.resolutionDueAt = previousResolutionDueAt;
      }
      await Task.updateOne(
        {
          _id: assigned._id,
          owner: assigned.owner,
          status: "in-progress",
          assignee: staff._id,
          updatedAt: assigned.updatedAt,
        },
        update,
      );
    },
  };
};

type StaffChatClaimSnapshot = Pick<
  ISupportChat,
  | "locale"
  | "status"
  | "assignedTo"
  | "assignedToName"
  | "requiresSuperAdmin"
  | "origin"
  | "ticket"
  | "user"
> & { _id: mongoose.Types.ObjectId };

const claimChatForStaff = async (
  pendingChat: StaffChatClaimSnapshot,
  staff: HydratedDocument<IUser>,
  options: { reuseAssigned: boolean },
): Promise<HydratedDocument<ISupportChat>> => {
  ensureStaffMayHandle(pendingChat, staff);
  const staffId = String(staff._id);
  const assignedToStaff = String(pendingChat.assignedTo ?? "") === staffId;

  if (pendingChat.status === "active" && assignedToStaff) {
    if (!options.reuseAssigned) {
      throw new AppError("This chat is already assigned to you", 409);
    }
    const assignedChat = await SupportChat.findById(pendingChat._id);
    if (!assignedChat) throw new AppError("Chat not found", 404);
    return assignedChat;
  }

  const superAdmin = isSuperAdminRoles(staff.roles);
  const replacingAssignment = pendingChat.assignedTo !== null && !assignedToStaff;
  const takingOver = superAdmin && pendingChat.status === "active" && replacingAssignment;

  if (pendingChat.status !== "open" && !takingOver) {
    throw new AppError("This chat is unavailable or has already been joined", 409);
  }
  if (replacingAssignment && !superAdmin) {
    throw new AppError("This chat is assigned to another support agent", 403);
  }
  if (!superAdmin && pendingChat.origin === "admin") {
    throw new AppError("Only a Super Support Agent can handle this chat", 403);
  }

  const staffName = supportName(staff);
  const filter: QueryFilter<ISupportChat> = {
    _id: pendingChat._id,
    status: pendingChat.status,
    assignedTo: pendingChat.assignedTo ?? null,
  };
  if (!superAdmin) {
    filter.requiresSuperAdmin = false;
    filter.origin = { $in: ["user", "guest"] };
  }

  const transitionMessages = replacingAssignment
    ? [
        {
          sender: "system",
          senderName: null,
          content: systemMessage(
            pendingChat.locale,
            "staff-left",
            pendingChat.assignedToName ?? "Support",
          ),
          createdAt: new Date(),
        },
        {
          sender: "system",
          senderName: null,
          content: systemMessage(pendingChat.locale, "accepted", staffName),
          createdAt: new Date(),
        },
      ]
    : [
        {
          sender: "system",
          senderName: null,
          content: systemMessage(pendingChat.locale, "accepted", staffName),
          createdAt: new Date(),
        },
      ];

  const chat = await SupportChat.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "active",
        assignedTo: staff._id,
        assignedToName: staffName,
        ...(takingOver && { requiresSuperAdmin: true }),
      },
      $addToSet: {
        staffParticipants: {
          $each:
            replacingAssignment && pendingChat.assignedTo
              ? [staff._id, pendingChat.assignedTo]
              : [staff._id],
        },
      },
      $push: { messages: { $each: transitionMessages } },
    },
    { new: true, runValidators: true },
  );
  if (!chat) {
    throw new AppError("The chat assignment changed before you could join", 409);
  }
  return chat;
};

const isDuplicateActiveTicketChatError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

const ticketContextMessage = (
  ticket: HydratedDocument<ITask>,
  locale: SupportChatLocale,
): string => {
  const reference = ticket.ticketNumber ?? String(ticket._id);
  const description = ticket.description.trim();
  return localized(
    locale,
    `Original request from ${reference}\n${ticket.title}${description ? `\n\n${description}` : ""}`,
    `Ursprüngliche Anfrage aus ${reference}\n${ticket.title}${description ? `\n\n${description}` : ""}`,
  );
};

export const openStaffTicketChat: RequestHandler = async (request, response) => {
  const staff = await getCurrentUser(request);
  const ticketId = validateObjectId(request.params.ticketId, "ticket");
  const locale = (request.body as { locale: SupportChatLocale }).locale;
  const context = await loadStaffTicketContext(ticketId, staff);

  const ensureExistingChatOwner = (pendingChat: StaffChatClaimSnapshot): void => {
    if (String(pendingChat.user ?? "") !== String(context.ticket.owner)) {
      throw new AppError("The linked chat does not belong to the ticket owner", 409);
    }
  };

  const existingChat = await SupportChat.findOne({
    ticket: context.ticket._id,
    status: { $in: ["open", "active"] },
  });
  let chat: HydratedDocument<ISupportChat>;
  let created = false;

  if (existingChat) {
    ensureExistingChatOwner(existingChat);
    const ticketClaim = await assignTicketForStaffResponse(context.ticket, staff);
    try {
      chat = await claimChatForStaff(existingChat, staff, {
        reuseAssigned: true,
      });
    } catch (error) {
      await ticketClaim.rollback();
      throw error;
    }
  } else {
    const ticketClaim = await assignTicketForStaffResponse(context.ticket, staff);
    const now = new Date();
    try {
      chat = await SupportChat.create({
        user: context.owner._id,
        ticket: context.ticket._id,
        origin: isStaffRoles(context.owner.roles) ? "admin" : "user",
        locale,
        subject: context.ticket.title,
        status: "active",
        assignedTo: staff._id,
        staffParticipants: [staff._id],
        assignedToName: supportName(staff),
        requiresSuperAdmin: isStaffRoles(context.owner.roles),
        escalationReason: "human_requested",
        lastAgent: null,
        messages: [
          {
            sender: "system",
            senderId: null,
            senderName: null,
            content: ticketContextMessage(context.ticket, locale),
            createdAt: now,
          },
          {
            sender: "system",
            senderName: null,
            content: systemMessage(locale, "accepted", supportName(staff)),
            createdAt: now,
          },
        ],
      });
      created = true;
    } catch (error) {
      try {
        if (!isDuplicateActiveTicketChatError(error)) throw error;
        const racedChat = await SupportChat.findOne({
          ticket: context.ticket._id,
          status: { $in: ["open", "active"] },
        });
        if (!racedChat) {
          throw new AppError("The support chat changed before it could open", 409);
        }
        ensureExistingChatOwner(racedChat);
        chat = await claimChatForStaff(racedChat, staff, {
          reuseAssigned: true,
        });
      } catch (claimError) {
        await ticketClaim.rollback();
        throw claimError;
      }
    }
  }

  await chat.populate(
    "user",
    "firstName lastName email roles profileImage ban createdAt updatedAt",
  );
  await chat.populate("ticket", TICKET_SUMMARY_FIELDS);
  response.status(created ? 201 : 200).json({
    success: true,
    data: { chat: serializeChat(chat) },
  });
};

export const listStaffChats: RequestHandler = async (request, response) => {
  const staff = await getCurrentUser(request);
  if (!isStaffRoles(staff.roles)) throw new AppError("Administrator required", 403);
  await closeInactiveAssistantChats();
  const query = supportQueueQuerySchema.parse(request.query);
  const superAdmin = isSuperAdminRoles(staff.roles);
  const filter: QueryFilter<ISupportChat> = {};
  if (superAdmin) {
    if (query.status) filter.status = query.status;
    else {
      filter.$or = [
        { status: { $in: ["open", "active"] } },
        { assignedTo: { $ne: null } },
        { "staffParticipants.0": { $exists: true } },
        { escalationReason: { $ne: null } },
      ];
    }
  } else {
    const protectedOwners = (
      await User.distinct("_id", { roles: { $in: ["admin", "super_admin"] } })
    ).map((ownerId) => new mongoose.Types.ObjectId(String(ownerId)));
    const manageableTicketIds = (
      await Task.distinct("_id", {
        owner: { $nin: protectedOwners },
        $or: [
          { assignee: null },
          { assignee: { $exists: false } },
          { assignee: staff._id },
        ],
      })
    ).map((ticketId) => new mongoose.Types.ObjectId(String(ticketId)));

    filter.$and = [
      {
        $or: [
          { ticket: null },
          { ticket: { $exists: false } },
          { ticket: { $in: manageableTicketIds } },
        ],
      },
      {
        $or: [
          {
            status: "open",
            assignedTo: null,
            requiresSuperAdmin: false,
            origin: { $in: ["user", "guest"] },
          },
          { staffParticipants: staff._id },
          { assignedTo: staff._id },
        ],
      },
    ];
  }
  const allChats = await SupportChat.find(filter)
    .populate(
      "user",
      "firstName lastName email roles profileImage ban createdAt updatedAt",
    )
    .populate({
      path: "ticket",
      select: `${TICKET_SUMMARY_FIELDS} owner`,
      populate: { path: "owner", select: "roles" },
    });
  const scopedChats = superAdmin
    ? allChats
    : allChats.filter((chat) => {
        if (!chat.ticket) return true;
        if (typeof chat.ticket !== "object" || !("owner" in chat.ticket)) return false;
        const ticket = chat.ticket as unknown as ITask & {
          owner: mongoose.Types.ObjectId | (Pick<IUser, "roles"> & { _id: unknown });
        };
        const owner =
          ticket.owner && typeof ticket.owner === "object" && "roles" in ticket.owner
            ? ticket.owner
            : null;
        if (!owner || isStaffRoles(owner.roles)) return false;
        return !ticket.assignee || String(ticket.assignee) === String(staff._id);
      });
  const total = scopedChats.length;
  const statusRank: Record<ISupportChat["status"], number> = {
    open: 0,
    active: 1,
    ended: 2,
    assistant: 3,
  };
  const lastMessageTime = (chat: HydratedDocument<ISupportChat>): number =>
    chat.messages.at(-1)?.createdAt.getTime() ?? chat.updatedAt.getTime();
  const superSupportPriority = (chat: HydratedDocument<ISupportChat>): number =>
    chat.requiresSuperAdmin ? 0 : 1;
  const chats = scopedChats
    .sort(
      (left, right) =>
        statusRank[left.status] - statusRank[right.status] ||
        superSupportPriority(left) - superSupportPriority(right) ||
        lastMessageTime(right) - lastMessageTime(left),
    )
    .slice((query.page - 1) * query.limit, query.page * query.limit);
  response.status(200).json({
    success: true,
    data: {
      chats: chats.map(serializeChat),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: query.page * query.limit < total,
        hasPreviousPage: query.page > 1,
      },
    },
  });
};

export const claimStaffChat: RequestHandler = async (request, response) => {
  const staff = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  const pendingChat = await SupportChat.findById(chatId)
    .select(
      "locale status assignedTo assignedToName requiresSuperAdmin origin ticket user",
    )
    .lean();
  if (!pendingChat) throw new AppError("Chat not found", 404);

  let ticketContext: StaffTicketContext | null = null;
  if (pendingChat.ticket) {
    ticketContext = await loadStaffTicketContext(pendingChat.ticket, staff);
    if (String(pendingChat.user ?? "") !== String(ticketContext.ticket.owner)) {
      throw new AppError("The linked chat does not belong to the ticket owner", 409);
    }
  }

  const ticketClaim = ticketContext
    ? await assignTicketForStaffResponse(ticketContext.ticket, staff)
    : null;
  let chat: HydratedDocument<ISupportChat>;
  try {
    chat = await claimChatForStaff(pendingChat, staff, { reuseAssigned: false });
  } catch (error) {
    await ticketClaim?.rollback();
    throw error;
  }

  await chat.populate(
    "user",
    "firstName lastName email roles profileImage ban createdAt updatedAt",
  );
  await chat.populate("ticket", TICKET_SUMMARY_FIELDS);
  response.status(200).json({ success: true, data: { chat: serializeChat(chat) } });
};

const requireAssignedStaff = async (
  chat: HydratedDocument<ISupportChat>,
  staff: HydratedDocument<IUser>,
): Promise<void> => {
  ensureStaffMayHandle(chat, staff);
  if (chat.status !== "active" || String(chat.assignedTo) !== String(staff._id)) {
    throw new AppError("You must claim this chat before replying", 403);
  }
  if (chat.ticket) {
    const context = await loadStaffTicketContext(chat.ticket, staff);
    if (String(chat.user ?? "") !== String(context.ticket.owner)) {
      throw new AppError("The linked chat does not belong to the ticket owner", 409);
    }
    if (String(context.ticket.assignee ?? "") !== String(staff._id)) {
      throw new AppError("This ticket is no longer assigned to you", 403);
    }
  }
};

export const sendStaffMessage: RequestHandler = async (request, response) => {
  const staff = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  const chat = await SupportChat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  await requireAssignedStaff(chat, staff);
  const ticketRollback = await syncLinkedTicket(chat, "staff-response", staff);
  let updatedChat: HydratedDocument<ISupportChat> | null = null;
  try {
    updatedChat = await SupportChat.findOneAndUpdate(
      {
        _id: chat._id,
        status: "active",
        assignedTo: staff._id,
        updatedAt: chat.updatedAt,
      },
      {
        $push: {
          messages: {
            sender: "staff",
            senderId: staff._id,
            senderName: supportName(staff),
            content: (request.body as { message: string }).message,
            createdAt: new Date(),
          },
        },
        $addToSet: { staffParticipants: staff._id },
      },
      { new: true, runValidators: true },
    );
    if (!updatedChat) {
      throw new AppError("The chat assignment changed before the reply was sent", 409);
    }
  } catch (error) {
    await rollbackTicketAfterChatFailure(ticketRollback, "a staff reply failed");
    throw error;
  }
  await updatedChat.populate(
    "user",
    "firstName lastName email roles profileImage ban createdAt updatedAt",
  );
  await updatedChat.populate("ticket", TICKET_SUMMARY_FIELDS);
  response
    .status(200)
    .json({ success: true, data: { chat: serializeChat(updatedChat) } });
};

export const transferStaffChat: RequestHandler = async (request, response) => {
  const staff = await getCurrentUser(request);
  if (isSuperAdminRoles(staff.roles)) {
    throw new AppError("A Super Support Agent cannot transfer this chat upward", 400);
  }
  const chatId = validateObjectId(request.params.id, "chat");
  const chat = await SupportChat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  await requireAssignedStaff(chat, staff);
  const ticketRollback = await syncLinkedTicket(chat, "transferred", staff);
  const staffName = supportName(staff);
  let updatedChat: HydratedDocument<ISupportChat> | null = null;
  try {
    updatedChat = await SupportChat.findOneAndUpdate(
      {
        _id: chat._id,
        status: "active",
        assignedTo: staff._id,
        updatedAt: chat.updatedAt,
      },
      {
        $set: {
          status: "open",
          assignedTo: null,
          assignedToName: null,
          requiresSuperAdmin: true,
        },
        $addToSet: { staffParticipants: staff._id },
        $push: {
          messages: {
            $each: [
              {
                sender: "system",
                senderName: null,
                content: systemMessage(chat.locale, "staff-left", staffName),
                createdAt: new Date(),
              },
              {
                sender: "system",
                senderName: null,
                content: systemMessage(chat.locale, "transferred", staffName),
                createdAt: new Date(),
              },
              {
                sender: "system",
                senderName: null,
                content: systemMessage(chat.locale, "waiting-super"),
                createdAt: new Date(),
              },
            ],
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!updatedChat) {
      throw new AppError("The chat assignment changed before transfer completed", 409);
    }
  } catch (error) {
    await rollbackTicketAfterChatFailure(ticketRollback, "a chat transfer failed");
    throw error;
  }
  await updatedChat.populate("ticket", TICKET_SUMMARY_FIELDS);
  response
    .status(200)
    .json({ success: true, data: { chat: serializeChat(updatedChat) } });
};

export const endStaffChat: RequestHandler = async (request, response) => {
  const staff = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  const chat = await SupportChat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  await requireAssignedStaff(chat, staff);
  const ticketRollback = await syncLinkedTicket(chat, "resolved", staff);
  let endedChat: HydratedDocument<ISupportChat>;
  try {
    const result = await endChatAtomically(
      chat,
      { assignedTo: staff._id },
      {
        sender: "system",
        senderName: null,
        content: systemMessage(chat.locale, "staff-ended", supportName(staff)),
        createdAt: new Date(),
      },
    );
    endedChat = result.chat;
  } catch (error) {
    await rollbackTicketAfterChatFailure(ticketRollback, "a staff chat failed to end");
    throw error;
  }
  await endedChat.populate(
    "user",
    "firstName lastName email roles profileImage ban createdAt updatedAt",
  );
  await endedChat.populate("ticket", TICKET_SUMMARY_FIELDS);
  response.status(200).json({ success: true, data: { chat: serializeChat(endedChat) } });
};

export const getStaffSuggestions: RequestHandler = async (request, response) => {
  const staff = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  const chat = await SupportChat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  await requireAssignedStaff(chat, staff);
  await chat.populate("user", "roles");
  const transcript: SupportTranscriptMessage[] = chat.messages.map((message) => ({
    sender: message.sender,
    senderName: message.senderName,
    content: message.content,
  }));
  const customer = chat.user ? (chat.user as unknown as Pick<IUser, "roles">) : null;
  const suggestions = await createReplySuggestions(transcript, {
    roles: staff.roles,
    authenticated: true,
    locale: chat.locale,
    staffName: supportName(staff),
    staffRole: isSuperAdminRoles(staff.roles) ? "super_admin" : "admin",
    customerRoles: customer?.roles ?? [],
  });
  response.status(200).json({ success: true, data: { suggestions } });
};

export const rewriteStaffMessage: RequestHandler = async (request, response) => {
  const staff = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  const chat = await SupportChat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  await requireAssignedStaff(chat, staff);
  await chat.populate("user", "roles");
  const transcript: SupportTranscriptMessage[] = chat.messages.map((item) => ({
    sender: item.sender,
    senderName: item.senderName,
    content: item.content,
  }));
  const customer = chat.user ? (chat.user as unknown as Pick<IUser, "roles">) : null;
  const message = await improveStaffDraft(
    (request.body as { message: string }).message,
    transcript,
    {
      roles: staff.roles,
      authenticated: true,
      locale: chat.locale,
      staffName: supportName(staff),
      staffRole: isSuperAdminRoles(staff.roles) ? "super_admin" : "admin",
      customerRoles: customer?.roles ?? [],
    },
  );
  response.status(200).json({ success: true, data: { message } });
};
