import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { mapTaskResponse } from "@/lib/workflow";

function tryParseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      workflowState: true,
      project: true,
      transitions: {
        include: {
          fromState: true,
          toState: true,
        },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        orderBy: { createdAt: "asc" },
      },
      artifacts: {
        orderBy: { createdAt: "asc" },
      },
      jobs: {
        orderBy: { createdAt: "desc" },
        include: {
          events: {
            orderBy: { ts: "asc" },
            take: 200,
          },
        },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({
    task: mapTaskResponse(task),
    transitions: task.transitions,
    comments: task.comments,
    artifacts: task.artifacts,
    jobs: task.jobs.map((job) => ({
      ...job,
      events: job.events.map((event) => ({
        ...event,
        data: tryParseJson(event.data),
      })),
    })),
  });
}
