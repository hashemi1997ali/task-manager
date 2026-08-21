import mongoose from "mongoose";

import { Task, type ITask } from "#models";

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

type DashboardTask = Pick<
  ITask,
  | "title"
  | "description"
  | "status"
  | "priority"
  | "dueDate"
  | "completedAt"
  | "owner"
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
  high: 0,
  medium: 1,
  low: 2,
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

  const [todayTasks, focusTasks, upcomingCounts, weeklyCompleted, conflictBuckets] =
    await Promise.all([
      Task.find({
        owner,
        dueDate: { $gte: todayStart, $lt: tomorrowStart },
      })
        .select(
          "title description status priority dueDate completedAt owner createdAt updatedAt",
        )
        .lean<DashboardTask[]>(),
      Task.find({
        owner,
        dueDate: { $ne: null, $lt: tomorrowStart },
        $or: [
          { dueDate: { $lt: todayStart }, status: { $ne: "done" } },
          { dueDate: { $gte: todayStart, $lt: tomorrowStart } },
        ],
      })
        .select(
          "title description status priority dueDate completedAt owner createdAt updatedAt",
        )
        .sort({ dueDate: 1, updatedAt: -1 })
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
    ]);

  const completedToday = todayTasks.filter((task) => task.status === "done").length;
  const overdue = focusTasks.filter(
    (task) =>
      task.status !== "done" &&
      task.dueDate !== null &&
      task.dueDate !== undefined &&
      task.dueDate < todayStart,
  ).length;
  const dueToday = todayTasks.length - completedToday;
  const highPriority = focusTasks.filter(
    (task) => task.status !== "done" && task.priority === "high",
  ).length;
  const orderedFocusTasks = [...focusTasks]
    .sort((first, second) => {
      const firstOverdue = first.dueDate && first.dueDate < todayStart ? 0 : 1;
      const secondOverdue = second.dueDate && second.dueDate < todayStart ? 0 : 1;
      if (firstOverdue !== secondOverdue) return firstOverdue - secondOverdue;
      if (priorityRank[first.priority] !== priorityRank[second.priority]) {
        return priorityRank[first.priority] - priorityRank[second.priority];
      }
      return (first.dueDate?.getTime() ?? 0) - (second.dueDate?.getTime() ?? 0);
    })
    .slice(0, 5);
  const upcomingMap = new Map(upcomingCounts.map((entry) => [entry._id, entry.count]));
  const weeklyMap = new Map(weeklyCompleted.map((entry) => [entry._id, entry.count]));

  return {
    generatedAt: now.toISOString(),
    timeZone,
    stats: {
      tasksToday: todayTasks.length,
      completed: completedToday,
      overdue,
      completionRate: todayTasks.length ? completedToday / todayTasks.length : 0,
    },
    focusTasks: orderedFocusTasks,
    upcoming: upcomingKeys.map((date) => ({
      date,
      count: upcomingMap.get(date) ?? 0,
    })),
    weeklyProgress: weeklyKeys.map((date) => ({
      date,
      completed: weeklyMap.get(date) ?? 0,
    })),
    dailyBrief: {
      overdue,
      highPriority,
      dueToday,
      scheduleConflicts: conflictBuckets.length,
    },
  };
};
