import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AppProviders } from "@/providers/app-providers";
import {
  LOCALE_COOKIE_NAME,
  parseLocale,
  parseThemePreference,
  THEME_COOKIE_NAME,
  type Locale,
  type ThemePreference,
} from "@/lib/preferences";
import "./globals.css";

const metadataByLocale: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "Karino | AI-assisted task management",
    description:
      "A calm, secure workspace for tasks, progress, and personal AI assistance.",
  },
  de: {
    title: "Karino | KI-gestützte Aufgabenverwaltung",
    description: "Ein einfacher, schneller und sicherer Ort für deine Tagesplanung.",
  },
};

const getRequestLocale = async (): Promise<Locale> => {
  const cookieStore = await cookies();
  return parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = metadataByLocale[locale];
  return {
    title: { default: copy.title, template: `%s | Karino Desk` },
    description: copy.description,
    applicationName: "Karino Desk",
  };
}

const createThemeScript = (initialTheme: ThemePreference | null) => `(() => {
  try {
    const stored = localStorage.getItem("karino-theme");
    const initial = ${initialTheme ? JSON.stringify(initialTheme) : "null"};
    const preference = stored === "light" || stored === "dark" || stored === "system" ? stored : (initial || "system");
    const theme = preference === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : preference;
    const dark = theme === "dark";
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.dataset.theme = preference;
    root.style.colorScheme = dark ? "dark" : "light";
  } catch {}
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const cookieStore = await cookies();
  const initialTheme = parseThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value);

  return (
    <html
      lang={locale}
      dir="ltr"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: createThemeScript(initialTheme) }} />
      </head>
      <body className="min-h-full">
        <a className="skip-link focus-ring" href="#main-content">
          {locale === "de" ? "Zum Inhalt springen" : "Skip to content"}
        </a>
        <AppProviders initialLocale={locale} initialTheme={initialTheme}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
