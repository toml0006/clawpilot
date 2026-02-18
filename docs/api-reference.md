# ClawPilot API Reference

## Overview

ClawPilot exposes REST APIs for both human UI interactions and agent integrations.

- **Human API** (`/api/*`) - Used by the ClawPilot UI
- **Agent API** (`/api/agent/v1/*`) - Used by OpenClaw agents with token auth

## Authentication

### Agent API

All agent endpoints require bearer token authentication:

```http
Authorization: Bearer <CLAWPILOT_AGENT_TOKEN>
```

Mutating requests require an idempotency key:

```http
Idempotency-Key: <unique-key>
```

## Human API Endpoints

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks (query: view, projectId, q) |
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks/:id` | Get task details |
| PATCH | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |
| POST | `/api/tasks/:id/transition` | Change task workflow state |
| PATCH | `/api/tasks/:id/reorder` | Reorder task in column |
| POST | `/api/tasks/:id/archive` | Archive a task |
| POST | `/api/tasks/:id/unarchive` | Unarchive a task |
| GET | `/api/tasks/:id/history` | Get task transition history |

### Labels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/labels` | List all labels |
| POST | `/api/labels` | Create a label |
| GET | `/api/labels/:id` | Get label details |
| PATCH | `/api/labels/:id` | Update a label |
| DELETE | `/api/labels/:id` | Delete a label |

### Task Labels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks/:id/labels` | List labels on a task |
| POST | `/api/tasks/:id/labels` | Add label to task |
| DELETE | `/api/tasks/:id/labels` | Remove label from task |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/:id` | Get project details |
| PATCH | `/api/projects/:id` | Update a project |
| DELETE | `/api/projects/:id` | Delete a project |

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks/:id/jobs` | List jobs for a task |
| POST | `/api/tasks/:id/jobs` | Start a new job |
| GET | `/api/jobs/:id` | Get job details |
| POST | `/api/jobs/:id/cancel` | Cancel a running job |
| POST | `/api/jobs/:id/resume` | Resume a blocked job |
| POST | `/api/jobs/:id/complete` | Mark job as completed |
| POST | `/api/jobs/:id/fail` | Mark job as failed |

### Events & Timeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/timeline` | List events (query: taskId, level, limit) |
| GET | `/api/events/stream` | SSE stream of new events |

### Workflow States

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflow/states` | List workflow states |
| PATCH | `/api/workflow/states/:id` | Update workflow state |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get app settings |
| PATCH | `/api/settings` | Update app settings |
| GET | `/api/settings/credentials` | List agent credentials |
| POST | `/api/settings/credentials` | Create agent credential |

### OpenClaw Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/openclaw/health` | Check OpenClaw Gateway connection |

## Agent API Endpoints

All agent endpoints are under `/api/agent/v1/`.

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent/v1/tasks` | List tasks |
| POST | `/api/agent/v1/tasks` | Create a task |
| GET | `/api/agent/v1/tasks/:id` | Get task details |
| PATCH | `/api/agent/v1/tasks/:id` | Update a task |
| POST | `/api/agent/v1/tasks/:id/transition` | Transition task state |
| POST | `/api/agent/v1/tasks/:id/complete` | Mark task complete |
| POST | `/api/agent/v1/tasks/:id/comments` | Add comment |
| POST | `/api/agent/v1/tasks/:id/artifacts` | Add artifact |

### Labels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent/v1/labels` | List all labels |
| GET | `/api/agent/v1/tasks/:id/labels` | List labels on task |
| POST | `/api/agent/v1/tasks/:id/labels` | Add label to task |
| DELETE | `/api/agent/v1/tasks/:id/labels` | Remove label from task |

### Workflow

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent/v1/workflow/states` | List workflow states |

### Approvals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent/v1/actions/pending` | List pending approvals |
| POST | `/api/agent/v1/actions/:id/approve` | Approve action |
| POST | `/api/agent/v1/actions/:id/reject` | Reject action |

## SSE Events

Connect to `/api/events/stream` for realtime events:

```javascript
const es = new EventSource('/api/events/stream?taskId=xxx');
es.addEventListener('event', (e) => {
  const event = JSON.parse(e.data);
  console.log(event);
});
```

Event types:
- `state_change` - Job status changed
- `log` - Log message from job
- `tool` - Tool invocation
- `artifact` - Artifact created
- `question` - Agent needs human input

## Error Responses

All errors return JSON:

```json
{
  "error": "Error message",
  "details": { ... }
}
```

Common status codes:
- `400` - Bad request / validation error
- `401` - Unauthorized (agent API)
- `403` - Forbidden (policy denied)
- `404` - Not found
- `409` - Conflict (duplicate key, label already attached)
