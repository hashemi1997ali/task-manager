import type { RequestHandler } from "express";
import mongoose, { type HydratedDocument } from "mongoose";

import { detectMessageLocale, runTaskAgent } from "#ai";
import {
  AssistantConversation,
  Task,
  User,
  type IAssistantConversation,
  type IAssistantMessage,
  type IUser,
} from "#models";
import { AppError } from "#utils";

const validateObjectId = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new AppError(`Invalid ${label} ID`, 400);
  }
  return value;
};

const getCurrentUser = async (
  userId: string | undefined,
): Promise<HydratedDocument<IUser>> => {
  if (!userId) throw new AppError("Authentication required", 401);
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);
  if (user.ban?.isBanned) throw new AppError("Your account has been banned", 403);
  return user;
};

const serializeProposal = (proposal: IAssistantMessage["taskProposal"]) =>
  proposal
    ? {
        title: proposal.title,
        description: proposal.description,
        priority: proposal.priority,
        dueDate: proposal.dueDate,
        status: proposal.status,
        taskId: proposal.taskId ? String(proposal.taskId) : null,
      }
    : null;

const serializeConversation = (
  conversation: HydratedDocument<IAssistantConversation>,
) => ({
  id: String(conversation._id),
  locale: conversation.locale,
  subject: conversation.subject,
  messages: conversation.messages.map((message) => ({
    id: String(message._id),
    sender: message.sender,
    content: message.content,
    taskProposal: serializeProposal(message.taskProposal),
    createdAt: message.createdAt,
  })),
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

const loadTaskContext = async (userId: string) => {
  const tasks = await Task.find({ owner: userId })
    .select("title status priority dueDate")
    .sort({ status: 1, dueDate: 1, updatedAt: -1 })
    .limit(20)
    .lean();
  return tasks.map((task) => ({
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
  }));
};

const historyOf = (conversation: HydratedDocument<IAssistantConversation>) =>
  conversation.messages.slice(-30).map((message) => ({
    role: message.sender as "user" | "assistant",
    content: message.content,
  }));

export const listAssistantConversations: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request.user?.userId);
  const conversations = await AssistantConversation.find({ user: user._id })
    .sort({ updatedAt: -1 })
    .limit(50);
  response.status(200).json({
    success: true,
    data: { conversations: conversations.map(serializeConversation) },
  });
};

export const createAssistantConversation: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request.user?.userId);
  const { message, locale: requestedLocale } = request.body as {
    message: string;
    locale: "en" | "de";
  };
  const locale = detectMessageLocale(message, requestedLocale).locale;
  const result = await runTaskAgent({
    message,
    history: [],
    context: {
      roles: user.roles,
      authenticated: true,
      locale,
      userId: String(user._id),
    },
    getTaskContext: () => loadTaskContext(String(user._id)),
  });

  const conversation = await AssistantConversation.create({
    user: user._id,
    locale,
    subject: message.slice(0, 100),
    messages: [
      { sender: "user", content: message, createdAt: new Date() },
      {
        sender: "assistant",
        content: result.reply,
        taskProposal: result.proposal
          ? { ...result.proposal, status: "pending", taskId: null }
          : null,
        createdAt: new Date(),
      },
    ],
  });

  response.status(201).json({
    success: true,
    data: {
      conversation: serializeConversation(conversation),
      provider: result.provider,
    },
  });
};

