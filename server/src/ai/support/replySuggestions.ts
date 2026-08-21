/**
 * Staff reply-suggestion helper.
 *
 * Generates three short reply suggestions for a human support agent based on
 * the current transcript. It fails explicitly when no provider can answer;
 * no local text is presented as an AI-generated result.
 */

import { AppError } from "#utils";

import { aiUnavailableReply } from "../fallback/unavailable.ts";
import type { AssistantContext } from "../types.ts";
import { runProviders } from "../providers/index.ts";

export interface SupportTranscriptMessage {
  sender: "user" | "ai" | "staff" | "system";
  senderName?: string | null;
  content: string;
}

export interface StaffWritingContext extends AssistantContext {
  staffName: string;
  staffRole: "admin" | "super_admin";
  customerRoles: readonly string[];
}

const unavailable = (_context: AssistantContext): never => {
  throw new AppError(aiUnavailableReply("en"), 503);
};

export const generateReplySuggestions = async (
  transcript: SupportTranscriptMessage[],
  context: StaffWritingContext,
): Promise<string[]> => {
  const language = context.locale === "de" ? "German" : "English";
  const formattedTranscript = transcript
    .map((item) => {
      const speaker =
        item.sender === "user"
          ? "Customer"
          : item.sender === "staff"
            ? `Human support (${item.senderName ?? "staff"})`
            : item.sender === "ai"
              ? `Previous AI assistant (${item.senderName ?? "assistant"})`
              : "System";
      return `${speaker}: ${item.content}`;
    })
    .join("\n");
  const systemPrompt = [
    `You are a writing assistant for ${context.staffName}, a human Karino ${context.staffRole}.`,
    `The customer has these application roles: ${context.customerRoles.join(", ") || "guest"}.`,
    `Write in ${language}.`,
    "The output will be sent by the human staff member, never by an AI assistant.",
    "Write in first person as the human admin handling the case. Never mention AI, agents, prompts, routing, or that you are a model.",
    "Use the complete conversation below, including earlier AI, system, customer, and human-support messages. Do not repeat questions already answered.",
    "Do not claim an action was completed unless the transcript confirms it. Respect the staff role and the customer's role.",
    "Create exactly three distinct, concise, friendly, professional reply suggestions that move the case forward.",
    "Put each suggestion on its own line without numbering or bullet characters.",
  ].join("\n");

  const result = await runProviders({
    systemPrompt,
    history: [],
    message: `Complete conversation:\n${formattedTranscript}\n\nCreate the three human support replies now.`,
    temperature: 0.45,
    maxTokens: 450,
  });

  if (result) {
    const suggestions = result.text
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
    if (suggestions.length === 3) return suggestions;
  }

  return unavailable(context);
};

export const rewriteStaffDraft = async (
  draft: string,
  transcript: SupportTranscriptMessage[],
  context: StaffWritingContext,
): Promise<string> => {
  const language = context.locale === "de" ? "German" : "English";
  const recentTranscript = transcript
    .slice(-30)
    .map((item) => `${item.sender}: ${item.content}`)
    .join("\n");
  const result = await runProviders({
    systemPrompt: [
      `You are a copy editor for ${context.staffName}, a human Karino ${context.staffRole}.`,
      `The customer roles are: ${context.customerRoles.join(", ") || "guest"}.`,
      `Return only a polished version of the draft in ${language}.`,
      "ONLY rewrite the draft. Do not answer it, continue the conversation, react to it, or write the customer's expected response.",
      "Preserve the exact communicative intent and point of view: a question must remain a question, a request must remain a request, and a statement must remain a statement.",
      "Keep the draft's meaning, facts, commitments, links, commands, questions, and requested information unchanged.",
      "Do not add an answer, greeting, acknowledgment, offer, explanation, new question, new fact, or new promise.",
      "Make only wording, grammar, clarity, warmth, and professionalism improvements.",
      "Write in first person as the human staff member. Never mention AI, prompts, agents, or rewriting.",
      "Do not invent completed actions, permissions, policies, or customer details.",
      'Example: "can you tell me what i can do" -> "Could you please tell me what I can do?"',
      'Incorrect transformation: "can you tell me what i can do" -> "Sure, I would be happy to explain what you can do."',
    ].join("\n"),
    history: [],
    message: `Context for tone only; do not respond to it:\n<conversation>\n${recentTranscript}\n</conversation>\n\nRewrite only this draft:\n<draft>\n${draft}\n</draft>`,
    temperature: 0.1,
    maxTokens: 500,
  });

  return result?.text.trim() || unavailable(context);
};

