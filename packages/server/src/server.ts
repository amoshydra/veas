import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import sessionsRoute from "./routes/sessions.js";
import jobsRoute from "./routes/jobs.js";
import filesRoute from "./routes/files.js";
import opsRoute from "./routes/operations.js";
import pipelinesRoute from "./routes/pipelines.js";

const app = new Hono();

app.use("*", cors());
app.use("*", logger());

// Health check
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  });
});

// Routes
app.route("/api/sessions", sessionsRoute);
app.route("/api/jobs", jobsRoute);
app.route("/api/files", filesRoute);
app.route("/api/operations", opsRoute);
app.route("/api/pipelines", pipelinesRoute);

const port = parseInt(process.env.PORT || "3001");

console.log(`VEAS server starting on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
