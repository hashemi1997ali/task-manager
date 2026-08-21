import type { QueryFilter, SortOrder } from "mongoose";
import mongoose from "mongoose";
import type { RequestHandler } from "express";

import { Task, User, type ITask } from "#models";
import { getTodayDashboardData } from "#services";
import { AppError, applyTaskStatusTransition } from "#utils";
import { taskQuerySchema } from "#schemas";

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const requireUserId = (userId: string | undefined): string => {
  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  return userId;
};

const validateTaskId = (id: unknown): string => {
  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid task ID", 400);
  }

  return id;
};

export const createTask: RequestHandler = async (request, response) => {
  const owner = requireUserId(request.user?.userId);
  const ownerExists = await User.exists({ _id: owner });

  if (!ownerExists) {
    throw new AppError("User no longer exists", 401);
  }

  const task = await Task.create({
    ...request.body,
    owner,
    completedAt: request.body.status === "done" ? new Date() : null,
  });
  response.status(201).json({
    success: true,
    message: "Task created successfully",
    data: { task },
  });
};

export const getTasks: RequestHandler = async (request, response) => {
  const owner = requireUserId(request.user?.userId);
  const filter: QueryFilter<ITask> = { owner };
  const query = taskQuerySchema.parse(request.query);

  if (query.status) {
    filter.status = query.status;
  }

  if (query.priority) {
    filter.priority = query.priority;
  }

  if (query.search) {
    const regex = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = [{ title: regex }, { description: regex }];
  }

  if (query.dueBefore || query.dueAfter) {
    const dueDateFilter: { $lte?: Date; $gte?: Date } = {};

    if (query.dueBefore) {
      dueDateFilter.$lte = query.dueBefore;
    }

    if (query.dueAfter) {
      dueDateFilter.$gte = query.dueAfter;
    }

    filter.dueDate = dueDateFilter;
  }

  const { page, limit } = query;
  const skip = (page - 1) * limit;
  const order: SortOrder = query.order === "asc" ? 1 : -1;

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort({ [query.sortBy]: order, _id: order })
      .skip(skip)
      .limit(limit),
    Task.countDocuments(filter),
  ]);

  response.status(200).json({
    success: true,
    data: {
      tasks,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    },
  });
};

export const getTaskById: RequestHandler = async (request, response) => {
  const owner = requireUserId(request.user?.userId);
  const taskId = validateTaskId(request.params.id);
  const task = await Task.findOne({ _id: taskId, owner });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  response.status(200).json({ success: true, data: { task } });
};

export const updateTask: RequestHandler = async (request, response) => {
  const owner = requireUserId(request.user?.userId);
  const taskId = validateTaskId(request.params.id);

  if (Object.keys(request.body).length === 0) {
    throw new AppError("At least one task field must be provided", 400);
  }

  const task = await Task.findOne({ _id: taskId, owner });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  applyTaskStatusTransition(task, request.body.status);
  Object.assign(task, request.body);
  await task.save();

  response.status(200).json({
    success: true,
    message: "Task updated successfully",
    data: { task },
  });
};

export const deleteTask: RequestHandler = async (request, response) => {
  const owner = requireUserId(request.user?.userId);
  const taskId = validateTaskId(request.params.id);
  const task = await Task.findOneAndDelete({ _id: taskId, owner });

  if (!task) {
    throw new AppError("Task not found", 404);
  }
  response.status(200).json({
    success: true,
    message: "Task deleted successfully",
  });
};

export const getTaskSummary: RequestHandler = async (request, response) => {
  const owner = requireUserId(request.user?.userId);

  const [summary] = await Task.aggregate<{
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    low: number;
    medium: number;
    high: number;
    overdue: number;
  }>([
    { $match: { owner: new mongoose.Types.ObjectId(owner) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        todo: { $sum: { $cond: [{ $eq: ["$status", "todo"] }, 1, 0] } },
        inProgress: {
          $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] },
        },
        done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
        low: { $sum: { $cond: [{ $eq: ["$priority", "low"] }, 1, 0] } },
        medium: {
          $sum: { $cond: [{ $eq: ["$priority", "medium"] }, 1, 0] },
        },
        high: { $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$status", "done"] },
                  { $ne: ["$dueDate", null] },
                  { $lt: ["$dueDate", new Date()] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $project: { _id: 0 } },
  ]);

  response.status(200).json({
    success: true,
    data: {
      summary: summary ?? {
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
        low: 0,
        medium: 0,
        high: 0,
        overdue: 0,
      },
    },
  });
};

export const getTodayDashboard: RequestHandler = async (request, response) => {
  const owner = requireUserId(request.user?.userId);
  const requestedTimeZone =
    typeof request.query.timeZone === "string" ? request.query.timeZone : "UTC";

  let dashboard;
  try {
    dashboard = await getTodayDashboardData({
      userId: owner,
      requestedTimeZone,
    });
  } catch (error) {
    if (error instanceof RangeError) {
      throw new AppError("Invalid time zone", 400);
    }
    throw error;
  }

  response.status(200).json({
    success: true,
    data: { dashboard },
  });
};
