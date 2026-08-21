"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Bot,
  CheckSquare2,
  ChevronRight,
  Headphones,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  ShieldCheck,
  TicketCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Logo, LogoMark, LogoWordmark } from "@/components/logo";
import { UserAvatar } from "@/components/user-avatar";
import { Button, buttonClassName } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { AccountView } from "@/features/account/account-view";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    today: "Overview",
    tasks: "My requests",
    assistant: "AI triage",
    account: "Account",
    general: "General",
    profile: "Account",
    security: "Security",
    sessions: "Active sessions",
    accountNavigation: "Account settings",
    settings: "Settings",
    settingsDescription: "Profile, language, security, and active sessions.",
    theme: "Theme",
    lightTheme: "Light",
    darkTheme: "Dark",
    systemTheme: "System",
    userMenu: "Account menu",
    overview: "Overview",
    allTasks: "All tasks",
    users: "Users",
    supportChat: "Support chat",
    contactForm: "Contact form",
    contactUs: "Contact us",
    administration: "Administration",
    navigation: "Workspace navigation",
    newTask: "New request",
    more: "More",
    moreDescription: "Account and administration options.",
    close: "Close menu",
    logout: "Sign out",
    loggedOut: "You have been signed out.",
    logoutTitle: "Sign out of this device?",
    logoutDescription: "This session will end on this device.",
    collapseSidebar: "Collapse sidebar",
    expandSidebar: "Expand sidebar",
  },
  de: {
    today: "Übersicht",
    tasks: "Meine Anfragen",
    assistant: "KI-Triage",
    account: "Konto",
    general: "Allgemein",
    profile: "Konto",
    security: "Sicherheit",
    sessions: "Aktive Sitzungen",
    accountNavigation: "Kontoeinstellungen",
    settings: "Einstellungen",
    settingsDescription: "Profil, Sprache, Sicherheit und aktive Sitzungen.",
    theme: "Design",
    lightTheme: "Hell",
    darkTheme: "Dunkel",
    systemTheme: "System",
    userMenu: "KontomenÃ¼",
    overview: "Übersicht",
    allTasks: "Alle Aufgaben",
    users: "Benutzer",
    supportChat: "Support-Chat",
    contactForm: "Kontaktformular",
    contactUs: "Kontaktiere uns",
    administration: "Administration",
    navigation: "Arbeitsbereich-Navigation",
    newTask: "Neue Anfrage",
    more: "Mehr",
    moreDescription: "Konto- und Administrationsoptionen.",
    close: "Menü schließen",
    logout: "Abmelden",
    loggedOut: "Du wurdest abgemeldet.",
    logoutTitle: "Von diesem Gerät abmelden?",
    logoutDescription: "Die Sitzung auf diesem Gerät wird beendet.",
    collapseSidebar: "Seitenleiste einklappen",
    expandSidebar: "Seitenleiste ausklappen",
  },
} as const;

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type AccountSection = "general" | "account" | "security";

const SIDEBAR_TRANSITION_MS = 300;

