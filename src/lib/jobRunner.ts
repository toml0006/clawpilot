/**
 * Job Runner Service
 *
 * Executes tasks via OpenClaw and records events.
 * This is the bridge between ClawPilot tasks and OpenClaw agents.
 */

import { prisma } from "./prisma";
import { openclaw } from "./openclaw";

interface StartJobOptions {
  taskId: string;
  model?: string;
  thinking?: string;
}

interface JobResult {
  ok: boolean;
  jobId?: string;
  sessionKey?: string;
  error?: string;
}

/**
 * Start a job for a task
 */
export async function startJob(options: StartJobOptions): Promise<JobResult> {
  const task = await prisma.task.findUnique({
    where: { id: options.taskId },
    include: {
      project: true,
      labels: { include: { label: true } },
    },
  });

  if (!task) {
    return { ok: false, error: "Task not found" };
  }

  // Check for existing running job
  const runningJob = await prisma.job.findFirst({
    where: {
      taskId: options.taskId,
      status: { in: ["queued", "running"] },
    },
  });

  if (runningJob) {
    return { ok: false, error: "Task already has a running job", jobId: runningJob.id };
  }

  // Create job record
  const job = await prisma.job.create({
    data: {
      taskId: options.taskId,
      status: "queued",
    },
  });

  // Record job creation event
  await recordEvent({
    jobId: job.id,
    taskId: options.taskId,
    type: "state_change",
    message: "Job queued",
    data: { status: "queued" },
  });

  // Build task prompt
  const labelNames = task.labels.map((tl) => tl.label.name).join(", ");
  const taskPrompt = buildTaskPrompt({
    title: task.title,
    description: task.description,
    project: task.project?.name,
    labels: labelNames || undefined,
    jobId: job.id,
  });

  // Spawn OpenClaw session
  const spawnResult = await openclaw.spawn({
    task: taskPrompt,
    model: options.model,
    thinking: options.thinking,
    label: `clawpilot:${job.id}`,
    cleanup: "keep",
  });

  if (!spawnResult.ok) {
    // Mark job as failed
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: spawnResult.error,
        endedAt: new Date(),
      },
    });

    await recordEvent({
      jobId: job.id,
      taskId: options.taskId,
      type: "state_change",
      level: "error",
      message: `Job failed to start: ${spawnResult.error}`,
      data: { status: "failed", error: spawnResult.error },
    });

    return { ok: false, jobId: job.id, error: spawnResult.error };
  }

  // Mark job as running
  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: "running",
      startedAt: new Date(),
    },
  });

  await recordEvent({
    jobId: job.id,
    taskId: options.taskId,
    type: "state_change",
    message: "Job started",
    data: { status: "running", sessionKey: spawnResult.sessionKey },
  });

  return {
    ok: true,
    jobId: job.id,
    sessionKey: spawnResult.sessionKey,
  };
}

/**
 * Cancel a running job
 */
export async function cancelJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) {
    return { ok: false, error: "Job not found" };
  }

  if (job.status !== "queued" && job.status !== "running" && job.status !== "blocked") {
    return { ok: false, error: `Cannot cancel job with status: ${job.status}` };
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "cancelled",
      endedAt: new Date(),
    },
  });

  await recordEvent({
    jobId,
    taskId: job.taskId,
    type: "state_change",
    message: "Job cancelled",
    data: { status: "cancelled" },
  });

  return { ok: true };
}

/**
 * Mark a job as blocked (needs human input)
 */
export async function blockJob(
  jobId: string,
  question: string
): Promise<{ ok: boolean; error?: string }> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) {
    return { ok: false, error: "Job not found" };
  }

  if (job.status !== "running") {
    return { ok: false, error: `Cannot block job with status: ${job.status}` };
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "blocked" },
  });

  await recordEvent({
    jobId,
    taskId: job.taskId,
    type: "question",
    level: "warn",
    message: question,
    data: { status: "blocked", question },
  });

  return { ok: true };
}

/**
 * Resume a blocked job with an answer
 */
export async function resumeJob(
  jobId: string,
  answer: string
): Promise<{ ok: boolean; error?: string }> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) {
    return { ok: false, error: "Job not found" };
  }

  if (job.status !== "blocked") {
    return { ok: false, error: `Cannot resume job with status: ${job.status}` };
  }

  // Send answer to the session
  const sendResult = await openclaw.send({
    label: `clawpilot:${jobId}`,
    message: answer,
  });

  if (!sendResult.ok) {
    return { ok: false, error: sendResult.error };
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "running" },
  });

  await recordEvent({
    jobId,
    taskId: job.taskId,
    type: "state_change",
    message: "Job resumed",
    data: { status: "running", answer },
  });

  return { ok: true };
}

/**
 * Complete a job successfully
 */
export async function completeJob(
  jobId: string,
  summary?: string
): Promise<{ ok: boolean; error?: string }> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) {
    return { ok: false, error: "Job not found" };
  }

  if (job.status !== "running" && job.status !== "blocked") {
    return { ok: false, error: `Cannot complete job with status: ${job.status}` };
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "succeeded",
      endedAt: new Date(),
    },
  });

  await recordEvent({
    jobId,
    taskId: job.taskId,
    type: "state_change",
    message: summary || "Job completed successfully",
    data: { status: "succeeded", summary },
  });

  return { ok: true };
}

/**
 * Fail a job
 */
export async function failJob(
  jobId: string,
  error: string
): Promise<{ ok: boolean; error?: string }> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job) {
    return { ok: false, error: "Job not found" };
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "failed",
      error,
      endedAt: new Date(),
    },
  });

  await recordEvent({
    jobId,
    taskId: job.taskId,
    type: "state_change",
    level: "error",
    message: `Job failed: ${error}`,
    data: { status: "failed", error },
  });

  return { ok: true };
}

/**
 * Record an event for a job
 */
export async function recordEvent(options: {
  jobId: string;
  taskId: string;
  type: string;
  level?: string;
  message: string;
  data?: unknown;
}): Promise<void> {
  await prisma.event.create({
    data: {
      jobId: options.jobId,
      taskId: options.taskId,
      type: options.type,
      level: options.level || "info",
      message: options.message,
      data: options.data ? JSON.stringify(options.data) : null,
    },
  });
}

/**
 * Build task prompt for OpenClaw
 */
function buildTaskPrompt(options: {
  title: string;
  description?: string | null;
  project?: string;
  labels?: string;
  jobId: string;
}): string {
  const parts = [`## Task: ${options.title}`];

  if (options.project) {
    parts.push(`**Project:** ${options.project}`);
  }

  if (options.labels) {
    parts.push(`**Labels:** ${options.labels}`);
  }

  if (options.description) {
    parts.push("\n### Description");
    parts.push(options.description);
  }

  parts.push("\n### Instructions");
  parts.push("Complete this task. When finished, provide a summary of what was done.");
  parts.push(`\n_ClawPilot Job ID: ${options.jobId}_`);

  return parts.join("\n");
}

export const jobRunner = {
  startJob,
  cancelJob,
  blockJob,
  resumeJob,
  completeJob,
  failJob,
  recordEvent,
};
