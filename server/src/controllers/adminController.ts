import type { RequestHandler } from "express";
import mongoose, { type QueryFilter, type SortOrder } from "mongoose";

import {
  ContactSubmission,
  RefreshSession,
  PasswordReset,
  SupportChat,
  Task,
  type BanReason,
  type ITask,
  type IUser,
  User,
} from "#models";
import { deleteProfileImageFromCloudinary, uploadProfileImage } from "#middlewares";
import { banUser, deleteUserAccount, setAdministratorRole, unbanUser } from "#services";
import {
  AppError,
  applyTaskStatusTransition,
  canDeleteAccount,
  canManageBan,
} from "#utils";
import {
  adminTaskQuerySchema,
  adminUserQuerySchema,
  adminUserTaskQuerySchema,
} from "../schemas/adminSchema.ts";

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validateObjectId = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new AppError(`Invalid ${label} ID`, 400);
  }

  return value;
};

const requireAdminId = (userId: string | undefined): string => {
  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  return userId;
};

const serializeUser = (user: {
  _id: unknown;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  profileImage?: { url: string; publicId: string } | null;
  createdAt: Date;
  updatedAt: Date;
  ban?: IUser["ban"];
}) => ({
  id: String(user._id),
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  roles: user.roles,
  profileImage: user.profileImage ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  ban: user.ban
    ? {
        isBanned: user.ban.isBanned,
        reason: user.ban.reason,
        bannedAt: user.ban.bannedAt,
      }
    : null,
});

const createPagination = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPreviousPage: page > 1,
});

export const getAdminTasks: RequestHandler = async (request, response) => {
  const query = adminTaskQuerySchema.parse(request.query);
  const filter: QueryFilter<ITask> = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.priority) {
    filter.priority = query.priority;
  }

  if (query.ownerId) {
    filter.owner = new mongoose.Types.ObjectId(query.ownerId);
  }

  if (query.search) {
    const search = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = [{ title: search }, { description: search }];
  }

  const skip = (query.page - 1) * query.limit;
  const order: SortOrder = query.order === "asc" ? 1 : -1;

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate("owner", "firstName lastName email roles profileImage")
      .sort({ [query.sortBy]: order, _id: order })
      .skip(skip)
      .limit(query.limit),
    Task.countDocuments(filter),
  ]);

  response.status(200).json({
    success: true,
    data: {
      tasks,
      pagination: createPagination(total, query.page, query.limit),
    },
  });
};

export const getAdminOverview: RequestHandler = async (_request, response) => {
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const weeklyStart = new Date(todayStart);
  weeklyStart.setUTCDate(weeklyStart.getUTCDate() - 6);
  const [
    totalUsers,
    activeUsers,
    totalTasks,
    openTasks,
    overdueTasks,
    waitingSupport,
    unansweredContacts,
    bannedUsers,
    weeklyCompleted,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ $or: [{ ban: null }, { "ban.isBanned": { $ne: true } }] }),
    Task.countDocuments(),
    Task.countDocuments({ status: { $ne: "done" } }),
    Task.countDocuments({ status: { $ne: "done" }, dueDate: { $lt: now } }),
    SupportChat.countDocuments({ status: "open" }),
    ContactSubmission.countDocuments({ status: "open" }),
    User.countDocuments({ "ban.isBanned": true }),
    Task.aggregate<{ _id: string; count: number }>([
      { $match: { completedAt: { $gte: weeklyStart } } },
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$completedAt",
              format: "%Y-%m-%d",
              timezone: "UTC",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);
  const weeklyMap = new Map(weeklyCompleted.map((entry) => [entry._id, entry.count]));
  const weeklyProgress = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weeklyStart);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date: key, completed: weeklyMap.get(key) ?? 0 };
  });

  response.status(200).json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      totalTasks,
      openTasks,
      overdueTasks,
      waitingSupport,
      unansweredContacts,
      bannedUsers,
      weeklyProgress,
    },
  });
};

