"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
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
    title: "Create your Karino account",
    description: "You're less than a minute away from a more organized day.",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    submit: "Create account",
    hasAccount: "Already have an account?",
    login: "Log in",
  },
  de: {
    success: "Dein Konto ist bereit.",
    title: "Erstelle dein Karino-Konto",
    description: "In weniger als einer Minute beginnt dein besser organisierter Tag.",
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail",
    password: "Passwort",
    confirmPassword: "Passwort bestätigen",
    submit: "Konto erstellen",
    hasAccount: "Du hast bereits ein Konto?",
    login: "Anmelden",
  },
} as const;

export function RegisterForm() {
  const router = useRouter();
  const { register: createAccount, status } = useAuth();
  const { locale } = usePreferences();
  const t = copy[locale];
  const schema = useMemo(() => createRegisterSchema(locale), [locale]);
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
    <div className="w-full">
      <p className="eyebrow text-[var(--primary)]">Karino workspace</p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--foreground)]">
        {t.title}
      </h1>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t.description}</p>
      <form onSubmit={onSubmit} className="mt-7 grid gap-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.firstName} error={errors.firstName?.message}>
            <Input autoComplete="given-name" {...register("firstName")} />
          </Field>
          <Field label={t.lastName} error={errors.lastName?.message}>
            <Input autoComplete="family-name" {...register("lastName")} />
          </Field>
        </div>
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
          <Input
            type="password"
            dir="ltr"
            autoComplete="new-password"
            {...register("password")}
          />
        </Field>
        <Field label={t.confirmPassword} error={errors.confirmPassword?.message}>
          <Input
            type="password"
            dir="ltr"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
          <UserPlus className="size-4" />
          {t.submit}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
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
