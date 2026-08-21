"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, LogIn, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { useAuth } from "@/features/auth/auth-provider";
import { createLoginSchema, type LoginFormValues } from "@/features/auth/schemas";
import { getErrorMessage } from "@/lib/api-error";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    success: "Welcome back. You're now logged in.",
    eyebrow: "Secure workspace",
    title: "Welcome back",
    description: "Log in to track requests and continue your support conversations.",
    security: "Private requests · managed sessions",
    email: "Email",
    password: "Password",
    hidePassword: "Hide password",
    showPassword: "Show password",
    submit: "Log in",
    forgot: "Forgot password?",
    noAccount: "Don't have an account?",
    register: "Create one",
  },
  de: {
    success: "Willkommen zurück. Du bist jetzt angemeldet.",
    eyebrow: "Sicherer Arbeitsbereich",
    title: "Willkommen zurück",
    description: "Melde dich an, um Anfragen und Support-Unterhaltungen zu verfolgen.",
    security: "Private Anfragen · verwaltete Sitzungen",
    email: "E-Mail",
    password: "Passwort",
    hidePassword: "Passwort ausblenden",
    showPassword: "Passwort anzeigen",
    submit: "Anmelden",
    forgot: "Passwort vergessen?",
    noAccount: "Du hast noch kein Konto?",
    register: "Konto erstellen",
  },
} as const;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status } = useAuth();
  const { locale } = usePreferences();
  const t = copy[locale];
  const schema = useMemo(() => createLoginSchema(locale), [locale]);
  const [showPassword, setShowPassword] = useState(false);
  const next = searchParams.get("next");
  const destination =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const {
    register,
    handleSubmit,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (status === "authenticated") router.replace(destination);
  }, [status, destination, router]);

  useEffect(() => clearErrors(), [locale, clearErrors]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values);
      toast.success(t.success);
      router.replace(destination);
    } catch (error) {
      toast.error(getErrorMessage(error, locale));
    }
  });

  return (
    <div className="desk-panel desk-grid-glow relative w-full overflow-hidden rounded-[var(--container-radius)] border bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] p-5 shadow-[var(--shadow-panel)] sm:p-7">
      <div className="pointer-events-none absolute -top-20 right-0 size-44 rounded-full bg-[var(--primary-glow)] blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="desk-icon-well grid size-11 place-items-center rounded-2xl border bg-[var(--surface)] text-[var(--primary)] shadow-sm">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="desk-eyebrow text-[0.6875rem] font-bold tracking-[0.14em] text-[var(--primary)] uppercase">
              {t.eyebrow}
            </p>
            <p className="mt-1 text-[0.6875rem] font-medium text-[var(--muted)]">
              {t.security}
            </p>
          </div>
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-[-0.04em] text-[var(--foreground)] sm:text-4xl">
          {t.title}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-7 text-[var(--muted)]">
          {t.description}
        </p>
      </div>
      <form onSubmit={onSubmit} className="relative mt-7 grid gap-3" noValidate>
        <Field label={t.email} error={errors.email?.message}>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder="you@example.com"
              className="h-12 bg-[var(--surface)] pl-11"
              {...register("email")}
            />
          </div>
        </Field>
        <Field label={t.password} error={errors.password?.message}>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              type={showPassword ? "text" : "password"}
              dir="ltr"
              autoComplete="current-password"
              className="h-12 bg-[var(--surface)] pr-12 pl-11"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="focus-ring absolute right-0.5 top-0.5 grid size-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/8 dark:hover:text-white"
              aria-label={showPassword ? t.hidePassword : t.showPassword}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Link
          href="/forgot-password"
          className="-mt-2 justify-self-end rounded text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-dark)] hover:underline"
        >
          {t.forgot}
        </Link>
        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          className="mt-1 w-full shadow-[0_12px_28px_var(--primary-glow)]"
        >
          <LogIn className="size-4" />
          {t.submit}
        </Button>
      </form>
      <p className="relative mt-6 border-t pt-5 text-center text-sm text-[var(--muted)]">
        {t.noAccount}{" "}
        <Link
          href="/register"
          className="font-bold text-[var(--primary)] hover:text-[var(--primary-dark)]"
        >
          {t.register}
        </Link>
      </p>
    </div>
  );
}
