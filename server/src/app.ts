import cookieParser from "cookie-parser";
import express from "express";

import "#db";
import { errorHandler, notFound, timeLogger } from "#middlewares";
import {
  adminRouter,
  assistantRouter,
  authRouter,
  chatRouter,
  contactRouter,
  taskRouter,
} from "#routers";
import { startAssistantChatLifecycle } from "#services";
import { getNonNegativeIntegerEnv } from "#utils";

const app = express();
const port = Number(process.env.PORT) || 4000;
const trustProxyHops = getNonNegativeIntegerEnv("TRUST_PROXY_HOPS", 0);

app.disable("x-powered-by");

if (trustProxyHops > 0) {
  app.set("trust proxy", trustProxyHops);
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(timeLogger);

app.get("/", (_request, response) => {
  response.status(200).json({
    success: true,
    message: "Karino API is running",
  });
});

app.use("/auth", authRouter);
app.use("/tasks", taskRouter);
app.use("/admin", adminRouter);
app.use("/assistant", assistantRouter);
app.use("/chat", chatRouter);
app.use("/contact", contactRouter);

app.use(notFound);
app.use(errorHandler);

startAssistantChatLifecycle();

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
