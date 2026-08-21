"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Send } from "lucide-react";
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
    <div className="w-full">
      <p className="eyebrow text-[var(--primary)]">{t.eyebrow}</p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">{t.title}</h1>
      {sent ? (
        <div className="mt-7 rounded-[var(--container-radius)] border bg-[var(--surface)] p-6">
          <Mail className="size-8 text-[var(--primary)]" />
          <h2 className="mt-4 text-xl font-black">{t.sentTitle}</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t.sent}</p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t.description}</p>
          <form onSubmit={submit} className="mt-8 grid gap-3" noValidate>
            <Field label={t.email} error={errors.email?.message}>
              <Input
                type="email"
                dir="ltr"
                autoComplete="email"
                placeholder="you@example.com"
                {...register("email")}
              />
            </Field>
            {serverError && <p className="text-sm text-rose-600">{serverError}</p>}
            <Button type="submit" size="lg" loading={isSubmitting}>
              <Send className="size-4" />
              {t.submit}
            </Button>
          </form>
        </>
      )}
      <Link
        href="/login"
        className="mt-7 block text-center text-sm font-bold text-[var(--primary)]"
      >
        {t.back}
      </Link>
    </div>
  );
}
