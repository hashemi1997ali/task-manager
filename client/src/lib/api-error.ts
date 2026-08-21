import type { ValidationIssue } from "@/lib/types";
import { parseLocale, type Locale } from "@/lib/preferences";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issues: ValidationIssue[] = [],
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const germanApiMessages: Record<string, string> = {
  "Invalid email or password": "E-Mail-Adresse oder Passwort ist falsch.",
  "An account with this email already exists":
    "Für diese E-Mail-Adresse gibt es bereits ein Konto.",
  "Current password is incorrect": "Das aktuelle Passwort ist falsch.",
  "New password must be different": "Das neue Passwort muss sich unterscheiden.",
  "Authentication required": "Bitte melde dich an, um fortzufahren.",
  "Access token has expired": "Deine Anmeldung ist abgelaufen.",
  "Session is no longer active": "Diese Sitzung ist nicht mehr aktiv.",
  "Refresh token is missing": "Deine Sitzung ist abgelaufen.",
  "Refresh token has expired": "Deine Sitzung ist abgelaufen.",
  "Invalid refresh token": "Deine Sitzung ist ungültig.",
  "User not found": "Das Benutzerkonto wurde nicht gefunden.",
  "Task not found": "Das Ticket wurde nicht gefunden.",
  "Ticket not found": "Das Ticket wurde nicht gefunden.",
  "Administrator permission is required": "Dafür sind Administratorrechte nötig.",
  "You cannot remove your own administrator role":
    "Du kannst deine eigene Administratorrolle nicht entfernen.",
  "You cannot delete your own administrator account":
    "Du kannst dein eigenes Administratorkonto nicht löschen.",
  "The last administrator cannot be demoted":
    "Der letzte Administrator kann nicht zurückgestuft werden.",
  "The last administrator cannot be deleted":
    "Der letzte Administrator kann nicht gelöscht werden.",
  "Invalid task ID": "Die Ticket-ID ist ungültig.",
  "Invalid ticket ID": "Die Ticket-ID ist ungültig.",
  "Invalid user ID": "Die Benutzer-ID ist ungültig.",
  "Invalid session ID": "Die Sitzungs-ID ist ungültig.",
  "Invalid access token": "Deine Anmeldung ist ungültig.",
  "User no longer exists": "Das Benutzerkonto existiert nicht mehr.",
  "At least one task field must be provided": "Ändere mindestens ein Ticketfeld.",
  "At least one ticket field must be provided": "Ändere mindestens ein Ticketfeld.",
  "Active session not found": "Die aktive Sitzung wurde nicht gefunden.",
  "Refresh authentication is required": "Bitte melde dich erneut an.",
  "Invalid refresh session": "Die Sitzung ist ungültig.",
  "Refresh session is no longer active": "Diese Sitzung ist nicht mehr aktiv.",
  "Refresh token reuse detected. Please log in again":
    "Die Sitzung konnte nicht bestätigt werden. Bitte melde dich erneut an.",
  "Invalid user": "Das Benutzerkonto ist ungültig.",
  "You do not have permission for this action":
    "Du hast keine Berechtigung für diese Aktion.",
  "Request body contains malformed JSON": "Die gesendeten Daten sind ungültig.",
  "Request body cannot exceed 1 MB": "Die Anfrage darf höchstens 1 MB groß sein.",
  "Validation failed": "Bitte überprüfe deine Eingaben.",
  "A record with this value already exists":
    "Ein Eintrag mit diesem Wert existiert bereits.",
  "Profile image cannot exceed 5 MB": "Das Profilbild darf höchstens 5 MB groß sein.",
  "Only JPG, PNG and WEBP profile images are allowed":
    "Nur JPG-, PNG- und WEBP-Profilbilder sind erlaubt.",
  "Profile image upload is unavailable because Cloudinary is not configured":
    "Profilbild-Uploads sind derzeit nicht verfügbar.",
  "Profile image upload failed": "Das Profilbild konnte nicht hochgeladen werden.",
  "Too many registration attempts. Please try again later":
    "Zu viele Registrierungsversuche. Bitte versuche es später erneut.",
  "Too many failed login attempts. Please try again later":
    "Zu viele fehlgeschlagene Anmeldeversuche. Bitte versuche es später erneut.",
  "Too many failed token refresh attempts. Please try again later":
    "Zu viele fehlgeschlagene Sitzungsversuche. Bitte versuche es später erneut.",
  "Too many refreshes for this session. Please try again later":
    "Zu viele Aktualisierungen dieser Sitzung. Bitte versuche es später erneut.",
  "At least one profile field must be provided": "Ändere mindestens ein Profilfeld.",
  "At least one user field must be provided": "Ändere mindestens ein Benutzerfeld.",
  "Your session has expired. Please sign in again.":
    "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  "The server could not process the request.":
    "Der Server konnte die Anfrage nicht verarbeiten.",
  "Internal server error": "Ein interner Serverfehler ist aufgetreten.",
  "Unknown server error": "Ein unbekannter Serverfehler ist aufgetreten.",
  "Your account has been banned": "Dein Konto wurde gesperrt.",
  "Chat not found": "Der Chat wurde nicht gefunden.",
  "This chat has ended": "Dieser Chat ist bereits beendet.",
  "This chat has already been sent to support":
    "Dieser Chat wurde bereits an den Support gesendet.",
  "This chat has already been rated": "Dieser Chat wurde bereits bewertet.",
  "Transfer or end the active support chat before changing the ticket assignee":
    "Übertrage oder beende zuerst den aktiven Support-Chat, bevor du die Ticketzuweisung änderst.",
  "End the active support chat before changing the ticket status":
    "Beende zuerst den aktiven Support-Chat, bevor du den Ticketstatus änderst.",
  "The ticket changed before your update could be saved":
    "Das Ticket wurde gleichzeitig geändert. Lade die Ansicht neu und versuche es erneut.",
  "The ticket changed before the support chat could open":
    "Das Ticket wurde gleichzeitig geändert. Lade die Ansicht neu, bevor du den Support-Chat öffnest.",
  "End the chat before rating it": "Beende den Chat, bevor du ihn bewertest.",
  "This chat is unavailable or has already been claimed":
    "Dieser Chat ist nicht verfügbar oder wurde bereits angenommen.",
  "This chat requires a super administrator":
    "Dieser Chat erfordert einen Super-Administrator.",
  "You must claim this chat before replying":
    "Du musst diesen Chat annehmen, bevor du antwortest.",
  "Super administrators manage support directly":
    "Super-Administratoren verwalten Supportfälle direkt.",
  "A super administrator cannot transfer a chat upward":
    "Ein Super-Administrator kann einen Chat nicht weiter nach oben übertragen.",
  "Only a super administrator can change administrator roles":
    "Nur ein Super-Administrator kann Administratorrollen ändern.",
  "A super administrator role cannot be changed here":
    "Die Super-Administratorrolle kann hier nicht geändert werden.",
  "You cannot ban this account": "Du kannst dieses Konto nicht sperren.",
  "You cannot unban this account": "Du kannst die Sperre dieses Kontos nicht aufheben.",
  "You cannot ban your own account": "Du kannst dein eigenes Konto nicht sperren.",
  "You do not have permission to ban this account":
    "Du hast keine Berechtigung, dieses Konto zu sperren.",
  "You do not have permission to unban this account":
    "Du hast keine Berechtigung, die Sperre dieses Kontos aufzuheben.",
  "You do not have permission to edit this account":
    "Du hast keine Berechtigung, dieses Konto zu bearbeiten.",
  "You do not have permission to delete this account":
    "Du hast keine Berechtigung, dieses Konto zu löschen.",
  "This user is not banned": "Dieser Benutzer ist nicht gesperrt.",
  "Administrator required": "Administratorrechte sind erforderlich.",
  "New password must be different from your current password":
    "Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.",
  "This password reset link is invalid or expired":
    "Dieser Link zum Zurücksetzen des Passworts ist ungültig oder abgelaufen.",
  "Email delivery is temporarily unavailable":
    "Der E-Mail-Versand ist vorübergehend nicht verfügbar.",
  "Email delivery failed": "Die E-Mail konnte nicht gesendet werden.",
  "Contact message not found": "Die Kontaktnachricht wurde nicht gefunden.",
  "AI assistance is currently disabled.": "Die AI-Unterstützung ist derzeit deaktiviert.",
  "Die AI-Unterstützung ist derzeit deaktiviert.":
    "Die AI-Unterstützung ist derzeit deaktiviert.",
  "Too many contact messages. Please try again later":
    "Zu viele Kontaktnachrichten. Bitte versuche es später erneut.",
  "Too many password reset requests. Please try again later":
    "Zu viele Anfragen zum Zurücksetzen des Passworts. Bitte versuche es später erneut.",
};

