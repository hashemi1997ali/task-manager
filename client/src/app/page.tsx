"use client";

import {
  ArrowDown,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  Mic,
  Paperclip,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import FadeContent from "@/components/FadeContent";
import { Logo } from "@/components/logo";
import { FluidHeroBackground } from "@/components/marketing/fluid-hero-background";
import { PublicHeader } from "@/components/marketing/public-header";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    title: "Plan with AI —",
    description:
      "Karino brings tasks, deadlines, progress and a personal assistant into one calm workspace built around your day.",
    prompt: "Ask Karino to plan your day...",
    promptActions: ["Plan my day", "Prioritize tasks"],
    disclaimer: "Karino can make mistakes. Review important details.",
    start: "Start for free",
    scroll: "Discover Karino",
    productEyebrow: "The workspace",
    productTitle: "Your tasks stay practical.",
    productAccent: "Your assistant keeps the context.",
    productDescription:
      "Plan, update and finish work without moving between disconnected tools. Every view uses the same task data.",
    workspace: "Today",
    workspaceMeta: "3 tasks · 1 completed",
    assistant: "Personal assistant",
    assistantQuestion: "What should I focus on this afternoon?",
    assistantAnswer:
      "Finish the launch review first. It is high priority and due today. I can turn the remaining work into tomorrow’s plan.",
    tasks: [
      { title: "Review the launch checklist", meta: "Today · High", done: true },
      { title: "Prepare the client update", meta: "Today · Medium", done: false },
      { title: "Plan tomorrow’s focus block", meta: "Tomorrow · Low", done: false },
    ],
    featuresEyebrow: "Built around real work",
    featuresTitle: "One clear system, not another layer of noise.",
    featuresDescription:
      "The essentials are close when you need them and quiet when you do not.",
    features: [
      {
        title: "Tasks that stay connected",
        description:
          "List and board views share status, priority, assignee and dates, so switching views never loses context.",
        detail: "List · Board · Filters",
      },
      {
        title: "An assistant that can act",
        description:
          "Ask for a plan, refine it in conversation and create the resulting tasks in the same workspace.",
        detail: "Ask · Refine · Create",
      },
      {
        title: "Control without friction",
        description:
          "Manage profile details, active sessions and appearance without interrupting your daily flow.",
        detail: "Profile · Sessions · Security",
      },
    ],
    workflowEyebrow: "A lighter workflow",
    workflowTitle: "From a thought to finished work.",
    workflowDescription:
      "Three steps, one source of truth, and no decorative complexity between you and the next action.",
    steps: [
      {
        title: "Capture",
        description: "Add the task with the detail you already know. Nothing else is required.",
      },
      {
        title: "Clarify",
        description: "Use filters or ask the assistant to identify the most useful next step.",
      },
      {
        title: "Finish",
        description: "Update progress once and see the change everywhere in the workspace.",
      },
    ],
    securityEyebrow: "Private by design",
    securityTitle: "Your workspace remains yours.",
    securityDescription:
      "Account controls are built into the product instead of hidden behind support requests.",
    securityItems: [
      { title: "Secure sessions", description: "Review every active device and recent use." },
      { title: "Remote sign-out", description: "Close one session or all other sessions immediately." },
      { title: "Clear ownership", description: "Personal tasks and assistant history stay tied to your account." },
    ],
    ctaTitle: "Start with the next task.",
    ctaDescription: "Create your workspace and let Karino help organize what comes after it.",
    cta: "Create your workspace",
    dashboard: "Open dashboard",
    footer: "A calmer place for tasks, progress and thoughtful assistance.",
    contact: "Contact",
    language: "Language",
  },
  de: {
    title: "Plane mit KI —",
    description:
      "Karino vereint Aufgaben, Termine, Fortschritt und einen persönlichen Assistenten in einem ruhigen Arbeitsbereich.",
    prompt: "Frag Karino nach deinem Tagesplan...",
    promptActions: ["Tag planen", "Aufgaben priorisieren"],
    disclaimer: "Karino kann Fehler machen. Prüfe wichtige Details.",
    start: "Kostenlos starten",
    scroll: "Karino entdecken",
    productEyebrow: "Der Workspace",
    productTitle: "Deine Aufgaben bleiben praktisch.",
    productAccent: "Dein Assistent behält den Kontext.",
    productDescription:
      "Plane, aktualisiere und erledige Arbeit ohne getrennte Werkzeuge. Jede Ansicht verwendet dieselben Aufgabendaten.",
    workspace: "Heute",
    workspaceMeta: "3 Aufgaben · 1 erledigt",
    assistant: "Persönlicher Assistent",
    assistantQuestion: "Worauf sollte ich mich heute Nachmittag konzentrieren?",
    assistantAnswer:
      "Schließe zuerst die Launch-Prüfung ab. Sie hat hohe Priorität und ist heute fällig. Den Rest kann ich für morgen planen.",
    tasks: [
      { title: "Launch-Checkliste prüfen", meta: "Heute · Hoch", done: true },
      { title: "Kundenupdate vorbereiten", meta: "Heute · Mittel", done: false },
      { title: "Fokusblock für morgen planen", meta: "Morgen · Niedrig", done: false },
    ],
    featuresEyebrow: "Für echte Arbeit gebaut",
    featuresTitle: "Ein klares System statt einer weiteren Schicht Lärm.",
    featuresDescription:
      "Das Wesentliche ist nah, wenn du es brauchst, und ruhig, wenn du es nicht brauchst.",
    features: [
      {
        title: "Aufgaben bleiben verbunden",
        description:
          "Liste und Board teilen Status, Priorität, Nutzer und Termine. Beim Wechsel geht kein Kontext verloren.",
        detail: "Liste · Board · Filter",
      },
      {
        title: "Ein Assistent, der handeln kann",
        description:
          "Bitte um einen Plan, verfeinere ihn im Gespräch und erstelle die Aufgaben im selben Workspace.",
        detail: "Fragen · Klären · Erstellen",
      },
      {
        title: "Kontrolle ohne Reibung",
        description:
          "Verwalte Profil, aktive Sitzungen und Darstellung, ohne deinen täglichen Ablauf zu unterbrechen.",
        detail: "Profil · Sitzungen · Sicherheit",
      },
    ],
    workflowEyebrow: "Ein leichterer Ablauf",
    workflowTitle: "Vom Gedanken zur erledigten Arbeit.",
    workflowDescription:
      "Drei Schritte, eine verlässliche Datenquelle und keine dekorative Komplexität vor der nächsten Aktion.",
    steps: [
      {
        title: "Erfassen",
        description: "Füge die Aufgabe mit den Details hinzu, die du bereits kennst. Mehr ist nicht nötig.",
      },
      {
        title: "Klären",
        description: "Nutze Filter oder frage den Assistenten nach dem sinnvollsten nächsten Schritt.",
      },
      {
        title: "Erledigen",
        description: "Aktualisiere den Fortschritt einmal und sieh die Änderung überall im Workspace.",
      },
    ],
    securityEyebrow: "Privat by Design",
    securityTitle: "Dein Workspace bleibt deiner.",
    securityDescription:
      "Kontoeinstellungen sind direkt im Produkt verfügbar und nicht hinter Support-Anfragen versteckt.",
    securityItems: [
      { title: "Sichere Sitzungen", description: "Prüfe jedes aktive Gerät und die letzte Nutzung." },
      { title: "Remote-Abmeldung", description: "Beende eine oder alle anderen Sitzungen sofort." },
      { title: "Klare Zuordnung", description: "Aufgaben und Assistent-Verlauf bleiben deinem Konto zugeordnet." },
    ],
    ctaTitle: "Beginne mit der nächsten Aufgabe.",
    ctaDescription: "Erstelle deinen Workspace und lass Karino den Rest mit dir strukturieren.",
    cta: "Workspace erstellen",
    dashboard: "Dashboard öffnen",
    footer: "Ein ruhigerer Ort für Aufgaben, Fortschritt und hilfreiche Unterstützung.",
    contact: "Kontakt",
    language: "Sprache",
  },
} as const;

