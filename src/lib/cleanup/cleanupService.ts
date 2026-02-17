import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";

export type CleanupResult = {
  dryRun: boolean;
  archiveAfterDays: number;
  purgeEventsAfterDays: number;
  archivedTaskCount: number;
  purgedEventCount: number;
  archivedTaskIds: string[];
};

export async function runCleanup(dryRun: boolean): Promise<CleanupResult> {
  await ensureSystemSetup();

  const now = new Date();

  const run = await prisma.cleanupRun.create({
    data: {
      dryRun,
      status: "running",
      startedAt: now,
    },
  });

  try {
    const policy = await prisma.retentionPolicy.findUnique({ where: { id: "singleton" } });
    if (!policy) {
      throw new Error("Retention policy not configured");
    }

    const archiveCutoff = new Date(now.getTime() - policy.archiveAfterDays * 24 * 60 * 60 * 1000);
    const purgeCutoff = new Date(now.getTime() - policy.purgeEventsAfterDays * 24 * 60 * 60 * 1000);

    const tasksToArchive = await prisma.task.findMany({
      where: {
        archivedAt: null,
        workflowState: {
          category: {
            in: ["completed", "canceled"],
          },
        },
        updatedAt: {
          lte: archiveCutoff,
        },
      },
      select: { id: true },
      take: 1000,
    });

    const eventsToPurgeCount = await prisma.event.count({
      where: {
        ts: {
          lt: purgeCutoff,
        },
      },
    });

    if (!dryRun) {
      if (tasksToArchive.length > 0) {
        await prisma.task.updateMany({
          where: {
            id: {
              in: tasksToArchive.map((task) => task.id),
            },
          },
          data: {
            archivedAt: now,
            revision: {
              increment: 1,
            },
          },
        });
      }

      if (eventsToPurgeCount > 0) {
        await prisma.event.deleteMany({
          where: {
            ts: {
              lt: purgeCutoff,
            },
          },
        });
      }
    }

    const result: CleanupResult = {
      dryRun,
      archiveAfterDays: policy.archiveAfterDays,
      purgeEventsAfterDays: policy.purgeEventsAfterDays,
      archivedTaskCount: tasksToArchive.length,
      purgedEventCount: eventsToPurgeCount,
      archivedTaskIds: tasksToArchive.map((task) => task.id),
    };

    await prisma.cleanupRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        summary: JSON.stringify(result),
        archivedTasks: tasksToArchive.length,
        purgedEvents: eventsToPurgeCount,
        finishedAt: new Date(),
      },
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cleanup failed";
    await prisma.cleanupRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: message,
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}
