import { Hono } from "hono";
import {
  createSession,
  getSessionsByOwner,
  getSession,
  updateSession,
  deleteSession,
} from "../services/session.js";
import { db } from "../db/index.js";
import { files } from "../db/schema.js";
import { eq } from "drizzle-orm";

const sessionsRoute = new Hono();

sessionsRoute.post("/", async (c) => {
  const body = await c.req.json();
  const ownerId = body.ownerId || c.req.header("x-owner-id") || "anonymous";
  const session = createSession(ownerId, body.name);
  return c.json(session, 201);
});

sessionsRoute.get("/", (c) => {
  const ownerId = c.req.query("ownerId") || c.req.header("x-owner-id") || "anonymous";
  const list = getSessionsByOwner(ownerId);
  return c.json(list);
});

sessionsRoute.get("/:id", (c) => {
  const ownerId = c.req.header("x-owner-id") || "anonymous";
  const session = getSession(c.req.param("id"), ownerId);
  if (!session) return c.json({ error: "Session not found" }, 404);
  return c.json(session);
});

sessionsRoute.put("/:id", async (c) => {
  const ownerId = c.req.header("x-owner-id") || "anonymous";
  const body = await c.req.json();
  const updated = updateSession(c.req.param("id"), ownerId, body);
  if (!updated) return c.json({ error: "Session not found" }, 404);
  return c.json(updated);
});

sessionsRoute.get("/:id/summary", (c) => {
  const ownerId = c.req.header("x-owner-id") || "anonymous";
  const session = getSession(c.req.param("id"), ownerId);
  if (!session) return c.json({ error: "Session not found" }, 404);

  const sessionFiles = db.select().from(files).where(eq(files.sessionId, session.id)).all();

  return c.json({
    fileCount: sessionFiles.length,
    totalSize: sessionFiles.reduce((sum, f) => sum + f.size, 0),
  });
});

sessionsRoute.delete("/:id", (c) => {
  const ownerId = c.req.header("x-owner-id") || "anonymous";
  deleteSession(c.req.param("id"), ownerId);
  return c.json({ ok: true });
});

export default sessionsRoute;
