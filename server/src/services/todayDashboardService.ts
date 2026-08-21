import mongoose from "mongoose";

import { Task, type ITask } from "#models";
import { serializeTicket } from "#utils";

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

type DashboardTask = Pick<
  ITask,
  | "title"
  | "ticketNumber"
  | "description"
  | "status"
  | "priority"
  | "category"
  | "source"
  | "dueDate"
  | "firstResponseDueAt"
  | "resolutionDueAt"
  | "firstRespondedAt"
  | "completedAt"
  | "owner"
  | "assignee"
  | "createdAt"
  | "updatedAt"
> & { _id: mongoose.Types.ObjectId };

const dateTimeFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

const getDateTimeParts = (date: Date, timeZone: string) => {
  const values = Object.fromEntries(
    dateTimeFormatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
};

const addCalendarDays = (date: CalendarDate, amount: number): CalendarDate => {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + amount));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

const dateKey = ({ year, month, day }: CalendarDate): string =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const zonedMidnightToUtc = (date: CalendarDate, timeZone: string): Date => {
  const localTimestamp = Date.UTC(date.year, date.month - 1, date.day);
  let estimate = new Date(localTimestamp);

  // Recalculate to handle offsets on both sides of UTC and DST boundaries.
  for (let index = 0; index < 3; index += 1) {
    const parts = getDateTimeParts(estimate, timeZone);
    const representedTimestamp = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    estimate = new Date(estimate.getTime() + localTimestamp - representedTimestamp);
  }

  return estimate;
};

const assertTimeZone = (timeZone: string): string => {
  if (timeZone.length > 64) {
    throw new RangeError("Invalid time zone");
  }

  // Intl validates IANA names without maintaining a separate, stale allow-list.
  new Intl.DateTimeFormat("en-US", { timeZone }).format();
  return timeZone;
};

const priorityRank: Record<ITask["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const nextOperationalDeadline = (task: DashboardTask): Date | null => {
  const deadlines = [
    !task.firstRespondedAt ? task.firstResponseDueAt : null,
    task.resolutionDueAt,
    task.dueDate,
  ].filter((date): date is Date => date instanceof Date);
  if (!deadlines.length) return null;
  return new Date(Math.min(...deadlines.map((date) => date.getTime())));
};

