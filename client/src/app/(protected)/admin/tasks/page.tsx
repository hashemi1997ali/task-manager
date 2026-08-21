import { Suspense } from "react";

import { TasksView } from "@/features/tasks/tasks-view";

export default function AdminTasksPage() {
  return (
    <Suspense>
      <TasksView admin />
    </Suspense>
  );
}
