"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { resetPasswordRequest } from "@/features/auth/api";
import {
  createResetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/features/auth/schemas";
import { getErrorMessage } from "@/lib/api-error";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    eyebrow: "Choose a new password",
    title: "Reset your password",
    description: "Enter and confirm a strong new password.",
    password: "New password",
    confirm: "Confirm new password",
    submit: "Reset password",
    success: "Your password was changed successfully. You can now log in.",
    invalid: "This reset link is missing or invalid.",
    login: "Go to login",
    show: "Show password",
    hide: "Hide password",
    security: "A successful reset signs out active sessions.",
  },
  de: {
    eyebrow: "Neues Passwort wählen",
    title: "Passwort zurücksetzen",
    description: "Gib ein starkes neues Passwort ein und bestätige es.",
    password: "Neues Passwort",
    confirm: "Neues Passwort bestätigen",
    submit: "Passwort zurücksetzen",
    success: "Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.",
    invalid: "Dieser Link fehlt oder ist ungültig.",
    login: "Zur Anmeldung",
    show: "Passwort anzeigen",
    hide: "Passwort ausblenden",
    security: "Ein erfolgreiches Zurücksetzen beendet aktive Sitzungen.",
  },
} as const;

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const { locale } = usePreferences();
  const t = copy[locale];
  const schema = useMemo(() => createResetPasswordSchema(locale), [locale]);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async ({ password }) => {
    setServerError(null);
    try {
      await resetPasswordRequest(token, password);
      setSuccess(true);
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
      {success ? (
        <div className="desk-panel-soft relative mt-7 rounded-2xl border border-[color-mix(in_srgb,var(--success)_24%,var(--border))] bg-[color-mix(in_srgb,var(--success)_6%,var(--surface))] p-5">
          <span className="grid size-11 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] text-[var(--success)]">
            <CheckCircle2 className="size-5" />
          </span>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{t.success}</p>
        </div>
      ) : !token ? (
        <p className="relative mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/15 dark:text-rose-300">
          {t.invalid}
        </p>
      ) : (
        <>
          <p className="relative mt-2 text-sm leading-7 text-[var(--muted)]">
            {t.description}
          </p>
          <form onSubmit={submit} className="relative mt-7 grid gap-3" noValidate>
            {(["password", "confirmPassword"] as const).map((field, index) => (
              <Field
                key={field}
                label={index === 0 ? t.password : t.confirm}
                error={errors[field]?.message}
              >
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-[var(--muted)]" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    autoComplete="new-password"
                    className="h-12 bg-[var(--surface)] pr-12 pl-11"
                    {...register(field)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="focus-ring absolute right-0.5 top-0.5 grid size-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/8"
                    aria-label={showPassword ? t.hide : t.show}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </Field>
            ))}
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
              <KeyRound className="size-4" />
              {t.submit}
            </Button>
          </form>
        </>
      )}
      {(success || !token) && (
        <Link
          href="/login"
          className="focus-ring relative mt-6 flex min-h-11 items-center justify-center gap-2 rounded-xl border-t pt-4 text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary-dark)]"
        >
          <ArrowLeft className="size-4" />
          {t.login}
        </Link>
      )}
    </div>
  );
}
