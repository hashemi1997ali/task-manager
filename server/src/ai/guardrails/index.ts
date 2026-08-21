/**
 * Centralised guardrails for the AI assistant.
 *
 * Every guardrail is a pure function that inspects either the inbound user
 * message or the outbound agent reply and returns a {@link GuardrailResult}.
 *
 * The four guardrail categories required by the specification:
 *
 *  1. Language  – only English and German are supported.
 *  2. Scope     – only Karino topics are in scope.
 *  3. Permission– the AI must never claim an action succeeded unless the
 *                 backend actually executed it (enforced via output check).
 *  4. Output    – no hallucinated confirmations, no leaked system prompts.
 */

import type { AssistantContext, AssistantLocale, GuardrailResult } from "../types.ts";

/* -------------------------------------------------------------------------- */
/*  Language guardrail                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Detects whether the user message is written in a language other than
 * English or German. We deliberately use only a conservative Unicode-script
 * signal; vocabulary-density checks reject valid terse support descriptions
 * such as product names, error codes, and technical symptoms.
 *
 * If the message is clearly in another script (Cyrillic, CJK, Arabic, …),
 * the guardrail flags it so the orchestrator can return a provider-backed
 * safe reply or the explicit disabled-assistance state.
 */

/**
 * Unicode script ranges for scripts we do NOT support.
 * If a significant portion of the message falls into these ranges the
 * language guardrail rejects it.
 */
const NON_LATIN_SCRIPT_RANGES: Array<[number, number]> = [
  [0x0400, 0x04ff], // Cyrillic
  [0x0530, 0x058f], // Armenian
  [0x0590, 0x05ff], // Hebrew
  [0x0600, 0x06ff], // Arabic
  [0x0750, 0x077f], // Arabic Supplement
  [0x0900, 0x097f], // Devanagari
  [0x0980, 0x09ff], // Bengali
  [0x0a00, 0x0a7f], // Gurmukhi
  [0x0e00, 0x0e7f], // Thai
  [0x1100, 0x11ff], // Hangul Jamo
  [0x3040, 0x309f], // Hiragana
  [0x30a0, 0x30ff], // Katakana
  [0x3400, 0x9fff], // CJK Unified Ideographs
  [0xac00, 0xd7af], // Hangul Syllables
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
];

const isNonLatinChar = (code: number): boolean =>
  NON_LATIN_SCRIPT_RANGES.some(([low, high]) => code >= low && code <= high);

/**
 * Returns `true` when the message appears to be in a language we do not
 * support (i.e. neither English nor German).
 */
export const detectWrongLanguage = (message: string): boolean => {
  const trimmed = message.trim();
  if (!trimmed) return false;

  let nonLatinCount = 0;
  let totalLetters = 0;

  for (const char of trimmed) {
    const code = char.codePointAt(0) ?? 0;
    if (char.match(/\p{L}/u)) {
      totalLetters++;
      if (isNonLatinChar(code)) nonLatinCount++;
    }
  }

  // If more than 20 % of letters are in a non-Latin script, reject.
  if (totalLetters > 0 && nonLatinCount / totalLetters > 0.2) return true;

  return false;
};

/**
 * Language guardrail — applied to the **inbound** user message.
 * If the message is in an unsupported language the orchestrator verifies the
 * configured provider before returning a safe refusal. Provider failure uses
 * the normal disabled-assistance state.
 */
export const languageGuardrail = (message: string): GuardrailResult => {
  if (detectWrongLanguage(message)) {
    return {
      passed: false,
      reason: "unsupported-language",
    };
  }
  return { passed: true };
};

/* -------------------------------------------------------------------------- */
/*  Scope guardrail                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Keywords that are clearly outside the scope of a customer-support desk.
 * If the user message is *primarily* about these topics the scope guardrail
 * flags it so the agent can politely decline.
 */
const OUT_OF_SCOPE_KEYWORDS = [
  // Politics & news
  "politics",
  "election",
  "president",
  "government",
  "parliament",
  "politik",
  "wahl",
  "präsident",
  "regierung",
  "bundestag",
  // Finance / investment advice
  "stock",
  "crypto",
  "bitcoin",
  "investment advice",
  "trading",
  "aktie",
  "krypto",
  "bitcoin",
  "anlageberatung",
  "handel",
  // Medical / legal advice
  "diagnose",
  "prescribe",
  "medical advice",
  "legal advice",
  "diagnose",
  "verschreiben",
  "medizinischer rat",
  "rechtlicher rat",
  // General knowledge / trivia
  "recipe",
  "cook",
  "weather",
  "news",
  "movie",
  "film review",
  "rezept",
  "kochen",
  "wetter",
  "nachrichten",
  "filmkritik",
  // Coding / homework
  "write code",
  "do my homework",
  "solve this exercise",
  "schreib code",
  "mache meine hausaufgabe",
];