export const getRuntimeLocale = (): Locale =>
  typeof document === "undefined" ? "en" : parseLocale(document.documentElement.lang);

export const localizeApiMessage = (message: string, locale: Locale): string => {
  if (locale !== "de") return message;
  const exact = germanApiMessages[message];
  if (exact) return exact;
  if (/^Invalid value for /.test(message)) return "Ein gesendeter Wert ist ungültig.";
  if (/^Route not found: /.test(message))
    return "Die angeforderte Route wurde nicht gefunden.";
  return "Die Anfrage konnte nicht verarbeitet werden. Bitte versuche es erneut.";
};

export const getErrorMessage = (error: unknown, locale = getRuntimeLocale()): string => {
  if (error instanceof ApiError && error.message === "Your account has been banned") {
    const details = error.details as
      { ban?: { reason?: string; bannedAt?: string } } | undefined;
    const reason = details?.ban?.reason;
    const base = localizeApiMessage(error.message, locale);
    if (!reason) return base;
    return locale === "de" ? `${base} Grund: ${reason}` : `${base} Reason: ${reason}`;
  }
  if (error instanceof Error) return localizeApiMessage(error.message, locale);
  return locale === "de"
    ? "Es ist ein Fehler aufgetreten. Bitte versuche es erneut."
    : "Something went wrong. Please try again.";
};
