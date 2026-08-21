"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Laptop,
  MonitorSmartphone,
  Pencil,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { Card, Badge } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ThemeSelector } from "@/components/ui/theme-selector";
import {
  changePasswordRequest,
  deleteAccountRequest,
  getSessionsRequest,
  logoutAllSessionsRequest,
  revokeSessionRequest,
  updateProfileRequest,
} from "@/features/account/api";
import { useAuth } from "@/features/auth/auth-provider";
import {
  createPasswordChangeSchema,
  createProfileSchema,
  type PasswordChangeFormValues,
  type ProfileFormValues,
} from "@/features/auth/schemas";
import { getErrorMessage } from "@/lib/api-error";
import type { Locale } from "@/lib/preferences";
import { prepareProfileImage } from "@/lib/profile-image";
import type { RefreshSession } from "@/lib/types";
import { cn, getId } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

interface AccountCopy {
  devices: {
    mobile: string;
    tablet: string;
    computer: string;
  };
  profileSaved: string;
  passwordChanged: string;
  otherSessionsClosed: string;
  sessionClosed: string;
  signedOutEverywhere: string;
  eyebrow: string;
  title: string;
  description: string;
  profileTitle: string;
  profileDescription: string;
  firstName: string;
  lastName: string;
  email: string;
  saveChanges: string;
  passwordTitle: string;
  passwordDescription: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  changePassword: string;
  sessionsTitle: string;
  sessionsDescription: string;
  signOutOthers: string;
  signOutAll: string;
  loadingSessions: string;
  currentDevice: string;
  ipUnavailable: string;
  lastUsed: string;
  expires: string;
  signOut: string;
  closeSession: string;
  signOutTitle: string;
  signOutDescription: string;
  signOutOthersTitle: string;
  signOutOthersDescription: string;
  signOutAllTitle: string;
  signOutAllDescription: string;
  closeSessionTitle: string;
  closeSessionDescription: string;
  profileImage: string;
  chooseImage: string;
  removeImage: string;
  appearanceTitle: string;
  appearanceDescription: string;
  lightTheme: string;
  darkTheme: string;
  systemTheme: string;
  themeTitle: string;
  securityTitle: string;
  securityDescription: string;
  backToSecurity: string;
  languageTitle: string;
  languageDescription: string;
  english: string;
  german: string;
  deleteAccount: string;
  deleteAccountTitle: string;
  deleteAccountDescription: string;
  deleteAccountHelp: string;
  accountDeleted: string;
}

