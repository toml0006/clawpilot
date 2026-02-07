# MVP Plan

## Iteration 1: Board + persistence
- Next.js app shell
- Board with drag/drop
- SQLite schema + CRUD

## Iteration 2: Task detail + event timeline
- Task detail view
- Events list (persisted)
- SSE endpoint + UI subscription

## Iteration 3: Runner stub
- "Start" creates a job
- Runner emits fake events first
- Then wire to OpenClaw actions

## Iteration 4: Chat + human-blocked
- Per-task chat thread
- Job can enter blocked state with a question
- User answer unblocks job
