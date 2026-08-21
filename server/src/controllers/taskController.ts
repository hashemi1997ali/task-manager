import type { QueryFilter, SortOrder } from "mongoose";
import mongoose from "mongoose";
import type { RequestHandler } from "express";

import { SupportChat, Task, User, type ITask } from "#models";
import { getTodayDashboardData } from "#services";
import {
  AppError,
  applyTaskStatusTransition,
  applyTicketPriorityTransition,
  serializeTicket,
} from "#utils";
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
    throw new AppError("Invalid ticket ID", 400);
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
    source: "manual",
    status: "todo",
    assignee: null,
    completedAt: null,
  });
  await task.populate("assignee", "firstName lastName email roles profileImage");
  response.status(201).json({
    success: true,
    message: "Ticket created successfully",
    data: { task: serializeTicket(task) },
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

  if (query.category) {
    filter.category = query.category;
  }

  if (query.source) {
    filter.source = query.source;
  }

  if (query.search) {
    const regex = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = [{ ticketNumber: regex }, { title: regex }, { description: regex }];
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
      .populate("assignee", "firstName lastName email roles profileImage")
      .sort({ [query.sortBy]: order, _id: order })
      .skip(skip)
      .limit(limit),
    Task.countDocuments(filter),
  ]);

  response.status(200).json({
    success: true,
    data: {
      tasks: tasks.map(serializeTicket),
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
  const task = await Task.findOne({ _id: taskId, owner }).populate(
    "assignee",
    "firstName lastName email roles profileImage",
  );

  if (!task) {
    throw new AppError("Ticket not found", 404);
  }

  response.status(200).json({
    success: true,
    data: { task: serializeTicket(task) },
  });
};

export const updateTask: RequestHandler = async (request, response) => {
  const owner = requireUserId(request.user?.userId);
  const taskId = validateTaskId(request.params.id);

  if (Object.keys(request.body).length === 0) {
    throw new AppError("At least one ticket field must be provided", 400);
  }

  const task = await Task.findOne({ _id: taskId, owner });

  if (!task) {
    throw new AppError("Ticket not found", 404);
  }

  if (request.body.status && request.body.status !== task.status) {
    const activeChat = await SupportChat.exists({
      ticket: task._id,
      status: { $in: ["assistant", "open", "active"] },
    });
    if (activeChat) {
      throw new AppError(
        "End the active support chat before changing the ticket status",
        409,
      );
    }
  }

  applyTaskStatusTransition(task, request.body.status);
  applyTicketPriorityTransition(
    task,
    request.body.priority,
    { firstResponseDueAt: false, resolutionDueAt: false },
    { allowExtension: false, nextStatus: request.body.status },
  );
  Object.assign(task, request.body);
  task.$where = { updatedAt: task.updatedAt };
  try {
    await task.save();
  } catch (error) {
    if (error instanceof mongoose.Error.DocumentNotFoundError) {
      throw new AppError("The ticket changed before your update could be saved", 409);
    }
    throw error;
  }
  await task.populate("assignee", "firstName lastName email roles profileImage");

  response.status(200).json({
    success: true,
    message: "Ticket updated successfully",
    data: { task: serializeTicket(task) },
  });
};

export const deleteTask: RequestHandler = async (request, response) => {
  const owner = requireUserId(request.user?.userId);
  const taskId = validateTaskId(request.params.id);
  const task = await Task.findOne({ _id: taskId, owner });

  if (!task) {
    throw new AppError("Ticket not found", 404);
  }
  const activeChat = await SupportChat.exists({
    ticket: task._id,
    status: { $in: ["open", "active"] },
  });
  if (activeChat) {
    throw new AppError("End the linked support chat before deleting this ticket", 409);
  }
  await Promise.all([
    task.deleteOne(),
    SupportChat.updateMany(
      { ticket: task._id, status: "ended" },
      { $set: { ticket: null } },
    ),
  ]);
  response.status(200).json({
    success: true,
    message: "Ticket deleted successfully",
  });
};

export const getTaskSummary: RequestHandler = async (request, response) => {
  const owner = requireUserId(request.user?.userId);
  const now = new Date();

  const [summary] = await Task.aggregate<{
    total: number;
    totalTickets: number;
    openTickets: number;
    todo: number;
    inProgress: number;
    waitingCustomer: number;
    done: number;
    low: number;
    medium: number;
    high: number;
    urgent: number;
    overdue: number;
    firstResponseBreached: number;
    resolutionBreached: number;
    slaBreached: number;
    unassigned: number;
  }>([
    { $match: { owner: new mongoose.Types.ObjectId(owner) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalTickets: { $sum: 1 },
        openTickets: {
          $sum: { $cond: [{ $ne: ["$status", "done"] }, 1, 0] },
        },
        todo: { $sum: { $cond: [{ $eq: ["$status", "todo"] }, 1, 0] } },
        inProgress: {
          $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] },
        },
        waitingCustomer: {
          $sum: {
            $cond: [{ $eq: ["$status", "waiting-customer"] }, 1, 0],
          },
        },
        done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
        low: { $sum: { $cond: [{ $eq: ["$priority", "low"] }, 1, 0] } },
        medium: {
          $sum: { $cond: [{ $eq: ["$priority", "medium"] }, 1, 0] },
        },
        high: { $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] } },
        urgent: {
          $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] },
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$status", "done"] },
                  { $ne: ["$dueDate", null] },
                  { $lt: ["$dueDate", now] },
                ],
              },
              1,
              0,
            ],
          },
        },
        firstResponseBreached: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$status", "done"] },
                  { $eq: [{ $ifNull: ["$firstRespondedAt", null] }, null] },
                  { $ne: [{ $ifNull: ["$firstResponseDueAt", null] }, null] },
                  { $lt: ["$firstResponseDueAt", now] },
                ],
              },
              1,
              0,
            ],
          },
        },
        resolutionBreached: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$status", "done"] },
                  { $ne: [{ $ifNull: ["$resolutionDueAt", null] }, null] },
                  { $lt: ["$resolutionDueAt", now] },
                ],
              },
              1,
              0,
            ],
          },
        },
        slaBreached: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$status", "done"] },
                  {
                    $or: [
                      {
                        $and: [
                          {
                            $eq: [{ $ifNull: ["$firstRespondedAt", null] }, null],
                          },
                          {
                            $ne: [{ $ifNull: ["$firstResponseDueAt", null] }, null],
                          },
                          { $lt: ["$firstResponseDueAt", now] },
                        ],
                      },
                      {
                        $and: [
                          {
                            $ne: [{ $ifNull: ["$resolutionDueAt", null] }, null],
                          },
                          { $lt: ["$resolutionDueAt", now] },
                        ],
                      },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        unassigned: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$status", "done"] },
                  { $eq: [{ $ifNull: ["$assignee", null] }, null] },
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
        totalTickets: 0,
        openTickets: 0,
        todo: 0,
        inProgress: 0,
        waitingCustomer: 0,
        done: 0,
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0,
        overdue: 0,
        firstResponseBreached: 0,
        resolutionBreached: 0,
        slaBreached: 0,
        unassigned: 0,
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
