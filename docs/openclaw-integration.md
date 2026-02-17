# OpenClaw Integration

ClawPilot exposes a policy-gated agent API under `/api/agent/v1`.

## Authentication

Set `CLAWPILOT_AGENT_TOKEN` in the environment before running the app. On startup, ClawPilot hashes and seeds this token into `AgentCredential`.

Use bearer auth on every agent request:

```http
Authorization: Bearer <token>
```

Mutating requests also require:

```http
Idempotency-Key: <unique-key>
```

## Core Endpoints

- `GET /api/agent/v1/workflow/states`
- `GET /api/agent/v1/tasks`
- `POST /api/agent/v1/tasks`
- `PATCH /api/agent/v1/tasks/:id`
- `POST /api/agent/v1/tasks/:id/transition`
- `POST /api/agent/v1/tasks/:id/complete`
- `POST /api/agent/v1/tasks/:id/comments`
- `POST /api/agent/v1/tasks/:id/artifacts`
- `GET /api/agent/v1/actions/pending`
- `POST /api/agent/v1/actions/:id/approve`
- `POST /api/agent/v1/actions/:id/reject`

## Policy Behavior

Rules in `AgentPolicyRule` determine action behavior:

- `allow`: action executes immediately
- `deny`: response is `403`
- `require_approval`: response is `202` with `actionRequestId`

Pending approvals appear in ClawPilot Inbox (`/inbox`).

## Approval Flow

1. Agent attempts policy-gated action.
2. API creates an `AgentActionRequest` with `status=pending`.
3. Human approves or rejects in Inbox.
4. Approved actions are optionally executed immediately by the approval endpoint.

## Idempotency

ClawPilot stores mutation results in `IdempotencyRecord` keyed by `(scope, idempotencyKey)`.
Repeated requests with the same body replay the original response.
Using the same key with a different body returns `409`.
