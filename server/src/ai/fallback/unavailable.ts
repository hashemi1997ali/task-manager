import type { AssistantLocale } from "../types.ts";

const line = (locale: AssistantLocale, en: string, de: string): string =>
  locale === "de" ? de : en;

export const unsupportedLanguageReply = (locale: AssistantLocale): string =>
  line(
    locale,
    "I'm sorry, I can only help in English or German. Please rephrase your message in one of these languages.",
    "Es tut mir leid, ich kann nur auf Englisch oder Deutsch helfen. Bitte formuliere deine Nachricht in einer dieser Sprachen.",
  );

export const outOfScopeReply = (locale: AssistantLocale): string =>
  line(
    locale,
    "I can only help with Karino Desk and its customer-support features.",
    "Ich kann nur bei Karino Desk und seinen Kundensupport-Funktionen helfen.",
  );

export const aiUnavailableReply = (locale: AssistantLocale): string =>
  line(
    locale,
    "AI assistance is currently disabled.",
    "Die AI-Unterstützung ist derzeit deaktiviert.",
  );
