import { v4 as uuidv4 } from "uuid";
import { rmSync } from "node:fs";
import { db } from "../db/index.js";
import { sessions, files } from "../db/schema.js";
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
  // Get all files for this session
  const sessionFiles = db
    .select({ path: files.path })
    .from(files)
    .where(eq(files.sessionId, id))
    .all();

  // Delete files from disk
  for (const file of sessionFiles) {
    try { rmSync(file.path, { force: true }); } catch {}
  }

  // Remove session directories
  try { rmSync(`./data/uploads/${id}`, { recursive: true, force: true }); } catch {}
  try { rmSync(`./data/output/${id}`, { recursive: true, force: true }); } catch {}

  // Delete session row (CASCADE cleans up files + jobs DB records)
  return db
    .delete(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.ownerId, ownerId)))
    .run();
}
