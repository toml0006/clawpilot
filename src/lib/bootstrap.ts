import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_WORKFLOW_STATES,
  LEGACY_STATUS_TO_STATE_KEY,
  normalizeProjectKey,
} from "@/lib/workflow";

const globalForBootstrap = globalThis as unknown as {
  clawPilotBootstrapPromise?: Promise<void>;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function seedWorkflowStates() {
  for (const state of DEFAULT_WORKFLOW_STATES) {
    await prisma.workflowState.upsert({
      where: { key: state.key },
      create: {
        key: state.key,
        name: state.name,
        category: state.category,
        position: state.position,
        color: state.color,
        isDefault: Boolean(state.isDefault),
      },
      update: {},
    });
  }
}

async function seedPolicyRules() {
  const existing = await prisma.agentPolicyRule.count();
  if (existing > 0) return;

  const defaults: Array<{ name: string; action: string; effect: string; position: number }> = [
    { name: "Allow task create", action: "task.create", effect: "allow", position: 0 },
    { name: "Allow task update", action: "task.update", effect: "allow", position: 1 },
    { name: "Allow task transition", action: "task.transition", effect: "allow", position: 2 },
    { name: "Allow task complete", action: "task.complete", effect: "allow", position: 3 },
    { name: "Allow task comment", action: "task.comment", effect: "allow", position: 4 },
    { name: "Allow task artifact", action: "task.artifact", effect: "allow", position: 5 },
    {
      name: "Require approval for reopen",
      action: "task.reopen",
      effect: "require_approval",
      position: 6,
    },
    {
      name: "Require approval for archive",
      action: "task.archive",
      effect: "require_approval",
      position: 7,
    },
    {
      name: "Require approval for unarchive",
      action: "task.unarchive",
      effect: "require_approval",
      position: 8,
    },
    {
      name: "Require approval for policy updates",
      action: "policy.update",
      effect: "require_approval",
      position: 9,
    },
    { name: "Deny task delete", action: "task.delete", effect: "deny", position: 10 },
  ];

  await prisma.agentPolicyRule.createMany({
    data: defaults,
  });
}

async function seedProjects() {
  const defaults: Array<{
    key: string;
    name: string;
    color: string;
    position: number;
  }> = [
    { key: "general", name: "General", color: "#475569", position: 0 },
    { key: "clawpilot", name: "ClawPilot", color: "#2563eb", position: 1 },
    { key: "openclaw", name: "OpenClaw", color: "#7c3aed", position: 2 },
  ];

  for (const project of defaults) {
    await prisma.project.upsert({
      where: { key: project.key },
      create: project,
      update: {},
    });
  }
}

async function seedRetentionPolicy() {
  await prisma.retentionPolicy.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      archiveAfterDays: 30,
      purgeEventsAfterDays: 90,
      retainTasksForever: true,
    },
    update: {},
  });
}

async function seedCredentialFromEnv() {
  const token = process.env.CLAWPILOT_AGENT_TOKEN;
  if (!token || token.trim().length === 0) return;

  const tokenHash = hashToken(token.trim());

  await prisma.agentCredential.upsert({
    where: { tokenHash },
    create: {
      name: "Default Env Agent",
      tokenHash,
      scopes: JSON.stringify(["*"]),
      status: "active",
    },
    update: {
      status: "active",
    },
  });
}

async function migrateLegacyTasks() {
  const states = await prisma.workflowState.findMany();
  const stateByKey = new Map(states.map((state) => [state.key, state]));
  const backlog = stateByKey.get("backlog");
  if (!backlog) return;

  const tasks = await prisma.task.findMany({
    where: {
      workflowStateId: null,
    },
    select: {
      id: true,
      status: true,
      completedAt: true,
      canceledAt: true,
    },
  });

  for (const task of tasks) {
    const mappedKey = LEGACY_STATUS_TO_STATE_KEY[task.status] ?? "backlog";
    const mappedState = stateByKey.get(mappedKey) ?? backlog;
    const completedAt =
      mappedState.category === "completed" ? task.completedAt ?? new Date() : task.completedAt;
    const canceledAt =
      mappedState.category === "canceled" ? task.canceledAt ?? new Date() : task.canceledAt;

    await prisma.task.update({
      where: { id: task.id },
      data: {
        workflowStateId: mappedState.id,
        status: mappedState.key,
        completedAt,
        canceledAt,
      },
    });

    const existingTransitions = await prisma.taskTransition.count({ where: { taskId: task.id } });
    if (existingTransitions === 0) {
      await prisma.taskTransition.create({
        data: {
          taskId: task.id,
          toStateId: mappedState.id,
          reason: "Legacy status migration",
          actorType: "system",
        },
      });
    }
  }
}

async function migrateTaskProjects() {
  const general = await prisma.project.findUnique({ where: { key: "general" } });
  if (!general) return;

  const uncategorized = await prisma.task.findMany({
    where: {
      projectId: null,
      category: null,
    },
    select: { id: true },
  });

  if (uncategorized.length > 0) {
    await prisma.task.updateMany({
      where: {
        id: {
          in: uncategorized.map((task) => task.id),
        },
      },
      data: {
        projectId: general.id,
      },
    });
  }

  const categorized = await prisma.task.findMany({
    where: {
      projectId: null,
      category: { not: null },
    },
    select: {
      id: true,
      category: true,
    },
  });

  for (const task of categorized) {
    const rawCategory = task.category?.trim();
    if (!rawCategory) {
      await prisma.task.update({
        where: { id: task.id },
        data: { projectId: general.id },
      });
      continue;
    }

    const key = normalizeProjectKey(rawCategory);
    const safeKey = key.length > 0 ? key.slice(0, 48) : `project-${task.id.slice(-8)}`;

    const project = await prisma.project.upsert({
      where: { key: safeKey },
      create: {
        key: safeKey,
        name: rawCategory,
        color: "#0ea5e9",
        position: 999,
      },
      update: {},
    });

    await prisma.task.update({
      where: { id: task.id },
      data: {
        projectId: project.id,
      },
    });
  }
}

async function seedAppSettings() {
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

export async function ensureSystemSetup() {
  if (!globalForBootstrap.clawPilotBootstrapPromise) {
    globalForBootstrap.clawPilotBootstrapPromise = (async () => {
      await seedWorkflowStates();
      await seedProjects();
      await seedPolicyRules();
      await seedRetentionPolicy();
      await seedAppSettings();
      await seedCredentialFromEnv();
      await migrateLegacyTasks();
      await migrateTaskProjects();
    })();
  }

  await globalForBootstrap.clawPilotBootstrapPromise;
}
