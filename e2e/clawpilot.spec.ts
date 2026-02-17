import { expect, test, type APIRequestContext } from "@playwright/test";

const AGENT_TOKEN = "test-agent-token";

function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function getStateIdByKey(request: APIRequestContext, key: string) {
  const statesRes = await request.get("/api/workflow/states");
  expect(statesRes.ok()).toBeTruthy();
  const states = (await statesRes.json()) as Array<{ id: string; key: string }>;
  const match = states.find((state) => state.key === key);
  expect(match).toBeTruthy();
  return match!.id;
}

function agentHeaders(idempotencyKey: string) {
  return {
    Authorization: `Bearer ${AGENT_TOKEN}`,
    "Idempotency-Key": idempotencyKey,
  };
}

async function createProject(request: APIRequestContext, name: string) {
  const response = await request.post("/api/projects", {
    data: { name },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; name: string };
}

test.describe("ClawPilot end-to-end", () => {
  test("creates a task from the board and updates its state", async ({ page }) => {
    const title = uniqueTitle("E2E Active Task");

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();

    await page.getByRole("button", { name: "New Task" }).click();
    await page.getByLabel("Title").fill(title);
    const createStateSelect = page.getByLabel("State");
    await expect(createStateSelect).toBeVisible();
    await expect
      .poll(async () => createStateSelect.locator("option").count())
      .toBeGreaterThan(0);
    const stateOptions = await createStateSelect.locator("option").allTextContents();
    if (stateOptions.includes("Todo")) {
      await createStateSelect.selectOption({ label: "Todo" });
    }
    await page.getByRole("button", { name: "Create Task" }).click();

    await expect(page.getByRole("button", { name: "Create Task" })).toHaveCount(0);
    await expect(page.getByText(title).first()).toBeVisible();

    await page.getByText(title).first().click();
    await expect(page.getByText("Task Detail")).toBeVisible();

    await page.getByLabel("State").selectOption({ label: "In Progress" });

    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("shows completed tasks in Past and can reopen one", async ({ page, request }) => {
    const title = uniqueTitle("E2E Past Task");
    const doneStateId = await getStateIdByKey(request, "done");

    const createRes = await request.post("/api/tasks", {
      data: {
        title,
        workflowStateId: doneStateId,
      },
    });
    expect(createRes.ok()).toBeTruthy();

    await page.goto("/past");
    await page.getByPlaceholder("Search title/description/category").fill(title);

    const row = page.locator("tr", { hasText: title });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Reopen" }).click();
    await expect(row).toHaveCount(0);

    await page.goto("/");
    await expect(page.getByText(title)).toBeVisible();
  });

  test("loads policies page and runs cleanup dry-run", async ({ page }) => {
    await page.goto("/policies");
    await expect(page.getByRole("heading", { name: "Policies" })).toBeVisible();

    await page.getByRole("button", { name: "Dry-run cleanup" }).click();
    await expect(page.getByText(/Dry run finished:/)).toBeVisible({ timeout: 20000 });
  });

  test("enforces agent auth and approval-gated reopen flow", async ({ request }) => {
    const unauthorized = await request.get("/api/agent/v1/tasks");
    expect(unauthorized.status()).toBe(401);

    const title = uniqueTitle("E2E Agent Done Task");
    const doneStateId = await getStateIdByKey(request, "done");
    const idempotencyKey = `agent-create-${Date.now()}-${Math.random()}`;

    const createRes = await request.post("/api/agent/v1/tasks", {
      headers: {
        Authorization: `Bearer ${AGENT_TOKEN}`,
        "Idempotency-Key": idempotencyKey,
      },
      data: {
        title,
        workflowStateId: doneStateId,
      },
    });

    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { id: string; stateCategory: string };
    expect(created.stateCategory).toBe("completed");

    const replayRes = await request.post("/api/agent/v1/tasks", {
      headers: {
        Authorization: `Bearer ${AGENT_TOKEN}`,
        "Idempotency-Key": idempotencyKey,
      },
      data: {
        title,
        workflowStateId: doneStateId,
      },
    });

    expect(replayRes.status()).toBe(201);
    expect(replayRes.headers()["x-idempotent-replay"]).toBe("true");
    const replayed = (await replayRes.json()) as { id: string };
    expect(replayed.id).toBe(created.id);

    const transitionRes = await request.post(`/api/agent/v1/tasks/${created.id}/transition`, {
      headers: {
        Authorization: `Bearer ${AGENT_TOKEN}`,
        "Idempotency-Key": `agent-transition-${Date.now()}-${Math.random()}`,
      },
      data: {
        status: "todo",
        reason: "Reopen for follow-up",
      },
    });

    expect(transitionRes.status()).toBe(202);
    const pendingResponse = (await transitionRes.json()) as { actionRequestId: string };
    expect(pendingResponse.actionRequestId).toBeTruthy();

    const pendingRes = await request.get("/api/agent/v1/actions/pending?all=true");
    expect(pendingRes.ok()).toBeTruthy();
    const pendingItems = (await pendingRes.json()) as Array<{ id: string }>;
    const pendingItem = pendingItems.find((item) => item.id === pendingResponse.actionRequestId);
    expect(pendingItem).toBeTruthy();

    const approveRes = await request.post(
      `/api/agent/v1/actions/${pendingResponse.actionRequestId}/approve`,
      {
        data: {
          resolvedBy: "e2e-human",
          execute: true,
        },
      }
    );
    expect(approveRes.ok()).toBeTruthy();

    const taskAfterApprove = await request.get(`/api/tasks/${created.id}`);
    expect(taskAfterApprove.ok()).toBeTruthy();
    const reopened = (await taskAfterApprove.json()) as { stateCategory: string; status: string };
    expect(reopened.stateCategory).toBe("unstarted");
    expect(reopened.status).toBe("todo");
  });

  test("progressively discloses task activity and audit history", async ({ page, request }) => {
    const title = uniqueTitle("E2E History Task");
    const todoStateId = await getStateIdByKey(request, "todo");
    const inProgressStateId = await getStateIdByKey(request, "in-progress");

    const createRes = await request.post("/api/tasks", {
      data: {
        title,
        workflowStateId: todoStateId,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { id: string };

    const transitionRes = await request.post(`/api/tasks/${created.id}/transition`, {
      data: {
        workflowStateId: inProgressStateId,
        reason: "E2E transition for history",
      },
    });
    expect(transitionRes.ok()).toBeTruthy();

    const commentText = `E2E agent comment ${Date.now()}`;
    const commentRes = await request.post(`/api/agent/v1/tasks/${created.id}/comments`, {
      headers: agentHeaders(`agent-comment-${Date.now()}-${Math.random()}`),
      data: {
        body: commentText,
      },
    });
    expect(commentRes.status()).toBe(201);

    const artifactTitle = `E2E artifact ${Date.now()}`;
    const artifactValue = `artifact-value-${Math.random()}`;
    const artifactRes = await request.post(`/api/agent/v1/tasks/${created.id}/artifacts`, {
      headers: agentHeaders(`agent-artifact-${Date.now()}-${Math.random()}`),
      data: {
        kind: "note",
        title: artifactTitle,
        value: artifactValue,
      },
    });
    expect(artifactRes.status()).toBe(201);

    await page.goto("/");
    await page.getByText(title).first().click();
    await expect(page.getByText("Task Detail")).toBeVisible();

    await expect(page.getByText(/State Transitions \(\d+\)/)).toHaveCount(0);

    await page.getByRole("button", { name: /Activity & Audit History/ }).click();

    await expect(page.getByText(/State Transitions \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Comments \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Artifacts \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Audit Log \(\d+\)/)).toBeVisible();

    await page.getByText(/Comments \(\d+\)/).first().click();
    await expect(page.getByText(commentText)).toBeVisible();

    await page.getByText(/Artifacts \(\d+\)/).first().click();
    await page.getByText(artifactTitle).first().click();
    await expect(page.getByText(artifactValue)).toBeVisible();

    await page.getByText(/Audit Log \(\d+\)/).first().click();
    await expect(page.getByText("task.transition")).toBeVisible();
  });

  test("groups active work by project and filters to a single project", async ({
    page,
    request,
  }) => {
    const todoStateId = await getStateIdByKey(request, "todo");
    const projectA = await createProject(request, uniqueTitle("E2E Project Alpha"));
    const projectB = await createProject(request, uniqueTitle("E2E Project Beta"));

    const taskATitle = uniqueTitle("E2E Project Task A");
    const taskBTitle = uniqueTitle("E2E Project Task B");

    const taskARes = await request.post("/api/tasks", {
      data: {
        title: taskATitle,
        workflowStateId: todoStateId,
        projectId: projectA.id,
      },
    });
    expect(taskARes.status()).toBe(201);

    const taskBRes = await request.post("/api/tasks", {
      data: {
        title: taskBTitle,
        workflowStateId: todoStateId,
        projectId: projectB.id,
      },
    });
    expect(taskBRes.status()).toBe(201);

    await page.goto("/");
    await expect(page.getByText(taskATitle)).toBeVisible();
    await expect(page.getByText(taskBTitle)).toBeVisible();

    await page.getByRole("button", { name: "Group by Project" }).click();
    await expect(page.getByRole("button", { name: "Grouped by Project" })).toBeVisible();
    const projectFilter = page.locator("select").first();
    await projectFilter.selectOption(projectA.id);

    await expect(page.getByText(taskATitle)).toBeVisible();
    await expect(page.getByText(taskBTitle)).toHaveCount(0);
  });
});
