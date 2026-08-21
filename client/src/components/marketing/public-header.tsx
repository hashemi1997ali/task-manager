"use client";

import { ArrowRight, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/logo";
import { buttonClassName } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/features/auth/auth-provider";
import { usePreferences } from "@/providers/preferences-provider";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    features: "Features",
    workflow: "How it works",
    security: "Security",
    tasks: "My tasks",
    contact: "Contact",
    dashboard: "My dashboard",
    login: "Log in",
    start: "Start free",
    navigation: "Main navigation",
  },
  de: {
    features: "Funktionen",
    workflow: "So funktioniert's",
    security: "Sicherheit",
    tasks: "Meine Aufgaben",
    contact: "Kontakt",
    dashboard: "Mein Dashboard",
    login: "Anmelden",
    start: "Kostenlos starten",
    navigation: "Hauptnavigation",
  },
} as const;

export function PublicHeader({ overlay = false }: { overlay?: boolean }) {
  const { status } = useAuth();
  const { locale } = usePreferences();
  const pathname = usePathname();
  const t = copy[locale];
  const authenticated = status === "authenticated";

  const navItems = [
    { href: "/#features", label: t.features },
    { href: "/#workflow", label: t.workflow },
    { href: "/#security", label: t.security },
    { href: "/contact", label: t.contact, active: pathname === "/contact" },
  ];

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-4 z-50 sm:top-6",
          overlay ? null : "text-[var(--foreground)]",
        )}
      >
        <div className="portfolio-nav-shell mx-auto w-[calc(100%-2rem)] justify-between sm:w-[calc(100%-3rem)] lg:w-fit lg:justify-start">
          <Logo
            className="h-10 min-w-0 shrink-0 px-0.5"
            markClassName="size-8 rounded-xl shadow-none sm:size-9 lg:size-8"
            wordmarkClassName="text-base sm:text-[1.1rem]"
          />
          <span className="mx-1 hidden h-5 w-px bg-[var(--border)] lg:block" aria-hidden="true" />
          <nav
            className="hidden items-center gap-1 text-sm font-medium lg:flex"
            aria-label={t.navigation}
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className="portfolio-nav-item focus-ring"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="mx-1 hidden h-5 w-px bg-[var(--border)] lg:block" aria-hidden="true" />
          <div className="flex items-center gap-1">
            <ThemeToggle className="size-10" />
            {authenticated ? (
              <Link
                href="/dashboard"
                className={buttonClassName({ size: "sm", className: "h-10 rounded-full px-3 sm:px-4" })}
                aria-label={t.dashboard}
              >
                <LayoutDashboard className="size-4" />
                <span className="max-[419px]:hidden min-[420px]:inline">
                  {t.dashboard}
                </span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={buttonClassName({
                  variant: "ghost",
                  size: "sm",
                  className: "max-lg:hidden h-10 rounded-full px-4 lg:inline-flex",
                })}
                >
                  {t.login}
                </Link>
                <Link
                  href="/register"
                  className={buttonClassName({
                  size: "sm",
                  className: "hidden h-10 rounded-full px-4 sm:inline-flex",
                })}
                  aria-label={t.start}
                >
                  <span className="max-[419px]:hidden min-[420px]:inline">
                    {t.start}
                  </span>
                  <ArrowRight className="size-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {!overlay && <div className="h-[5.75rem]" aria-hidden="true" />}
    </>
  );
}
