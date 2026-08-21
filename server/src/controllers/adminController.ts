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
  applyTicketPriorityTransition,
  canDeleteAccount,
  canManageBan,
  isStaffRoles,
  isSuperAdminRoles,
  serializeTicket,
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

const ensureTicketOwnerInScope = (
  actorRoles: readonly string[],
  ownerRoles: readonly string[],
): void => {
  if (!isSuperAdminRoles(actorRoles) && isStaffRoles(ownerRoles)) {
    throw new AppError("Only a Super Support Agent can manage staff tickets", 403);
  }
};

export const getAdminTasks: RequestHandler = async (request, response) => {
  const query = adminTaskQuerySchema.parse(request.query);
  const filter: QueryFilter<ITask> = {};
  const superAdmin = isSuperAdminRoles(request.user?.roles ?? []);

  if (!superAdmin) {
    const protectedOwners = (
      await User.distinct("_id", {
        roles: { $in: ["admin", "super_admin"] },
      })
    ).map((ownerId) => new mongoose.Types.ObjectId(String(ownerId)));
    filter.owner = { $nin: protectedOwners };
    if (
      query.ownerId &&
      protectedOwners.some((ownerId) => String(ownerId) === query.ownerId)
    ) {
      throw new AppError("Only a Super Support Agent can view staff tickets", 403);
    }
  }

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

  if (query.attention) {
    const now = new Date();
    const attentionFilter: QueryFilter<ITask> =
      query.attention === "first-response-breached"
        ? {
            status: { $ne: "done" },
            firstRespondedAt: null,
            firstResponseDueAt: { $lt: now },
          }
        : query.attention === "resolution-breached"
          ? {
              status: { $ne: "done" },
              resolutionDueAt: { $lt: now },
            }
          : {
              status: { $ne: "done" },
              dueDate: { $lt: now },
            };
    filter.$and = [attentionFilter];
  }

  if (query.ownerId) {
    filter.owner = new mongoose.Types.ObjectId(query.ownerId);
  }

  if (query.assigneeId) {
    filter.assignee = new mongoose.Types.ObjectId(query.assigneeId);
  } else if (query.unassigned === true) {
    filter.assignee = null;
  }

  if (query.search) {
    const search = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = [{ ticketNumber: search }, { title: search }, { description: search }];
  }

  const skip = (query.page - 1) * query.limit;
  const order: SortOrder = query.order === "asc" ? 1 : -1;

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate("owner", "firstName lastName email roles profileImage")
      .populate("assignee", "firstName lastName email roles profileImage")
      .sort({ [query.sortBy]: order, _id: order })
      .skip(skip)
      .limit(query.limit),
    Task.countDocuments(filter),
  ]);

  response.status(200).json({
    success: true,
    data: {
      tasks: tasks.map(serializeTicket),
      pagination: createPagination(total, query.page, query.limit),
    },
  });
};

