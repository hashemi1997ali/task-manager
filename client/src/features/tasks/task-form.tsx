"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import type { TaskMutationValues } from "@/features/tasks/api";
import { createTaskFormSchema, type TaskFormValues } from "@/features/tasks/schemas";
import type { Task } from "@/lib/types";
import { toLocalDateTimeInput } from "@/lib/utils";
import { usePreferences } from "@/providers/preferences-provider";

const copy = {
  en: {
    title: "Task title",
    titlePlaceholder: "For example, finish the dashboard",
    description: "Description",
    descriptionPlaceholder: "Add the details needed to complete this task …",
    status: "Status",
    todo: "To do",
    inProgress: "In progress",
    done: "Done",
    priority: "Priority",
    low: "Low",
    medium: "Medium",
    high: "High",
    dueDate: "Due date",
    save: "Save changes",
    create: "Create task",
  },
  de: {
    title: "Aufgabentitel",
    titlePlaceholder: "Zum Beispiel: Dashboard fertigstellen",
    description: "Beschreibung",
    descriptionPlaceholder: "Ergänze alle Details für diese Aufgabe …",
    status: "Status",
    todo: "Offen",
    inProgress: "In Bearbeitung",
    done: "Erledigt",
    priority: "Priorität",
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
    dueDate: "Fällig am",
    save: "Änderungen speichern",
    create: "Aufgabe erstellen",
  },
} as const;

export function TaskForm({
  task,
  loading,
  onSubmit,
}: {
  task?: Task | null;
  loading?: boolean;
  onSubmit: (data: TaskMutationValues) => void | Promise<void>;
}) {
  const { locale } = usePreferences();
  const t = copy[locale];
  const schema = useMemo(() => createTaskFormSchema(locale), [locale]);
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
      status: values.status,
      priority: values.priority,
      dueDate: values.dueDate
        ? new Date(values.dueDate).toISOString()
        : task
          ? null
          : undefined,
    }),
  );

  return (
    <form onSubmit={submit} className="grid gap-2 pb-1" noValidate>
      <Field compact label={t.title} error={errors.title?.message}>
        <Input placeholder={t.titlePlaceholder} autoFocus {...register("title")} />
      </Field>
      <Field compact label={t.description} error={errors.description?.message}>
        <Textarea
          placeholder={t.descriptionPlaceholder}
          className="min-h-24"
          {...register("description")}
        />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <Field compact label={t.status} error={errors.status?.message}>
          <Select {...register("status")}>
            <option value="todo">{t.todo}</option>
            <option value="in-progress">{t.inProgress}</option>
            <option value="done">{t.done}</option>
          </Select>
        </Field>
        <Field compact label={t.priority} error={errors.priority?.message}>
          <Select {...register("priority")}>
            <option value="low">{t.low}</option>
            <option value="medium">{t.medium}</option>
            <option value="high">{t.high}</option>
          </Select>
        </Field>
      </div>
      <Field compact label={t.dueDate} error={errors.dueDate?.message}>
        <Input type="datetime-local" dir="ltr" {...register("dueDate")} />
      </Field>
      <div className="flex justify-end pt-1 pb-1">
        <Button
          type="submit"
          loading={loading}
          className="w-full min-w-32 rounded-full sm:w-auto"
        >
          {task ? t.save : t.create}
        </Button>
      </div>
    </form>
  );
}
