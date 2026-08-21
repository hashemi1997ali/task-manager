"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import { AuthProvider } from "@/features/auth/auth-provider";
import { ChatWidget } from "@/features/chat/chat-widget";
import { ApiError } from "@/lib/api-error";
import type { Locale, ThemePreference } from "@/lib/preferences";
import { PreferencesProvider, usePreferences } from "@/providers/preferences-provider";

function AppToaster() {
  const { resolvedTheme } = usePreferences();
  return (
    <Toaster
      richColors
      closeButton
      position="top-center"
      dir="ltr"
      theme={resolvedTheme}
    />
  );
}

export function AppProviders({
  children,
  initialLocale,
  initialTheme,
}: {
  children: ReactNode;
  initialLocale: Locale;
  initialTheme: ThemePreference | null;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, error) =>
              count < 2 && (!(error instanceof ApiError) || error.status >= 500),
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <PreferencesProvider initialLocale={initialLocale} initialTheme={initialTheme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <ChatWidget />
        </AuthProvider>
        <AppToaster />
      </QueryClientProvider>
    </PreferencesProvider>
  );
}