export const sendAssistantMessage: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request.user?.userId);
  const conversationId = validateObjectId(request.params.id, "conversation");
  const { message, locale: requestedLocale } = request.body as {
    message: string;
    locale: "en" | "de";
  };
  const conversation = await AssistantConversation.findOne({
    _id: conversationId,
    user: user._id,
  });
  if (!conversation) throw new AppError("Conversation not found", 404);

  const locale = detectMessageLocale(
    message,
    conversation.locale ?? requestedLocale,
  ).locale;
  const history = historyOf(conversation);
  const result = await runTaskAgent({
    message,
    history,
    context: {
      roles: user.roles,
      authenticated: true,
      locale,
      userId: String(user._id),
    },
    getTaskContext: () => loadTaskContext(String(user._id)),
  });

  conversation.locale = locale;
  conversation.messages.push(
    { sender: "user", content: message, createdAt: new Date() } as IAssistantMessage,
    {
      sender: "assistant",
      content: result.reply,
      taskProposal: result.proposal
        ? { ...result.proposal, status: "pending", taskId: null }
        : null,
      createdAt: new Date(),
    } as IAssistantMessage,
  );
  await conversation.save();

  response.status(200).json({
    success: true,
    data: {
      conversation: serializeConversation(conversation),
      provider: result.provider,
    },
  });
};

export const confirmAssistantTask: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request.user?.userId);
  const conversationId = validateObjectId(request.params.id, "conversation");
  const messageId = validateObjectId(request.params.messageId, "message");

  const reserved = await AssistantConversation.findOneAndUpdate(
    {
      _id: conversationId,
      user: user._id,
      messages: {
        $elemMatch: {
          _id: messageId,
          sender: "assistant",
          "taskProposal.status": "pending",
        },
      },
    },
    { $set: { "messages.$[message].taskProposal.status": "creating" } },
    {
      new: true,
      arrayFilters: [{ "message._id": messageId }],
      runValidators: true,
    },
  );
  if (!reserved) {
    const exists = await AssistantConversation.exists({
      _id: conversationId,
      user: user._id,
    });
    if (!exists) throw new AppError("Conversation not found", 404);
    throw new AppError("This task proposal is no longer pending", 409);
  }

  const sourceMessage = reserved.messages.find(
    (message) => String(message._id) === messageId,
  );
  const proposal = sourceMessage?.taskProposal;
  if (!proposal) throw new AppError("Task proposal not found", 404);

  try {
    const task = await Task.create({
      owner: user._id,
      title: proposal.title,
      description: proposal.description,
      priority: proposal.priority,
      dueDate: proposal.dueDate,
      status: "todo",
      completedAt: null,
    });
    const conversation = await AssistantConversation.findOneAndUpdate(
      { _id: conversationId, user: user._id },
      {
        $set: {
          "messages.$[message].taskProposal.status": "created",
          "messages.$[message].taskProposal.taskId": task._id,
        },
      },
      { new: true, arrayFilters: [{ "message._id": messageId }] },
    );
    if (!conversation) throw new AppError("Conversation not found", 404);
    response.status(201).json({
      success: true,
      message: "Task created successfully",
      data: { conversation: serializeConversation(conversation), task },
    });
  } catch (error) {
    await AssistantConversation.updateOne(
      { _id: conversationId, user: user._id },
      { $set: { "messages.$[message].taskProposal.status": "pending" } },
      { arrayFilters: [{ "message._id": messageId }] },
    );
    throw error;
  }
};

export const dismissAssistantTask: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(request.user?.userId);
  const conversationId = validateObjectId(request.params.id, "conversation");
  const messageId = validateObjectId(request.params.messageId, "message");
  const conversation = await AssistantConversation.findOneAndUpdate(
    {
      _id: conversationId,
      user: user._id,
      messages: {
        $elemMatch: {
          _id: messageId,
          sender: "assistant",
          "taskProposal.status": "pending",
        },
      },
    },
    { $set: { "messages.$[message].taskProposal.status": "dismissed" } },
    {
      new: true,
      arrayFilters: [{ "message._id": messageId }],
      runValidators: true,
    },
  );
  if (!conversation) {
    const exists = await AssistantConversation.exists({
      _id: conversationId,
      user: user._id,
    });
    if (!exists) throw new AppError("Conversation not found", 404);
    throw new AppError("This task proposal is no longer pending", 409);
  }
  response.status(200).json({
    success: true,
    data: { conversation: serializeConversation(conversation) },
  });
};
