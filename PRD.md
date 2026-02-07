# PRD: ClawPilot (OpenClaw Control Plane)

**Owner:** Jackson / Cliff  
**Repo:** https://github.com/toml0006/clawpilot  
**Local path:** `~/dev/middleout/clawpilot`  
**Status:** Draft  
**Last updated:** 2026-02-06

## 1) Summary
ClawPilot is a web-based control plane for supervising OpenClaw agents. It combines a drag-and-drop task board, contextual chat, and realtime progress/telemetry so a human can confidently delegate work, monitor execution, and intervene when needed.

### Problem
Current task management via GitHub Projects is unreliable and high-friction for “agent supervision” workflows:
- Poor realtime visibility into what the agent is doing
- Hard to track/stream progress and intermediate artifacts
- Drag/drop task state changes don’t reliably map to execution
- Overhead of GraphQL polling + permissions + board schema

### Goals
- A **single place** to: create/prioritize tasks, chat, see progress, and review outcomes.
- Make delegation safe: clear checkpoints, blockers, and human approvals.
- Reduce overhead: lightweight, fast UI; strong defaults; minimal ceremony.

### Non-goals (v1)
- Replace full PM suites (Jira/Linear)
- Multi-tenant SaaS
- Complex RBAC/SSO
- Perfect audit/compliance system (basic audit log is enough)

## 2) Target Users & Use Cases
### Primary user
- **Jackson** supervising 1+ OpenClaw agents (main + spawned sub-agents) across multiple workstreams.

### Core use cases
1. **Create a task** (title + description + links) and prioritize it.
2. **Drag task to “Cliff”** to start execution (or “Ready” → prompt for start).
3. **Watch realtime progress**: what’s happening now + logs + artifacts.
4. **Chat in context**: ask questions, refine requirements, approve steps.
5. **Handle blockers**: agent flags “needs human input”; user responds; agent continues.
6. **Review completion**: summary, outputs, links (PRs/commits/files), follow-ups.

## 3) Product Principles
- **Realtime by default:** status should never feel stale.
- **Human-in-the-loop:** clear “pause/approve/continue” moments.
- **Local-first:** run on the same machine/network as OpenClaw; avoid unnecessary cloud dependencies.
- **Simple mental model:** tasks are jobs; jobs emit events; UI renders timeline.

## 4) UX: Concepts & Screens
### 4.1 Board (Kanban)
Columns (suggested):
- Draft
- Ready
- Cliff (In Progress)
- Waiting (Needs human / blocked)
- Done

Fields visible on cards:
- Title
- Category (Personal / EcoEngineers / Breakmark / etc.)
- Priority rank within column
- Badge: running / blocked / error

### 4.2 Task Detail Drawer/Page
- Description (markdown)
- Links (repo/issue/docs)
- Checklist / Definition of Done
- Chat thread (task-scoped)
- Timeline (events)
- Artifacts (files, diffs, PR links)
- Controls: Start, Pause, Resume, Cancel, Rerun, Summarize

### 4.3 Global Activity Feed
- Cross-task timeline of what the agent(s) are doing
- Filters: agent, task, severity, errors

## 5) Functional Requirements
### 5.1 Task management
- Create/edit/delete tasks
- Drag/drop to change status
- Reorder within a column (priority)
- Categories/labels
- Search/filter

### 5.2 Execution model
- A task can be associated with a **Job**.
- Moving to “Cliff” can:
  - Auto-start a job (default)
  - Or prompt “Start now?” (config)
- Job states: queued, running, blocked, succeeded, failed, cancelled

### 5.3 Realtime progress
- Stream events to UI (SSE or WebSocket)
- Events should include:
  - job state transitions
  - tool invocations (safe, redacted)
  - logs (stdout/stderr snippets)
  - artifact created/updated
  - “needs human input” question

### 5.4 Chat
- Global chat (control-plane ↔ agent)
- Per-task chat threads
- Ability to “promote” a chat message into a task description update

### 5.5 Artifacts
- Attach/record:
  - URLs (PRs, docs)
  - file paths
  - generated summaries
  - patches/diffs references

### 5.6 Audit & safety
- Basic audit log:
  - who did what (user)
  - when
  - task/job affected
- Redaction policy for secrets in logs/events.

## 6) Non-Functional Requirements
- **Latency:** UI updates within ~1s for events.
- **Reliability:** events durable (persisted) so refresh doesn’t lose timeline.
- **Security:** local auth minimum (token). Optional basic auth behind reverse proxy.
- **Portability:** macOS-first; Linux later.

## 7) Proposed Architecture (MVP)
### Frontend
- **Next.js (App Router) + React** (chosen for fastest MVP)
- Drag/drop: dnd-kit
- Realtime: SSE (simple) or WS (if needed)

### Backend (MVP)
- **Next.js Route Handlers** (API in the same app)
- SSE endpoint for events

### Backend (possible post-MVP evolution)
- Split into a separate server (Fastify/Express) + dedicated runner if/when we need true long-running workers / heavier orchestration.

### Data
- SQLite (via Prisma) for:
  - tasks
  - jobs
  - events
  - artifacts

### OpenClaw integration
- Use OpenClaw Gateway API to:
  - spawn runs (sessions_spawn)
  - send messages (sessions_send)
  - read status/events where available
- If Gateway lacks needed streaming primitives, implement an internal “job runner” wrapper that writes events to DB as it executes.

## 8) MVP Scope (v0.1)
**Must-have**
- Board with drag/drop + persisted order
- Task detail view
- Job runner stub (start/pause/cancel semantics can be minimal)
- Event timeline persisted to SQLite
- Realtime streaming of new events

**Nice-to-have**
- Global feed
- Per-task chat (vs global only)
- Artifact panel

**Explicitly out-of-scope**
- Multi-user accounts
- External integrations (Linear/Jira)

## 9) Milestones
### M0: Repo scaffolding (done)
- Public repo created; README seeded

### M1: App skeleton
- Next.js app + UI shell (board + detail panel)
- SQLite + Prisma schema for tasks

### M2: Realtime event pipeline
- events table + SSE endpoint
- UI subscribes and renders timeline

### M3: Job runner integration
- “Start job” triggers a background run
- Logs/events recorded

### M4: Chat
- Global + task chat threads
- “needs human input” state

## 10) Risks / Open Questions
- What exact OpenClaw APIs are available for streaming + job control?
- How much log detail is safe to show (secret redaction)?
- Should tasks map 1:1 to an OpenClaw session, or can a job span multiple sessions?
- Authentication model (LAN-only vs remote access)

## 11) Success Metrics
- Jackson can run daily work from ClawPilot with minimal Telegram coordination.
- Task execution is transparent: fewer “what’s going on?” moments.
- Reduced overhead vs GitHub Projects (no polling, no drift).

