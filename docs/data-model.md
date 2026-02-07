# Data Model (Draft)

## Task
- id (uuid)
- title
- description (markdown)
- status (draft|ready|cliff|waiting|done)
- category
- priority (integer, per-column ordering)
- createdAt / updatedAt

## Job
- id (uuid)
- taskId
- status (queued|running|blocked|succeeded|failed|cancelled)
- startedAt / endedAt
- error (text, optional)

## Event
- id (uuid)
- jobId
- taskId (denormalized)
- ts
- level (info|warn|error)
- type (state_change|log|tool|artifact|question)
- message
- data (json)

## Artifact
- id (uuid)
- taskId
- jobId (optional)
- kind (url|file|diff|note)
- title
- value
- createdAt
