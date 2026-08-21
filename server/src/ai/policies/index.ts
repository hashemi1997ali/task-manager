import { isAdminRoles, isStaffRoles, isSuperAdminRoles } from "#utils";

import type { AssistantContext } from "../types.ts";

export type RoleTier = "guest" | "user" | "admin" | "super_admin";

export const resolveRoleTier = (context: AssistantContext): RoleTier => {
  if (!context.authenticated) return "guest";
  if (isSuperAdminRoles(context.roles)) return "super_admin";
  if (isAdminRoles(context.roles)) return "admin";
  return "user";
};

export const isStaffTier = (tier: RoleTier): boolean =>
  tier === "admin" || tier === "super_admin";

/** The site guide deliberately receives no staff-interface knowledge. */
const GUEST_HELP_TOPICS = [
  "Karino Desk is a customer-support workspace that combines AI guidance, structured tickets, SLA-aware follow-up, and optional live human support",
  "The public Contact form lets any visitor send an account or access request without linking it to a Karino account or private ticket",
  "A private request assistant and customer ticket history are available only inside a signed-in customer's workspace",
  "Guests may ask for a high-level product overview, but should not receive ticket submission steps, sign-in instructions, or staff/admin information",
];

const USER_HELP_TOPICS = [
  "Dashboard shows the customer's open, waiting, urgent, resolved, requested-deadline, and SLA state with time-aware daily workload",
  "Tickets lets the customer create, search, filter, edit, close, reopen, and delete only their own support requests",
  "A ticket supports a human reference number, title, description, category, priority, status, requested date and time, assignment, and SLA timestamps",
  "The private Request Assistant helps describe and categorise a ticket draft; every draft requires explicit confirmation before creation",
  "Starting live support can link an existing owned ticket or create a private chat-sourced ticket automatically",
  "Private AI Assistant conversations are visible only to their owner and are separate from live-support conversations",
];

const FORBIDDEN_HELP_TOPICS = [
  "pages or controls not included in the verified feature list",
  "all administrator and super-administrator pages, controls, roles, permissions, workflows, and internal structure",
  "internal architecture, source code, database details, internal APIs, secrets, or security implementation",
];

export const getAllowedHelpTopics = (tier: RoleTier): string[] => {
  const topics = [...GUEST_HELP_TOPICS];
  if (tier !== "guest") topics.push(...USER_HELP_TOPICS);
  return topics;
};

export const getForbiddenHelpTopics = (): string[] => [...FORBIDDEN_HELP_TOPICS];

/**
 * Guests use Contact instead of the staff queue. Regular users can reach
 * support for account problems. Admin support requests are super-admin-only.
 */
export const canRequestSupportTransfer = (context: AssistantContext): boolean => {
  const tier = resolveRoleTier(context);
  return tier === "user" || tier === "admin";
};

export { isStaffRoles };
