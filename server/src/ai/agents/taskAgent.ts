import { outputGuardrail } from "../guardrails/index.ts";
import { aiUnavailableReply } from "../fallback/unavailable.ts";
import { isStronglyMixedLanguage } from "../language.ts";
import {
  runProviders,
  type ProviderToolCall,
  type ProviderToolDefinition,
} from "../providers/index.ts";
import type {
  AssistantContext,
  AssistantHistoryMessage,
  TaskAssistantResult,
  TaskContextItem,
  TaskProposalDraft,
} from "../types.ts";
import { UNAVAILABLE_PROVIDER } from "./base.ts";

const localised = (locale: "en" | "de", english: string, german: string): string =>
  locale === "de" ? german : english;

const GET_TICKET_CONTEXT_TOOL: ProviderToolDefinition = {
  name: "get_ticket_context",
  description:
    "Get the signed-in customer's current private support tickets when they are needed to understand or avoid duplicating a request.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

const PROPOSE_TICKET_TOOL: ProviderToolDefinition = {
  name: "propose_ticket",
  description:
    "Prepare exactly one private support-ticket draft for explicit customer confirmation. This never creates the ticket itself.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", minLength: 3, maxLength: 100 },
      description: { type: "string", maxLength: 2000 },
      priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
      category: {
        type: "string",
        enum: ["general", "account", "technical", "billing", "feature"],
      },
      dueDate: {
        anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
      },
    },
    required: ["title", "description", "priority", "category", "dueDate"],
    additionalProperties: false,
  },
};

const parseProposalToolCall = (calls: ProviderToolCall[]): TaskProposalDraft | null => {
  const call = calls.find((item) => item.name === PROPOSE_TICKET_TOOL.name);
  if (!call || !call.arguments || typeof call.arguments !== "object") return null;
  const value = call.arguments as Record<string, unknown>;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const description =
    typeof value.description === "string" ? value.description.trim() : "";
  const priority =
    value.priority === "low" ||
    value.priority === "medium" ||
    value.priority === "high" ||
    value.priority === "urgent"
      ? value.priority
      : null;
  const category =
    value.category === "general" ||
    value.category === "account" ||
    value.category === "technical" ||
    value.category === "billing" ||
    value.category === "feature"
      ? value.category
      : null;
  const dueDate =
    typeof value.dueDate === "string" &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value.dueDate) &&
    !Number.isNaN(Date.parse(value.dueDate))
      ? new Date(value.dueDate)
      : value.dueDate === null
        ? null
        : undefined;

  if (
    title.length < 3 ||
    title.length > 100 ||
    description.length > 2000 ||
    priority === null ||
    category === null ||
    dueDate === undefined
  ) {
    return null;
  }
  return { title, description, priority, category, dueDate };
};

const taskContextText = (tasks: TaskContextItem[]): string =>
  tasks.length
    ? tasks
        .slice(0, 20)
        .map(
          (task) =>
            `- ${task.ticketNumber} | ${task.title} | ${task.status} | ${task.priority} | ${task.category} | requested ${task.dueDate ?? "none"} | SLA resolution ${task.resolutionDueAt ?? "none"}`,
        )
        .join("\n")
    : "- No existing tickets";

const buildPrompt = (context: AssistantContext): string => {
  const language = context.locale === "de" ? "German" : "English";
  return [
    `You are the private Karino Desk Request Assistant. Reply only in ${language}.`,
    "Be calm, empathetic, concise, and precise.",
    "Your only scope is helping the signed-in customer describe, categorise, prioritise, and submit a private support request, or understand the status of their own tickets.",
    "Respond naturally to brief greetings, thanks, farewells, and capability questions, then guide the customer toward a clear support request.",
    "Account access, login, billing, feature requests, and technical problems are valid ticket topics: understand them, ask only useful clarifying questions, and prepare a draft when requested.",
    "Do not perform account actions, troubleshoot beyond verified Karino information, promise a resolution, expose staff/admin features, or answer unrelated general knowledge, news, coding, medical, legal, or financial questions.",
    "If a request is outside ticket scope, politely say that this private assistant only helps prepare and review Karino support requests.",
    "You may use the private ticket list returned by the tool as context, but never claim to see anything else.",
    "Never edit, delete, resolve, assign, or create a ticket directly.",
    "Call get_ticket_context only when the customer's existing tickets are needed to answer the request.",
    "When the customer clearly wants to submit a request, call propose_ticket exactly once. Choose urgent only for a credible immediate security, access, or service-blocking incident.",
    "A dueDate is the customer's requested deadline, not the internal SLA deadline. Use null unless the customer provided a clear date and time.",
    "Never print tool arguments or a ticket-proposal JSON object in the conversational reply.",
    "Do not say a ticket was created. The application creates it only after a separate explicit customer confirmation.",
    `Current UTC date: ${new Date().toISOString()}.`,
  ].join("\n");
};

export const runTaskAgent = async ({
  message,
  history,
  context,
  getTaskContext,
}: {
  message: string;
  history: AssistantHistoryMessage[];
  context: AssistantContext;
  getTaskContext: () => Promise<TaskContextItem[]>;
}): Promise<TaskAssistantResult> => {
  const systemPrompt = buildPrompt(context);
  let result = await runProviders({
    systemPrompt,
    history,
    message,
    temperature: 0.2,
    maxTokens: 700,
    tools: [GET_TICKET_CONTEXT_TOOL, PROPOSE_TICKET_TOOL],
  });

  if (!result) {
    return {
      reply: aiUnavailableReply(context.locale),
      provider: UNAVAILABLE_PROVIDER,
      proposal: null,
    };
  }

  let proposal = parseProposalToolCall(result.toolCalls);
  if (
    !proposal &&
    result.toolCalls.some((call) => call.name === GET_TICKET_CONTEXT_TOOL.name)
  ) {
    const tasks = await getTaskContext();
    result = await runProviders({
      systemPrompt: [
        systemPrompt,
        "The backend executed get_ticket_context. Use this trusted private result to answer the original request:",
        taskContextText(tasks),
      ].join("\n"),
      history,
      message,
      temperature: 0.2,
      maxTokens: 700,
      tools: [PROPOSE_TICKET_TOOL],
    });
    if (!result) {
      return {
        reply: aiUnavailableReply(context.locale),
        provider: UNAVAILABLE_PROVIDER,
        proposal: null,
      };
    }
    proposal = parseProposalToolCall(result.toolCalls);
  }

  let reply = result.text.trim();
  if (proposal && !reply) {
    reply = localised(
      context.locale,
      "Review this ticket draft and confirm it when you are ready.",
      "Prüfe diesen Ticketentwurf und bestätige ihn, wenn du bereit bist.",
    );
  }
  if (!reply) {
    return {
      reply: aiUnavailableReply(context.locale),
      provider: UNAVAILABLE_PROVIDER,
      proposal: null,
    };
  }

  const guard = outputGuardrail(reply, context);
  const safeReply = guard.passed
    ? reply
    : localised(
        context.locale,
        "I can prepare a ticket draft, but I need your confirmation before it is created.",
        "Ich kann einen Ticketentwurf vorbereiten, benötige aber deine Bestätigung, bevor er erstellt wird.",
      );

  return {
    reply: isStronglyMixedLanguage(safeReply)
      ? localised(
          context.locale,
          "I can help you describe, prioritise, or prepare a support-ticket draft.",
          "Ich kann dir helfen, eine Support-Anfrage zu beschreiben, zu priorisieren oder als Ticketentwurf vorzubereiten.",
        )
      : safeReply,
    provider: result.provider,
    proposal,
  };
};