const featureIcons = [ListChecks, Bot, ShieldCheck] as const;

export default function HomePage() {
  const { locale, setLocale } = usePreferences();
  const t = copy[locale];

  return (
    <div className="min-h-dvh overflow-hidden bg-[var(--background)]">
      <PublicHeader overlay />
      <main id="main-content" tabIndex={-1}>
        <section className="relative min-h-dvh w-full overflow-hidden bg-[var(--background)] text-[#151522] dark:text-white">
          <FluidHeroBackground />

          <FadeContent
            duration={360}
            threshold={0.04}
            className="relative z-10 mx-auto flex min-h-dvh max-w-4xl flex-col items-start justify-start gap-0 px-4 pb-0 pt-[16.7rem] sm:py-0 sm:pt-40 lg:px-8 lg:pt-[17rem]"
          >
            <h1 className="max-w-full text-[2rem] leading-[1.15] font-medium tracking-[-0.045em] sm:text-5xl sm:leading-none md:text-6xl lg:text-7xl">
              <span className="block">{t.title}</span>
              <span className="block whitespace-nowrap">
                {locale === "en" ? "the " : "die "}
                <em className="font-medium italic text-[#242536]/80 dark:text-white/70">
                  {locale === "en" ? "future" : "Zukunft"}
                </em>{" "}
                {locale === "en" ? "of productivity" : "der Arbeit"}
              </span>
            </h1>

            <div className="hero-prompt mt-7 w-full rounded-[2rem] bg-[#f9f9fc] p-3 text-left shadow-[0_16px_60px_rgb(39_48_100_/_0.12)] sm:mt-16">
              <div className="min-h-[5.7rem] px-4 py-3 text-base text-[#959bad]">
                {t.prompt}
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="hero-prompt-control grid size-12 shrink-0 place-items-center rounded-full bg-white text-[#9299aa]">
                  <Paperclip className="size-4" />
                </span>
                <span aria-hidden="true" className="hero-prompt-control grid size-12 shrink-0 place-items-center rounded-full bg-white text-[#7f8798]">
                  <Lightbulb className="size-4" />
                </span>
                {t.promptActions.map((action) => (
                  <span key={action} className="hero-prompt-control hidden h-12 items-center gap-2 rounded-full bg-white px-5 text-sm text-[#737b8d] sm:inline-flex">
                    <WandSparkles className="size-4" />
                    {action}
                  </span>
                ))}
                <span className="flex-1" />
                <span aria-hidden="true" className="hero-prompt-control hidden size-12 shrink-0 place-items-center rounded-full bg-white text-[#737b8d] sm:grid">
                  <Mic className="size-4" />
                </span>
                <Link href="/assistant" aria-label={t.start} className="focus-ring grid size-12 shrink-0 place-items-center rounded-full bg-[#03040a] text-white transition-colors hover:bg-[#1a1b22]">
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
            <p className="mt-5 w-full text-center text-xs text-[#151728]/60 dark:text-white/55">
              {t.disclaimer}
            </p>

            <div className="mt-auto flex w-full items-end justify-between gap-6 pb-5 text-[#151522]/60 dark:text-white/60 sm:pb-24">
              <p className="max-w-sm text-sm leading-5">{t.description}</p>
              <a href="#product" className="focus-ring grid size-12 shrink-0 place-items-center rounded-full transition-colors hover:text-[#151522] dark:hover:text-white" aria-label={t.scroll}>
                <ArrowDown className="size-8" strokeWidth={1.25} />
              </a>
            </div>
          </FadeContent>
        </section>

        <section id="product" className="border-b py-16 sm:py-20">
          <FadeContent duration={400} ease="power3.out" threshold={0.14} className="mx-auto max-w-[76rem] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-7">
                <p className="eyebrow text-[var(--primary)]">{t.productEyebrow}</p>
                <h2 className="text-balance mt-4 text-4xl leading-[1.04] font-medium tracking-[-0.05em] sm:text-5xl">
                  {t.productTitle}{" "}
                  <span className="text-[var(--muted)]">{t.productAccent}</span>
                </h2>
              </div>
              <p className="max-w-xl text-base leading-7 text-[var(--muted)] lg:col-span-4 lg:col-start-9">
                {t.productDescription}
              </p>
            </div>

            <div className="mt-10 overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-[0_24px_70px_rgb(27_24_62_/_0.06)] dark:shadow-none">
                <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-sm font-semibold">{t.workspace}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{t.workspaceMeta}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                    Live
                  </span>
                </div>
                <div className="grid lg:grid-cols-[1.05fr_.95fr]">
                  <div className="p-4 sm:p-6 lg:border-r">
                    <div className="grid gap-2">
                      {t.tasks.map((task) => (
                        <div key={task.title} className="flex min-h-16 items-center gap-3 rounded-xl border px-3.5 py-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-muted)] text-[var(--muted)]">
                            {task.done ? <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" /> : <Circle className="size-5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{task.title}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{task.meta}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex min-h-80 flex-col bg-[color-mix(in_srgb,var(--surface-muted)_58%,var(--surface))] p-4 sm:p-6">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Bot className="size-4.5 text-[var(--primary)]" />
                      {t.assistant}
                    </div>
                    <p className="mt-6 max-w-[90%] self-end rounded-xl bg-[var(--foreground)] px-4 py-3 text-sm leading-6 text-[var(--background)]">
                      {t.assistantQuestion}
                    </p>
                    <p className="mt-3 max-w-[92%] rounded-xl border bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                      {t.assistantAnswer}
                    </p>
                    <div className="mt-auto flex items-center gap-2 border-t pt-4 text-xs text-[var(--muted)]">
                      <Sparkles className="size-4 text-[var(--primary)]" />
                      {locale === "de" ? "Antwort mit deinem Workspace-Kontext" : "Answer grounded in your workspace context"}
                    </div>
                  </div>
                </div>
            </div>
          </FadeContent>
        </section>

        <section id="features" className="py-16 sm:py-20">
          <FadeContent duration={400} ease="power3.out" threshold={0.12} className="mx-auto max-w-[76rem] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <p className="eyebrow text-[var(--primary)]">{t.featuresEyebrow}</p>
                <h2 className="text-balance mt-4 text-4xl leading-[1.04] font-medium tracking-[-0.05em] sm:text-5xl">
                  {t.featuresTitle}
                </h2>
              </div>
              <p className="max-w-lg text-base leading-7 text-[var(--muted)] lg:col-span-4 lg:col-start-9 lg:pt-7">
                {t.featuresDescription}
              </p>
            </div>

            <dl className="mt-10 grid border-y md:grid-cols-3 md:divide-x">
              {t.features.map((feature, index) => {
                const Icon = featureIcons[index];
                return (
                  <div key={feature.title} className="border-b py-7 last:border-b-0 md:border-b-0 md:px-7 md:first:pl-0 md:last:pr-0">
                    <div className="flex items-center justify-between">
                      <Icon className="size-5 text-[var(--primary)]" aria-hidden="true" />
                      <dd className="text-xs font-medium text-[var(--muted)]">{feature.detail}</dd>
                    </div>
                    <dt className="mt-8 text-lg font-semibold tracking-[-0.02em]">{feature.title}</dt>
                    <dd className="mt-3 text-sm leading-6 text-[var(--muted)]">{feature.description}</dd>
                  </div>
                );
              })}
            </dl>
            <div id="workflow" className="mt-14 grid border-y bg-[var(--surface-muted)] lg:grid-cols-[.8fr_1.2fr]">
              <div className="border-b p-6 sm:p-8 lg:border-r lg:border-b-0">
                <p className="eyebrow text-[var(--primary)]">{t.workflowEyebrow}</p>
                <h2 className="text-balance mt-4 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">{t.workflowTitle}</h2>
                <p className="mt-4 max-w-md text-sm leading-6 text-[var(--muted)]">{t.workflowDescription}</p>
              </div>
              <ol className="divide-y px-6 sm:px-8">
                {t.steps.map((step, index) => (
                  <li key={step.title} className="grid gap-2 py-5 sm:grid-cols-[2.5rem_8rem_1fr] sm:items-start sm:gap-4">
                    <span className="text-xs font-semibold text-[var(--primary)]">0{index + 1}</span>
                    <h3 className="font-semibold tracking-[-0.02em]">{step.title}</h3>
                    <p className="text-sm leading-6 text-[var(--muted)]">{step.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </FadeContent>
        </section>

        <section id="security" className="border-t py-16 sm:py-20">
          <FadeContent duration={400} ease="power3.out" threshold={0.12} className="mx-auto max-w-[76rem] px-4 sm:px-6 lg:px-8">
            <div className="grid overflow-hidden rounded-2xl border bg-[var(--surface)] lg:grid-cols-[1.05fr_.95fr]">
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="flex items-center gap-3 text-[var(--primary)]">
                  <LockKeyhole className="size-5" aria-hidden="true" />
                  <p className="eyebrow">{t.securityEyebrow}</p>
                </div>
                <h2 className="text-balance mt-5 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">{t.securityTitle}</h2>
                <p className="mt-4 max-w-lg leading-7 text-[var(--muted)]">{t.securityDescription}</p>
                <div className="mt-7 grid gap-4 sm:grid-cols-3">
                  {t.securityItems.map((item) => (
                    <div key={item.title} className="border-t pt-4">
                      <div className="flex items-center gap-2">
                        <Check className="size-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                        <h3 className="text-sm font-semibold">{item.title}</h3>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col justify-between bg-[#16151e] p-6 text-white sm:p-8 lg:p-10 dark:bg-[#1b1928]">
                <div>
                  <Sparkles className="size-6 text-[#aaa1ff]" aria-hidden="true" />
                  <h2 className="mt-8 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">{t.ctaTitle}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">{t.ctaDescription}</p>
                </div>
                <div className="mt-10 flex flex-wrap gap-2">
                  <Link href="/register" className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#ffffff] px-6 text-sm font-semibold text-[#16151e] transition-colors hover:bg-[#efeff7]">
                    {t.cta}
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link href="/dashboard" className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/6 px-5 text-sm font-semibold transition-colors hover:bg-white/10">
                    <LayoutDashboard className="size-4" />
                    {t.dashboard}
                  </Link>
                </div>
              </div>
            </div>
          </FadeContent>
        </section>

        <section id="features" className="nova-section">
          <div className="nova-section-heading">
            <div>
              <p className="desk-eyebrow">{t.featuresEyebrow}</p>
              <h2>{t.featuresTitle}</h2>
            </div>
            <p>{t.featuresDescription}</p>
          </div>
          <div className="nova-feature-grid">
            {t.features.map(({ title, description }, index) => {
              const Icon = featureIcons[index];
              return (
                <article key={title} className={"nova-feature-card is-" + (index + 1)}>
                  <span className="nova-feature-number">0{index + 1}</span>
                  <span className="nova-feature-icon">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <div className="nova-feature-line" aria-hidden="true" />
                </article>
              );
            })}
          </div>
        </section>

        <section className="nova-time-band">
          <div className="nova-time-copy">
            <p className="desk-eyebrow">{t.timeEyebrow}</p>
            <h2>{t.timeTitle}</h2>
            <p>{t.timeDescription}</p>
            <div className="nova-time-pulse">
              <Clock3 className="size-4" aria-hidden="true" />
              <span>10:36</span>
              <small>{t.preview.nextSla}</small>
            </div>
          </div>
          <ol className="nova-timeline">
            {t.timeEvents.map((event, index) => (
              <li key={event.time + event.label}>
                <time>{event.time}</time>
                <span className={index === t.timeEvents.length - 1 ? "is-due" : ""} />
                <div>
                  <strong>{event.label}</strong>
                  <p>{event.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="workflow" className="nova-section nova-workflow">
          <div className="nova-workflow-intro">
            <span className="nova-orbit" aria-hidden="true">
              <Sparkles className="size-5" />
            </span>
            <p className="desk-eyebrow">{t.workflowEyebrow}</p>
            <h2>{t.workflowTitle}</h2>
            <p>{t.workflowDescription}</p>
          </div>
          <ol className="nova-workflow-list">
            {t.steps.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
                <ArrowRight className="size-4" aria-hidden="true" />
              </li>
            ))}
          </ol>
        </section>

        <section id="security" className="nova-security">
          <div className="nova-security-copy">
            <span>
              <LockKeyhole className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2>{t.securityTitle}</h2>
              <p>{t.securityDescription}</p>
            </div>
          </div>
          <div className="nova-security-list">
            {t.securityItems.map((item) => (
              <div key={item}>
                <ShieldCheck className="size-4" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="nova-cta">
          <div className="nova-cta-aura" aria-hidden="true" />
          <div>
            <p className="desk-eyebrow">{t.ctaEyebrow}</p>
            <h2>{t.ctaTitle}</h2>
            <p>{t.ctaDescription}</p>
          </div>
          <Link
            href="/register"
            className={buttonClassName({
              size: "lg",
              className: "nova-cta-action",
            })}
          >
            {t.start}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-[76rem] flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <Logo />
            <p className="max-w-md text-sm leading-6 text-[var(--muted)]">{t.footer}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/contact" className="focus-ring rounded-lg text-sm font-semibold text-[var(--primary)]">{t.contact}</Link>
              <div
                className="flex items-center rounded-full border bg-[var(--surface-muted)] p-1"
                role="group"
                aria-label={t.language}
              >
                {(["en", "de"] as const).map((language) => (
                  <button
                    key={language}
                    type="button"
                    onClick={() => setLocale(language)}
                    aria-pressed={locale === language}
                    className={`focus-ring min-h-11 min-w-12 rounded-full px-3 text-xs font-semibold uppercase transition-colors ${
                      locale === language
                        ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {language}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-6 text-xs text-[var(--muted)]">
            <span>© 2026 Karino</span>
            <span>Plan · Focus · Finish</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
