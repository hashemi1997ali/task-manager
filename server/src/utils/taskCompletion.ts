import type { TaskStatus } from "#models";

type CompletionTrackedTask = {
  status: TaskStatus;
  completedAt?: Date | null;
};

export const applyTaskStatusTransition = (
  task: CompletionTrackedTask,
  nextStatus: TaskStatus | undefined,
): void => {
  if (!nextStatus) {
    return;
  }

  if (nextStatus === "done") {
    if (task.status !== "done") {
      task.completedAt = new Date();
    }
    return;
  }

  task.completedAt = null;
};
