import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { sessions } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export function createSession(ownerId: string, name?: string) {
  const id = uuidv4();
  db.insert(sessions)
    .values({ id, ownerId, name: name || "Untitled" })
    .run();
  return db.select().from(sessions).where(eq(sessions.id, id)).get();
}

export function getSessionsByOwner(ownerId: string) {
  return db
    .select()
    .from(sessions)
    .where(eq(sessions.ownerId, ownerId))
    .all();
}

export function getSession(id: string, ownerId: string) {
  return db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.ownerId, ownerId)))
    .get();
}

export function updateSession(id: string, ownerId: string, data: Partial<{ name: string; state: string }>) {
  const existing = getSession(id, ownerId);
  if (!existing) return null;

  db.update(sessions)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(sessions.id, id), eq(sessions.ownerId, ownerId)))
    .run();

  return getSession(id, ownerId);
}

export function deleteSession(id: string, ownerId: string) {
  return db
    .delete(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.ownerId, ownerId)))
    .run();
}
