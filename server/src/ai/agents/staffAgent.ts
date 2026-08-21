import type { AgentInput, AgentOutput } from "../types.ts";
import { getStaffCapabilities, type RoleTier } from "../policies/index.ts";
import type { Agent } from "./base.ts";
import { commonPromptRules, completeOrFallback, tierOf } from "./base.ts";

const commandsFor = (tier: RoleTier): string => {
  const caps = getStaffCapabilities(tier);
  const commands: string[] = [];
  if (caps.viewUserStatus) commands.push("/user <email> â€” view account status");
  if (caps.banUsers)
    commands.push("/ban <email> <reason> â€” prepare a ban for confirmation");
  if (caps.unbanUsers)
    commands.push("/unban <email> â€” prepare removal of a ban for confirmation");
  if (caps.promoteAdmin)
    commands.push("/promote <email> â€” prepare granting the admin role");
  if (caps.demoteAdmin)
    commands.push("/demote <email> â€” prepare removal of the admin role");
  return commands.join("\n");
};

const buildPrompt = (input: AgentInput): string => {
  const tier = tierOf(input.context);
  const caps = getStaffCapabilities(tier);
  const scope =
    tier === "super_admin"
      ? "You may inspect accounts, ban/unban manageable accounts, and promote or demote administrators. Never manage a super admin."
      : "You may inspect accounts and ban/unban regular users. Never manage an admin or super admin.";

  return [
    commonPromptRules(input.context.locale),
    "You are the Staff Account Agent.",
    `Current staff role: ${tier}.`,
    scope,
    "Only answer account-management questions that fit the allowed capabilities. Do not act on ordinary conversational text.",
    "The /user command is read-only and runs immediately.",
    "Every mutation first returns a confirmation instruction. It executes only after a separate matching /confirm-ban, /confirm-unban, /confirm-promote, or /confirm-demote command.",
    `Available commands:\n${commandsFor(tier)}`,
    "Backend permissions are authoritative. Never claim success unless the command result explicitly reports success.",
    caps.promoteAdmin
      ? ""
      : "If asked to promote or demote an administrator, explain that only a super admin can do that.",
  ]
    .filter(Boolean)
    .join("\n");
};

export const staffAgent: Agent = {
  id: "staff",
  run: (input: AgentInput): Promise<AgentOutput> =>
    completeOrFallback(buildPrompt(input), input),
};
