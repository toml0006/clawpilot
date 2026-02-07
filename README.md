# ClawPilot

ClawPilot is a control-plane dashboard for supervising OpenClaw agents.

## Goals

- Drag-and-drop task board (priorities + statuses)
- Chat (global + per-task)
- Realtime progress feed (events/logs/artifacts)
- Clear “blocked / needs-human” handoffs

## Non-goals (for now)

- Replacing OpenClaw itself
- Building a full project-management suite

## Status

Early concept / scaffolding.

## Idea: MVP

1. **Board UI**: Draft → Cliff → Waiting → Done
2. **Task model**: title, description, category, status, priority, links
3. **Runner**: move to “Cliff” creates a job (or prompts “Start?”)
4. **Realtime feed**: server-sent events / websockets
5. **Artifacts**: link commits/PRs/files

## License

TBD
