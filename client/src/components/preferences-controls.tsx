"use client";

import { Languages, Palette, Settings2 } from "lucide-react";

import { ThemeSelector } from "@/components/ui/theme-selector";
import { usePreferences } from "@/providers/preferences-provider";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    open: "Open language and appearance settings",
    title: "Preferences",
    language: "Language",
    appearance: "Appearance",
    english: "English",
    german: "Deutsch",
    light: "Light",
    dark: "Dark",
    system: "System",
    sidebarLabel: "Appearance & language",
  },
  de: {
    open: "Sprach- und Darstellungseinstellungen öffnen",
    title: "Einstellungen",
    language: "Sprache",
    appearance: "Darstellung",
    english: "English",
    german: "Deutsch",
    light: "Hell",
    dark: "Dunkel",
    system: "System",
    sidebarLabel: "Darstellung & Sprache",
  },
} as const;

export function PreferencesControls({
  className,
  placement = "default",
}: {
  className?: string;
  placement?: "default" | "sidebar";
}) {
  const { locale, theme, setLocale, setTheme } = usePreferences();
  const t = copy[locale];

  return (
    <details className={cn("group relative", className)}>
      <summary
        className={cn(
          "focus-ring list-none border bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] text-[var(--muted)] shadow-[0_6px_18px_rgb(30_35_65_/_0.06)] backdrop-blur transition hover:border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] hover:text-[var(--primary)] [&::-webkit-details-marker]:hidden",
          placement === "sidebar"
            ? "flex h-11 w-full items-center gap-3 rounded-full px-3 text-sm font-semibold"
            : "grid size-11 place-items-center rounded-full",
        )}
        aria-label={t.open}
        title={t.title}
      >
        {placement === "sidebar" ? (
          <>
            <Palette className="size-4.5 shrink-0" />
            <span className="truncate">{t.sidebarLabel}</span>
          </>
        ) : (
          <Settings2 className="size-4.5" />
        )}
      </summary>
      <div
        className={cn(
          "surface-shadow z-[60] rounded-[1.25rem] border bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] p-3.5 text-[var(--foreground)] backdrop-blur-xl",
          placement === "sidebar"
            ? "fixed inset-x-3 bottom-20 w-auto sm:absolute sm:inset-x-auto sm:bottom-12 sm:start-0 sm:w-72"
            : "fixed inset-x-3 top-22 w-auto sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:w-72",
        )}
      >
        <div className="flex items-center gap-2 px-1 pb-2 text-sm font-bold">
          <Languages className="size-4 text-[var(--primary)]" />
          {t.language}
        </div>
        <div
          className="grid grid-cols-2 gap-1 rounded-full bg-[var(--surface-muted)] p-1"
          role="group"
          aria-label={t.language}
        >
          {(
            [
              ["en", t.english],
              ["de", t.german],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setLocale(value)}
              className={cn(
                "focus-ring flex h-11 items-center justify-center rounded-full px-3 text-sm font-semibold transition",
                locale === value
                  ? "bg-[var(--surface)] text-[var(--primary)] shadow-[0_6px_16px_rgb(30_35_65_/_0.08)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]",
              )}
              aria-pressed={locale === value}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 px-1 pb-2 text-sm font-bold">{t.appearance}</div>
        <ThemeSelector
          value={theme}
          onValueChange={setTheme}
          labels={{ light: t.light, dark: t.dark, system: t.system }}
          ariaLabel={t.appearance}
        />
      </div>
    </details>
  );
}
