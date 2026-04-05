# VEAS — Video Editing App Service

A client-server video editing application that brings powerful FFmpeg operations to a mobile-first web interface. Process videos through a REST API with real-time progress updates via Server-Sent Events.

## Features

<img width="1716" height="1147" alt="veas - a video editing app service" src="https://github.com/user-attachments/assets/620bb944-313f-49c8-9c1b-b2cad5249d7d" />


- **20+ Video Operations**: Trim, crop, concat, transcode, resize, filters, GIF conversion, speed change, audio extraction, watermark, rotate, reverse, loop, subtitles, picture-in-picture, and more
- **Real-Time Progress**: SSE-based progress streaming with frame-accurate ETA
- **Job Queue**: Concurrency-limited processing with P-Queue
- **Node Graph Editor**: Visual pipeline editor powered by ReactFlow for chaining operations
- **Session Management**: Persistent projects with auto-save and resume capability
- **File Management**: Chunked uploads, ffprobe metadata, thumbnail generation, and sprite sheets

## Tech Stack

| Layer            | Technology                                |
| ---------------- | ----------------------------------------- |
| **Server**       | Node.js, TypeScript, Hono                 |
| **Database**     | SQLite with Drizzle ORM                   |
| **Video Engine** | FFmpeg, ImageMagick                       |
| **Job Queue**    | P-Queue                                   |
| **Client**       | React 19, TypeScript, Vite                |
| **State**        | Zustand (client), TanStack Query (server) |
| **Node Graph**   | ReactFlow (@xyflow/react)                 |
| **Styling**      | Tailwind CSS                              |
| **Real-Time**    | Server-Sent Events (SSE)                  |
| **Monorepo**     | pnpm workspaces                           |

## Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 9+
- [FFmpeg](https://ffmpeg.org/) installed on the system
- [ImageMagick](https://imagemagick.org/) (optional, for image operations)

## Getting Started

### Quick Demo (No Server Required)

Try the demo version without running a server:

**Live Demo**: https://amoshydra.github.io/veas/

The demo uses MSW (Mock Service Worker) to simulate the API. You can upload your own videos and run the pipeline editor with simulated progress. No actual video processing occurs.

### Local Development with Server

```bash
# Clone the repository
git clone https://github.com/amoshydra/veas.git
cd veas

# Install dependencies
pnpm install

# Generate database schema
pnpm db:generate

# Run migrations
pnpm db:migrate
```

### Development

```bash
# Start both server and client concurrently
pnpm dev

# Or run individually
pnpm dev:server    # Server on http://localhost:3001
pnpm dev:client    # Client on http://localhost:5173
```

### Build

```bash
pnpm build             # Build all packages
pnpm build:demo        # Build client for demo (GitHub Pages)
```

## Project Structure

```
veas/
├── packages/
│   ├── server/              # Hono API server
│   │   ├── src/
│   │   │   ├── routes/      # API route handlers
│   │   │   ├── services/    # Business logic (FFmpeg, queue, etc.)
│   │   │   ├── db/          # Drizzle schema & migrations
│   │   │   └── server.ts    # Entry point
│   │   └── drizzle/         # Migration files
│   │
│   └── client/              # React SPA
│       ├── src/
│       │   ├── components/  # UI components (NodeEditor, Timeline, etc.)
│       │   ├── pages/       # Route pages
│       │   ├── stores/      # Zustand stores
│       │   ├── hooks/       # Custom React hooks
│       │   ├── api/         # API client
│       │   └── types/       # TypeScript definitions
│       └── index.html
│
├── .planning/               # Architecture & implementation docs
├── package.json             # Monorepo root
└── pnpm-workspace.yaml
```

## API Endpoints

### Sessions

| Method   | Endpoint            | Description              |
| -------- | ------------------- | ------------------------ |
| `POST`   | `/api/sessions`     | Create a new session     |
| `GET`    | `/api/sessions`     | List user's sessions     |
| `GET`    | `/api/sessions/:id` | Get session details      |
| `PUT`    | `/api/sessions/:id` | Update session           |
| `DELETE` | `/api/sessions/:id` | Delete session and files |

### Files

| Method | Endpoint                   | Description                         |
| ------ | -------------------------- | ----------------------------------- |
| `POST` | `/api/files/upload`        | Upload video (multipart)            |
| `GET`  | `/api/files/:id`           | Download file (with range requests) |
| `GET`  | `/api/files/:id/probe`     | Get media metadata                  |
| `GET`  | `/api/files/:id/thumbnail` | Generate thumbnail                  |

### Jobs

| Method   | Endpoint               | Description            |
| -------- | ---------------------- | ---------------------- |
| `POST`   | `/api/jobs`            | Submit processing job  |
| `GET`    | `/api/jobs`            | List jobs (filterable) |
| `GET`    | `/api/jobs/:id`        | Get job status         |
| `GET`    | `/api/jobs/:id/stream` | SSE progress stream    |
| `DELETE` | `/api/jobs/:id`        | Cancel job             |

### Operations

| Method | Endpoint                    | Description                   |
| ------ | --------------------------- | ----------------------------- |
| `POST` | `/api/operations/trim`      | Trim video                    |
| `POST` | `/api/operations/crop`      | Crop video                    |
| `POST` | `/api/operations/concat`    | Concatenate videos            |
| `POST` | `/api/operations/transcode` | Transcode (H.264/H.265/VP9)   |
| `POST` | `/api/operations/resize`    | Resize with aspect ratio lock |
| `POST` | `/api/operations/gif`       | Palette-optimized GIF         |
| `POST` | `/api/operations/speed`     | Change playback speed         |
| `POST` | `/api/operations/audio`     | Extract/replace audio         |
| `POST` | `/api/operations/watermark` | Add watermark overlay         |
| `POST` | `/api/operations/rotate`    | Rotate/flip video             |
| `POST` | `/api/operations/reverse`   | Reverse video/audio           |
| `POST` | `/api/operations/loop`      | Loop N times                  |
| `POST` | `/api/operations/subtitle`  | Burn-in subtitles             |
| `POST` | `/api/operations/pip`       | Picture-in-picture            |

### Pipelines

| Method | Endpoint                    | Description                 |
| ------ | --------------------------- | --------------------------- |
| `POST` | `/api/pipelines/execute`    | Execute node graph pipeline |
| `GET`  | `/api/pipelines/:id/stream` | SSE pipeline progress       |
| `POST` | `/api/pipelines/save`       | Save node graph             |
| `GET`  | `/api/pipelines/:id`        | Load saved node graph       |

## Architecture

```
┌──────────────────────────────────────────┐
│                   CLIENT                 │
│  React SPA                               │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ │
│  │ Timeline │ │ Preview  │ │ NodeGraph │ │
│  │  Editor  │ │ Player   │ │  Editor   │ │
│  └──────────┘ └──────────┘ └───────────┘ │
│         ▲                                │
│    SSE (progress) + REST API             │
└─────────┼────────────────────────────────┘
          │
┌─────────▼────────────────────────────────┐
│                   SERVER                 │
│  Node.js + TypeScript                    │
│  ┌──────────┐ ┌────────────┐ ┌─────────┐ │
│  │ REST API │ │ SSE Stream │ │ Queue   │ │
│  │ (Hono)   │ │ (progress) │ │(P-Queue)│ │
│  └──────────┘ └────────────┘ └───┬─────┘ │
│                                  │       │
│  ┌───────────────────────────────┴─────┐ │
│  │         FFmpeg / ImageMagick        │ │
│  │  (child_process spawn, progress)    │ │
│  └─────────────────────────────────────┘ │
│  ┌───────────────┐  ┌──────────────────┐ │
│  │ SQLite (DB)   │  │ File Storage     │ │
│  │ (Drizzle)     │  │ (disk)           │ │
│  └───────────────┘  └──────────────────┘ │
└──────────────────────────────────────────┘
```

## Progress

| Phase                  | Status         | Description                                    |
| ---------------------- | -------------- | ---------------------------------------------- |
| 1. Foundation          | ✅ Complete    | Monorepo, Hono server, SQLite schema           |
| 2. File Management     | ✅ Complete    | Upload, ffprobe, thumbnails                    |
| 3. Job Engine          | ✅ Complete    | P-Queue, FFmpeg, SSE                           |
| 4. Core Operations     | ✅ Complete    | Trim, crop, concat, transcode, resize, filters |
| 5. Client Scaffold     | ✅ Complete    | Vite, routing, API client, stores              |
| 6. Editor UI           | 🚧 In Progress | Preview, toolbar, panels, timeline             |
| 7. Session Persistence | 🚧 In Progress | CRUD, localStorage, auto-save                  |
| 8. Enhanced Operations | 🚧 In Progress | GIF, speed, audio, watermark, etc.             |
| 9. Polish              | ⬜ Pending     | Loading states, error boundaries, gestures     |
| 10. Deploy             | ⬜ Pending     | Docker, production build                       |

## License

MIT
