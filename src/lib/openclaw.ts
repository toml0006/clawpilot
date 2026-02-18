/**
 * OpenClaw Gateway Client
 *
 * Connects ClawPilot to the OpenClaw Gateway API for:
 * - Spawning sub-agent sessions
 * - Sending messages to sessions
 * - Listing/managing sessions
 */

import { prisma } from "./prisma";

interface OpenClawConfig {
  gatewayUrl: string;
  apiToken?: string;
  timeout: number;
}

interface SpawnOptions {
  task: string;
  model?: string;
  label?: string;
  thinking?: string;
  runTimeoutSeconds?: number;
  cleanup?: "delete" | "keep";
}

interface SpawnResult {
  ok: boolean;
  sessionKey?: string;
  label?: string;
  error?: string;
}

interface SendOptions {
  sessionKey?: string;
  label?: string;
  message: string;
  timeoutSeconds?: number;
}

interface SendResult {
  ok: boolean;
  reply?: string;
  error?: string;
}

interface Session {
  key: string;
  label?: string;
  kind: string;
  lastActivity?: string;
  messages?: Array<{
    role: string;
    content: string;
  }>;
}

interface SessionsListResult {
  ok: boolean;
  sessions?: Session[];
  error?: string;
}

async function getConfig(): Promise<OpenClawConfig> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });

  return {
    gatewayUrl: settings?.openclawGatewayUrl || process.env.OPENCLAW_GATEWAY_URL || "",
    apiToken: process.env.OPENCLAW_API_TOKEN,
    timeout: settings?.openclawApiTimeout || 30000,
  };
}

async function apiCall<T>(
  endpoint: string,
  method: string = "POST",
  body?: unknown
): Promise<{ ok: boolean; data?: T; error?: string; status?: number }> {
  const config = await getConfig();

  if (!config.gatewayUrl) {
    return { ok: false, error: "OpenClaw Gateway URL not configured" };
  }

  const url = config.gatewayUrl.replace(/\/$/, "") + endpoint;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiToken) {
    headers["Authorization"] = `Bearer ${config.apiToken}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        ok: false,
        error: `HTTP ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Request timed out" };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Spawn a new sub-agent session
 */
export async function spawn(options: SpawnOptions): Promise<SpawnResult> {
  const result = await apiCall<{ sessionKey: string; label?: string }>(
    "/api/sessions/spawn",
    "POST",
    {
      task: options.task,
      model: options.model,
      label: options.label,
      thinking: options.thinking,
      runTimeoutSeconds: options.runTimeoutSeconds,
      cleanup: options.cleanup,
    }
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    sessionKey: result.data?.sessionKey,
    label: result.data?.label,
  };
}

/**
 * Send a message to a session
 */
export async function send(options: SendOptions): Promise<SendResult> {
  const result = await apiCall<{ reply?: string }>(
    "/api/sessions/send",
    "POST",
    {
      sessionKey: options.sessionKey,
      label: options.label,
      message: options.message,
      timeoutSeconds: options.timeoutSeconds,
    }
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    reply: result.data?.reply,
  };
}

/**
 * List active sessions
 */
export async function listSessions(options?: {
  kinds?: string[];
  activeMinutes?: number;
  limit?: number;
  messageLimit?: number;
}): Promise<SessionsListResult> {
  const params = new URLSearchParams();
  if (options?.kinds) params.set("kinds", options.kinds.join(","));
  if (options?.activeMinutes) params.set("activeMinutes", String(options.activeMinutes));
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.messageLimit) params.set("messageLimit", String(options.messageLimit));

  const query = params.toString();
  const endpoint = `/api/sessions${query ? `?${query}` : ""}`;

  const result = await apiCall<{ sessions: Session[] }>(endpoint, "GET");

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    sessions: result.data?.sessions,
  };
}

/**
 * Get session status
 */
export async function getSession(sessionKey: string): Promise<{
  ok: boolean;
  session?: Session;
  error?: string;
}> {
  const result = await apiCall<Session>(
    `/api/sessions/${encodeURIComponent(sessionKey)}`,
    "GET"
  );

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    session: result.data,
  };
}

/**
 * Check if Gateway is reachable
 */
export async function healthCheck(): Promise<{ ok: boolean; error?: string }> {
  const config = await getConfig();

  if (!config.gatewayUrl) {
    return { ok: false, error: "OpenClaw Gateway URL not configured" };
  }

  try {
    const url = config.gatewayUrl.replace(/\/$/, "") + "/health";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const openclaw = {
  spawn,
  send,
  listSessions,
  getSession,
  healthCheck,
};
