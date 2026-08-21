import { z } from "zod";

import type { Locale } from "@/lib/preferences";

const validation = {
  en: {
    titleMin: "The title must contain at least 3 characters.",
    titleMax: "The title cannot exceed 100 characters.",
    descriptionMax: "The description cannot exceed 2,000 characters.",
  },
  de: {
    titleMin: "Der Titel muss mindestens 3 Zeichen lang sein.",
    titleMax: "Der Titel darf höchstens 100 Zeichen lang sein.",
    descriptionMax: "Die Beschreibung darf höchstens 2.000 Zeichen lang sein.",
  },
} as const;

export const createTaskFormSchema = (locale: Locale) => {
  const t = validation[locale];
  return z.object({
    title: z.string().trim().min(3, t.titleMin).max(100, t.titleMax),
    description: z.string().trim().max(2000, t.descriptionMax),
    status: z.enum(["todo", "in-progress", "waiting-customer", "done"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    category: z.enum(["general", "account", "technical", "billing", "feature"]),
    source: z.enum(["manual", "assistant", "chat", "contact"]).optional(),
    assignee: z.string().optional(),
    dueDate: z.string(),
  });
};

export const taskFormSchema = createTaskFormSchema("en");
export type TaskFormValues = z.infer<ReturnType<typeof createTaskFormSchema>>;
