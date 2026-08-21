import type { AgentInput, AgentOutput } from "../types.ts";
import { getAllowedHelpTopics, getForbiddenHelpTopics } from "../policies/index.ts";
import type { Agent } from "./base.ts";
import { commonPromptRules, completeOrFallback, tierOf } from "./base.ts";

const ADMIN_GUIDANCE =
  /\b(admin|administrator|super admin|staff dashboard|support queue|ban user|promote|demote|verwaltung|super-admin|mitarbeiterbereich|benutzer sperren|befördern|herabstufen)\b/i;
const ACCOUNT_OR_PERSONAL_HELP =
  /\b(account|login|password|banned|human|live support|personal agent|konto|anmeldung|passwort|gesperrt|mensch|persönlicher agent)\b/i;
const GUEST_HOW_TO =
  /\b(how (?:do|can) i (?:sign|log|register|create|add)|task creation|wie (?:kann|melde|erstelle)|registrieren|aufgabe erstellen)\b/i;

const localised = (locale: "en" | "de", english: string, german: string): string =>
  locale === "de" ? german : english;

const buildPrompt = (input: AgentInput): string => {
  const tier = tierOf(input.context);
  const sections =
    tier === "guest" ? ["Home", "Contact"] : ["Dashboard", "My tasks", "AI Assistant"];

  return [
    commonPromptRules(input.context.locale),
    "You are the Karino Site Guide. Explain only the verified Karino features listed below.",
    `Current user's role tier: ${tier}.`,
    "Verified features:",
    ...getAllowedHelpTopics(tier).map((topic) => `- ${topic}`),
    "Forbidden guidance:",
    ...getForbiddenHelpTopics().map((topic) => `- ${topic}`),
    "Never explain, mention, or infer administrator or super-administrator pages, roles, permissions, structure, or workflows, even when the current user is staff.",
    "Never claim to see the user's current screen, selected values, tasks, account data, or live UI state.",
    `Use only these navigation names when they are relevant: ${sections.join(", ")}.`,
    "For a guest, give only a high-level product overview. Do not explain how to sign in, register, or create a task.",
    "If a guest asks about an account, a ban, access, human help, or a personal agent, direct them to the public Contact form. Explain that the personal task assistant is available only after sign-in.",
    "For a signed-in regular user, explain how to create a task when asked. For an account, ban, access, or human-support issue, start the reply with the correct escalation marker so live support can help.",
    "If the requested feature is not in the verified list, say that you cannot verify it instead of guessing.",
    "You explain only. Never claim to click a control, submit a form, change data, or complete an action.",
  ].join("\n");
};

export const websiteHelpAgent: Agent = {
  id: "website-help",
  run: (input: AgentInput): Promise<AgentOutput> => {
    const tier = tierOf(input.context);
    if (ADMIN_GUIDANCE.test(input.message)) {
      return Promise.resolve({
        reply: localised(
          input.context.locale,
          "I can only explain Karino's public and personal task features. I cannot provide staff or administrator guidance.",
          "Ich kann nur die öffentlichen und persönlichen Aufgabenfunktionen von Karino erklären. Hinweise zu Mitarbeitenden- oder Administratorbereichen kann ich nicht geben.",
        ),
        usedLlm: false,
      });
    }
    if (tier === "guest" && ACCOUNT_OR_PERSONAL_HELP.test(input.message)) {
      return Promise.resolve({
        reply: localised(
          input.context.locale,
          "Please use the public Contact form for account access, a banned account, or personal help. The private task assistant is available only after sign-in.",
          "Nutze bitte das öffentliche Kontaktformular für Kontozugriff, eine Kontosperre oder persönliche Hilfe. Der private Aufgabenassistent ist nur nach der Anmeldung verfügbar.",
        ),
        usedLlm: false,
      });
    }
    if (tier === "guest" && GUEST_HOW_TO.test(input.message)) {
      return Promise.resolve({
        reply: localised(
          input.context.locale,
          "I can give you a general overview of Karino, but step-by-step sign-in and task-creation guidance is not available in guest chat.",
          "Ich kann dir einen allgemeinen Überblick über Karino geben, aber eine Schritt-für-Schritt-Anleitung zur Anmeldung oder Aufgabenerstellung ist im Gast-Chat nicht verfügbar.",
        ),
        usedLlm: false,
      });
    }
    return completeOrFallback(buildPrompt(input), input);
  },
};
