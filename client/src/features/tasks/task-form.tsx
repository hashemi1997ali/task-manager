"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, FileText, Gauge, Info, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import type { TaskMutationValues } from "@/features/tasks/api";
import { createTaskFormSchema, type TaskFormValues } from "@/features/tasks/schemas";
import type { Task, User } from "@/lib/types";
import { getId, toLocalDateTimeInput } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    title: "Request subject",
    titlePlaceholder: "For example, I cannot access my account",
    description: "What can we help with?",
    descriptionPlaceholder:
      "Include what happened, what you expected, and any useful details …",
    status: "Status",
    todo: "Open",
    inProgress: "In progress",
    waitingCustomer: "Waiting on customer",
    done: "Resolved",
    priority: "Priority",
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
    category: "Category",
    general: "General",
    account: "Account",
    technical: "Technical",
    billing: "Billing",
    feature: "Feature request",
    source: "Source",
    manual: "Portal",
    assistant: "AI assistant",
    chat: "Live chat",
    sourceHelp: "Source is recorded automatically and cannot be changed.",
    dueDate: "Requested resolution date & time",
    assignee: "Assigned agent",
    unassigned: "Unassigned",
    firstResponseDueAt: "First-response SLA",
    resolutionDueAt: "Resolution SLA",
    slaHelp: "SLA targets are calculated by the support policy.",
    save: "Save changes",
    create: "Submit request",
  },
  de: {
    title: "Betreff der Anfrage",
    titlePlaceholder: "Zum Beispiel: Ich kann nicht auf mein Konto zugreifen",
    description: "Wobei können wir helfen?",
    descriptionPlaceholder:
      "Beschreibe, was passiert ist, was du erwartet hast und alle hilfreichen Details …",
    status: "Status",
    todo: "Offen",
    inProgress: "In Bearbeitung",
    waitingCustomer: "Wartet auf Kunden",
    done: "Gelöst",
    priority: "Priorität",
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
    urgent: "Dringend",
    category: "Kategorie",
    general: "Allgemein",
    account: "Konto",
    technical: "Technisch",
    billing: "Abrechnung",
    feature: "Funktionswunsch",
    source: "Quelle",
    manual: "Portal",
    assistant: "KI-Assistent",
    chat: "Live-Chat",
    sourceHelp: "Die Quelle wird automatisch erfasst und kann nicht geändert werden.",
    dueDate: "Gewünschte Lösung mit Uhrzeit",
    assignee: "Zugewiesener Agent",
    unassigned: "Nicht zugewiesen",
    firstResponseDueAt: "SLA für Erstreaktion",
    resolutionDueAt: "SLA für Lösung",
    slaHelp: "SLA-Ziele werden automatisch aus der Support-Richtlinie berechnet.",
    save: "Änderungen speichern",
    create: "Anfrage senden",
  },
} as const;

