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

Before making changes, read these files (may not exist in freshly cloned repo):

- `.planning/PLAN.md` — Full architecture, API design, data model, phases
- `.planning/TODO.md` — Implementation checklist, track progress here

## Commands

### Monorepo (root)

```bash
pnpm dev              # Run both server + client concurrently
pnpm dev:server       # Server only (tsx watch, port 3001)
pnpm dev:client       # Client only (Vite, port 5173)
pnpm build            # Build all packages
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run database migrations
```

### Server (`packages/server/`)

```bash
pnpm dev              # Start with tsx watch
pnpm build            # Compile with tsc
pnpm start            # Run compiled output
```

### Client (`packages/client/`)

```bash
pnpm dev              # Vite dev server
pnpm build            # Typecheck + production build
pnpm build:demo       # Build with demo mode enabled (for GitHub Pages)
pnpm preview          # Preview production build
```

### GitHub Pages Demo Build

To deploy a demo on GitHub Pages (uses mock data, no server required):

```bash
# Build with demo mode enabled
pnpm --filter @veas/client build:demo

# Or manually
VITE_DEMO_MODE=true pnpm --filter @veas/client build
```

The demo mode is controlled by the `VITE_DEMO_MODE` build-time environment variable:

- `VITE_DEMO_MODE=true` — Enables mock API (MSW), shows demo data, enables settings toggle
- Not set or `false` — Uses real API calls to `/api` endpoints

### Testing

No test framework is currently configured. When adding tests, use **Vitest**
for both packages (compatible with Vite on client, ESM on server).

```bash
# Single test file (once vitest is installed)
pnpm --filter @veas/server vitest run path/to/file.test.ts
pnpm --filter @veas/client vitest run path/to/file.test.tsx
# Watch mode
pnpm --filter @veas/client vitest
```

## Code Style

### Module System

- ESM only (`"type": "module"` in both packages)
- Relative imports **must** use `.js` extension: `import { foo } from "./bar.js"`
- Node built-ins use `node:` prefix: `import { spawn } from "node:child_process"`

### Import Ordering

1. External packages (npm) — grouped, roughly alphabetical
2. Node.js built-ins with `node:` prefix
3. Internal relative imports
4. CSS imports (client only, last)

Use named imports. Default exports only for route handlers and page components.
Use `import type` for type-only imports.

### Formatting

- 2-space indentation
- Double quotes for strings and JSX attributes
- Semicolons required
- Trailing commas in multi-line objects/arrays
- Opening brace on same line
- Keep lines under ~120 characters
- No linter/formatter is configured — follow existing patterns manually

### Naming Conventions

| Kind                      | Convention                  | Example                                      |
| ------------------------- | --------------------------- | -------------------------------------------- |
| Files (server)            | kebab-case                  | `job-queue.ts`, `sessions.ts`                |
| Files (client components) | PascalCase                  | `NodeEditor.tsx`, `ProgressIndicator.tsx`    |
| Files (hooks)             | camelCase with `use` prefix | `useSSE.ts`, `useContextMenu.ts`             |
| Functions/variables       | camelCase                   | `createSession`, `handleFileSelect`          |
| Constants                 | UPPER_SNAKE_CASE            | `API_BASE`, `DB_PATH`, `NODE_DEFINITIONS`    |
| Interfaces/Types          | PascalCase                  | `FfprobeResult`, `NodeType`, `PipelineEvent` |
| Route variables           | camelCase + `Route` suffix  | `sessionsRoute`, `jobsRoute`                 |

Server route files are plural nouns; service files are singular.

### TypeScript

- `strict: true` is enabled in root `tsconfig.json`
- Avoid `as any` and `Record<string, any>` — prefer proper interfaces
- Use `err: unknown` in catch blocks, narrow with `instanceof Error`
- Use `Partial<T>` for update payloads
- Prefer interfaces for object shapes, type aliases for unions
- Non-null assertions (`!`) only when provably safe

### Error Handling

- **Server routes**: Return appropriate HTTP status codes (400, 404, 500) with `{ error: string }` JSON
- **Server services**: Throw `Error` for invalid state; use try/catch for FFmpeg operations
- **Non-critical ops** (ffprobe, file cleanup): Empty catch blocks are acceptable
- **Client**: Use `console.error` for debugging, local state for user-facing errors
- **Global handlers**: Server registers `uncaughtException` and `unhandledRejection` listeners

### Architecture Patterns

- **Server**: Thin routes → Services (business logic) → DB (Drizzle ORM)
- **Client state**: Zustand for client state, TanStack Query for server state
- **Client components**: All functional components, no class components
- **Event handlers**: Prefix with `handle` (`handleDelete`); callback props prefix with `on` (`onClick`)
- **Early returns**: Return `null` for conditional rendering

### Conventions

- Update `.planning/TODO.md` when completing or starting tasks
- Follow the phase order in PLAN.md
- Server code in `packages/server/`, Client code in `packages/client/`
- No barrel exports (no `index.ts` re-export files)
- No test files exist yet — this is expected, not an oversight
