export const LOCALE_COOKIE_NAME = "karino-locale";
export const THEME_COOKIE_NAME = "karino-theme";
export const THEME_STORAGE_KEY = "karino-theme";

export const SUPPORTED_LOCALES = ["en", "de"] as const;
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const parseLocale = (value: unknown): Locale => (value === "de" ? "de" : "en");

export const parseThemePreference = (value: unknown): ThemePreference | null =>
  value === "light" || value === "dark" || value === "system" ? value : null;

export const getIntlLocale = (locale: Locale): string =>
  locale === "de" ? "de-DE" : "en-US";