const persistSidebarPreference = (device: "tablet" | "desktop", collapsed: boolean) => {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `karino-sidebar-${device}=${
    collapsed ? "collapsed" : "expanded"
  }; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
};

export function AppShell({
  children,
  initialTabletSidebarCollapsed,
  initialDesktopSidebarCollapsed,
}: {
  children: ReactNode;
  initialTabletSidebarCollapsed: boolean;
  initialDesktopSidebarCollapsed: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, theme, setTheme } = usePreferences();
  const { user, isAdmin, logout } = useAuth();
  const t = copy[locale];
  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [tabletSidebarCollapsed, setTabletSidebarCollapsed] = useState(
    initialTabletSidebarCollapsed,
  );
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(
    initialDesktopSidebarCollapsed,
  );
  const [tabletSidebarOpening, setTabletSidebarOpening] = useState(false);
  const [desktopSidebarOpening, setDesktopSidebarOpening] = useState(false);
  const [localNow, setLocalNow] = useState<Date | null>(null);

  useEffect(() => {
    const updateClock = () => setLocalNow(new Date());
    updateClock();
    const interval = window.setInterval(updateClock, 30_000);
    document.addEventListener("visibilitychange", updateClock);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateClock);
    };
  }, []);
  const workspaceLinks = useMemo<NavItem[]>(
    () => [
      { href: "/dashboard", label: t.today, icon: LayoutDashboard },
      { href: "/tickets", label: t.tasks, icon: TicketCheck },
      { href: "/assistant", label: t.assistant, icon: Bot },
    ],
    [t],
  );
  const accountSectionLinks = useMemo<Array<NavItem & { section: AccountSection }>>(
    () => [
      {
        href: "/account?tab=account",
        label: t.profile,
        icon: UserRound,
        section: "account",
      },
      {
        href: "/account?tab=general",
        label: t.general,
        icon: Settings,
        section: "general",
      },
      {
        href: "/account?tab=security",
        label: t.security,
        icon: KeyRound,
        section: "security",
      },
    ],
    [t],
  );
  const adminLinks = useMemo<NavItem[]>(
    () => [
      { href: "/admin", label: t.overview, icon: ShieldCheck },
      { href: "/admin/tickets", label: t.allTasks, icon: TicketCheck },
      { href: "/admin/users", label: t.users, icon: UsersRound },
      { href: "/admin/support", label: t.supportChat, icon: Headphones },
      { href: "/admin/contact", label: t.contactForm, icon: Mail },
    ],
    [t],
  );

  const requestedAccountSection = searchParams.get("tab");
  const activeAccountSection: AccountSection =
    requestedAccountSection === "general" || requestedAccountSection === "appearance"
      ? "general"
      : requestedAccountSection === "security" || requestedAccountSection === "sessions"
        ? "security"
        : "account";
  const isSettingsPage = pathname === "/account" || pathname.startsWith("/account/");

  const doLogout = async () => {
    setLogoutPending(true);
    try {
      await logout();
    } finally {
      setLogoutPending(false);
      setConfirmLogout(false);
      toast.success(t.loggedOut);
      router.replace("/");
    }
  };

  const navLink = ({ href, label, icon: Icon }: NavItem, compact = false) => {
    const active =
      pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        title={compact ? label : undefined}
        onClick={() => setMoreOpen(false)}
        className={cn(
          "desk-nav-link focus-ring flex h-11 w-full items-center gap-3 overflow-hidden rounded-[0.85rem] px-3.5 text-sm font-bold transition-[background-color,color,box-shadow] duration-150",
          active ? "is-active" : undefined,
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        <span
          className={cn(
            "min-w-0 truncate whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none",
            compact
              ? "pointer-events-none opacity-0"
              : "opacity-100 delay-100 motion-reduce:delay-0",
          )}
        >
          {label}
        </span>
      </Link>
    );
  };

  const sidebarDivider = (compact: boolean, label?: string) => (
    <div className="flex h-9 shrink-0 items-center px-3.5" aria-hidden="true">
      {compact || !label ? (
        <span
          className={cn("desk-sidebar-separator block h-px", compact ? "w-5" : "w-full")}
        />
      ) : (
        <span className="desk-divider-label w-full whitespace-nowrap">{label}</span>
      )}
    </div>
  );

  const sidebarFooter = (compact: boolean) => (
    <div className="shrink-0 px-3 pb-3">
      {sidebarDivider(compact)}
      <button
        type="button"
        data-user-menu-trigger
        title={compact ? t.account : undefined}
        aria-label={t.userMenu}
        aria-expanded={userMenuOpen}
        onClick={() => setUserMenuOpen((open) => !open)}
        className={cn(
          "desk-nav-link focus-ring flex h-11 w-full items-center gap-3 overflow-hidden rounded-[0.85rem] px-3.5 text-left text-sm font-bold transition-colors",
          userMenuOpen ? "is-active" : undefined,
        )}
      >
        <UserAvatar
          user={user}
          className="size-6 shrink-0 border-white/6 text-[10px]"
          imageSizes="24px"
        />
        <span
          className={cn(
            "min-w-0 truncate whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none",
            compact
              ? "pointer-events-none opacity-0"
              : "opacity-100 delay-100 motion-reduce:delay-0",
          )}
        >
          {user?.firstName} {user?.lastName}
        </span>
      </button>
    </div>
  );

  const adminDivider = (compact = false) => sidebarDivider(compact, t.administration);

  const sidebarContent = (compact: boolean, opening: boolean, onToggle: () => void) => {
    const showOpenControl = compact;

    return (
      <>
        <div className="desk-sidebar-head flex h-16 shrink-0 items-center gap-2 overflow-hidden px-4">
          <div
            className={cn(
              "group/sidebar-logo relative h-11 min-w-0",
              compact ? "w-10 shrink-0" : "flex-1",
            )}
          >
            {showOpenControl ? (
              <button
                type="button"
                onClick={onToggle}
                aria-label={t.expandSidebar}
                aria-expanded={false}
                title={t.expandSidebar}
                className={cn(
                  "focus-ring absolute -left-0.5 top-0 z-0 size-11 rounded-full",
                  compact && "hover:bg-white/5",
                )}
              />
            ) : (
              <Link
                href="/"
                aria-label="Karino"
                className="focus-ring absolute inset-y-0 left-0 z-20 w-28 rounded-xl"
              />
            )}
            <LogoMark
              className={cn(
                "pointer-events-none absolute left-0 top-1/2 z-10 -translate-y-1/2 transition-opacity duration-150 motion-reduce:transition-none",
                compact
                  ? "group-hover/sidebar-logo:opacity-0 group-focus-within/sidebar-logo:opacity-0"
                  : "opacity-100",
              )}
            />
            <LogoWordmark
              inverse
              className={cn(
                "pointer-events-none absolute left-[3.125rem] top-1/2 z-10 -translate-y-1/2 transition-opacity duration-150 motion-reduce:transition-none",
                showOpenControl
                  ? "opacity-0"
                  : "opacity-100 delay-100 motion-reduce:delay-0",
              )}
            />
            <PanelLeftOpen
              className={cn(
                "pointer-events-none absolute left-5 top-1/2 z-10 size-5 -translate-x-1/2 -translate-y-1/2 text-white transition-opacity duration-150 motion-reduce:transition-none",
                compact
                  ? "opacity-0 group-hover/sidebar-logo:opacity-100 group-focus-within/sidebar-logo:opacity-100"
                  : "opacity-0",
              )}
              aria-hidden="true"
            />
          </div>
          {!showOpenControl && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "shrink-0 text-white/55 transition-opacity duration-150 hover:border-white/6 hover:bg-white/5 hover:text-white motion-reduce:transition-none",
                opening ? "pointer-events-none opacity-0" : "opacity-100",
              )}
              aria-label={t.collapseSidebar}
              aria-expanded={true}
              aria-hidden={opening}
              tabIndex={opening ? -1 : undefined}
              title={t.collapseSidebar}
              onClick={onToggle}
            >
              <PanelLeftClose className="size-5" aria-hidden="true" />
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4">
          <nav className="space-y-1.5" aria-label={t.navigation}>
            {workspaceLinks.map((item) => navLink(item, compact))}
          </nav>
          {isAdmin && (
            <>
              {adminDivider(compact)}
              <nav className="space-y-1.5" aria-label={t.administration}>
                {adminLinks.map((item) => navLink(item, compact))}
              </nav>
            </>
          )}
        </div>
        {sidebarFooter(compact)}
      </>
    );
  };

  const toggleTabletSidebar = () => {
    const nextValue = !tabletSidebarCollapsed;
    setTabletSidebarCollapsed(nextValue);
    persistSidebarPreference("tablet", nextValue);
    setTabletSidebarOpening(!nextValue);
    if (!nextValue) {
      const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : SIDEBAR_TRANSITION_MS;
      window.setTimeout(() => setTabletSidebarOpening(false), duration);
    }
  };

  const toggleDesktopSidebar = () => {
    const nextValue = !desktopSidebarCollapsed;
    setDesktopSidebarCollapsed(nextValue);
    persistSidebarPreference("desktop", nextValue);
    setDesktopSidebarOpening(!nextValue);
    if (!nextValue) {
      const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : SIDEBAR_TRANSITION_MS;
      window.setTimeout(() => setDesktopSidebarOpening(false), duration);
    }
  };

  return (
    <div
      className={cn(
        "desk-shell min-h-dvh transition-[padding] duration-300 ease-out motion-reduce:transition-none",
        tabletSidebarCollapsed ? "md:pl-[5.75rem]" : "md:pl-[17.25rem]",
        desktopSidebarCollapsed ? "xl:pl-[5.75rem]" : "xl:pl-[17.25rem]",
      )}
    >
      <aside
        className={cn(
          "desk-sidebar fixed inset-y-3 left-3 z-30 max-md:hidden overflow-hidden flex-col transition-[width] duration-300 ease-out motion-reduce:transition-none md:flex xl:hidden",
          tabletSidebarCollapsed ? "w-[4.75rem]" : "w-[15.75rem]",
        )}
      >
        {sidebarContent(
          tabletSidebarCollapsed,
          tabletSidebarOpening,
          toggleTabletSidebar,
        )}
      </aside>
      <aside
        className={cn(
          "desk-sidebar fixed inset-y-3 left-3 z-30 max-xl:hidden overflow-hidden flex-col transition-[width] duration-300 ease-out motion-reduce:transition-none xl:flex",
          desktopSidebarCollapsed ? "w-[4.75rem]" : "w-[15.75rem]",
        )}
      >
        {sidebarContent(
          desktopSidebarCollapsed,
          desktopSidebarOpening,
          toggleDesktopSidebar,
        )}
      </aside>

      <header className="pointer-events-none absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-40 flex items-center justify-between sm:inset-x-6 sm:top-6 md:justify-end lg:inset-x-8">
        <Logo
          className="pointer-events-auto md:hidden"
          markClassName="size-9 rounded-xl shadow-none"
          wordmarkClassName="text-base"
        />
        <Link
          href="/tasks?new=1"
          className={buttonClassName({
            size: "sm",
            className: "pointer-events-auto h-11 rounded-full px-4 shadow-sm",
          })}
        >
          <Plus className="size-4" />
          <span>{t.newTask}</span>
        </Link>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "desk-main min-h-dvh px-4 pb-[6.5rem] sm:px-6 lg:px-8",
          "pt-[5.25rem] sm:pt-[5.75rem] md:py-6 lg:py-8",
        )}
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-3 bottom-3 z-30 grid h-[calc(4.25rem+env(safe-area-inset-bottom))] grid-cols-4 rounded-[1.35rem] border border-white/6 bg-[#101124]/95 px-1 pb-[env(safe-area-inset-bottom)] text-white shadow-[0_20px_55px_rgb(7_7_20_/_0.38)] backdrop-blur-xl md:hidden"
        aria-label={t.navigation}
      >
        {workspaceLinks.slice(0, 3).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-ring grid min-w-0 place-items-center content-center gap-1 rounded-[1rem] text-[10px] font-bold",
                active ? "bg-white/8 text-[#aaa1ff]" : "text-white/48",
              )}
            >
              <Icon className="size-5" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label={t.more}
          aria-expanded={moreOpen}
          className={cn(
            "focus-ring grid place-items-center content-center gap-1 rounded-[1rem] text-[10px] font-bold",
            moreOpen || isSettingsPage
              ? "bg-white/8 text-[#aaa1ff]"
              : "text-white/48",
          )}
        >
          <UserAvatar
            user={user}
            className="size-6 border-white/6 text-[9px]"
            imageSizes="24px"
          />
          {t.more}
        </button>
      </nav>

      <Dialog.Root open={userMenuOpen} onOpenChange={setUserMenuOpen} modal={false}>
        <Dialog.Portal>
          <Dialog.Content
            onPointerDownOutside={(event) => {
              const target = event.target as Element | null;
              if (target?.closest("[data-user-menu-trigger]")) {
                event.preventDefault();
              }
            }}
            className="fixed bottom-[4.75rem] left-6 z-[70] hidden w-[14.25rem] overflow-hidden rounded-[1rem] border border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-[var(--surface)] p-2 text-[var(--foreground)] shadow-[var(--shadow-float)] outline-none md:block"
          >
            <Dialog.Title className="sr-only">{t.userMenu}</Dialog.Title>
            <Dialog.Description className="sr-only">
              {t.settingsDescription}
            </Dialog.Description>

            <p className="truncate px-3 py-2 text-xs text-[var(--muted)]" dir="ltr">
              {user?.email}
            </p>
            <ThemeSelector
              value={theme}
              onValueChange={setTheme}
              labels={{
                light: t.lightTheme,
                dark: t.darkTheme,
                system: t.systemTheme,
              }}
              ariaLabel={t.theme}
              className="mb-1"
              compact
              iconOnly
            />

            <button
              type="button"
              className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors hover:bg-[var(--surface-muted)]"
              onClick={() => {
                setUserMenuOpen(false);
                setAccountSettingsOpen(true);
              }}
            >
              <Settings className="size-5 text-[var(--muted)]" aria-hidden="true" />
              <span>{t.settings}</span>
            </button>
            <Link
              href="/contact"
              className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors hover:bg-[var(--surface-muted)]"
              onClick={() => setUserMenuOpen(false)}
            >
              <Mail className="size-5 text-[var(--muted)]" aria-hidden="true" />
              <span>{t.contactUs}</span>
            </Link>
            <button
              type="button"
              className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]"
              onClick={() => {
                setUserMenuOpen(false);
                setConfirmLogout(true);
              }}
            >
              <LogOut className="size-5" aria-hidden="true" />
              <span>{t.logout}</span>
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={accountSettingsOpen} onOpenChange={setAccountSettingsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] hidden bg-black/60 backdrop-blur-sm md:block" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] hidden h-[min(78dvh,46rem)] w-[min(68rem,calc(100%-3rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.5rem] border border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-[var(--surface)] shadow-[var(--shadow-float)] outline-none md:block">
            <div className="absolute left-0 top-0 z-30 flex h-12 w-[13rem] items-center border-r border-b border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-[color-mix(in_srgb,var(--surface-muted)_94%,transparent)] px-3 backdrop-blur-xl">
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t.close}
                  className="size-10 rounded-full"
                >
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
              <Dialog.Title className="sr-only">{t.settings}</Dialog.Title>
            </div>
            <Dialog.Description className="sr-only">
              {t.settingsDescription}
            </Dialog.Description>
            <AccountView embedded />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <Dialog.Portal>
          <Dialog.Content className="desk-mobile-more fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#101124] text-white outline-none md:hidden">
            <div className="desk-sidebar-head flex shrink-0 items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
              <Dialog.Title className="sr-only">{t.more}</Dialog.Title>
              <UserAvatar
                user={user}
                className="size-14 border-white/6"
                imageSizes="56px"
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold tracking-[-0.025em] text-white">
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="mt-1 truncate text-sm text-white/50" dir="ltr">
                  {user?.email}
                </p>
              </div>
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 rounded-full border-white/6 text-white/60 hover:bg-white/10 hover:text-white"
                  aria-label={t.close}
                >
                  <X className="size-5" />
                </Button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">
              {t.settingsDescription}
            </Dialog.Description>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <p className="mb-2 px-3.5 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-white/35">
                {t.accountNavigation}
              </p>
              <nav className="space-y-1.5" aria-label={t.accountNavigation}>
                {accountSectionLinks.map(({ href, label, icon: Icon, section }) => {
                  const active =
                    pathname === "/account" && activeAccountSection === section;
                  return (
                    <Link
                      key={section}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "desk-nav-link focus-ring flex h-14 items-center gap-3 rounded-[0.9rem] px-3.5 text-sm font-bold transition-[background-color,color,box-shadow] duration-150",
                        active && "is-active",
                      )}
                    >
                      <Icon className="size-5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <ChevronRight
                        className="size-4 shrink-0 text-white/30"
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
              </nav>
              {isAdmin && (
                <>
                  <p className="mt-7 mb-2 px-3.5 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-white/35">
                    {t.administration}
                  </p>
                  <nav className="space-y-1.5" aria-label={t.administration}>
                    {adminLinks.map(({ href, label, icon: Icon }) => {
                      const active =
                        pathname === href ||
                        (href !== "/admin" && pathname.startsWith(`${href}/`));
                      return (
                        <Link
                          key={href}
                          href={href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "desk-nav-link focus-ring flex h-14 items-center gap-3 rounded-[0.9rem] px-3.5 text-sm font-bold transition-[background-color,color,box-shadow] duration-150",
                            active && "is-active",
                          )}
                        >
                          <Icon className="size-5 shrink-0" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          <ChevronRight
                            className="size-4 shrink-0 text-white/30"
                            aria-hidden="true"
                          />
                        </Link>
                      );
                    })}
                  </nav>
                </>
              )}
            </div>
            <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <span
                className="desk-sidebar-separator mb-1 block h-px w-full"
                aria-hidden="true"
              />
              <Link
                href="/contact"
                onClick={() => setMoreOpen(false)}
                className="focus-ring flex min-h-12 w-full items-center gap-3 rounded-full px-3 text-sm font-medium text-white/75 transition-colors hover:bg-white/8 hover:text-white"
              >
                <Mail className="size-5 text-white/45" aria-hidden="true" />
                <span>{t.contactUs}</span>
              </Link>
              <button
                type="button"
                className="focus-ring flex min-h-12 w-full items-center gap-3 rounded-full px-3 text-sm font-medium text-red-300 transition-colors hover:bg-red-400/10 hover:text-red-200"
                onClick={() => {
                  setMoreOpen(false);
                  setConfirmLogout(true);
                }}
              >
                <LogOut className="size-5" aria-hidden="true" />
                <span>{t.logout}</span>
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title={t.logoutTitle}
        description={t.logoutDescription}
        confirmLabel={t.logout}
        loading={logoutPending}
        onConfirm={doLogout}
      />
    </div>
  );
}
