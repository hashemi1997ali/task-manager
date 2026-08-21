import { getTicketSlaDeadlines, type TaskPriority, type TaskStatus } from "#models";

type CompletionTrackedTask = {
  status: TaskStatus;
  priority: TaskPriority;
  createdAt?: Date;
  firstRespondedAt?: Date | null;
  firstResponseDueAt?: Date | null;
  resolutionDueAt?: Date | null;
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

  if (task.status === "done") {
    task.resolutionDueAt = getTicketSlaDeadlines(
      task.priority,
      new Date(),
    ).resolutionDueAt;
  }
  task.completedAt = null;
};

/** Marks the first actual human response without letting customer updates stop SLA. */
export const recordTicketFirstResponse = (
  task: CompletionTrackedTask,
  respondedAt = new Date(),
): void => {
  if (!task.firstRespondedAt) task.firstRespondedAt = respondedAt;
};

/**
 * Recalculates unresolved SLA targets after an explicit priority change.
 * An explicitly supplied deadline always wins, and recorded response times
 * are never rewritten.
 */
export const applyTicketPriorityTransition = (
  task: CompletionTrackedTask,
  nextPriority: TaskPriority | undefined,
  overrides: {
    firstResponseDueAt: boolean;
    resolutionDueAt: boolean;
  },
  options: {
    allowExtension?: boolean;
    nextStatus?: TaskStatus;
    transitionedAt?: Date;
  } = {},
): void => {
  if (!nextPriority || nextPriority === task.priority) return;

  const reopening =
    task.status === "done" &&
    options.nextStatus !== undefined &&
    options.nextStatus !== "done";
  const deadlines = getTicketSlaDeadlines(
    nextPriority,
    reopening ? (options.transitionedAt ?? new Date()) : (task.createdAt ?? new Date()),
  );
  if (
    !task.firstRespondedAt &&
    !overrides.firstResponseDueAt &&
    (options.allowExtension ||
      !task.firstResponseDueAt ||
      deadlines.firstResponseDueAt < task.firstResponseDueAt)
  ) {
    task.firstResponseDueAt = deadlines.firstResponseDueAt;
  }
  if (
    (options.nextStatus ?? task.status) !== "done" &&
    !overrides.resolutionDueAt &&
    (reopening ||
      options.allowExtension ||
      !task.resolutionDueAt ||
      deadlines.resolutionDueAt < task.resolutionDueAt)
  ) {
    task.resolutionDueAt = deadlines.resolutionDueAt;
  }
};
