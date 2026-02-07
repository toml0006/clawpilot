# Architecture (Draft)

ClawPilot is a local-first control-plane UI for supervising OpenClaw agents.

## High-level

- **UI**: Next.js (React) board + task detail + activity feed.
- **API**: Next.js Route Handlers (monolith for MVP).
- **Data**: SQLite via Prisma.
- **Realtime**: Server-Sent Events (SSE) for job/task event streaming (upgrade to WS if needed).
- **Runner**: A lightweight job runner abstraction that:
  - starts OpenClaw work (session spawn / send)
  - captures structured events
  - persists events so refresh doesn’t lose state

## Data flow

1. User moves a task into **Cliff**
2. Backend creates a **Job** for the task and marks it running
3. Runner performs actions and emits **Events**
4. UI receives events via SSE and appends them to the timeline

## Components

### Tasks
- Human-facing units of work.

### Jobs
- An execution instance for a task.
- Can be retried (multiple jobs per task).

### Events
- Immutable records emitted by jobs.
- Stored durably in DB.

### Artifacts
- References to outputs (URLs, file paths, PRs, summaries).

## OpenClaw integration (options)

- **Direct**: Use gateway endpoints to spawn isolated runs and relay progress.
- **Wrapped**: Job runner executes tool calls and logs them (best for consistent events).

## Security
- Default LAN-only.
- Auth token or basic auth behind reverse proxy.
- Redaction layer for secrets in logs.