export const getAdminUserTasks: RequestHandler = async (request, response) => {
  const userId = validateObjectId(request.params.id, "user");
  const query = adminUserTaskQuerySchema.parse(request.query);
  const userExists = await User.exists({ _id: userId });
  if (!userExists) throw new AppError("User not found", 404);

  const filter: QueryFilter<ITask> = { owner: new mongoose.Types.ObjectId(userId) };
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.search) {
    const search = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = [{ title: search }, { description: search }];
  }

  const skip = (query.page - 1) * query.limit;
  const order: SortOrder = query.order === "asc" ? 1 : -1;
  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort({ [query.sortBy]: order, _id: order })
      .skip(skip)
      .limit(query.limit),
    Task.countDocuments(filter),
  ]);

  response.status(200).json({
    success: true,
    data: { tasks, pagination: createPagination(total, query.page, query.limit) },
  });
};

export const getAdminTaskById: RequestHandler = async (request, response) => {
  const taskId = validateObjectId(request.params.taskId ?? request.params.id, "task");
  const ownerId = request.params.userId
    ? validateObjectId(request.params.userId, "user")
    : undefined;
  const task = await Task.findOne({
    _id: taskId,
    ...(ownerId && { owner: ownerId }),
  }).populate("owner", "firstName lastName email roles profileImage");

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  response.status(200).json({ success: true, data: { task } });
};

export const updateAdminTask: RequestHandler = async (request, response) => {
  const taskId = validateObjectId(request.params.taskId ?? request.params.id, "task");
  const ownerId = request.params.userId
    ? validateObjectId(request.params.userId, "user")
    : undefined;

  if (Object.keys(request.body).length === 0) {
    throw new AppError("At least one task field must be provided", 400);
  }

  const task = await Task.findOne({ _id: taskId, ...(ownerId && { owner: ownerId }) });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  applyTaskStatusTransition(task, request.body.status);
  Object.assign(task, request.body);
  await task.save();

  await task.populate("owner", "firstName lastName email roles profileImage");

  response.status(200).json({
    success: true,
    message: "Task updated successfully",
    data: { task },
  });
};

export const deleteAdminTask: RequestHandler = async (request, response) => {
  const taskId = validateObjectId(request.params.taskId ?? request.params.id, "task");
  const ownerId = request.params.userId
    ? validateObjectId(request.params.userId, "user")
    : undefined;
  const task = await Task.findOneAndDelete({
    _id: taskId,
    ...(ownerId && { owner: ownerId }),
  });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  response.status(200).json({
    success: true,
    message: "Task deleted successfully",
  });
};

export const getAdminUsers: RequestHandler = async (request, response) => {
  const query = adminUserQuerySchema.parse(request.query);
  const filter: QueryFilter<IUser> = {};

  if (query.role) {
    filter.roles = query.role;
  }

  if (query.banned === true) {
    filter["ban.isBanned"] = true;
  } else if (query.banned === false) {
    filter.$and = [
      ...(filter.$and ?? []),
      { $or: [{ ban: null }, { "ban.isBanned": { $ne: true } }] },
    ];
  }

  if (query.search) {
    const search = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = [{ firstName: search }, { lastName: search }, { email: search }];
  }

  const skip = (query.page - 1) * query.limit;
  const [users, total] = await Promise.all([
    User.aggregate([
      { $match: filter },
      {
        $addFields: {
          roleSortRank: {
            $switch: {
              branches: [
                {
                  case: { $in: ["super_admin", { $ifNull: ["$roles", []] }] },
                  then: 0,
                },
                {
                  case: { $in: ["admin", { $ifNull: ["$roles", []] }] },
                  then: 1,
                },
              ],
              default: 2,
            },
          },
        },
      },
      { $sort: { roleSortRank: 1, createdAt: 1, _id: 1 } },
      { $skip: skip },
      { $limit: query.limit },
      { $project: { roleSortRank: 0 } },
    ]),
    User.countDocuments(filter),
  ]);

  response.status(200).json({
    success: true,
    data: {
      users: users.map((user) => serializeUser(user)),
      pagination: createPagination(total, query.page, query.limit),
    },
  });
};

export const getAdminUserById: RequestHandler = async (request, response) => {
  const userId = validateObjectId(request.params.id, "user");
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const now = new Date();
  const [taskCount, activeSessionCount] = await Promise.all([
    Task.countDocuments({ owner: userId }),
    RefreshSession.countDocuments({
      user: userId,
      revokedAt: null,
      expiresAt: { $gt: now },
    }),
  ]);

  response.status(200).json({
    success: true,
    data: {
      user: serializeUser(user),
      stats: { taskCount, activeSessionCount },
    },
  });
};

