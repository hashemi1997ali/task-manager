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

/**
 * The site guide deliberately receives no staff-interface knowledge. Staff
 * account operations belong exclusively to the Staff Account Agent.
 */
const GUEST_HELP_TOPICS = [
  "Karino is a productivity website for organising tasks, priorities, due dates, daily focus, and progress",
  "The public Contact form lets any visitor send an account or access request without linking it to a Karino account",
  "A personal task assistant is available only inside a signed-in user's private dashboard",
  "Guests may ask for a high-level overview, but should not receive task-creation steps, sign-in instructions, or staff/admin information",
];

const USER_HELP_TOPICS = [
  "Dashboard shows total, in-progress, completed, and overdue task counts, upcoming tasks, and overall progress",
  "My tasks lets the user create, search, filter, edit, update the status of, and delete only their own tasks",
  "A task supports title, description, status, priority, and due date",
  "The private AI Assistant helps with task planning, prioritisation, and task drafts; every task draft requires confirmation before creation",
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

export interface StaffCapabilities {
  banUsers: boolean;
  unbanUsers: boolean;
  viewUserStatus: boolean;
  promoteAdmin: boolean;
  demoteAdmin: boolean;
}

/**
 * Admins may manage regular user accounts. Only a super admin may change
 * administrator membership. Backend services re-check the target role.
 */
export const getStaffCapabilities = (tier: RoleTier): StaffCapabilities => {
  if (tier === "admin") {
    return {
      banUsers: true,
      unbanUsers: true,
      viewUserStatus: true,
      promoteAdmin: false,
      demoteAdmin: false,
    };
  }
  if (tier === "super_admin") {
    return {
      banUsers: true,
      unbanUsers: true,
      viewUserStatus: true,
      promoteAdmin: true,
      demoteAdmin: true,
    };
  }
  return {
    banUsers: false,
    unbanUsers: false,
    viewUserStatus: false,
    promoteAdmin: false,
    demoteAdmin: false,
  };
};

/**
 * Guests use Contact instead of the staff queue. Regular users can reach
 * support for account problems. Admin support requests are super-admin-only.
 */
export const canRequestSupportTransfer = (context: AssistantContext): boolean => {
  const tier = resolveRoleTier(context);
  return tier === "user" || tier === "admin";
};

export { isStaffRoles };