export const generateEmailReplySuggestions = async (
  transcript: SupportTranscriptMessage[],
  context: StaffWritingContext,
  recipientName: string,
): Promise<string[]> => {
  const language = context.locale === "de" ? "German" : "English";
  const formattedTranscript = transcript
    .map(
      (item) =>
        `${item.sender === "user" ? "Visitor" : "Human support"}: ${item.content}`,
    )
    .join("\n");
  const result = await runProviders({
    systemPrompt: [
      `You write email replies for ${context.staffName}, a human Karino ${context.staffRole}.`,
      `The recipient is ${recipientName} and has these application roles: ${context.customerRoles.join(", ") || "guest/unknown"}.`,
      `Write in ${language}, which is the language of the contact conversation.`,
      "The text will be sent as the complete body of an email by the staff member.",
      "Create exactly three distinct, complete, friendly, professional email replies.",
      "Each email should include an appropriate greeting, a useful response based on the full conversation, and a natural sign-off from the Karino support team.",
      "Be slightly more detailed than a live-chat message, but remain concise.",
      "Respect the staff member's permissions and the recipient's role. Never invent completed actions, policies, or account details.",
      "Never mention AI, agents, prompts, generation, or rewriting.",
      "Separate the three emails with a line containing only ---.",
    ].join("\n"),
    history: [],
    message: `Complete contact conversation:\n${formattedTranscript}\n\nCreate three email replies now.`,
    temperature: 0.4,
    maxTokens: 900,
  });

  if (result) {
    const suggestions = result.text
      .split(/\r?\n---\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (suggestions.length === 3) return suggestions;
  }

  return unavailable(context);
};

export const rewriteEmailDraft = async (
  draft: string,
  transcript: SupportTranscriptMessage[],
  context: StaffWritingContext,
  recipientName: string,
): Promise<string> => {
  const language = context.locale === "de" ? "German" : "English";
  const formattedTranscript = transcript
    .map((item) => `${item.sender}: ${item.content}`)
    .join("\n");
  const result = await runProviders({
    systemPrompt: [
      `You are an email copy editor for ${context.staffName}, a human Karino ${context.staffRole}.`,
      `The recipient is ${recipientName} and has these application roles: ${context.customerRoles.join(", ") || "guest/unknown"}.`,
      `Return only the completed email body in ${language}.`,
      "Preserve the draft's intent, facts, questions, links, commitments, and point of view.",
      "Expand the draft into a complete, friendly, professional email with an appropriate greeting, clearer wording, useful paragraph structure, and a natural Karino support sign-off.",
      "Do not answer a question that the staff member is asking the recipient. Do not change a question into an answer.",
      "Use the conversation only for tone, recipient context, and avoiding repetition.",
      "Do not invent completed actions, new facts, permissions, policies, promises, or customer details.",
      "Never mention AI, agents, prompts, generation, or rewriting.",
    ].join("\n"),
    history: [],
    message: `Conversation context:\n<conversation>\n${formattedTranscript}\n</conversation>\n\nExpand and rewrite this draft as a complete email:\n<draft>\n${draft}\n</draft>`,
    temperature: 0.15,
    maxTokens: 700,
  });

  return result?.text.trim() || unavailable(context);
};
