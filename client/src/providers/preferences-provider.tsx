"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getIntlLocale,
  LOCALE_COOKIE_NAME,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type Locale,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/preferences";

interface PreferencesContextValue {
  locale: Locale;
  intlLocale: string;
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const prefersDark = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const applyTheme = (theme: ThemePreference): ResolvedTheme => {
  const root = document.documentElement;
  const resolvedTheme: ResolvedTheme =
    theme === "system" ? (prefersDark() ? "dark" : "light") : theme;
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = resolvedTheme;
  return resolvedTheme;
};

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

export function PreferencesProvider({
  children,
  initialLocale,
  initialTheme,
}: {
  children: ReactNode;
  initialLocale: Locale;
  initialTheme: ThemePreference | null;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme ?? "system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    initialTheme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    let storedTheme: ThemePreference | null = null;
    try {
      const storedValue = localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemePreference(storedValue)) storedTheme = storedValue;
    } catch {
      // Fall through to the cookie or the current OS preference.
    }

    const nextTheme = storedTheme ?? initialTheme ?? "system";
    const nextResolvedTheme = applyTheme(nextTheme);
    queueMicrotask(() => setThemeState(nextTheme));
    queueMicrotask(() => setResolvedTheme(nextResolvedTheme));

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const nextSyncedTheme = isThemePreference(event.newValue)
        ? event.newValue
        : "system";
      setThemeState(nextSyncedTheme);
      setResolvedTheme(applyTheme(nextSyncedTheme));
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [initialTheme]);

  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemTheme = () => setResolvedTheme(applyTheme("system"));
    media.addEventListener("change", handleSystemTheme);
    return () => media.removeEventListener("change", handleSystemTheme);
  }, [theme]);

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      setLocaleState(nextLocale);
      document.documentElement.lang = nextLocale;
      document.documentElement.dir = "ltr";
      document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.refresh();
    },
    [router],
  );

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    setResolvedTheme(applyTheme(nextTheme));
    document.cookie = `${THEME_COOKIE_NAME}=${nextTheme}; Path=/; Max-Age=31536000; SameSite=Lax`;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Cookie persistence and immediate DOM application still work when storage is blocked.
    }
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      locale,
      intlLocale: getIntlLocale(locale),
      theme,
      resolvedTheme,
      setLocale,
      setTheme,
    }),
    [locale, theme, resolvedTheme, setLocale, setTheme],
  );

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export const usePreferences = (): PreferencesContextValue => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }
  return context;
};
