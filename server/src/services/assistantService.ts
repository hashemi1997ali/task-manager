/**
 * Backward-compatible facade over the modular AI system in `#ai`.
 *
 * The chat controller (and any other consumer) keeps importing `runAssistant`,
 * `createReplySuggestions`, and the `AssistantHistoryMessage` type from
 * `#services`. All logic now lives in the modular `src/ai/` architecture
 * (triage router, site guide, private request agent, staff workspace guide,
 * guardrails, providers, fallback, policies).
 *
 * This file intentionally contains no business logic — it only re-exports the
 * orchestrator API to preserve compatibility and minimise breaking changes.
 */

import {
  detectMessageLocale,
  generateReplySuggestions,
  rewriteStaffDraft,
  runOrchestrator,
  type AssistantContext,
  type AssistantHistoryMessage,
  type AssistantResult,
  type ReplyAgentId,
  type StaffWritingContext,
  type SupportTranscriptMessage,
} from "#ai";

export type {
  AssistantHistoryMessage,
  AssistantContext,
  AssistantResult,
  SupportTranscriptMessage,
};
export { detectMessageLocale };

/** Agent identifier surfaced to callers (kept as an alias for compatibility). */
export type AssistantAgent = ReplyAgentId;

/**
 * Runs a single assistant turn through the modular orchestrator.
 * Signature and return shape are unchanged from the original service.
 */
export const runAssistant = (
  message: string,
  history: AssistantHistoryMessage[],
  context: AssistantContext,
): Promise<AssistantResult> => runOrchestrator(message, history, context);

/** Generates three short staff reply suggestions for a support transcript. */
export const createReplySuggestions = (
  transcript: SupportTranscriptMessage[],
  context: StaffWritingContext,
): Promise<string[]> => generateReplySuggestions(transcript, context);

export const improveStaffDraft = (
  draft: string,
  transcript: SupportTranscriptMessage[],
  context: StaffWritingContext,
): Promise<string> => rewriteStaffDraft(draft, transcript, context);
