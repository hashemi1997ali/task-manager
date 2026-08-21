"use client";

import { CheckCircle2, Clock3, Headphones, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { PreferencesControls } from "@/components/preferences-controls";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    title: "Support that keeps every detail connected.",
    description:
      "Submit requests, follow response targets, and move seamlessly from AI guidance to a human agent.",
    today: "Live request queue",
    tasks: [
      "Cannot access billing history",
      "Invoice contains the wrong address",
      "Request export for account data",
    ],
    suggestion: "AI triage",
    suggestionText: "Categorize this as Billing and prepare it for the support team?",
    home: "Back to home",
  },
  de: {
    title: "Support, bei dem kein Detail verloren geht.",
    description:
      "Sende Anfragen, verfolge Reaktionsziele und wechsle nahtlos von KI-Hilfe zu einem Support-Agenten.",
    today: "Live-Anfragen",
    tasks: [
      "Kein Zugriff auf den Rechnungsverlauf",
      "Falsche Adresse auf der Rechnung",
      "Datenexport für das Konto anfragen",
    ],
    suggestion: "KI-Triage",
    suggestionText: "Als Abrechnung kategorisieren und für das Support-Team vorbereiten?",
    home: "Zur Startseite",
  },
} as const;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { locale } = usePreferences();
  const t = copy[locale];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative grid min-h-dvh overflow-hidden bg-[var(--background)] lg:grid-cols-[minmax(28rem,1.08fr)_minmax(30rem,.92fr)]"
    >
      <aside className="relative max-lg:hidden min-h-dvh overflow-hidden flex-col bg-[#080711] px-10 py-10 text-white lg:flex xl:px-16">
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-[38rem] w-[46rem] rounded-full bg-[#7770db] opacity-55 blur-[110px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,#b9b4f0_0%,transparent_100%)] opacity-35" />
        <div className="relative z-10">
          <Logo inverse />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-12">
          <span className="mb-6 inline-flex h-7 w-fit items-center gap-2 rounded-full border border-white/6 bg-white/[.06] px-3 text-xs font-bold text-white/70 backdrop-blur-xl">
            <Sparkles className="size-3.5 text-[#bbb3ff]" />
            Karino AI workspace
          </span>
          <h1 className="max-w-lg text-5xl leading-[1.02] font-medium tracking-[-0.055em]">
            {t.title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/58">
            {t.description}
          </p>
          <div className="mt-12 rounded-[1.75rem] border border-white/6 bg-black/15 p-5 shadow-[0_28px_90px_rgb(0_0_0_/_0.25)] backdrop-blur-2xl">
            <h2 className="font-semibold">{t.today}</h2>
            <div className="mt-5 space-y-3">
              {t.tasks.map((task, index) => (
                <div
                  key={task}
                    className="group flex items-center gap-3 rounded-[1rem] border border-white/7 bg-white/[.045] p-3.5 transition hover:border-[#9a8cff]/35 hover:bg-white/[.075]"
                >
                  {index === 2 ? (
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                        <CheckCircle2 className="size-4.5" />
                      </span>
                  ) : (
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#9a8cff]/12 text-[#b1a6ff]">
                        <Headphones className="size-4.5" />
                      </span>
                  )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{task}</p>
                      <p className="mt-1 text-[10px] font-semibold text-white/38">
                      {locale === "de" ? "SLA · Hohe Priorität" : "SLA · High priority"}
                    </p>
                  </div>
                </div>
              ))}
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="rounded-[1rem] border border-white/8 bg-white/5 p-3.5">
                  <ShieldCheck className="size-4 text-emerald-300" />
                  <p className="mt-3 text-[10px] font-black tracking-[0.1em] text-white/35 uppercase">SLA health</p>
                  <p className="mt-1 text-xl font-black tracking-[-0.04em]">94%</p>
                </div>
                <div className="flex-1 rounded-[1rem] bg-[linear-gradient(145deg,#735ff2,#5142ba)] p-3.5 shadow-[0_16px_36px_rgb(73_59_190_/_0.35)]">
                  <p className="flex items-center gap-2 text-[10px] font-black tracking-[0.08em] uppercase">
                    <Sparkles className="size-3.5" />
                    {t.suggestion}
                  </p>
                  <p className="mt-2 text-[11px] leading-5 text-white/75">{t.suggestionText}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section className="relative flex min-h-dvh flex-col overflow-hidden px-4 py-5 sm:px-8 lg:px-14">
        <div className="pointer-events-none absolute -right-48 top-[-12rem] size-[34rem] rounded-full bg-[var(--primary-soft)] opacity-70 blur-[90px]" />
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="flex items-center gap-2">
            <PreferencesControls />
            <Link
              href="/"
              className="focus-ring rounded-full px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            >
              {t.home}
            </Link>
          </div>
        </div>
        <div className="relative mx-auto flex w-full max-w-lg flex-1 items-center py-10">
          {children}
        </div>
      </section>
    </main>
  );
}
