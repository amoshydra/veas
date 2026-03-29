# VEAS — Video Editing as a Service

## Overview
VEAS is a client-server video editing application. The server uses FFmpeg and
ImageMagick for video processing. The client is a mobile-first React SPA that
communicates via REST API and SSE for real-time progress.

## Tech Stack
- **Server**: Node.js + TypeScript + Hono + SQLite (better-sqlite3 + Drizzle)
- **Client**: React + TypeScript + Vite + Tailwind CSS
- **Job Queue**: P-Queue (concurrency-limited)
- **Progress**: Server-Sent Events (SSE)
- **Monorepo**: pnpm workspaces

## Planning Documents
Before making changes, read these files:
- `.planning/PLAN.md` — Full architecture, API design, data model, phases
- `.planning/TODO.md` — Implementation checklist, track progress here

## Conventions
- Update `.planning/TODO.md` when completing or starting tasks
- Follow the phase order in PLAN.md
- Server code in `packages/server/`
- Client code in `packages/client/`
