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

const connectToDatabase = async (): Promise<void> => {
  try {
    const connection = await mongoose.connect(getRequiredEnv("MONGO_URI"));
    console.log(`MongoDB connected: ${connection.connection.host}`);
    await bootstrapSuperAdmin();
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};

await connectToDatabase();
