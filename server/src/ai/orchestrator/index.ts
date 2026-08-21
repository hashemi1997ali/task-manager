/**
 * Orchestrator.
 *
 * Wires inbound guardrails, language-safe agent routing, deterministic and
 * agent-requested escalation, and outbound guardrails into one entry point.
 */

import type {
  AgentInput,
  AssistantContext,
  AssistantHistoryMessage,
  AssistantResult,
  EscalationReason,
  ReplyAgentId,
} from "../types.ts";
import { AGENTS } from "../agents/index.ts";
import { UNAVAILABLE_PROVIDER } from "../agents/base.ts";
import { outputGuardrail } from "../guardrails/index.ts";
import {
  aiUnavailableReply,
  outOfScopeReply,
  unsupportedLanguageReply,
} from "../fallback/unavailable.ts";
import { isStronglyMixedLanguage } from "../language.ts";
import { getConfiguredProviderName } from "../providers/index.ts";
import { resolveRoleTier } from "../policies/index.ts";
import { triage } from "./triage.ts";

interface EscalationDecision {
  reason: EscalationReason;
  requiresSuperAdmin: boolean;
}

const BANNED_PATTERN =
  /\b(banned|blocked|locked|suspended|ban(?:ned)? account|gesperrt|gebannt|blockiert|konto(?: ist)? gesperrt)\b/i;
const SECURITY_PATTERN =
  /\b(hacked|unauthori[sz]ed|stolen account|suspicious session|security issue|gehackt|unbefugt|verdächtige sitzung|sicherheitsproblem)\b/i;
const HUMAN_PATTERN =
  /\b(human support|real person|support agent|live support|talk to (?:a )?human|menschlicher support|echter mensch|mitarbeiter|supportmitarbeiter)\b/i;
const ACCESS_PATTERN =
  /\b(cannot log in|can't log in|unable to log in|account access|login problem|komme nicht rein|kann mich nicht anmelden|anmeldeproblem|kontozugriff)\b/i;
const ACCOUNT_PATTERN =
  /\b(account|profile|password|email change|session|device|konto|profil|passwort|e-mail ändern|sitzung|gerät)\b/i;

const deterministicEscalation = (
  message: string,
  context: AssistantContext,
): EscalationDecision | null => {
  const tier = resolveRoleTier(context);
  if (tier === "guest" || tier === "super_admin") return null;
  if (tier === "admin") {
    return HUMAN_PATTERN.test(message)
      ? { reason: "human_requested", requiresSuperAdmin: true }
      : null;
  }
  if (BANNED_PATTERN.test(message)) {
    return { reason: "account_banned", requiresSuperAdmin: true };
  }
  if (SECURITY_PATTERN.test(message)) {
    return { reason: "security", requiresSuperAdmin: true };
  }
  if (HUMAN_PATTERN.test(message)) {
    return { reason: "human_requested", requiresSuperAdmin: false };
  }
  if (ACCESS_PATTERN.test(message)) {
    return { reason: "account_access", requiresSuperAdmin: false };
  }
  if (ACCOUNT_PATTERN.test(message)) {
    return { reason: "account_access", requiresSuperAdmin: false };
  }
  return null;
};

const ESCALATION_MARKER =
  /^\s*\[ESCALATE:(account_banned|account_access|security|human_requested|permission|unresolved)\]\s*/i;

const parseEscalationMarker = (
  reply: string,
): { reply: string; decision: EscalationDecision | null } => {
  const match = reply.match(ESCALATION_MARKER);
  if (!match) return { reply, decision: null };
  const reason = match[1]?.toLowerCase() as EscalationReason;
  return {
    reply: reply.replace(ESCALATION_MARKER, "").trim(),
    decision: {
      reason,
      requiresSuperAdmin: reason === "account_banned" || reason === "security",
    },
  };
};

export const runOrchestrator = async (
  message: string,
  history: AssistantHistoryMessage[],
  context: AssistantContext,
): Promise<AssistantResult> => {
  const decision = triage(message, context);
  const input: AgentInput = { message, history, context };

  if (decision.wrongLanguage) {
    return finalize(
      unsupportedLanguageReply(context.locale),
      "website-help",
      UNAVAILABLE_PROVIDER,
      true,
      context,
      null,
    );
  }
  if (decision.outOfScope) {
    return finalize(
      outOfScopeReply(context.locale),
      "website-help",
      UNAVAILABLE_PROVIDER,
      true,
      context,
      null,
    );
  }

  const agent = AGENTS[decision.agent];
  if (!agent) {
    return finalize(
      aiUnavailableReply(context.locale),
      decision.agent,
      UNAVAILABLE_PROVIDER,
      false,
      context,
      deterministicEscalation(message, context),
    );
  }

  const output = await agent.run(input);
  const provider = output.usedLlm ? getConfiguredProviderName() : UNAVAILABLE_PROVIDER;
  const available = output.unavailable !== true;
  const agentId: ReplyAgentId = decision.agent;
  const marked = parseEscalationMarker(output.reply);
  const tier = resolveRoleTier(context);
  const markedEscalation = tier === "user" || tier === "admin" ? marked.decision : null;
  const escalation = deterministicEscalation(message, context) ?? markedEscalation;

  return finalize(marked.reply, agentId, provider, available, context, escalation);
};

const finalize = (
  reply: string,
  agent: ReplyAgentId,
  provider: string,
  available: boolean,
  context: AssistantContext,
  escalation: EscalationDecision | null,
): AssistantResult => {
  const guard = outputGuardrail(reply, context);
  let safeReply = guard.passed ? reply : (guard.replacement ?? reply);

  if (!safeReply.trim()) {
    safeReply = escalation
      ? context.locale === "de"
        ? "Für diese Anfrage ist Live-Support verfügbar."
        : "Live support is available for this request."
      : aiUnavailableReply(context.locale);
  }

  // A mixed bilingual answer is replaced with a locale-safe fallback instead
  // of showing two languages in one bubble.
  if (isStronglyMixedLanguage(safeReply)) {
    safeReply =
      context.locale === "de"
        ? "Ich helfe dir auf Deutsch weiter. Beschreibe bitte kurz, was du in Karino tun möchtest."
        : "I’ll continue in English. Please briefly describe what you want to do in Karino.";
  }

  return {
    reply: safeReply,
    agent,
    provider,
    available,
    action: escalation ? "escalate" : "reply",
    escalationReason: escalation?.reason ?? null,
    requiresSuperAdmin: escalation?.requiresSuperAdmin ?? false,
    locale: context.locale,
  };
};
