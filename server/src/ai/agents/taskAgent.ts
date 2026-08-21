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

const GET_TASK_CONTEXT_TOOL: ProviderToolDefinition = {
  name: "get_task_context",
  description:
    "Get the signed-in user's current task titles, statuses, priorities, and due dates when they are needed to answer a planning question.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

const PROPOSE_TASK_TOOL: ProviderToolDefinition = {
  name: "propose_task",
  description:
    "Prepare exactly one task draft for explicit user confirmation. This does not create the task.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", minLength: 3, maxLength: 100 },
      description: { type: "string", maxLength: 2000 },
      priority: { type: "string", enum: ["low", "medium", "high"] },
      dueDate: {
        anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
      },
    },
    required: ["title", "description", "priority", "dueDate"],
    additionalProperties: false,
  },
};

const parseProposalToolCall = (calls: ProviderToolCall[]): TaskProposalDraft | null => {
  const call = calls.find((item) => item.name === PROPOSE_TASK_TOOL.name);
  if (!call || !call.arguments || typeof call.arguments !== "object") return null;
  const value = call.arguments as Record<string, unknown>;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const description =
    typeof value.description === "string" ? value.description.trim() : "";
  const priority =
    value.priority === "low" || value.priority === "medium" || value.priority === "high"
      ? value.priority
      : null;
  const dueDate =
    typeof value.dueDate === "string" && !Number.isNaN(Date.parse(value.dueDate))
      ? new Date(value.dueDate)
      : value.dueDate === null
        ? null
        : undefined;

  if (
    title.length < 3 ||
    title.length > 100 ||
    description.length > 2000 ||
    priority === null ||
    dueDate === undefined
  ) {
    return null;
  }
  return { title, description, priority, dueDate };
};

const taskContextText = (tasks: TaskContextItem[]): string =>
  tasks.length
    ? tasks
        .slice(0, 20)
        .map(
          (task) =>
            `- ${task.title} | ${task.status} | ${task.priority} | due ${task.dueDate ?? "none"}`,
        )
        .join("\n")
    : "- No existing tasks";

const buildPrompt = (context: AssistantContext): string => {
  const language = context.locale === "de" ? "German" : "English";
  return [
    `You are the private Karino Task Agent. Reply only in ${language}.`,
    "Be friendly, practical, concise, and supportive.",
    "Your only scope is the signed-in user's tasks: planning, prioritising, scheduling, productivity guidance, and proposing a new task.",
    "Respond naturally to brief greetings, thanks, farewells, and questions about your capabilities, then gently guide the conversation toward tasks and planning.",
    "Do not answer questions about accounts, login, bans, support, staff/admin features, website architecture, general knowledge, news, coding, medical, legal, or financial topics.",
    "If a request is outside task scope, politely say that this private assistant only helps with tasks and planning.",
    "You may use the task list below as context, but never claim to see anything else.",
    "Never edit, delete, complete, or create a task directly.",
    "Call get_task_context only when current tasks are needed to answer the request.",
    "When the user clearly asks to create a task, call propose_task exactly once and ask them to review and confirm the returned draft.",
    "Never print tool arguments or a task-proposal JSON object in the conversational reply.",
    "Do not say a task was created. The application creates it only after a separate user confirmation.",
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
    tools: [GET_TASK_CONTEXT_TOOL, PROPOSE_TASK_TOOL],
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
    result.toolCalls.some((call) => call.name === GET_TASK_CONTEXT_TOOL.name)
  ) {
    const tasks = await getTaskContext();
    result = await runProviders({
      systemPrompt: [
        systemPrompt,
        "The backend executed get_task_context. Use this trusted result to answer the original request:",
        taskContextText(tasks),
      ].join("\n"),
      history,
      message,
      temperature: 0.2,
      maxTokens: 700,
      tools: [PROPOSE_TASK_TOOL],
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
      "Review this task draft and confirm it when you are ready.",
      "Prüfe diesen Aufgabenentwurf und bestätige ihn, wenn du bereit bist.",
    );
  }
  if (!reply) {
    reply = localised(
      context.locale,
      "I could not complete that request. Please rephrase it and try again.",
      "Ich konnte diese Anfrage nicht abschließen. Bitte formuliere sie neu und versuche es erneut.",
    );
  }

  const guard = outputGuardrail(reply, context);
  const safeReply = guard.passed
    ? reply
    : localised(
        context.locale,
        "I can prepare a task draft, but I need your confirmation before it is created.",
        "Ich kann einen Aufgabenentwurf vorbereiten, benötige aber deine Bestätigung, bevor er erstellt wird.",
      );

  return {
    reply: isStronglyMixedLanguage(safeReply)
      ? localised(
          context.locale,
          "I can help you plan, prioritise, or create a task draft.",
          "Ich kann dir beim Planen, Priorisieren oder Erstellen eines Aufgabenentwurfs helfen.",
        )
      : safeReply,
    provider: result.provider,
    proposal,
  };
};