export const getTodayDashboardData = async ({
  userId,
  requestedTimeZone,
  now = new Date(),
}: {
  userId: string;
  requestedTimeZone: string;
  now?: Date;
}) => {
  const timeZone = assertTimeZone(requestedTimeZone);
  const currentParts = getDateTimeParts(now, timeZone);
  const today: CalendarDate = {
    year: currentParts.year,
    month: currentParts.month,
    day: currentParts.day,
  };
  const owner = new mongoose.Types.ObjectId(userId);
  const todayStart = zonedMidnightToUtc(today, timeZone);
  const tomorrowStart = zonedMidnightToUtc(addCalendarDays(today, 1), timeZone);
  const historyStart = zonedMidnightToUtc(addCalendarDays(today, -6), timeZone);
  const upcomingEnd = zonedMidnightToUtc(addCalendarDays(today, 6), timeZone);
  const weeklyKeys = Array.from({ length: 7 }, (_, index) =>
    dateKey(addCalendarDays(today, index - 6)),
  );
  const upcomingKeys = Array.from({ length: 5 }, (_, index) =>
    dateKey(addCalendarDays(today, index + 1)),
  );

  const [
    todayTasks,
    focusTasks,
    upcomingCounts,
    weeklyCompleted,
    conflictBuckets,
    openTicketStats,
    overdueRequestedDeadlines,
    firstResponseBreaches,
    resolutionBreaches,
    breachedSlaTickets,
    slaAtRiskTickets,
    resolvedToday,
    hourlyTickets,
  ] = await Promise.all([
    Task.find({
      owner,
      dueDate: { $gte: todayStart, $lt: tomorrowStart },
    })
      .select(
        "ticketNumber title description status priority category source dueDate firstResponseDueAt resolutionDueAt firstRespondedAt completedAt owner assignee createdAt updatedAt",
      )
      .lean<DashboardTask[]>(),
    Task.find({
      owner,
      status: { $ne: "done" },
      $or: [
        { dueDate: { $ne: null, $lt: tomorrowStart } },
        { resolutionDueAt: { $ne: null, $lt: tomorrowStart } },
        {
          firstRespondedAt: null,
          firstResponseDueAt: { $ne: null, $lt: tomorrowStart },
        },
      ],
    })
      .select(
        "ticketNumber title description status priority category source dueDate firstResponseDueAt resolutionDueAt firstRespondedAt completedAt owner assignee createdAt updatedAt",
      )
      .sort({ resolutionDueAt: 1, dueDate: 1, updatedAt: -1 })
      .limit(20)
      .lean<DashboardTask[]>(),
    Task.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          owner,
          status: { $ne: "done" },
          dueDate: { $gte: tomorrowStart, $lt: upcomingEnd },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$dueDate",
              format: "%Y-%m-%d",
              timezone: timeZone,
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Task.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          owner,
          completedAt: { $gte: historyStart, $lt: tomorrowStart },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$completedAt",
              format: "%Y-%m-%d",
              timezone: timeZone,
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Task.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          owner,
          status: { $ne: "done" },
          dueDate: { $gte: todayStart, $lt: upcomingEnd },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$dueDate",
              format: "%Y-%m-%dT%H",
              timezone: timeZone,
            },
          },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]),
    Task.aggregate<{
      open: number;
      waitingCustomer: number;
      urgent: number;
      unassigned: number;
    }>([
      { $match: { owner, status: { $ne: "done" } } },
      {
        $group: {
          _id: null,
          open: { $sum: 1 },
          waitingCustomer: {
            $sum: {
              $cond: [{ $eq: ["$status", "waiting-customer"] }, 1, 0],
            },
          },
          urgent: {
            $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] },
          },
          unassigned: {
            $sum: {
              $cond: [{ $eq: [{ $ifNull: ["$assignee", null] }, null] }, 1, 0],
            },
          },
        },
      },
      { $project: { _id: 0 } },
    ]),
    Task.countDocuments({
      owner,
      status: { $ne: "done" },
      dueDate: { $lt: now },
    }),
    Task.countDocuments({
      owner,
      status: { $ne: "done" },
      firstRespondedAt: null,
      firstResponseDueAt: { $lt: now },
    }),
    Task.countDocuments({
      owner,
      status: { $ne: "done" },
      resolutionDueAt: { $lt: now },
    }),
    Task.countDocuments({
      owner,
      status: { $ne: "done" },
      $or: [
        { firstRespondedAt: null, firstResponseDueAt: { $lt: now } },
        { resolutionDueAt: { $lt: now } },
      ],
    }),
    Task.countDocuments({
      owner,
      status: { $ne: "done" },
      $or: [
        {
          firstRespondedAt: null,
          firstResponseDueAt: {
            $gte: now,
            $lte: new Date(now.getTime() + 4 * 60 * 60 * 1000),
          },
        },
        {
          resolutionDueAt: {
            $gte: now,
            $lte: new Date(now.getTime() + 4 * 60 * 60 * 1000),
          },
        },
      ],
    }),
    Task.countDocuments({
      owner,
      completedAt: { $gte: todayStart, $lt: tomorrowStart },
    }),
    Task.find({
      owner,
      status: { $ne: "done" },
      $or: [
        { dueDate: { $gte: todayStart, $lt: tomorrowStart } },
        { firstResponseDueAt: { $gte: todayStart, $lt: tomorrowStart } },
        { resolutionDueAt: { $gte: todayStart, $lt: tomorrowStart } },
      ],
    })
      .select("dueDate firstResponseDueAt resolutionDueAt firstRespondedAt")
      .lean<DashboardTask[]>(),
  ]);

  const completedToday = todayTasks.filter((task) => task.status === "done").length;
  const overdue = overdueRequestedDeadlines;
  const dueToday = todayTasks.length - completedToday;
  const highPriority = focusTasks.filter(
    (task) =>
      task.status !== "done" && (task.priority === "high" || task.priority === "urgent"),
  ).length;
  const orderedFocusTasks = [...focusTasks]
    .sort((first, second) => {
      const firstDeadline = nextOperationalDeadline(first);
      const secondDeadline = nextOperationalDeadline(second);
      const firstOverdue = firstDeadline && firstDeadline < now ? 0 : 1;
      const secondOverdue = secondDeadline && secondDeadline < now ? 0 : 1;
      if (firstOverdue !== secondOverdue) return firstOverdue - secondOverdue;
      if (priorityRank[first.priority] !== priorityRank[second.priority]) {
        return priorityRank[first.priority] - priorityRank[second.priority];
      }
      return (firstDeadline?.getTime() ?? 0) - (secondDeadline?.getTime() ?? 0);
    })
    .slice(0, 5);
  const upcomingMap = new Map(upcomingCounts.map((entry) => [entry._id, entry.count]));
  const weeklyMap = new Map(weeklyCompleted.map((entry) => [entry._id, entry.count]));
  const queue = openTicketStats[0] ?? {
    open: 0,
    waitingCustomer: 0,
    urgent: 0,
    unassigned: 0,
  };
  const hourlySchedule = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    requestedDeadlines: 0,
    firstResponseDeadlines: 0,
    resolutionDeadlines: 0,
  }));
  for (const ticket of hourlyTickets) {
    const increment = (
      date: Date | null | undefined,
      field: "requestedDeadlines" | "firstResponseDeadlines" | "resolutionDeadlines",
    ) => {
      if (!date) return;
      const hour = getDateTimeParts(date, timeZone).hour;
      const bucket = hourlySchedule[hour];
      if (bucket) bucket[field] += 1;
    };
    increment(ticket.dueDate, "requestedDeadlines");
    if (!ticket.firstRespondedAt) {
      increment(ticket.firstResponseDueAt, "firstResponseDeadlines");
    }
    increment(ticket.resolutionDueAt, "resolutionDeadlines");
  }
  const needsAttention = orderedFocusTasks.map((ticket) => {
    const nextActionAt = nextOperationalDeadline(ticket);
    return {
      ...serializeTicket(ticket),
      nextActionAt,
      slaState:
        nextActionAt && nextActionAt < now
          ? "breached"
          : nextActionAt && nextActionAt.getTime() - now.getTime() <= 4 * 60 * 60 * 1000
            ? "at-risk"
            : "on-track",
    };
  });

  return {
    generatedAt: now.toISOString(),
    timeZone,
    stats: {
      tasksToday: todayTasks.length,
      completed: completedToday,
      overdue,
      completionRate: todayTasks.length ? completedToday / todayTasks.length : 0,
      openTickets: queue.open,
      waitingCustomer: queue.waitingCustomer,
      urgentOpen: queue.urgent,
      unassigned: queue.unassigned,
      slaBreached: breachedSlaTickets,
      slaAtRisk: slaAtRiskTickets,
      resolvedToday,
    },
    // Legacy key plus desk-native naming.
    focusTasks: needsAttention,
    needsAttention,
    upcoming: upcomingKeys.map((date) => ({
      date,
      count: upcomingMap.get(date) ?? 0,
    })),
    weeklyProgress: weeklyKeys.map((date) => ({
      date,
      completed: weeklyMap.get(date) ?? 0,
      resolved: weeklyMap.get(date) ?? 0,
    })),
    hourlySchedule,
    sla: {
      firstResponseBreaches,
      resolutionBreaches,
      breachedTickets: breachedSlaTickets,
      atRiskTickets: slaAtRiskTickets,
    },
    dailyBrief: {
      overdue,
      highPriority,
      dueToday,
      scheduleConflicts: conflictBuckets.length,
    },
  };
};
