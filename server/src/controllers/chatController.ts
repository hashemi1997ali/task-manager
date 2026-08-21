import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { Request, RequestHandler, Response } from "express";
import mongoose, { type HydratedDocument, type QueryFilter } from "mongoose";

import {
  BAN_REASONS,
  SupportChat,
  type ISupportChat,
  type IUser,
  type SupportChatLocale,
  type SupportEscalationReason,
  User,
} from "#models";
import {
  banUser,
  CHAT_WELCOME_SENDER,
  chatWelcomeMessage,
  clearAssistantIdleClose,
  closeInactiveAssistantChats,
  createReplySuggestions,
  detectMessageLocale,
  hasReachedHumanSupport,
  improveStaffDraft,
  runAssistant,
  resolveSupportAudience,
  setAdministratorRole,
  unbanUser,
  type AssistantHistoryMessage,
  type SupportTranscriptMessage,
} from "#services";
import {
  AppError,
  canManageBan,
  getPositiveIntegerEnv,
  isAdminRoles,
  isStaffRoles,
  isSuperAdminRoles,
  normalizeIpAddress,
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

const fullName = (user: Pick<IUser, "firstName" | "lastName">): string =>
  `${user.firstName} ${user.lastName}`.trim();

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

const serializeChat = (chat: HydratedDocument<ISupportChat>) => {
  const populatedUser =
    chat.user && typeof chat.user === "object" && "email" in chat.user
      ? (chat.user as unknown as IUser & { _id: unknown })
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

const endChatDocument = async (
  chat: HydratedDocument<ISupportChat>,
): Promise<boolean> => {
  const now = new Date();
  const deleteAfterEnd = !hasReachedHumanSupport(chat);
  chat.status = "ended";
  chat.assistantIdleExpiresAt = null;
  chat.endedAt = now;
  if (deleteAfterEnd) {
    await chat.deleteOne();
    return true;
  }
  const retentionDays = getPositiveIntegerEnv("SUPPORT_CHAT_RETENTION_DAYS", 90);
  chat.expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  await chat.save();
  return false;
};

const parseStaffCommand = async (
  message: string,
  actor: HydratedDocument<IUser>,
  locale: SupportChatLocale,
): Promise<string | null> => {
  if (!message.startsWith("/") || !isStaffRoles(actor.roles)) return null;

  const [command, emailValue, reasonValue] = message.trim().split(/\s+/, 3);
  const email = emailValue?.trim().toLowerCase();

  if (!email) {
    return localized(
      locale,
      "A user email is required after the command.",
      "Nach dem Befehl ist eine Benutzer-E-Mail-Adresse erforderlich.",
    );
  }

  const target = await User.findOne({ email });
  if (!target) {
    return localized(
      locale,
      `No user was found for ${email}.`,
      `Für ${email} wurde kein Benutzer gefunden.`,
    );
  }

  const actorInfo = { userId: String(actor._id), roles: actor.roles };

  if (command === "/ban" || command === "/confirm-ban") {
    if (
      !reasonValue ||
      !BAN_REASONS.includes(reasonValue as (typeof BAN_REASONS)[number])
    ) {
      return localized(
        locale,
        `Choose one ban reason: ${BAN_REASONS.join(", ")}.`,
        `Wähle einen Sperrgrund: ${BAN_REASONS.join(", ")}.`,
      );
    }
    if (!canManageBan(actor.roles, target.roles)) {
      throw new AppError("You cannot ban this account", 403);
    }
    if (command === "/ban") {
      return localized(
        locale,
        `Confirm banning ${target.email} for "${reasonValue}" by sending /confirm-ban ${target.email} ${reasonValue}.`,
        `Bestätige die Sperre von ${target.email} wegen „${reasonValue}“ mit /confirm-ban ${target.email} ${reasonValue}.`,
      );
    }
    const result = await banUser(target, reasonValue as (typeof BAN_REASONS)[number]);
    return localized(
      locale,
      `${target.email} was banned for “${reasonValue}”. ${result.sessionsRevoked} active session(s) were revoked.`,
      `${target.email} wurde wegen „${reasonValue}“ gesperrt. ${result.sessionsRevoked} aktive Sitzung(en) wurden beendet.`,
    );
  }

  if (command === "/unban" || command === "/confirm-unban") {
    if (!canManageBan(actor.roles, target.roles)) {
      throw new AppError("You cannot unban this account", 403);
    }
    if (!target.ban?.isBanned) {
      return localized(
        locale,
        `${target.email} is not currently banned.`,
        `${target.email} ist derzeit nicht gesperrt.`,
      );
    }
    if (command === "/unban") {
      return localized(
        locale,
        `Confirm removing the ban from ${target.email} by sending /confirm-unban ${target.email}.`,
        `Bestätige das Aufheben der Sperre von ${target.email} mit /confirm-unban ${target.email}.`,
      );
    }
    await unbanUser(target);
    return localized(
      locale,
      `${target.email} was unbanned and all ban metadata was cleared.`,
      `Die Sperre von ${target.email} wurde aufgehoben und alle Sperrdaten wurden gelöscht.`,
    );
  }

  if (
    command === "/promote" ||
    command === "/demote" ||
    command === "/confirm-promote" ||
    command === "/confirm-demote"
  ) {
    if (!isSuperAdminRoles(actor.roles)) {
      throw new AppError(
        "Only a super administrator can change administrator roles",
        403,
      );
    }
    const promote = command === "/promote" || command === "/confirm-promote";
    const confirmed = command === "/confirm-promote" || command === "/confirm-demote";
    if (!confirmed) {
      const confirmation = promote ? "/confirm-promote" : "/confirm-demote";
      return localized(
        locale,
        `Confirm this role change for ${target.email} by sending ${confirmation} ${target.email}.`,
        `Bestätige diese Rollenänderung für ${target.email} mit ${confirmation} ${target.email}.`,
      );
    }
    const result = await setAdministratorRole(actorInfo, target, promote);
    if (promote) {
      return localized(
        locale,
        `${target.email} is now an administrator. ${result.sessionsRevoked} active session(s) were revoked.`,
        `${target.email} ist jetzt Administrator. ${result.sessionsRevoked} aktive Sitzung(en) wurden beendet.`,
      );
    }
    return localized(
      locale,
      `${target.email} is no longer an administrator. ${result.sessionsRevoked} active session(s) were revoked.`,
      `${target.email} ist kein Administrator mehr. ${result.sessionsRevoked} aktive Sitzung(en) wurden beendet.`,
    );
  }

  if (command === "/user") {
    return localized(
      locale,
      `${fullName(target)} · ${target.email} · roles: ${target.roles.join(", ")} · banned: ${target.ban?.isBanned ? `yes (${target.ban.reason})` : "no"}`,
      `${fullName(target)} · ${target.email} · Rollen: ${target.roles.join(", ")} · gesperrt: ${target.ban?.isBanned ? `ja (${target.ban.reason})` : "nein"}`,
    );
  }

  return localized(
    locale,
    "Unknown command. Use /ban, /unban, /user, and—if you are a super admin—/promote or /demote.",
    "Unbekannter Befehl. Verwende /ban, /unban, /user und als Super-Admin zusätzlich /promote oder /demote.",
  );
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
      {
        sender: "ai",
        senderName: CHAT_WELCOME_SENDER,
        content: chatWelcomeMessage(locale),
        createdAt: new Date(),
      },
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
  const { history, locale, reason } = request.body as {
    history: AssistantHistoryMessage[];
    locale: SupportChatLocale;
    reason: SupportEscalationReason;
  };
  const firstUserMessage = history.find((item) => item.role === "user")?.content ?? "";
  const requiresSuperAdmin = supportRequiresSuperAdmin(reason, user.roles);
  const chat = await SupportChat.create({
    user: user._id,
    origin: isAdminRoles(user.roles) && !isSuperAdminRoles(user.roles) ? "admin" : "user",
    locale,
    subject: firstUserMessage.slice(0, 200),
    status: "open",
    assignedTo: null,
    assignedToName: null,
    escalationReason: reason,
    requiresSuperAdmin,
    lastAgent: "website-help",
    messages: [
      {
        sender: "ai",
        senderName: CHAT_WELCOME_SENDER,
        content: chatWelcomeMessage(locale),
        createdAt: new Date(),
      },
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
  chat.messages.push({
    sender: "user",
    senderName: "Guest",
    content: message,
    createdAt: new Date(),
  } as ISupportChat["messages"][number]);
  if (!chat.guestEmail) {
    chat.guestEmail = message.match(EMAIL_PATTERN)?.[0]?.toLowerCase() ?? null;
  }
  await chat.save();
  response.status(200).json({ success: true, data: { chat: serializeChat(chat) } });
};

export const endGuestChat: RequestHandler = async (request, response) => {
  const chat = await findGuestChat(request, String(request.params.id));
  let deleted = false;
  if (chat.status !== "ended") {
    chat.messages.push({
      sender: "system",
      senderName: null,
      content: systemMessage(chat.locale, "user-ended"),
      createdAt: new Date(),
    } as ISupportChat["messages"][number]);
    deleted = await endChatDocument(chat);
  } else if (!hasReachedHumanSupport(chat)) {
    await chat.deleteOne();
    deleted = true;
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
  const commandReply = await parseStaffCommand(message, user, locale);
  const assistant = commandReply
    ? {
        reply: commandReply,
        agent: "staff" as const,
        provider: "command",
        available: true,
        action: "reply" as const,
        escalationReason: null,
        requiresSuperAdmin: false,
        locale,
      }
    : await runAssistant(message, history, {
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
  const chat = await SupportChat.findOne({ _id: chatId, user: user._id });
  if (!chat) throw new AppError("Chat not found", 404);
  if (chat.status !== "open" && chat.status !== "active") {
    throw new AppError("This support chat is not accepting messages", 409);
  }

  const locale = resolveLocale(message, chat.locale ?? requestedLocale);
  chat.locale = locale;
  chat.messages.push({
    sender: "user",
    senderId: user._id,
    senderName: supportName(user),
    content: message,
    createdAt: new Date(),
  } as ISupportChat["messages"][number]);

  await chat.save();
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
  await chat.save();

  response.status(200).json({ success: true, data: { chat: serializeChat(chat) } });
};

export const endOwnChat: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  await closeInactiveAssistantChats({ _id: chatId, user: user._id });
  const chat = await SupportChat.findOne({ _id: chatId, user: user._id });
  if (!chat) throw new AppError("Chat not found", 404);
  let deleted = false;
  if (chat.status !== "ended") {
    chat.messages.push({
      sender: "system",
      senderName: null,
      content: systemMessage(chat.locale, "user-ended"),
      createdAt: new Date(),
    } as ISupportChat["messages"][number]);
    deleted = await endChatDocument(chat);
  } else if (!hasReachedHumanSupport(chat)) {
    await chat.deleteOne();
    deleted = true;
  }
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
  response.status(200).json({ success: true, data: { chat: serializeChat(chat) } });
};

const ensureStaffMayHandle = (
  chat: HydratedDocument<ISupportChat>,
  staff: HydratedDocument<IUser>,
): void => {
  if (chat.requiresSuperAdmin && !isSuperAdminRoles(staff.roles)) {
    throw new AppError("This chat requires a Super Support Agent", 403);
  }
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
    filter.$or = [
      {
        status: "open",
        assignedTo: null,
        requiresSuperAdmin: false,
        origin: { $in: ["user", "guest"] },
      },
      { staffParticipants: staff._id },
      { assignedTo: staff._id },
    ];
  }
  const [allChats, total] = await Promise.all([
    SupportChat.find(filter).populate(
      "user",
      "firstName lastName email roles profileImage ban createdAt updatedAt",
    ),
    SupportChat.countDocuments(filter),
  ]);
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
  const chats = allChats
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
  const staffName = supportName(staff);
  const superAdmin = isSuperAdminRoles(staff.roles);
  const pendingChat = await SupportChat.findById(chatId)
    .select("locale status assignedTo assignedToName requiresSuperAdmin origin")
    .lean();
  if (!pendingChat) throw new AppError("Chat not found", 404);

  const takingOver =
    superAdmin &&
    pendingChat.status === "active" &&
    String(pendingChat.assignedTo ?? "") !== String(staff._id);
  if (pendingChat.status !== "open" && !takingOver) {
    throw new AppError("This chat is unavailable or has already been joined", 409);
  }

  const filter: QueryFilter<ISupportChat> = takingOver
    ? {
        _id: chatId,
        status: "active",
        assignedTo: pendingChat.assignedTo,
      }
    : { _id: chatId, status: "open" };
  if (!superAdmin) {
    filter.requiresSuperAdmin = false;
    filter.origin = { $in: ["user", "guest"] };
  }

  const transitionMessages = takingOver
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
            takingOver && pendingChat.assignedTo
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

  await chat.populate(
    "user",
    "firstName lastName email roles profileImage ban createdAt updatedAt",
  );
  response.status(200).json({ success: true, data: { chat: serializeChat(chat) } });
};

const requireAssignedStaff = (
  chat: HydratedDocument<ISupportChat>,
  staff: HydratedDocument<IUser>,
): void => {
  ensureStaffMayHandle(chat, staff);
  if (chat.status !== "active" || String(chat.assignedTo) !== String(staff._id)) {
    throw new AppError("You must claim this chat before replying", 403);
  }
};

export const sendStaffMessage: RequestHandler = async (request, response) => {
  const staff = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  const chat = await SupportChat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  requireAssignedStaff(chat, staff);
  chat.messages.push({
    sender: "staff",
    senderId: staff._id,
    senderName: supportName(staff),
    content: (request.body as { message: string }).message,
    createdAt: new Date(),
  } as ISupportChat["messages"][number]);
  if (!chat.staffParticipants.some((id) => String(id) === String(staff._id))) {
    chat.staffParticipants.push(staff._id);
  }
  await chat.save();
  await chat.populate(
    "user",
    "firstName lastName email roles profileImage ban createdAt updatedAt",
  );
  response.status(200).json({ success: true, data: { chat: serializeChat(chat) } });
};

export const transferStaffChat: RequestHandler = async (request, response) => {
  const staff = await getCurrentUser(request);
  if (isSuperAdminRoles(staff.roles)) {
    throw new AppError("A Super Support Agent cannot transfer this chat upward", 400);
  }
  const chatId = validateObjectId(request.params.id, "chat");
  const chat = await SupportChat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  requireAssignedStaff(chat, staff);
  if (!chat.staffParticipants.some((id) => String(id) === String(staff._id))) {
    chat.staffParticipants.push(staff._id);
  }
  chat.status = "open";
  chat.assignedTo = null;
  chat.assignedToName = null;
  chat.requiresSuperAdmin = true;
  const staffName = supportName(staff);
  chat.messages.push(
    {
      sender: "system",
      senderName: null,
      content: systemMessage(chat.locale, "staff-left", staffName),
      createdAt: new Date(),
    } as ISupportChat["messages"][number],
    {
      sender: "system",
      senderName: null,
      content: systemMessage(chat.locale, "transferred", staffName),
      createdAt: new Date(),
    } as ISupportChat["messages"][number],
    {
      sender: "system",
      senderName: null,
      content: systemMessage(chat.locale, "waiting-super"),
      createdAt: new Date(),
    } as ISupportChat["messages"][number],
  );
  await chat.save();
  response.status(200).json({ success: true, data: { chat: serializeChat(chat) } });
};

export const endStaffChat: RequestHandler = async (request, response) => {
  const staff = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  const chat = await SupportChat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  requireAssignedStaff(chat, staff);
  chat.messages.push({
    sender: "system",
    senderName: null,
    content: systemMessage(chat.locale, "staff-ended", supportName(staff)),
    createdAt: new Date(),
  } as ISupportChat["messages"][number]);
  await endChatDocument(chat);
  await chat.populate(
    "user",
    "firstName lastName email roles profileImage ban createdAt updatedAt",
  );
  response.status(200).json({ success: true, data: { chat: serializeChat(chat) } });
};

export const getStaffSuggestions: RequestHandler = async (request, response) => {
  const staff = await getCurrentUser(request);
  const chatId = validateObjectId(request.params.id, "chat");
  const chat = await SupportChat.findById(chatId);
  if (!chat) throw new AppError("Chat not found", 404);
  requireAssignedStaff(chat, staff);
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
  requireAssignedStaff(chat, staff);
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
