"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound } from "lucide-react";
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
    <div className="w-full">
      <p className="eyebrow text-[var(--primary)]">{t.eyebrow}</p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">{t.title}</h1>
      {success ? (
        <div className="mt-7 rounded-[var(--container-radius)] border bg-[var(--surface)] p-6">
          <KeyRound className="size-8 text-emerald-600" />
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{t.success}</p>
        </div>
      ) : !token ? (
        <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
          {t.invalid}
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t.description}</p>
          <form onSubmit={submit} className="mt-8 grid gap-3" noValidate>
            {(["password", "confirmPassword"] as const).map((field, index) => (
              <Field
                key={field}
                label={index === 0 ? t.password : t.confirm}
                error={errors[field]?.message}
              >
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    autoComplete="new-password"
                    className="pr-12"
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
            {serverError && <p className="text-sm text-rose-600">{serverError}</p>}
            <Button type="submit" size="lg" loading={isSubmitting}>
              <KeyRound className="size-4" />
              {t.submit}
            </Button>
          </form>
        </>
      )}
      {(success || !token) && (
        <Link
          href="/login"
          className="mt-7 block text-center text-sm font-bold text-[var(--primary)]"
        >
          {t.login}
        </Link>
      )}
    </div>
  );
}