const copy = {
  en: {
    devices: { mobile: "Mobile", tablet: "Tablet", computer: "Computer" },
    profileSaved: "Your account details have been saved.",
    passwordChanged: "Your password was changed and your other sessions were closed.",
    otherSessionsClosed: "All other sessions have been closed.",
    sessionClosed: "The selected session has been closed.",
    signedOutEverywhere: "You have been signed out on every device.",
    eyebrow: "Personal settings",
    title: "Account",
    description: "Manage your profile, password, and active sessions.",
    profileTitle: "Account",
    profileDescription: "Your account details",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    profileImage: "Profile image",
    chooseImage: "Choose image",
    removeImage: "Remove image",
    appearanceTitle: "General",
    appearanceDescription: "Manage theme and language preferences",
    lightTheme: "Light",
    darkTheme: "Dark",
    systemTheme: "System",
    themeTitle: "Theme",
    securityTitle: "Security",
    securityDescription: "Manage your password and signed-in devices",
    backToSecurity: "Back to security",
    languageTitle: "Language",
    languageDescription: "Choose the language used across Karino",
    english: "English",
    german: "German",
    deleteAccount: "Delete account",
    deleteAccountTitle: "Permanently delete your account?",
    deleteAccountDescription:
      "Your profile, tickets, chats, assistant conversations, sessions, and related account data will be permanently deleted. This cannot be undone.",
    deleteAccountHelp: "Permanently remove your account and all related data.",
    accountDeleted: "Your account and related data were deleted.",
    saveChanges: "Save changes",
    passwordTitle: "Change password",
    passwordDescription: "Use your current password",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    changePassword: "Change password",
    sessionsTitle: "Active sessions",
    sessionsDescription: "Your signed-in devices",
    signOutOthers: "Sign out others",
    signOutAll: "Sign out everywhere",
    loadingSessions: "Loading sessions...",
    currentDevice: "Current device",
    ipUnavailable: "IP unavailable",
    lastUsed: "Last used",
    expires: "Expires",
    signOut: "Sign out",
    closeSession: "Sign out",
    signOutTitle: "Sign out of this device?",
    signOutDescription:
      "This session will end on this device. You will need to sign in again to continue.",
    signOutOthersTitle: "Sign out on all other devices?",
    signOutOthersDescription:
      "Every session except this device will be revoked. This device will stay signed in.",
    signOutAllTitle: "Sign out on every device?",
    signOutAllDescription:
      "Every session, including this device, will be revoked. You will need to sign in again.",
    closeSessionTitle: "Sign out of this session?",
    closeSessionDescription:
      "This device will no longer be able to stay signed in with its refresh token.",
  },
  de: {
    devices: { mobile: "Mobilgerät", tablet: "Tablet", computer: "Computer" },
    profileSaved: "Deine Kontodaten wurden gespeichert.",
    passwordChanged:
      "Dein Passwort wurde geändert und deine anderen Sitzungen wurden beendet.",
    otherSessionsClosed: "Alle anderen Sitzungen wurden beendet.",
    sessionClosed: "Die ausgewählte Sitzung wurde beendet.",
    signedOutEverywhere: "Du wurdest auf allen Geräten abgemeldet.",
    eyebrow: "Persönliche Einstellungen",
    title: "Konto",
    description: "Verwalte dein Profil, Passwort und aktive Sitzungen.",
    profileTitle: "Konto",
    profileDescription: "Deine Kontodaten",
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail-Adresse",
    profileImage: "Profilbild",
    chooseImage: "Bild auswählen",
    removeImage: "Bild entfernen",
    appearanceTitle: "Allgemein",
    appearanceDescription: "Design und Sprache verwalten",
    lightTheme: "Hell",
    darkTheme: "Dunkel",
    systemTheme: "System",
    themeTitle: "Design",
    securityTitle: "Sicherheit",
    securityDescription: "Passwort und angemeldete Geräte verwalten",
    backToSecurity: "Zurück zur Sicherheit",
    languageTitle: "Sprache",
    languageDescription: "Wähle die Sprache für Karino",
    english: "Englisch",
    german: "Deutsch",
    deleteAccount: "Konto löschen",
    deleteAccountTitle: "Dein Konto dauerhaft löschen?",
    deleteAccountDescription:
      "Dein Profil, deine Tickets, Chats, Assistent-Unterhaltungen, Sitzungen und zugehörigen Kontodaten werden dauerhaft gelöscht. Dies kann nicht rückgängig gemacht werden.",
    deleteAccountHelp: "Konto und alle zugehörigen Daten dauerhaft entfernen.",
    accountDeleted: "Dein Konto und die zugehörigen Daten wurden gelöscht.",
    saveChanges: "Änderungen speichern",
    passwordTitle: "Passwort ändern",
    passwordDescription: "Aktuelles Passwort verwenden",
    currentPassword: "Aktuelles Passwort",
    newPassword: "Neues Passwort",
    confirmPassword: "Neues Passwort bestätigen",
    changePassword: "Passwort ändern",
    sessionsTitle: "Aktive Sitzungen",
    sessionsDescription: "Deine angemeldeten Geräte",
    signOutOthers: "Andere abmelden",
    signOutAll: "Überall abmelden",
    loadingSessions: "Sitzungen werden geladen...",
    currentDevice: "Aktuelles Gerät",
    ipUnavailable: "IP nicht verfügbar",
    lastUsed: "Zuletzt verwendet",
    expires: "Läuft ab",
    signOut: "Abmelden",
    closeSession: "Abmelden",
    signOutTitle: "Von diesem Gerät abmelden?",
    signOutDescription:
      "Die Sitzung auf diesem Gerät wird beendet. Du musst dich erneut anmelden, um fortzufahren.",
    signOutOthersTitle: "Auf allen anderen Geräten abmelden?",
    signOutOthersDescription:
      "Alle Sitzungen außer dieser werden widerrufen. Dieses Gerät bleibt angemeldet.",
    signOutAllTitle: "Auf allen Geräten abmelden?",
    signOutAllDescription:
      "Alle Sitzungen, einschließlich dieses Geräts, werden widerrufen. Du musst dich danach erneut anmelden.",
    closeSessionTitle: "Von dieser Sitzung abmelden?",
    closeSessionDescription:
      "Dieses Gerät kann mit seinem Refresh-Token nicht länger angemeldet bleiben.",
  },
} as const satisfies Record<Locale, AccountCopy>;

