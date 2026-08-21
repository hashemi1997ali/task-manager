import { model, Schema, type Types } from "mongoose";

import { TASK_PRIORITIES, type TaskPriority } from "./Task.ts";

export const ASSISTANT_CONVERSATION_LOCALES = ["en", "de"] as const;
export type AssistantConversationLocale = (typeof ASSISTANT_CONVERSATION_LOCALES)[number];

export const ASSISTANT_PROPOSAL_STATUSES = [
  "pending",
  "creating",
  "created",
  "dismissed",
] as const;
export type AssistantProposalStatus = (typeof ASSISTANT_PROPOSAL_STATUSES)[number];

export interface IAssistantTaskProposal {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: Date | null;
  status: AssistantProposalStatus;
  taskId: Types.ObjectId | null;
}

export interface IAssistantMessage {
  _id: Types.ObjectId;
  sender: "user" | "assistant";
  content: string;
  taskProposal: IAssistantTaskProposal | null;
  createdAt: Date;
}

export interface IAssistantConversation {
  user: Types.ObjectId;
  locale: AssistantConversationLocale;
  subject: string;
  messages: IAssistantMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const taskProposalSchema = new Schema<IAssistantTaskProposal>(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      required: true,
      default: "medium",
    },
    dueDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ASSISTANT_PROPOSAL_STATUSES,
      required: true,
      default: "pending",
    },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
  },
  { _id: false, versionKey: false },
);

const assistantMessageSchema = new Schema<IAssistantMessage>(
  {
    sender: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    taskProposal: {
      type: taskProposalSchema,
      default: null,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: true, versionKey: false },
);

const assistantConversationSchema = new Schema<IAssistantConversation>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    locale: {
      type: String,
      enum: ASSISTANT_CONVERSATION_LOCALES,
      required: true,
      default: "en",
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    messages: {
      type: [assistantMessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

assistantConversationSchema.index({ user: 1, updatedAt: -1 });

/**
 * Private task-assistant conversations live in a dedicated collection.
 * No staff router exposes this model; every query in the assistant controller
 * is scoped by both conversation id and the authenticated owner id.
 */
export const AssistantConversation = model<IAssistantConversation>(
  "AssistantConversation",
  assistantConversationSchema,
);
