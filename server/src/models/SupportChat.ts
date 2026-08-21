import { model, Schema, type Types } from "mongoose";

export const SUPPORT_CHAT_STATUSES = ["assistant", "open", "active", "ended"] as const;
export type SupportChatStatus = (typeof SUPPORT_CHAT_STATUSES)[number];

export const SUPPORT_CHAT_ORIGINS = ["user", "admin", "guest"] as const;
export type SupportChatOrigin = (typeof SUPPORT_CHAT_ORIGINS)[number];

export const SUPPORT_CHAT_LOCALES = ["en", "de"] as const;
export type SupportChatLocale = (typeof SUPPORT_CHAT_LOCALES)[number];

export const SUPPORT_MESSAGE_SENDERS = ["user", "ai", "staff", "system"] as const;
export type SupportMessageSender = (typeof SUPPORT_MESSAGE_SENDERS)[number];

export const SUPPORT_ESCALATION_REASONS = [
  "account_banned",
  "account_access",
  "security",
  "human_requested",
  "permission",
  "unresolved",
] as const;
export type SupportEscalationReason = (typeof SUPPORT_ESCALATION_REASONS)[number];

export interface ISupportMessage {
  _id: Types.ObjectId;
  sender: SupportMessageSender;
  senderId?: Types.ObjectId | null;
  senderName: string | null;
  content: string;
  createdAt: Date;
}

export interface ISupportRating {
  score: number;
  reason: string;
}

export interface ISupportChat {
  user: Types.ObjectId | null;
  ticket: Types.ObjectId | null;
  origin: SupportChatOrigin;
  locale: SupportChatLocale;
  subject: string;
  status: SupportChatStatus;
  assignedTo: Types.ObjectId | null;
  staffParticipants: Types.ObjectId[];
  assignedToName: string | null;
  requiresSuperAdmin: boolean;
  escalationReason: SupportEscalationReason | null;
  lastAgent: string | null;
  guestId: string | null;
  guestTokenHash?: string;
  guestEmail: string | null;
  guestIpAddress: string | null;
  guestUserAgent: string | null;
  messages: ISupportMessage[];
  rating: ISupportRating | null;
  assistantIdleExpiresAt: Date | null;
  endedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const supportMessageSchema = new Schema<ISupportMessage>(
  {
    sender: {
      type: String,
      enum: SUPPORT_MESSAGE_SENDERS,
      required: true,
    },
    senderName: {
      type: String,
      maxlength: 120,
      default: null,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: true, versionKey: false },
);

const supportChatSchema = new Schema<ISupportChat>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    ticket: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true,
    },
    origin: {
      type: String,
      enum: SUPPORT_CHAT_ORIGINS,
      required: true,
      default: "user",
    },
    locale: {
      type: String,
      enum: SUPPORT_CHAT_LOCALES,
      required: true,
      default: "en",
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    status: {
      type: String,
      enum: SUPPORT_CHAT_STATUSES,
      required: true,
      default: "assistant",
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    staffParticipants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    assignedToName: {
      type: String,
      maxlength: 120,
      default: null,
    },
    requiresSuperAdmin: {
      type: Boolean,
      required: true,
      default: false,
    },
    escalationReason: {
      type: String,
      enum: SUPPORT_ESCALATION_REASONS,
      default: null,
    },
    lastAgent: {
      type: String,
      maxlength: 80,
      default: null,
    },
    guestId: {
      type: String,
      maxlength: 80,
      default: null,
    },
    guestTokenHash: {
      type: String,
      maxlength: 128,
      select: false,
      default: undefined,
    },
    guestEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: null,
    },
    guestIpAddress: {
      type: String,
      maxlength: 128,
      default: null,
    },
    guestUserAgent: {
      type: String,
      maxlength: 512,
      default: null,
    },
    messages: {
      type: [supportMessageSchema],
      default: [],
    },
    rating: {
      type: new Schema<ISupportRating>(
        {
          score: { type: Number, required: true, min: 1, max: 5 },
          reason: { type: String, trim: true, maxlength: 1000, default: "" },
        },
        { _id: false },
      ),
      default: null,
    },
    assistantIdleExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

supportChatSchema.pre("validate", function validateOwner() {
  if (this.origin === "guest") {
    if (this.user) this.invalidate("user", "Guest chats cannot have a user owner");
    if (this.isNew && (!this.guestId || !this.guestTokenHash)) {
      this.invalidate("guestId", "Guest identity is required");
    }
    return;
  }

  if (!this.user) this.invalidate("user", "Authenticated chats require a user owner");
});

supportChatSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: "date" } } },
);
supportChatSchema.index({ user: 1, updatedAt: -1 });
supportChatSchema.index({ ticket: 1, updatedAt: -1 });
supportChatSchema.index(
  { ticket: 1 },
  {
    name: "unique_active_ticket_chat",
    unique: true,
    partialFilterExpression: {
      ticket: { $type: "objectId" },
      status: { $in: ["open", "active"] },
    },
  },
);
supportChatSchema.index({ status: 1, requiresSuperAdmin: 1, updatedAt: -1 });
supportChatSchema.index({ status: 1, assistantIdleExpiresAt: 1 });
supportChatSchema.index(
  { guestTokenHash: 1 },
  { unique: true, partialFilterExpression: { guestTokenHash: { $type: "string" } } },
);
supportChatSchema.index({ guestId: 1, updatedAt: -1 });

export const SupportChat = model<ISupportChat>("SupportChat", supportChatSchema);
