import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull().default("Untitled"),
  state: text("state").default("{}"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  path: text("path").notNull(),
  size: integer("size").notNull().default(0),
  mimeType: text("mime_type").default(""),
  duration: real("duration"),
  width: integer("width"),
  height: integer("height"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  operation: text("operation").notNull(),
  params: text("params").notNull().default("{}"),
  status: text("status").notNull().default("queued"),
  progress: real("progress").notNull().default(0),
  inputFiles: text("input_files").notNull().default("[]"),
  outputFile: text("output_file"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
});
