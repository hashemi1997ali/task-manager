/**
 * Core type definitions for the modular AI assistant system.
 *
 * The assistant is composed of four logical components:
 *  - Triage Router      (internal only, never replies to the user)
 *  - Website Help Agent  (public and signed-in website guidance)
 *  - Request Agent       (private support-ticket guidance and proposals)
 *  - Staff Workspace Guide (guidance only; no account data or mutations)
 * Provider unavailability is a fallback state, not an agent.
 *
 * Guardrails (Language, Scope, Permission, Output) are applied centrally
 * by the orchestrator before and after every agent invocation.
 */

/** Supported UI locales — the assistant must reply in one of these. */
export type AssistantLocale = "en" | "de";

/** Internal agent identifiers used for routing, logging and serialisation. */
export type AgentId = "triage-router" | "website-help" | "task" | "staff";

/**
 * The set of agent identifiers that can appear in a user-visible reply.
 * The triage router is intentionally excluded — it never produces a reply.
 */
export type ReplyAgentId = Exclude<AgentId, "triage-router">;

/** A single message in the conversation history sent to the LLM. */
export interface AssistantHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Context object passed to every agent and guardrail.
 * Mirrors the original `AssistantContext` shape so the public API stays
 * backward-compatible with `chatController`.
 */
export interface AssistantContext {
  /** Roles of the current user; empty array for guests. */
  roles: readonly string[];
  /** Whether the request comes from an authenticated session. */
  authenticated: boolean;
  /** Reply locale (en / de). */
  locale: AssistantLocale;
  /** MongoDB user id when authenticated, null for guests. */
  userId?: string | null;
}

export interface TaskContextItem {
  ticketNumber: string;
  title: string;
  status: "todo" | "in-progress" | "waiting-customer" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  category: "general" | "account" | "technical" | "billing" | "feature";
  dueDate: string | null;
  resolutionDueAt: string | null;
}

export interface TaskProposalDraft {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  category: "general" | "account" | "technical" | "billing" | "feature";
  dueDate: Date | null;
}

export interface TaskAssistantResult {
  reply: string;
  provider: string;
  proposal: TaskProposalDraft | null;
}

/** Result returned by the orchestrator to the caller (chatController). */
export type AssistantAction = "reply" | "escalate";

export type EscalationReason =
  | "account_banned"
  | "account_access"
  | "security"
  | "human_requested"
  | "permission"
  | "unresolved";

export interface AssistantResult {
  reply: string;
  agent: ReplyAgentId;
  provider: string;
  available: boolean;
  action: AssistantAction;
  escalationReason: EscalationReason | null;
  requiresSuperAdmin: boolean;
  locale: AssistantLocale;
}

/**
 * Internal routing decision produced by the Triage Router.
 * This is NEVER sent to the user — it only selects which agent runs next.
 */
export interface TriageDecision {
  agent: ReplyAgentId;
  /** Human-readable reason for logging / debugging. */
  reason: string;
  /** Whether the message was detected as out-of-scope. */
  outOfScope: boolean;
  /** Whether the message was detected as a non-supported language. */
  wrongLanguage: boolean;
}

/** Input passed to an agent's `run()` method. */
export interface AgentInput {
  message: string;
  history: AssistantHistoryMessage[];
  context: AssistantContext;
}

/** Output returned by an agent's `run()` method. */
export interface AgentOutput {
  reply: string;
  /** Whether the agent used an LLM or produced a static reply. */
  usedLlm: boolean;
  /** True only when no configured provider/model could produce a response. */
  unavailable?: boolean;
}

/** Configuration for a single LLM provider call. */
export interface ProviderCallConfig {
  systemPrompt: string;
  history: AssistantHistoryMessage[];
  message: string;
  temperature?: number;
  maxTokens?: number;
}

/** Result of a provider call. */
export interface ProviderCallResult {
  text: string;
  provider: string;
  model: string;
}

/** Guardrail verdict — if `blocked`, the reply is replaced by `replacement`. */
export interface GuardrailResult {
  passed: boolean;
  replacement?: string;
  reason?: string;
}
