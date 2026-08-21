"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Mail, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { forgotPasswordRequest } from "@/features/auth/api";
import {
  createForgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/features/auth/schemas";
import { getErrorMessage } from "@/lib/api-error";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    eyebrow: "Account recovery",
    title: "Forgot your password?",
    description: "Enter your email and we’ll send you a secure reset link.",
    email: "Email",
    submit: "Send reset link",
    sentTitle: "Check your inbox",
    sent: "If an account exists for this email, a reset link has been sent. Also check your spam folder.",
    back: "Back to login",
    security: "The response never reveals whether an account exists.",
  },
  de: {
    eyebrow: "Kontowiederherstellung",
    title: "Passwort vergessen?",
    description: "Gib deine E-Mail-Adresse ein. Wir senden dir einen sicheren Link.",
    email: "E-Mail",
    submit: "Link senden",
    sentTitle: "Posteingang prüfen",
    sent: "Falls ein Konto mit dieser E-Mail existiert, wurde ein Link gesendet. Prüfe auch den Spam-Ordner.",
    back: "Zurück zur Anmeldung",
    security: "Die Antwort verrät nicht, ob ein Konto existiert.",
  },
} as const;

export function ForgotPasswordForm() {
  const { locale } = usePreferences();
  const t = copy[locale];
  const schema = useMemo(() => createForgotPasswordSchema(locale), [locale]);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async ({ email }) => {
    setServerError(null);
    try {
      await forgotPasswordRequest(email, locale);
      setSent(true);
    } catch (error) {
      setServerError(getErrorMessage(error, locale));
    }
  });

  return (
    <div className="desk-panel desk-grid-glow relative w-full overflow-hidden rounded-[var(--container-radius)] border bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] p-5 shadow-[var(--shadow-panel)] sm:p-7">
      <div className="pointer-events-none absolute -top-20 right-0 size-44 rounded-full bg-[var(--primary-glow)] blur-3xl" />
      <div className="relative flex items-center gap-3">
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
      <h1 className="relative mt-6 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
        {t.title}
      </h1>
      {sent ? (
        <div className="desk-panel-soft relative mt-7 rounded-2xl border border-[color-mix(in_srgb,var(--success)_24%,var(--border))] bg-[color-mix(in_srgb,var(--success)_6%,var(--surface))] p-5">
          <span className="grid size-11 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] text-[var(--success)]">
            <CheckCircle2 className="size-5" />
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em]">{t.sentTitle}</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t.sent}</p>
        </div>
      ) : (
        <>
          <p className="relative mt-2 text-sm leading-7 text-[var(--muted)]">
            {t.description}
          </p>
          <form onSubmit={submit} className="relative mt-7 grid gap-3" noValidate>
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
            {serverError && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                {serverError}
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              className="shadow-[0_12px_28px_var(--primary-glow)]"
            >
              <Send className="size-4" />
              {t.submit}
            </Button>
          </form>
        </>
      )}
      <Link
        href="/login"
        className="focus-ring relative mt-6 flex min-h-11 items-center justify-center gap-2 rounded-xl border-t pt-4 text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary-dark)]"
      >
        <ArrowLeft className="size-4" />
        {t.back}
      </Link>
    </div>
  );
}
