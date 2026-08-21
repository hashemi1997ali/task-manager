"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

import { cn } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const subscribeToMount = () => () => undefined;

const useIsMounted = (): boolean =>
  useSyncExternalStore(subscribeToMount, () => true, () => false);

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

export function ThemeToggle({ className }: { className?: string }) {
  const mounted = useIsMounted();
  const { locale, resolvedTheme, setTheme } = usePreferences();
  const isDark = mounted && resolvedTheme === "dark";
  const label =
    locale === "de"
      ? isDark
        ? "Zum hellen Design wechseln"
        : "Zum dunklen Design wechseln"
      : isDark
        ? "Switch to light theme"
        : "Switch to dark theme";

  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const nextTheme = isDark ? "light" : "dark";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const documentWithTransition = document as DocumentWithViewTransition;

    if (!documentWithTransition.startViewTransition || reduceMotion) {
      setTheme(nextTheme);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(centerX, window.innerWidth - centerX),
      Math.max(centerY, window.innerHeight - centerY),
    );
    const root = document.documentElement;
    root.style.setProperty("--theme-cx", `${centerX}px`);
    root.style.setProperty("--theme-cy", `${centerY}px`);
    root.style.setProperty("--theme-r", `${radius}px`);
    root.dataset.themeAnim = "1";

    const transition = documentWithTransition.startViewTransition(() => {
      flushSync(() => setTheme(nextTheme));
    });
    transition.finished.finally(() => {
      delete root.dataset.themeAnim;
    });
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={mounted ? label : locale === "de" ? "Design wechseln" : "Toggle theme"}
      aria-pressed={mounted ? isDark : undefined}
      className={cn(
        "focus-ring relative inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-[var(--surface)] text-[var(--foreground)] transition-colors duration-200 hover:bg-[var(--surface-muted)]",
        className,
      )}
    >
      <span aria-hidden="true" className="relative size-4">
        <Sun
          className={cn(
            "absolute inset-0 size-4 transition-[opacity,transform] duration-300 motion-reduce:transition-none",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 size-4 transition-[opacity,transform] duration-300 motion-reduce:transition-none",
            !isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0",
          )}
        />
      </span>
    </button>
  );
}
