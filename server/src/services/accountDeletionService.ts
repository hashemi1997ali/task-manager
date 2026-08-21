import type { HydratedDocument } from "mongoose";

import {
  AssistantConversation,
  ContactSubmission,
  PasswordReset,
  RefreshSession,
  SupportChat,
  Task,
  User,
  type IUser,
} from "#models";
import { deleteProfileImageFromCloudinary } from "../middlewares/upload.ts";

export interface AccountDeletionResult {
  deletedTaskCount: number;
  deletedChatCount: number;
  deletedAssistantConversationCount: number;
}

export const deleteUserAccount = async (
  user: HydratedDocument<IUser>,
): Promise<AccountDeletionResult> => {
  await RefreshSession.updateMany(
    { user: user._id, revokedAt: null },
    {
      $set: {
        revokedAt: new Date(),
        revocationReason: "user-deleted",
      },
    },
  );

  const [taskDeleteResult, chatDeleteResult, assistantConversationDeleteResult] =
    await Promise.all([
      Task.deleteMany({ owner: user._id }),
      SupportChat.deleteMany({ user: user._id }),
      AssistantConversation.deleteMany({ user: user._id }),
      RefreshSession.deleteMany({ user: user._id }),
      PasswordReset.deleteMany({ user: user._id }),
    ]);

  await Promise.all([
    SupportChat.updateMany(
      { assignedTo: user._id },
      { $set: { assignedTo: null, assignedToName: null } },
    ),
    SupportChat.updateMany(
      { "messages.senderId": user._id },
      { $set: { "messages.$[message].senderId": null } },
      { arrayFilters: [{ "message.senderId": user._id }] },
    ),
    ContactSubmission.updateMany(
      { "messages.senderId": user._id },
      { $set: { "messages.$[message].senderId": null } },
      { arrayFilters: [{ "message.senderId": user._id }] },
    ),
  ]);

  await User.deleteOne({ _id: user._id });

  if (user.profileImage) {
    await deleteProfileImageFromCloudinary(user.profileImage.publicId).catch((error) =>
      console.error(`Failed to delete profile image for user ${user._id}:`, error),
    );
  }

  return {
    deletedTaskCount: taskDeleteResult.deletedCount,
    deletedChatCount: chatDeleteResult.deletedCount,
    deletedAssistantConversationCount: assistantConversationDeleteResult.deletedCount,
  };
};
