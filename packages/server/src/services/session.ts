import { and, eq } from "drizzle-orm";
import { rmSync } from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { files, nodeGraphs, sessions } from "../db/schema.js";

const UNNAMED = "__UNNAMED__";

const DEFAULT_INPUT_NODE = {
  id: "input-1",
  type: "fileInput",
  position: { x: 100, y: 200 },
  data: { config: {} },
};

export function createSession(ownerId: string, name?: string) {
  const id = uuidv4();
  const finalName = name || UNNAMED;
  db.insert(sessions).values({ id, ownerId, name: finalName }).run();

  db.insert(nodeGraphs)
    .values({
      id: uuidv4(),
      sessionId: id,
      nodes: JSON.stringify([DEFAULT_INPUT_NODE]),
      connections: "[]",
    })
    .run();

  return db.select().from(sessions).where(eq(sessions.id, id)).get();
}

export function generateUniqueName(ownerId: string, baseName: string): string {
  const existingNames = db
    .select({ name: sessions.name })
    .from(sessions)
    .where(eq(sessions.ownerId, ownerId))
    .all()
    .map((s) => s.name);

  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  let index = 2;
  let candidate = `${baseName} - ${index}`;
  while (existingNames.includes(candidate)) {
    index++;
    candidate = `${baseName} - ${index}`;
  }
  return candidate;
}

export function getSessionsByOwner(ownerId: string) {
  return db //
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

export function updateSession(
  id: string,
  ownerId: string,
  data: Partial<{ name: string; state: string }>,
) {
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
  const sessionFiles = db
    .select({ path: files.path })
    .from(files)
    .where(eq(files.sessionId, id))
    .all();

  for (const file of sessionFiles) {
    try {
      rmSync(file.path, { force: true });
    } catch {}
  }

  try {
    rmSync(`./data/uploads/${id}`, { recursive: true, force: true });
  } catch {}
  try {
    rmSync(`./data/output/${id}`, { recursive: true, force: true });
  } catch {}

  return db
    .delete(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.ownerId, ownerId)))
    .run();
}