export const updateAdminUser: RequestHandler = async (request, response) => {
  const userId = validateObjectId(request.params.id, "user");
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (
    String(user._id) !== request.user?.userId &&
    !canDeleteAccount(request.user?.roles ?? [], user.roles)
  ) {
    throw new AppError("You do not have permission to edit this account", 403);
  }

  const { firstName, lastName, email } = request.body as {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  const emailChanged = email !== undefined && email !== user.email;

  if (email && email !== user.email) {
    const emailExists = await User.exists({
      _id: { $ne: user._id },
      email,
    });

    if (emailExists) {
      throw new AppError("An account with this email already exists", 409);
    }
  }

  const uploadedImage = request.file ? await uploadProfileImage(request.file) : null;
  const previousImage = user.profileImage;

  if (firstName !== undefined) {
    user.firstName = firstName;
  }
  if (lastName !== undefined) {
    user.lastName = lastName;
  }
  if (email !== undefined) {
    user.email = email;
  }
  if (uploadedImage) {
    user.profileImage = {
      url: uploadedImage.secure_url,
      publicId: uploadedImage.public_id,
    };
  }

  try {
    await user.save();
    if (emailChanged) await PasswordReset.deleteMany({ user: user._id });
  } catch (error) {
    if (uploadedImage) {
      await deleteProfileImageFromCloudinary(uploadedImage.public_id).catch(
        () => undefined,
      );
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new AppError("An account with this email already exists", 409);
    }

    throw error;
  }
  if (uploadedImage && previousImage) {
    await deleteProfileImageFromCloudinary(previousImage.publicId).catch(() => undefined);
  }

  response.status(200).json({
    success: true,
    message: "User updated successfully",
    data: { user: serializeUser(user) },
  });
};

export const updateAdminRole: RequestHandler = async (request, response) => {
  const actorId = requireAdminId(request.user?.userId);
  const userId = validateObjectId(request.params.id, "user");
  const { isAdmin } = request.body as { isAdmin: boolean };
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const result = await setAdministratorRole(
    { userId: actorId, roles: request.user?.roles ?? [] },
    user,
    isAdmin,
  );

  response.status(200).json({
    success: true,
    message: isAdmin
      ? "Administrator role enabled successfully"
      : "Administrator role removed successfully",
    data: {
      user: serializeUser(result.user),
      sessionsRevoked: result.sessionsRevoked,
    },
  });
};

export const banAdminUser: RequestHandler = async (request, response) => {
  const actorId = requireAdminId(request.user?.userId);
  const userId = validateObjectId(request.params.id, "user");

  if (actorId === userId) {
    throw new AppError("You cannot ban your own account", 400);
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);

  if (!canManageBan(request.user?.roles ?? [], user.roles)) {
    throw new AppError("You do not have permission to ban this account", 403);
  }

  const { reason } = request.body as { reason: BanReason };
  const result = await banUser(user, reason);

  response.status(200).json({
    success: true,
    message: "User banned successfully",
    data: {
      user: serializeUser(result.user),
      sessionsRevoked: result.sessionsRevoked,
    },
  });
};

export const unbanAdminUser: RequestHandler = async (request, response) => {
  const userId = validateObjectId(request.params.id, "user");
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);

  if (!canManageBan(request.user?.roles ?? [], user.roles)) {
    throw new AppError("You do not have permission to unban this account", 403);
  }

  if (!user.ban?.isBanned) {
    throw new AppError("This user is not banned", 409);
  }

  await unbanUser(user);
  response.status(200).json({
    success: true,
    message: "User unbanned successfully",
    data: { user: serializeUser(user) },
  });
};

export const deleteAdminUser: RequestHandler = async (request, response) => {
  const currentAdminId = requireAdminId(request.user?.userId);
  const userId = validateObjectId(request.params.id, "user");

  if (currentAdminId === userId) {
    throw new AppError("You cannot delete your own administrator account", 400);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (!canDeleteAccount(request.user?.roles ?? [], user.roles)) {
    throw new AppError("You do not have permission to delete this account", 403);
  }

  const deletion = await deleteUserAccount(user);

  response.status(200).json({
    success: true,
    message: "User and related data deleted successfully",
    data: {
      ...deletion,
    },
  });
};
