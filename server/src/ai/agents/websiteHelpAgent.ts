import type { AgentInput, AgentOutput } from "../types.ts";
import { getAllowedHelpTopics, getForbiddenHelpTopics } from "../policies/index.ts";
import type { Agent } from "./base.ts";
import { commonPromptRules, completeOrFallback, tierOf } from "./base.ts";

const buildPrompt = (input: AgentInput): string => {
  const tier = tierOf(input.context);
  const sections =
    tier === "guest" ? ["Home", "Contact"] : ["Dashboard", "Tickets", "AI Assistant"];

  return [
    commonPromptRules(input.context.locale),
    "You are the Karino Site Guide. Explain only the verified Karino features listed below.",
    `Current user's role tier: ${tier}.`,
    "Verified features:",
    ...getAllowedHelpTopics(tier).map((topic) => `- ${topic}`),
    "Forbidden guidance:",
    ...getForbiddenHelpTopics().map((topic) => `- ${topic}`),
    "Never explain, mention, or infer administrator or super-administrator pages, roles, permissions, structure, or workflows, even when the current user is staff.",
    "Never claim to see the user's current screen, selected values, tickets, account data, or live UI state.",
    `Use only these navigation names when they are relevant: ${sections.join(", ")}.`,
    "For a guest, give only a high-level product overview. Do not explain how to sign in, register, or submit a private ticket.",
    "If a guest asks about an account, a ban, access, human help, or a private assistant, direct them to the public Contact form. Explain that ticket history and the request assistant are available only after sign-in.",
    "For a signed-in regular user, explain how to submit and track a ticket when asked. For an account, ban, access, or human-support issue, start the reply with the correct escalation marker so live support can help.",
    "If the requested feature is not in the verified list, say that you cannot verify it instead of guessing.",
    "You explain only. Never claim to click a control, submit a form, change data, or complete an action.",
  ].join("\n");
};

export const websiteHelpAgent: Agent = {
  id: "website-help",
  run: (input: AgentInput): Promise<AgentOutput> =>
    completeOrFallback(buildPrompt(input), input),
};
