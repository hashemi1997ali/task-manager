import type { BanReason, TaskPriority, TaskStatus, UserRole } from "@/lib/types";
import type { Locale } from "@/lib/preferences";

const banReasonLabels: Record<Locale, Record<BanReason, string>> = {
  en: {
    spam: "Spam",
    "abusive-behavior": "Abusive behavior",
    harassment: "Harassment",
    fraud: "Fraud",
    "terms-violation": "Terms violation",
    security: "Security risk",
    other: "Other",
  },
  de: {
    spam: "Spam",
    "abusive-behavior": "Missbräuchliches Verhalten",
    harassment: "Belästigung",
    fraud: "Betrug",
    "terms-violation": "Verstoß gegen die Nutzungsbedingungen",
    security: "Sicherheitsrisiko",
    other: "Sonstiges",
  },
};

const roleLabels: Record<Locale, Record<UserRole, string>> = {
  en: {
    user: "User",
    admin: "Admin",
    super_admin: "Super Admin",
  },
  de: {
    user: "Benutzer",
    admin: "Admin",
    super_admin: "Super Admin",
  },
};

const taskStatusLabels: Record<Locale, Record<TaskStatus, string>> = {
  en: {
    todo: "To do",
    "in-progress": "In progress",
    done: "Done",
  },
  de: {
    todo: "Offen",
    "in-progress": "In Bearbeitung",
    done: "Erledigt",
  },
};

const taskPriorityLabels: Record<Locale, Record<TaskPriority, string>> = {
  en: {
    low: "Low",
    medium: "Medium",
    high: "High",
  },
  de: {
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
  },
};

export const getBanReasonLabel = (reason: BanReason, locale: Locale): string =>
  banReasonLabels[locale][reason];

export const getUserRoleLabel = (role: UserRole, locale: Locale): string =>
  roleLabels[locale][role];

export const getTaskStatusLabel = (status: TaskStatus, locale: Locale): string =>
  taskStatusLabels[locale][status];

export const getTaskPriorityLabel = (priority: TaskPriority, locale: Locale): string =>
  taskPriorityLabels[locale][priority];

export const getAssistantAgentLabel = (agent: string, locale: Locale): string => {
  void agent;
  void locale;
  return "AI Assistant";
};

export const isInternalSupportTransferMessage = (content: string): boolean =>
  /transferred this chat to a super support agent|an einen super-support-agenten/i.test(
    content,
  );

export const getLocalizedSupportSystemMessage = (
  content: string,
  locale: Locale,
): string => {
  const normalized = content.toLowerCase();
  const name = content.trim().split(/\s+/)[0] || "Support";
  if (/waiting.*super|wartet.*super/.test(normalized)) {
    return locale === "de"
      ? "Dieser Chat wartet auf einen Super-Support-Agenten."
      : "This chat is waiting for a Super Support Agent.";
  }
  if (/waiting.*support|wartet.*support/.test(normalized)) {
    return locale === "de"
      ? "Dieser Chat wartet auf einen Human-Support-Agenten."
      : "This chat is waiting for a Human Support Agent.";
  }
  if (/the user ended|benutzer.*beendet/.test(normalized)) {
    return locale === "de"
      ? "Der Benutzer hat diesen Chat beendet."
      : "The user ended this chat.";
  }
  if (/ended automatically|automatisch beendet/.test(normalized)) {
    return locale === "de"
      ? "Dieser Chat wurde automatisch beendet, weil längere Zeit keine Antwort eingegangen ist. Du kannst jederzeit einen neuen Chat starten."
      : "This chat was ended automatically because no reply was received for a while. You can start a new chat at any time.";
  }
  if (/transferred|übertragen|uebertragen/.test(normalized)) {
    return locale === "de"
      ? `${name} hat diesen Chat an einen Super-Support-Agenten übertragen.`
      : `${name} transferred this chat to a Super Support Agent.`;
  }
  if (/joined|accepted|beigetreten|angenommen/.test(normalized)) {
    return locale === "de"
      ? `${name} ist diesem Support-Chat beigetreten.`
      : `${name} joined this support chat.`;
  }
  if (/left this support chat|support-chat verlassen/.test(normalized)) {
    return locale === "de"
      ? `${name} hat diesen Support-Chat verlassen.`
      : `${name} left this support chat.`;
  }
  if (/ended this support chat|support-chat beendet/.test(normalized)) {
    return locale === "de"
      ? `${name} hat diesen Support-Chat beendet.`
      : `${name} ended this support chat.`;
  }
  return content;
};