type DeviceKind = keyof AccountCopy["devices"];
type AccountTab = "general" | "account" | "security";
type SecurityPane = "overview" | "password" | "sessions";

function deviceInfo(userAgent: string | null): {
  kind: DeviceKind;
  icon: typeof Smartphone;
} {
  const value = userAgent?.toLowerCase() ?? "";
  if (/iphone|android|mobile/.test(value)) {
    return { kind: "mobile", icon: Smartphone };
  }
  if (/ipad|tablet/.test(value)) return { kind: "tablet", icon: MonitorSmartphone };
  return { kind: "computer", icon: Laptop };
}

const formatDateTime = (value: string, intlLocale: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export function AccountView({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user, updateUser, endSessionLocally } = useAuth();
  const { locale, intlLocale, theme, setLocale, setTheme } = usePreferences();
  const t = copy[locale];
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<RefreshSession | null>(null);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [embeddedTab, setEmbeddedTab] = useState<AccountTab>("account");
  const [securityPane, setSecurityPane] = useState<SecurityPane>("overview");
  const requestedTab = searchParams.get("tab");
  const routeTab: AccountTab =
    requestedTab === "general" || requestedTab === "appearance"
      ? "general"
      : requestedTab === "security" || requestedTab === "sessions"
        ? "security"
        : "account";
  const activeTab = embedded ? embeddedTab : routeTab;
  const profileImagePreview = useMemo(
    () => (profileImage ? URL.createObjectURL(profileImage) : null),
    [profileImage],
  );
  const localizedProfileSchema = useMemo(() => createProfileSchema(locale), [locale]);
  const localizedPasswordSchema = useMemo(
    () => createPasswordChangeSchema(locale),
    [locale],
  );
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(localizedProfileSchema),
  });
  const passwordForm = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(localizedPasswordSchema),
  });

  useEffect(() => {
    profileForm.clearErrors();
    passwordForm.clearErrors();
  }, [locale, profileForm, passwordForm]);

  useEffect(
    () => () => {
      if (profileImagePreview) URL.revokeObjectURL(profileImagePreview);
    },
    [profileImagePreview],
  );

  useEffect(() => {
    if (user) {
      profileForm.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      });
    }
  }, [user, profileForm]);

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: getSessionsRequest,
  });

  const profileMutation = useMutation({
    mutationFn: updateProfileRequest,
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      setProfileImage(null);
      setRemoveProfileImage(false);
      toast.success(t.profileSaved);
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const passwordMutation = useMutation({
    mutationFn: changePasswordRequest,
    onSuccess: () => {
      passwordForm.reset();
      toast.success(t.passwordChanged);
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const revokeMutation = useMutation({
    mutationFn: (session: RefreshSession) => revokeSessionRequest(getId(session)),
    onSuccess: async () => {
      setSessionToRevoke(null);
      toast.success(t.sessionClosed);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const allMutation = useMutation({
    mutationFn: logoutAllSessionsRequest,
    onSuccess: () => {
      setConfirmAll(false);
      endSessionLocally();
      toast.success(t.signedOutEverywhere);
      router.replace("/login");
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccountRequest,
    onSuccess: () => {
      setConfirmDeleteAccount(false);
      endSessionLocally();
      toast.success(t.accountDeleted);
      router.replace("/");
    },
    onError: (error) => toast.error(getErrorMessage(error, locale)),
  });

  const profileHasChanges =
    profileForm.formState.isDirty || Boolean(profileImage) || removeProfileImage;
  const submitProfile = profileForm.handleSubmit((values) => {
    if (!profileHasChanges) return;
    return profileMutation
      .mutateAsync({ ...values, profileImage, removeProfileImage })
      .then(() => undefined);
  });
  const submitPassword = passwordForm.handleSubmit((values) =>
    passwordMutation
      .mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      .then(() => undefined),
  );

  const panelClassName = cn(
    "p-5 sm:p-6",
    embedded &&
      "mx-auto min-h-full w-full max-w-[46rem] rounded-none border-0 bg-transparent p-0 shadow-none hover:border-transparent sm:p-0",
  );
  const showSecurityBack = activeTab === "security" && securityPane !== "overview";
  const activePageTitle =
    activeTab === "general"
      ? t.appearanceTitle
      : activeTab === "account"
        ? t.profileTitle
        : securityPane === "password"
          ? t.passwordTitle
          : securityPane === "sessions"
            ? t.sessionsTitle
            : t.securityTitle;
  const activePageDescription =
    activeTab === "general"
      ? t.appearanceDescription
      : activeTab === "account"
        ? t.profileDescription
        : securityPane === "password"
          ? t.passwordDescription
          : securityPane === "sessions"
            ? t.sessionsDescription
            : t.securityDescription;

  return (
    <div
      className={cn(
        embedded &&
          "relative grid h-full min-h-0 grid-cols-[13rem_minmax(0,1fr)] overflow-hidden",
      )}
    >
      {!embedded && !showSecurityBack && (
        <PageHeading title={activePageTitle} description={activePageDescription} />
      )}
      {!embedded && showSecurityBack && (
        <header className="desk-page-header">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 rounded-full"
                aria-label={t.backToSecurity}
                title={t.backToSecurity}
                onClick={() => setSecurityPane("overview")}
              >
                <ChevronLeft className="size-5" />
              </Button>
              <h1>{activePageTitle}</h1>
            </div>
            <p>{activePageDescription}</p>
          </div>
        </header>
      )}
      {embedded && (
        <div className="absolute left-[13rem] right-0 top-0 z-20 flex h-12 items-center gap-2 border-b border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-6 backdrop-blur-xl">
          {showSecurityBack && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-full"
              aria-label={t.backToSecurity}
              title={t.backToSecurity}
              onClick={() => setSecurityPane("overview")}
            >
              <ChevronLeft className="size-4" />
            </Button>
          )}
          <h2 className="truncate text-lg font-bold tracking-[-0.025em] text-[var(--foreground)]">
            {activePageTitle}
          </h2>
        </div>
      )}

      {embedded && (
        <div
          className="col-start-1 row-start-1 flex min-h-0 flex-col gap-1 border-r border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-[var(--surface-muted)]/45 p-3 pt-[3.75rem]"
          role="tablist"
          aria-label={t.title}
        >
          {[
            { value: "account" as const, label: t.profileTitle },
            { value: "general" as const, label: t.appearanceTitle },
            { value: "security" as const, label: t.securityTitle },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              onClick={() => {
                setEmbeddedTab(value);
                if (value === "security") setSecurityPane("overview");
              }}
              className={cn(
                "focus-ring inline-flex h-11 w-full shrink-0 items-center justify-start rounded-[var(--control-radius)] px-4 text-left text-sm font-semibold transition-[background-color,color,box-shadow] duration-200",
                activeTab === value
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--foreground)_6%,transparent)]"
                  : "text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--surface)_84%,transparent)] hover:text-[var(--foreground)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div
        className={cn(
          embedded
            ? "col-start-2 row-start-1 min-h-0 overflow-y-auto p-6 pt-[4.5rem]"
            : "mt-5",
        )}
      >
        {activeTab === "account" && (
          <Card className={cn("h-full", panelClassName)}>
            <div className="flex min-h-[4.5rem] items-center justify-between gap-3 border-b pb-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative shrink-0">
                  <UserAvatar
                    user={user}
                    className="size-20 ring-4 ring-[var(--surface)] shadow-xl sm:size-24"
                    imageSizes="96px"
                    imageUrl={
                      removeProfileImage ? null : (profileImagePreview ?? undefined)
                    }
                  />
                  <label
                    className={`focus-ring absolute -bottom-1 -right-1 grid size-10 cursor-pointer place-items-center rounded-full ${
                      profileImage || processingImage
                        ? "text-white"
                        : "text-[var(--foreground)]"
                    }`}
                    title={t.chooseImage}
                    aria-label={t.chooseImage}
                  >
                    <span
                      className={`grid size-9 place-items-center rounded-full border-2 border-[var(--surface)] shadow-lg ${
                        profileImage || processingImage
                          ? "border-[var(--primary)] bg-[var(--primary)]"
                          : "bg-[var(--surface)]"
                      }`}
                    >
                      <Pencil className="size-3.5" />
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={processingImage}
                      onChange={async (event) => {
                        const selectedFile = event.target.files?.[0];
                        if (!selectedFile) return;
                        setProcessingImage(true);
                        try {
                          const preparedImage = await prepareProfileImage(selectedFile);
                          setProfileImage(preparedImage);
                          setRemoveProfileImage(false);
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "The profile image could not be processed.",
                          );
                        } finally {
                          setProcessingImage(false);
                          event.target.value = "";
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-black text-[var(--foreground)]">
                    {user?.firstName} {user?.lastName}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-[var(--muted)]" dir="ltr">
                    {user?.email}
                  </p>
                </div>
              </div>
              {!removeProfileImage && (user?.profileImage || profileImage) && (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  className="shrink-0"
                  onClick={() => {
                    setProfileImage(null);
                    setRemoveProfileImage(Boolean(user?.profileImage));
                  }}
                >
                  <Trash2 className="size-4" />
                  {t.removeImage}
                </Button>
              )}
              <div
                className="pointer-events-none absolute -end-16 -top-20 size-56 rounded-full bg-[var(--primary)]/10 blur-3xl"
                aria-hidden="true"
              />
            </div>
            <div className="grid gap-8 p-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:p-7">
              <form
                onSubmit={submitProfile}
                className="grid content-start gap-4"
                noValidate
              >
                <div>
                  <h3 className="desk-section-title">{t.profileDescription}</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t.firstName}
                    error={profileForm.formState.errors.firstName?.message}
                  >
                    <Input
                      dir="auto"
                      autoComplete="given-name"
                      {...profileForm.register("firstName")}
                    />
                  </Field>
                  <Field
                    label={t.lastName}
                    error={profileForm.formState.errors.lastName?.message}
                  >
                    <Input
                      dir="auto"
                      autoComplete="family-name"
                      {...profileForm.register("lastName")}
                    />
                  </Field>
                </div>
                <Field
                  label={t.email}
                  error={profileForm.formState.errors.email?.message}
                >
                  <Input
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    {...profileForm.register("email")}
                  />
                </Field>
                <div className="mt-2 flex justify-end">
                  <Button
                    type="submit"
                    loading={profileMutation.isPending}
                    disabled={processingImage || !profileHasChanges}
                  >
                    <Save className="size-4" /> {t.saveChanges}
                  </Button>
                </div>
              </form>
              <aside className="desk-panel-soft flex flex-col justify-between p-4">
                <div>
                  <span className="desk-icon-well text-[var(--danger)]">
                    <Trash2 className="size-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-[var(--foreground)]">
                    {t.deleteAccount}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                    {t.deleteAccountHelp}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="mt-6 w-full"
                  onClick={() => setConfirmDeleteAccount(true)}
                >
                  <Trash2 className="size-4" />
                  {t.deleteAccount}
                </Button>
              </aside>
            </div>
          </Card>
        )}

        {activeTab === "general" && (
          <Card className={panelClassName}>
            <section className="pb-6">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {t.themeTitle}
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                {t.appearanceDescription}
              </p>
              <ThemeSelector
                value={theme}
                onValueChange={setTheme}
                labels={{
                  light: t.lightTheme,
                  dark: t.darkTheme,
                  system: t.systemTheme,
                }}
                ariaLabel={t.themeTitle}
                className="mt-4 max-w-md"
              />
            </section>
            <section className="border-t pt-6">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {t.languageTitle}
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                {t.languageDescription}
              </p>
              <SegmentedControl
                value={locale}
                onValueChange={setLocale}
                options={[
                  { value: "en" as const, label: t.english },
                  { value: "de" as const, label: t.german },
                ]}
                ariaLabel={t.languageTitle}
                className="mt-4 max-w-md"
              />
            </section>
          </Card>
        )}

        {activeTab === "security" && securityPane === "overview" && (
          <Card className={panelClassName}>
            <div className="divide-y">
              <button
                type="button"
                className="focus-ring flex min-h-20 w-full items-center gap-3 pb-6 text-left transition-colors hover:text-[var(--primary)]"
                onClick={() => setSecurityPane("password")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t.passwordTitle}</span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {t.passwordDescription}
                  </span>
                </span>
                <ChevronRight className="size-4 text-[var(--muted)]" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="focus-ring flex min-h-20 w-full items-center gap-3 pt-6 text-left transition-colors hover:text-[var(--primary)]"
                onClick={() => setSecurityPane("sessions")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t.sessionsTitle}</span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {t.sessionsDescription}
                  </span>
                </span>
                <Badge>
                  {sessionsQuery.isPending ? "…" : (sessionsQuery.data?.length ?? 0)}
                </Badge>
                <ChevronRight className="size-4 text-[var(--muted)]" aria-hidden="true" />
              </button>
            </div>
          </Card>
        )}

        {activeTab === "security" && securityPane === "password" && (
          <Card className={cn("h-full", panelClassName)}>
            <p className="mb-5 text-xs text-[var(--muted)]">{t.passwordDescription}</p>
            <form onSubmit={submitPassword} className="grid gap-3" noValidate>
              <Field
                label={t.currentPassword}
                error={passwordForm.formState.errors.currentPassword?.message}
              >
                <Input
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                  {...passwordForm.register("currentPassword")}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t.newPassword}
                  error={passwordForm.formState.errors.newPassword?.message}
                >
                  <Input
                    type="password"
                    dir="ltr"
                    autoComplete="new-password"
                    {...passwordForm.register("newPassword")}
                  />
                </Field>
                <Field
                  label={t.confirmPassword}
                  error={passwordForm.formState.errors.confirmPassword?.message}
                >
                  <Input
                    type="password"
                    dir="ltr"
                    autoComplete="new-password"
                    {...passwordForm.register("confirmPassword")}
                  />
                </Field>
              </div>
              <div className="mt-2 flex justify-end">
                <Button type="submit" loading={passwordMutation.isPending}>
                  <ShieldCheck className="size-4" /> {t.changePassword}
                </Button>
              </div>
            </form>
          </Card>
        )}
        {activeTab === "security" && securityPane === "sessions" && (
          <Card className={panelClassName}>
            <p className="mb-3 text-xs text-[var(--muted)]">{t.sessionsDescription}</p>

            {sessionsQuery.isPending ? (
              <LoadingState label={t.loadingSessions} />
            ) : sessionsQuery.isError ? (
              <ErrorState
                message={getErrorMessage(sessionsQuery.error, locale)}
                retry={() => void sessionsQuery.refetch()}
              />
            ) : (
              <>
                <div className="mt-3 divide-y">
                  {sessionsQuery.data.map((session) => {
                    const device = deviceInfo(session.userAgent);
                    const DeviceIcon = device.icon;
                    return (
                      <article
                        key={getId(session)}
                        className="flex flex-col gap-3 py-4 first:pt-2 sm:flex-row sm:items-center"
                      >
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--muted)]">
                          <DeviceIcon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-[var(--foreground)]">
                              {t.devices[device.kind]}
                            </h3>
                            {session.isCurrent && (
                              <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                {t.currentDevice}
                              </Badge>
                            )}
                          </div>
                          <p
                            className="mt-1 truncate text-xs text-[var(--muted)]"
                            title={session.userAgent ?? undefined}
                          >
                            <bdi dir="ltr">{session.ipAddress ?? t.ipUnavailable}</bdi> ·{" "}
                            {t.lastUsed} {formatDateTime(session.lastUsedAt, intlLocale)}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)] opacity-80">
                            {t.expires}: {formatDateTime(session.expiresAt, intlLocale)}
                          </p>
                        </div>
                        {!session.isCurrent && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="shrink-0"
                            onClick={() => setSessionToRevoke(session)}
                          >
                            {t.closeSession}
                          </Button>
                        )}
                      </article>
                    );
                  })}
                </div>
                <div className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-md text-xs leading-5 text-[var(--muted)]">
                    {t.signOutAllDescription}
                  </p>
                  <Button
                    type="button"
                    variant="danger"
                    className="shrink-0"
                    onClick={() => setConfirmAll(true)}
                  >
                    {t.signOutAll}
                  </Button>
                </div>
              </>
            )}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={t.signOutAllTitle}
        description={t.signOutAllDescription}
        confirmLabel={t.signOutAll}
        loading={allMutation.isPending}
        onConfirm={() => allMutation.mutateAsync().then(() => undefined)}
      />
      <ConfirmDialog
        open={Boolean(sessionToRevoke)}
        onOpenChange={(open) => {
          if (!open) setSessionToRevoke(null);
        }}
        title={t.closeSessionTitle}
        description={t.closeSessionDescription}
        confirmLabel={t.closeSession}
        loading={revokeMutation.isPending}
        onConfirm={() => {
          if (sessionToRevoke) {
            return revokeMutation.mutateAsync(sessionToRevoke).then(() => undefined);
          }
        }}
      />
      <ConfirmDialog
        open={confirmDeleteAccount}
        onOpenChange={setConfirmDeleteAccount}
        title={t.deleteAccountTitle}
        description={t.deleteAccountDescription}
        confirmLabel={t.deleteAccount}
        confirmVariant="danger"
        loading={deleteAccountMutation.isPending}
        onConfirm={() => deleteAccountMutation.mutateAsync().then(() => undefined)}
      />
    </div>
  );
}
