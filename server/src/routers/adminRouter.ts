import { Router } from "express";

import {
  authenticate,
  requireActiveSession,
  requireCurrentStaff,
  requireCurrentSuperAdmin,
  profileImageUpload,
  validateByZod,
} from "#middlewares";
import {
  banAdminUser,
  deleteAdminTask,
  deleteAdminUser,
  getAdminOverview,
  getAdminTasks,
  getAdminUserById,
  getAdminUsers,
  getAdminUserTasks,
  unbanAdminUser,
  updateAdminRole,
  updateAdminTask,
  updateAdminUser,
} from "#controllers";
import {
  adminBanSchema,
  adminRoleSchema,
  adminUpdateTaskSchema,
  adminUpdateUserSchema,
} from "#schemas";

export const adminRouter = Router();

adminRouter.use(authenticate, requireActiveSession, requireCurrentStaff);

adminRouter.get("/overview", getAdminOverview);
adminRouter.get("/tasks", getAdminTasks);
adminRouter
  .route("/tasks/:id")
  .patch(requireCurrentSuperAdmin, validateByZod(adminUpdateTaskSchema), updateAdminTask)
  .delete(requireCurrentSuperAdmin, deleteAdminTask);

adminRouter.get("/users/:id/tasks", getAdminUserTasks);
adminRouter
  .route("/users/:userId/tasks/:taskId")
  .patch(requireCurrentSuperAdmin, validateByZod(adminUpdateTaskSchema), updateAdminTask)
  .delete(requireCurrentSuperAdmin, deleteAdminTask);

adminRouter.get("/users", getAdminUsers);
adminRouter.patch(
  "/users/:id/admin-role",
  requireCurrentSuperAdmin,
  validateByZod(adminRoleSchema),
  updateAdminRole,
);
adminRouter.post("/users/:id/ban", validateByZod(adminBanSchema), banAdminUser);
adminRouter.post("/users/:id/unban", unbanAdminUser);
adminRouter
  .route("/users/:id")
  .get(getAdminUserById)
  .patch(
    profileImageUpload.single("profileImage"),
    validateByZod(adminUpdateUserSchema),
    updateAdminUser,
  )
  .delete(requireCurrentSuperAdmin, deleteAdminUser);