/**
 * Scope guardrail — applied to the **inbound** user message.
 * Returns `passed: false` when the message is predominantly about topics
 * unrelated to Karino.
 */
export const scopeGuardrail = (message: string): GuardrailResult => {
  const lower = message.toLowerCase();

  // Count how many out-of-scope keywords appear.
  const hits = OUT_OF_SCOPE_KEYWORDS.filter((kw) => lower.includes(kw));

  // If 2+ distinct out-of-scope keywords appear, or the message is short
  // and contains even one, treat it as out of scope.
  if (hits.length >= 2) {
    return { passed: false, reason: "out-of-scope" };
  }

  // For very short messages (≤ 6 words) a single strong out-of-scope hit
  // is enough to decline.
  const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount <= 6 && hits.length === 1) {
    return { passed: false, reason: "out-of-scope" };
  }

  return { passed: true };
};

/* -------------------------------------------------------------------------- */
/*  Permission guardrail                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Permission guardrail — applied to the **inbound** user message.
 *
 * This guardrail does NOT grant any account access. AI agents cannot inspect
 * or mutate accounts; all such work remains in the normal administrative UI
 * and API, where backend role checks are authoritative.
 *
 * The guardrail returns `passed: true` always; it is included for
 * completeness and future extensibility (e.g. logging denied attempts).
 */
export const permissionGuardrail = (
  _message: string,
  context: AssistantContext,
): GuardrailResult => {
  // Guests cannot perform any authenticated action — agents must redirect
  // them to sign in.  This is informational; the guardrail never blocks.
  void context;
  return { passed: true };
};

/* -------------------------------------------------------------------------- */
/*  Output guardrail                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Patterns that must never appear in an agent reply:
 *  - Leaked system-prompt fragments ("You are Karino's …").
 *  - Hallucinated confirmation of an action that only the backend can
 *    perform (e.g. "I have banned …", "Your password has been changed").
 *  - Raw API keys or tokens.
 */
const LEAKED_PROMPT_PATTERNS = [
  /you are karino'?s/i,
  /system prompt/i,
  /your instructions say/i,
];

const HALLUCINATED_ACTION_PATTERNS = [
  /\bi have (banned|unbanned|deleted|promoted|demoted|changed your password|reset your password)\b/i,
  /\bi(?:'ve)? (banned|unbanned|deleted|promoted|demoted) .+ for you\b/i,
  /\bich habe .+ (gesperrt|entsperrt|gelöscht|befördert|herabgestuft)\b/i,
  /\b(i have|i've) (transferred|sent|forwarded) (this|the) (chat|conversation)\b/i,
  /\bich habe (diesen|den) chat (übertragen|weitergeleitet)\b/i,
];

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/i, // OpenAI-style keys
  /Bearer\s+[a-zA-Z0-9._-]{20,}/i,
];

/**
 * Output guardrail — applied to the **outbound** agent reply.
 * If the reply contains a forbidden pattern the guardrail returns a
 * safe replacement message.
 */
export const outputGuardrail = (
  reply: string,
  context: AssistantContext,
): GuardrailResult => {
  for (const pattern of [...LEAKED_PROMPT_PATTERNS, ...HALLUCINATED_ACTION_PATTERNS]) {
    if (pattern.test(reply)) {
      return {
        passed: false,
        reason: "output-guardrail-violation",
        replacement: safeOutputReplacement(context),
      };
    }
  }

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(reply)) {
      return {
        passed: false,
        reason: "secret-leak-detected",
        replacement: safeOutputReplacement(context),
      };
    }
  }

  return { passed: true };
};

const safeOutputReplacement = (context: AssistantContext): string =>
  context.locale === "de"
    ? "Ich kann diese Anfrage nicht direkt ausführen. Bitte nutze die entsprechende Funktion in der App, oder wende dich an den Support, falls du Hilfe benötigst."
    : "I cannot perform that action directly. Please use the corresponding feature in the app, or contact support if you need help.";
