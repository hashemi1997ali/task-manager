"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn } from "lucide-react";
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
    title: "Welcome back 👋",
    description: "Log in to keep planning and completing your work.",
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
    title: "Willkommen zurück 👋",
    description: "Melde dich an, um deine Aufgaben weiter zu planen und zu erledigen.",
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
    <div className="w-full">
      <p className="eyebrow text-[var(--primary)]">Karino workspace</p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--foreground)]">
        {t.title}
      </h1>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t.description}</p>
      <form onSubmit={onSubmit} className="mt-8 grid gap-3" noValidate>
        <Field label={t.email} error={errors.email?.message}>
          <Input
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
          />
        </Field>
        <Field label={t.password} error={errors.password?.message}>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              dir="ltr"
              autoComplete="current-password"
              className="pr-12"
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
          className="-mt-2 justify-self-end text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)]"
        >
          {t.forgot}
        </Link>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
          <LogIn className="size-4" />
          {t.submit}
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-slate-500">
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
