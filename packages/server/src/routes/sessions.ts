import { Hono } from "hono";
import {
  createSession,
  getSessionsByOwner,
  getSession,
  updateSession,
  deleteSession,
} from "../services/session.js";

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

sessionsRoute.delete("/:id", (c) => {
  const ownerId = c.req.header("x-owner-id") || "anonymous";
  deleteSession(c.req.param("id"), ownerId);
  return c.json({ ok: true });
});

export default sessionsRoute;
