import type { Metadata } from "next";
import { Suspense } from "react";

import { TasksView } from "@/features/tasks/tasks-view";

export const metadata: Metadata = { title: "Ticket queue" };

export default function AdminTicketsPage() {
  return (
    <Suspense>
      <TasksView admin />
    </Suspense>
  );
}
