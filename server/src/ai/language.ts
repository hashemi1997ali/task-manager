import type { AssistantLocale } from "./types.ts";

export interface MessageLocaleDetection {
  locale: AssistantLocale;
  confidence: number;
}

const ENGLISH_WORDS = new Set([
  "a",
  "about",
  "account",
  "am",
  "and",
  "are",
  "banned",
  "blocked",
  "can",
  "cannot",
  "change",
  "chat",
  "create",
  "delete",
  "do",
  "does",
  "email",
  "for",
  "from",
  "help",
  "how",
  "i",
  "in",
  "is",
  "it",
  "locked",
  "login",
  "my",
  "need",
  "not",
  "of",
  "on",
  "please",
  "register",
  "session",
  "support",
  "task",
  "ticket",
  "request",
  "the",
  "this",
  "to",
  "user",
  "want",
  "what",
  "why",
  "with",
  "you",
  "your",
]);

const GERMAN_WORDS = new Set([
  "aber",
  "anmelden",
  "anmeldung",
  "auf",
  "aufgabe",
  "benutzer",
  "bitte",
  "chat",
  "das",
  "dein",
  "der",
  "die",
  "ein",
  "eine",
  "erstellen",
  "für",
  "gesperrt",
  "hilfe",
  "ich",
  "ist",
  "kann",
  "konto",
  "löschen",
  "mein",
  "mit",
  "möchte",
  "nicht",
  "oder",
  "passwort",
  "registrieren",
  "sind",
  "sitzung",
  "support",
  "ticket",
  "anfrage",
  "und",
  "von",
  "warum",
  "was",
  "wie",
  "zu",
]);

const AMBIGUOUS_SHORT_WORDS = new Set([
  "hi",
  "hello",
  "hey",
  "ok",
  "okay",
  "yes",
  "no",
  "thanks",
  "danke",
  "hallo",
  "ja",
  "nein",
]);

const cleanWords = (message: string): string[] =>
  message
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, " ")
    .toLocaleLowerCase("de-DE")
    .match(/[a-zäöüß']+/g) ?? [];

/**
 * Detects English or German from the current message. Short or ambiguous
 * messages deliberately keep the website/chat locale as their fallback.
 */
export const detectMessageLocale = (
  message: string,
  fallbackLocale: AssistantLocale,
): MessageLocaleDetection => {
  const words = cleanWords(message);
  if (words.length === 0) return { locale: fallbackLocale, confidence: 0 };

  if (words.length <= 2 && words.every((word) => AMBIGUOUS_SHORT_WORDS.has(word))) {
    return { locale: fallbackLocale, confidence: 0.2 };
  }

  let englishScore = 0;
  let germanScore = 0;

  for (const word of words) {
    if (ENGLISH_WORDS.has(word)) englishScore += 1;
    if (GERMAN_WORDS.has(word)) germanScore += 1;

    if (/(ing|tion|ed|ly)$/.test(word)) englishScore += 0.2;
    if (/(ung|keit|heit|lich|isch|chen)$/.test(word)) germanScore += 0.25;
  }

  if (/[äöüß]/i.test(message)) germanScore += 2;
  if (/\b(i'm|i've|don't|can't|isn't|please)\b/i.test(message)) englishScore += 1.5;
  if (/\b(ich|mein|dein|kannst|möchte|nicht|bitte)\b/i.test(message)) {
    germanScore += 1.5;
  }

  const total = englishScore + germanScore;
  const difference = Math.abs(englishScore - germanScore);
  if (total < 1 || difference < 0.75) {
    return { locale: fallbackLocale, confidence: total === 0 ? 0 : difference / total };
  }

  return {
    locale: germanScore > englishScore ? "de" : "en",
    confidence: Math.min(1, difference / Math.max(total, 1) + 0.35),
  };
};

/** Returns true only when a reply contains strong signals from both languages. */
export const isStronglyMixedLanguage = (reply: string): boolean => {
  const words = cleanWords(reply);
  let english = 0;
  let german = 0;
  for (const word of words) {
    if (ENGLISH_WORDS.has(word)) english++;
    if (GERMAN_WORDS.has(word)) german++;
  }
  return english >= 4 && german >= 4;
};
