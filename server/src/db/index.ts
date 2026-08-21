import mongoose from "mongoose";

import { getRequiredEnv } from "#utils";

const bootstrapSuperAdmin = async (): Promise<void> => {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;

  const result = await mongoose.connection
    .collection("users")
    .updateOne({ email }, { $set: { roles: ["user", "super_admin"] } });

  if (result.matchedCount === 0) {
    console.warn(`SUPER_ADMIN_EMAIL does not match an existing user: ${email}`);
    return;
  }

  console.log(`Super administrator ensured for ${email}`);
};

/**
 * Idempotently upgrades legacy Task rows to the support-ticket shape. Keeping
 * this at connection time means old production data is safe before API reads
 * and before operators search by the new human ticket number.
 */
const backfillLegacyTickets = async (): Promise<void> => {
  const tasks = mongoose.connection.collection("tasks");
  const startedAt = { $ifNull: ["$createdAt", { $toDate: "$_id" }] };
  const responseMinutes = {
    $switch: {
      branches: [
        { case: { $eq: ["$priority", "urgent"] }, then: 60 },
        { case: { $eq: ["$priority", "high"] }, then: 4 * 60 },
        { case: { $eq: ["$priority", "low"] }, then: 24 * 60 },
      ],
      default: 12 * 60,
    },
  };
  const resolutionMinutes = {
    $switch: {
      branches: [
        { case: { $eq: ["$priority", "urgent"] }, then: 4 * 60 },
        { case: { $eq: ["$priority", "high"] }, then: 24 * 60 },
        { case: { $eq: ["$priority", "low"] }, then: 5 * 24 * 60 },
      ],
      default: 3 * 24 * 60,
    },
  };
  const result = await tasks.updateMany(
    {
      $or: [
        { ticketNumber: { $exists: false } },
        { category: { $exists: false } },
        { source: { $exists: false } },
        { firstResponseDueAt: { $exists: false } },
        { resolutionDueAt: { $exists: false } },
        { firstRespondedAt: { $exists: false } },
      ],
    },
    [
      {
        $set: {
          ticketNumber: {
            $cond: [
              { $eq: [{ $type: "$ticketNumber" }, "missing"] },
              {
                $concat: [
                  "KRN-",
                  {
                    $dateToString: {
                      date: { $toDate: "$_id" },
                      format: "%Y%m%d",
                      timezone: "UTC",
                    },
                  },
                  "-",
                  {
                    $toUpper: {
                      $substrBytes: [{ $toString: "$_id" }, 16, 8],
                    },
                  },
                ],
              },
              "$ticketNumber",
            ],
          },
          category: {
            $cond: [{ $eq: [{ $type: "$category" }, "missing"] }, "general", "$category"],
          },
          source: {
            $cond: [{ $eq: [{ $type: "$source" }, "missing"] }, "manual", "$source"],
          },
          firstResponseDueAt: {
            $cond: [
              { $eq: [{ $type: "$firstResponseDueAt" }, "missing"] },
              { $add: [startedAt, { $multiply: [responseMinutes, 60_000] }] },
              "$firstResponseDueAt",
            ],
          },
          resolutionDueAt: {
            $cond: [
              { $eq: [{ $type: "$resolutionDueAt" }, "missing"] },
              { $add: [startedAt, { $multiply: [resolutionMinutes, 60_000] }] },
              "$resolutionDueAt",
            ],
          },
          firstRespondedAt: {
            $cond: [
              { $eq: [{ $type: "$firstRespondedAt" }, "missing"] },
              {
                $cond: [
                  { $ne: ["$status", "todo"] },
                  {
                    $ifNull: ["$completedAt", { $ifNull: ["$updatedAt", startedAt] }],
                  },
                  null,
                ],
              },
              "$firstRespondedAt",
            ],
          },
        },
      },
    ],
  );

  if (result.modifiedCount > 0) {
    console.log(`Support-ticket fields backfilled for ${result.modifiedCount} task(s)`);
  }
};

const connectToDatabase = async (): Promise<void> => {
  try {
    const connection = await mongoose.connect(getRequiredEnv("MONGO_URI"));
    console.log(`MongoDB connected: ${connection.connection.host}`);
    await bootstrapSuperAdmin();
    await backfillLegacyTickets();
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};

await connectToDatabase();