export const getAdminOverview: RequestHandler = async (request, response) => {
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const weeklyStart = new Date(todayStart);
  weeklyStart.setUTCDate(weeklyStart.getUTCDate() - 6);
  const superAdmin = isSuperAdminRoles(request.user?.roles ?? []);
  const protectedOwners = superAdmin
    ? []
    : (
        await User.distinct("_id", {
          roles: { $in: ["admin", "super_admin"] },
        })
      ).map((ownerId) => new mongoose.Types.ObjectId(String(ownerId)));
  const ticketScope: QueryFilter<ITask> = superAdmin
    ? {}
    : { owner: { $nin: protectedOwners } };
  const ticketFilter = (extra: QueryFilter<ITask> = {}): QueryFilter<ITask> => ({
    ...ticketScope,
    ...extra,
  });
  const [
    totalUsers,
    activeUsers,
    totalTickets,
    openTickets,
    overdueRequestedDeadlines,
    waitingCustomerTickets,
    urgentOpenTickets,
    unassignedTickets,
    firstResponseBreaches,
    resolutionBreaches,
    breachedSlaTickets,
    waitingSupport,
    unansweredContacts,
    bannedUsers,
    resolvedToday,
    weeklyResolved,
    firstResponseTiming,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ $or: [{ ban: null }, { "ban.isBanned": { $ne: true } }] }),
    Task.countDocuments(ticketScope),
    Task.countDocuments(ticketFilter({ status: { $ne: "done" } })),
    Task.countDocuments(ticketFilter({ status: { $ne: "done" }, dueDate: { $lt: now } })),
    Task.countDocuments(ticketFilter({ status: "waiting-customer" })),
    Task.countDocuments(ticketFilter({ status: { $ne: "done" }, priority: "urgent" })),
    Task.countDocuments(ticketFilter({ status: { $ne: "done" }, assignee: null })),
    Task.countDocuments(
      ticketFilter({
        status: { $ne: "done" },
        firstRespondedAt: null,
        firstResponseDueAt: { $lt: now },
      }),
    ),
    Task.countDocuments(
      ticketFilter({
        status: { $ne: "done" },
        resolutionDueAt: { $lt: now },
      }),
    ),
    Task.countDocuments(
      ticketFilter({
        status: { $ne: "done" },
        $or: [
          { firstRespondedAt: null, firstResponseDueAt: { $lt: now } },
          { resolutionDueAt: { $lt: now } },
        ],
      }),
    ),
    SupportChat.countDocuments(
      superAdmin
        ? { status: "open" }
        : {
            status: "open",
            requiresSuperAdmin: false,
            origin: { $in: ["user", "guest"] },
          },
    ),
    ContactSubmission.countDocuments({ status: "open" }),
    User.countDocuments({ "ban.isBanned": true }),
    Task.countDocuments(ticketFilter({ completedAt: { $gte: todayStart, $lte: now } })),
    Task.aggregate<{ _id: string; count: number }>([
      { $match: ticketFilter({ completedAt: { $gte: weeklyStart } }) },
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
    Task.aggregate<{ averageMinutes: number }>([
      {
        $match: {
          ...ticketScope,
          firstRespondedAt: { $type: "date" },
          createdAt: { $type: "date" },
        },
      },
      {
        $group: {
          _id: null,
          averageMinutes: {
            $avg: {
              $divide: [{ $subtract: ["$firstRespondedAt", "$createdAt"] }, 60_000],
            },
          },
        },
      },
      { $project: { _id: 0, averageMinutes: 1 } },
    ]),
  ]);
  const weeklyMap = new Map(weeklyResolved.map((entry) => [entry._id, entry.count]));
  const weeklyProgress = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weeklyStart);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const resolved = weeklyMap.get(key) ?? 0;
    return { date: key, completed: resolved, resolved };
  });

  response.status(200).json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      // Legacy names remain until older clients have moved to the ticket names.
      totalTasks: totalTickets,
      openTasks: openTickets,
      overdueTasks: overdueRequestedDeadlines,
      totalTickets,
      openTickets,
      overdueRequestedDeadlines,
      waitingCustomerTickets,
      urgentOpenTickets,
      unassignedTickets,
      firstResponseBreaches,
      resolutionBreaches,
      breachedSlaTickets,
      resolvedToday,
      averageFirstResponseMinutes: firstResponseTiming[0]?.averageMinutes ?? null,
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
  const user = await User.findById(userId).select("roles");
  if (!user) throw new AppError("User not found", 404);
  ensureTicketOwnerInScope(request.user?.roles ?? [], user.roles);

  const filter: QueryFilter<ITask> = { owner: new mongoose.Types.ObjectId(userId) };
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.category) filter.category = query.category;
  if (query.source) filter.source = query.source;
  if (query.assigneeId) {
    filter.assignee = new mongoose.Types.ObjectId(query.assigneeId);
  } else if (query.unassigned === true) {
    filter.assignee = null;
  }
  if (query.search) {
    const search = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = [{ ticketNumber: search }, { title: search }, { description: search }];
  }

  const skip = (query.page - 1) * query.limit;
  const order: SortOrder = query.order === "asc" ? 1 : -1;
  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate("assignee", "firstName lastName email roles profileImage")
      .sort({ [query.sortBy]: order, _id: order })
      .skip(skip)
      .limit(query.limit),
    Task.countDocuments(filter),
  ]);

  response.status(200).json({
    success: true,
    data: {
      tasks: tasks.map(serializeTicket),
      pagination: createPagination(total, query.page, query.limit),
    },
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
  if (task) {
    await task.populate("assignee", "firstName lastName email roles profileImage");
  }

  if (!task) {
    throw new AppError("Ticket not found", 404);
  }
  const populatedOwner = task.owner as unknown as Pick<IUser, "roles">;
  ensureTicketOwnerInScope(request.user?.roles ?? [], populatedOwner.roles);

  response.status(200).json({
    success: true,
    data: { task: serializeTicket(task) },
  });
};

export const updateAdminTask: RequestHandler = async (request, response) => {
  const taskId = validateObjectId(request.params.taskId ?? request.params.id, "task");
  const ownerId = request.params.userId
    ? validateObjectId(request.params.userId, "user")
    : undefined;

  if (Object.keys(request.body).length === 0) {
    throw new AppError("At least one ticket field must be provided", 400);
  }

  const task = await Task.findOne({ _id: taskId, ...(ownerId && { owner: ownerId }) });

  if (!task) {
    throw new AppError("Ticket not found", 404);
  }

  const owner = await User.findById(task.owner).select("roles");
  if (!owner) throw new AppError("Ticket owner not found", 404);
  ensureTicketOwnerInScope(request.user?.roles ?? [], owner.roles);

  const superAdmin = isSuperAdminRoles(request.user?.roles ?? []);
  if (!superAdmin && task.assignee && String(task.assignee) !== request.user?.userId) {
    throw new AppError("This ticket is assigned to another support agent", 403);
  }

  const changesWorkflow = [
    "status",
    "priority",
    "category",
    "firstResponseDueAt",
    "resolutionDueAt",
  ].some((field) => Object.hasOwn(request.body, field));
  if (
    !superAdmin &&
    changesWorkflow &&
    (!task.assignee || request.body.assignee === null)
  ) {
    request.body.assignee = request.user?.userId;
  }

  if (request.body.assignee) {
    const assignee = await User.findById(request.body.assignee).select("roles");
    if (!assignee || !isStaffRoles(assignee.roles)) {
      throw new AppError("Ticket assignee must be a support staff member", 400);
    }
    if (!superAdmin && String(assignee._id) !== request.user?.userId) {
      throw new AppError("Support agents may only assign tickets to themselves", 403);
    }
  } else if (
    !superAdmin &&
    request.body.assignee === null &&
    task.assignee &&
    String(task.assignee) !== request.user?.userId
  ) {
    throw new AppError("You cannot unassign another support agent's ticket", 403);
  }

  const changesAssignee =
    Object.hasOwn(request.body, "assignee") &&
    String(request.body.assignee ?? "") !== String(task.assignee ?? "");
  const changesStatus =
    Object.hasOwn(request.body, "status") && request.body.status !== task.status;
  if (changesAssignee || changesStatus) {
    const activeChat = await SupportChat.exists({
      ticket: task._id,
      status: { $in: ["assistant", "open", "active"] },
    });
    if (activeChat) {
      throw new AppError(
        changesAssignee
          ? "Transfer or end the active support chat before changing the ticket assignee"
          : "End the active support chat before changing the ticket status",
        409,
      );
    }
  }

  applyTaskStatusTransition(task, request.body.status);
  applyTicketPriorityTransition(
    task,
    request.body.priority,
    {
      firstResponseDueAt: Object.hasOwn(request.body, "firstResponseDueAt"),
      resolutionDueAt: Object.hasOwn(request.body, "resolutionDueAt"),
    },
    { allowExtension: true, nextStatus: request.body.status },
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

  await task.populate("owner", "firstName lastName email roles profileImage");
  await task.populate("assignee", "firstName lastName email roles profileImage");

  response.status(200).json({
    success: true,
    message: "Ticket updated successfully",
    data: { task: serializeTicket(task) },
  });
};

export const deleteAdminTask: RequestHandler = async (request, response) => {
  const taskId = validateObjectId(request.params.taskId ?? request.params.id, "task");
  const ownerId = request.params.userId
    ? validateObjectId(request.params.userId, "user")
    : undefined;
  const task = await Task.findOne({
    _id: taskId,
    ...(ownerId && { owner: ownerId }),
  });

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
      stats: { taskCount, ticketCount: taskCount, activeSessionCount },
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
