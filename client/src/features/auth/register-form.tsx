"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { useAuth } from "@/features/auth/auth-provider";
import { createRegisterSchema, type RegisterFormValues } from "@/features/auth/schemas";
import { getErrorMessage } from "@/lib/api-error";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    success: "Your account is ready.",
    eyebrow: "Customer access",
    title: "Create your Karino account",
    description: "Submit requests, follow SLA updates, and continue with live support.",
    security: "Private by default · session controls included",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    submit: "Create account",
    hasAccount: "Already have an account?",
    login: "Log in",
    showPassword: "Show passwords",
    hidePassword: "Hide passwords",
  },
  de: {
    success: "Dein Konto ist bereit.",
    eyebrow: "Kundenzugang",
    title: "Erstelle dein Karino-Konto",
    description:
      "Sende Anfragen, verfolge SLA-Updates und wechsle bei Bedarf zum Live-Support.",
    security: "Standardmäßig privat · mit Sitzungskontrolle",
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail",
    password: "Passwort",
    confirmPassword: "Passwort bestätigen",
    submit: "Konto erstellen",
    hasAccount: "Du hast bereits ein Konto?",
    login: "Anmelden",
    showPassword: "Passwörter anzeigen",
    hidePassword: "Passwörter ausblenden",
  },
} as const;

export function RegisterForm() {
  const router = useRouter();
  const { register: createAccount, status } = useAuth();
  const { locale } = usePreferences();
  const t = copy[locale];
  const schema = useMemo(() => createRegisterSchema(locale), [locale]);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  useEffect(() => clearErrors(), [locale, clearErrors]);

  const onSubmit = handleSubmit(async (formValues) => {
    try {
      await createAccount({
        firstName: formValues.firstName,
        lastName: formValues.lastName,
        email: formValues.email,
        password: formValues.password,
      });
      toast.success(t.success);
      router.replace("/dashboard");
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.firstName} error={errors.firstName?.message}>
            <div className="relative">
              <UserRound className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                autoComplete="given-name"
                className="h-12 bg-[var(--surface)] pl-11"
                {...register("firstName")}
              />
            </div>
          </Field>
          <Field label={t.lastName} error={errors.lastName?.message}>
            <div className="relative">
              <UserRound className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                autoComplete="family-name"
                className="h-12 bg-[var(--surface)] pl-11"
                {...register("lastName")}
              />
            </div>
          </Field>
        </div>
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
              autoComplete="new-password"
              className="h-12 bg-[var(--surface)] pr-12 pl-11"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="focus-ring absolute top-0.5 right-0.5 grid size-11 place-items-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              aria-label={showPassword ? t.hidePassword : t.showPassword}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Field label={t.confirmPassword} error={errors.confirmPassword?.message}>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              type={showPassword ? "text" : "password"}
              dir="ltr"
              autoComplete="new-password"
              className="h-12 bg-[var(--surface)] pr-12 pl-11"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="focus-ring absolute top-0.5 right-0.5 grid size-11 place-items-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              aria-label={showPassword ? t.hidePassword : t.showPassword}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          className="mt-1 w-full shadow-[0_12px_28px_var(--primary-glow)]"
        >
          <UserPlus className="size-4" />
          {t.submit}
        </Button>
      </form>
      <p className="relative mt-6 border-t pt-5 text-center text-sm text-[var(--muted)]">
        {t.hasAccount}{" "}
        <Link
          href="/login"
          className="font-bold text-[var(--primary)] hover:text-[var(--primary-dark)]"
        >
          {t.login}
        </Link>
      </p>
    </div>
  );
}