export function TaskForm({
  task,
  admin = false,
  assignees,
  loading,
  onSubmit,
}: {
  task?: Task | null;
  admin?: boolean;
  assignees?: User[];
  loading?: boolean;
  onSubmit: (data: TaskMutationValues) => void | Promise<void>;
}) {
  const { locale } = usePreferences();
  const t = copy[locale];
  const schema = useMemo(() => createTaskFormSchema(locale), [locale]);
  const taskAssigneeId = task?.assignee
    ? typeof task.assignee === "object"
      ? getId(task.assignee)
      : task.assignee
    : "";
  const {
    register,
    handleSubmit,
    clearErrors,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: task?.status ?? "todo",
      priority: task?.priority ?? "medium",
      category: task?.category ?? "general",
      source: task?.source ?? "manual",
      assignee: taskAssigneeId,
      dueDate: toLocalDateTimeInput(task?.dueDate),
    },
  });

  useEffect(() => {
    clearErrors();
  }, [locale, clearErrors]);

  const submit = handleSubmit((values) =>
    onSubmit({
      title: values.title,
      description: values.description,
      status: admin ? values.status : undefined,
      priority: values.priority,
      category: values.category,
      assignee: admin ? values.assignee || null : undefined,
      dueDate: values.dueDate
        ? new Date(values.dueDate).toISOString()
        : task
          ? null
          : undefined,
    }),
  );

  return (
    <form onSubmit={submit} className="space-y-4 pb-1" noValidate>
      <section className="desk-panel-soft overflow-hidden p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="desk-icon-well shrink-0">
            <FileText className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="desk-eyebrow">{t.title}</p>
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{t.description}</p>
          </div>
        </div>
        <div className="grid gap-3">
          <Field compact label={t.title} error={errors.title?.message}>
            <Input
              placeholder={t.titlePlaceholder}
              autoFocus
              className="bg-[var(--surface)]"
              {...register("title")}
            />
          </Field>
          <Field compact label={t.description} error={errors.description?.message}>
            <Textarea
              placeholder={t.descriptionPlaceholder}
              className="min-h-32 bg-[var(--surface)] leading-6"
              {...register("description")}
            />
          </Field>
        </div>
      </section>

      <section className="desk-panel p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="desk-icon-well shrink-0">
            <Gauge className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="desk-eyebrow">{t.priority}</p>
            <h3 className="text-sm font-black">{t.category}</h3>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {admin && (
            <Field compact label={t.status} error={errors.status?.message}>
              <Select {...register("status")}>
                <option value="todo">{t.todo}</option>
                <option value="in-progress">{t.inProgress}</option>
                <option value="waiting-customer">{t.waitingCustomer}</option>
                <option value="done">{t.done}</option>
              </Select>
            </Field>
          )}
          <Field compact label={t.priority} error={errors.priority?.message}>
            <Select {...register("priority")}>
              <option value="low">{t.low}</option>
              <option value="medium">{t.medium}</option>
              <option value="high">{t.high}</option>
              <option value="urgent">{t.urgent}</option>
            </Select>
          </Field>
          <Field compact label={t.category} error={errors.category?.message}>
            <Select {...register("category")}>
              <option value="general">{t.general}</option>
              <option value="account">{t.account}</option>
              <option value="technical">{t.technical}</option>
              <option value="billing">{t.billing}</option>
              <option value="feature">{t.feature}</option>
            </Select>
          </Field>
          {task && (
            <Field compact label={t.source}>
              <Select value={task.source ?? "manual"} disabled aria-label={t.source}>
                <option value="manual">{t.manual}</option>
                <option value="assistant">{t.assistant}</option>
                <option value="chat">{t.chat}</option>
              </Select>
              <span className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-4 text-[var(--muted)]">
                <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                {t.sourceHelp}
              </span>
            </Field>
          )}
        </div>
      </section>

      {admin && assignees && (
        <section className="desk-panel p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="desk-icon-well shrink-0">
              <UserRoundCheck className="size-4" aria-hidden="true" />
            </span>
            <p className="text-sm font-black">{t.assignee}</p>
          </div>
          <Field compact label={t.assignee} error={errors.assignee?.message}>
            <Select {...register("assignee")}>
              <option value="">{t.unassigned}</option>
              {assignees.map((user) => (
                <option key={getId(user)} value={getId(user)}>
                  {user.firstName} {user.lastName} · {user.email}
                </option>
              ))}
            </Select>
          </Field>
        </section>
      )}

      <section className="desk-panel p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="desk-icon-well shrink-0">
            <CalendarClock className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="desk-eyebrow">{t.dueDate}</p>
            <h3 className="text-sm font-black">{t.resolutionDueAt}</h3>
          </div>
        </div>
        <Field compact label={t.dueDate} error={errors.dueDate?.message}>
          <Input type="datetime-local" dir="ltr" {...register("dueDate")} />
        </Field>
        {task ? (
          <div className="mt-3 grid gap-3 border-t border-[var(--border)]/70 pt-4 sm:grid-cols-2">
            <Field compact label={t.firstResponseDueAt}>
              <Input
                type="datetime-local"
                dir="ltr"
                value={toLocalDateTimeInput(task.firstResponseDueAt)}
                disabled
                readOnly
              />
            </Field>
            <Field compact label={t.resolutionDueAt}>
              <Input
                type="datetime-local"
                dir="ltr"
                value={toLocalDateTimeInput(task.resolutionDueAt)}
                disabled
                readOnly
              />
            </Field>
            <p className="flex items-start gap-1.5 text-xs leading-5 text-[var(--muted)] sm:col-span-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--primary)]" />
              {t.slaHelp}
            </p>
          </div>
        ) : (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--primary-soft)]/65 px-3 py-2.5 text-xs leading-5 text-[var(--muted)]">
            <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--primary)]" />
            {t.slaHelp}
          </p>
        )}
      </section>

      <div className="sticky bottom-0 -mx-1 flex justify-end border-t border-[var(--border)]/80 bg-[var(--surface)]/90 px-1 pt-4 pb-1 backdrop-blur">
        <Button type="submit" loading={loading} className="w-full min-w-36 sm:w-auto">
          {task ? t.save : t.create}
        </Button>
      </div>
    </form>
  );
}
