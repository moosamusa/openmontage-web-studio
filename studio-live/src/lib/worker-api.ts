// Typed client for the OpenMontage production worker (worker/app.py).
// The worker URL lives in localStorage; the worker access token lives only in
// sessionStorage. Provider API keys are never sent to or stored in the browser.
import { useEffect, useSyncExternalStore } from "react";
import { z } from "zod";

export const healthSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  upstream_commit: z.string(),
  registry_error: z.string().nullable(),
  auth_configured: z.boolean(),
  ffmpeg: z.boolean(),
  node: z.boolean(),
  queue_depth: z.number(),
});
export type Health = z.infer<typeof healthSchema>;

export const workerToolSchema = z.object({
  name: z.string(),
  provider: z.string().nullable(),
  capability: z.string().nullable(),
  tier: z.string(),
  runtime: z.string(),
  stability: z.string(),
  status: z.string(),
  allowed: z.boolean(),
  paid: z.boolean(),
  install_instructions: z.string().optional(),
});
export const capabilitiesSchema = z.object({
  tools: z.array(workerToolSchema),
  allow_paid: z.boolean(),
  max_job_usd: z.number(),
});
export type Capabilities = z.infer<typeof capabilitiesSchema>;

export const jobSchema = z.object({
  id: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  project_id: z.string(),
  tool: z.string(),
  stage: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  result: z
    .object({
      success: z.boolean(),
      error: z.string().nullable(),
      data: z.record(z.any()),
      artifacts: z.array(z.string()),
      cost_usd: z.number(),
    })
    .optional(),
});
export type Job = z.infer<typeof jobSchema>;

export const logsSchema = z.object({
  decisions: z.array(z.record(z.any())),
  costs: z.array(z.object({ ts: z.number(), job_id: z.string(), tool: z.string(), usd: z.number() })),
  events: z.array(z.record(z.any())),
});

// ---------------------------------------------------------------- settings
const URL_KEY = "omws.workerUrl";
const TOKEN_KEY = "omws.workerToken";

export function getSettings() {
  if (typeof window === "undefined") return { url: "", token: "" };
  return { url: localStorage.getItem(URL_KEY) ?? "", token: sessionStorage.getItem(TOKEN_KEY) ?? "" };
}
export function setSettings(url: string, token: string) {
  localStorage.setItem(URL_KEY, url.replace(/\/+$/, ""));
  sessionStorage.setItem(TOKEN_KEY, token);
  void checkHealth();
}

export class WorkerError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const { url, token } = getSettings();
  if (!url) throw new WorkerError(0, "No worker endpoint configured");
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      ...init,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
    });
  } catch (e) {
    throw new WorkerError(0, `Worker unreachable: ${(e as Error).message}`);
  }
  if (!res.ok) {
    const body = await res.text();
    let detail = body;
    try {
      detail = JSON.parse(body).detail ?? body;
    } catch {
      /* keep text */
    }
    throw new WorkerError(res.status, `[${res.status}] ${detail}`);
  }
  return schema.parse(await res.json());
}
const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  health: () => request("/health", healthSchema),
  capabilities: () => request("/capabilities", capabilitiesSchema),
  pipelines: () => request("/pipelines", z.array(z.string())),
  syncProject: (p: { id: string; title: string; pipeline: string; manifest?: unknown }) =>
    request("/projects", z.object({ id: z.string(), ok: z.boolean() }), json(p)),
  createJob: (j: { project_id: string; tool: string; inputs: Record<string, unknown>; stage?: string; budget_usd: number; kind?: string }) =>
    request("/jobs", jobSchema, json(j)),
  getJob: (id: string) => request(`/jobs/${encodeURIComponent(id)}`, jobSchema),
  listJobs: (projectId: string) => request(`/jobs?project_id=${encodeURIComponent(projectId)}`, z.array(jobSchema)),
  uploadAsset: (projectId: string, file: Blob, name: string) => {
    const fd = new FormData();
    fd.append("file", file, name);
    return request(
      `/projects/${projectId}/assets`,
      z.object({ id: z.string(), path: z.string(), size: z.number() }),
      { method: "POST", body: fd },
    );
  },
  listAssets: (projectId: string) =>
    request(`/projects/${projectId}/assets`, z.array(z.object({ path: z.string(), size: z.number() }))),
  approve: (projectId: string, body: { stage: string; decision: "approved" | "revision_requested"; notes: string; artifact?: unknown }) =>
    request(`/projects/${projectId}/approvals`, z.record(z.any()), json(body)),
  logs: (projectId: string) => request(`/projects/${projectId}/logs`, logsSchema),
  /** Fetches a worker file with auth and returns an object URL for download. */
  download: async (projectId: string, rel: string) => {
    const { url, token } = getSettings();
    const res = await fetch(`${url}/projects/${projectId}/files/${rel}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new WorkerError(res.status, `[${res.status}] ${await res.text()}`);
    return URL.createObjectURL(await res.blob());
  },
  eventsUrl: (projectId: string) => {
    const { url, token } = getSettings();
    return `${url}/projects/${projectId}/events?access_token=${encodeURIComponent(token)}`;
  },
};

// ---------------------------------------------------------------- health store
export type HealthState =
  | { state: "unconfigured" }
  | { state: "checking" }
  | { state: "online"; health: Health }
  | { state: "offline"; error: string };

let healthState: HealthState = { state: "unconfigured" };
const subs = new Set<() => void>();
const set = (s: HealthState) => {
  healthState = s;
  subs.forEach((f) => f());
};

export async function checkHealth(): Promise<HealthState> {
  if (!getSettings().url) {
    set({ state: "unconfigured" });
    return healthState;
  }
  set({ state: "checking" });
  try {
    const h = await api.health();
    set(h.ok ? { state: "online", health: h } : { state: "offline", error: h.registry_error ?? "Worker reports not ready (check auth/registry)" });
  } catch (e) {
    set({ state: "offline", error: (e as Error).message });
  }
  return healthState;
}

export function useWorkerHealth(): HealthState {
  const s = useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => healthState,
    () => healthState,
  );
  useEffect(() => {
    if (healthState.state === "unconfigured" && getSettings().url) void checkHealth();
  }, []);
  return s;
}

export const workerOnline = (h: HealthState) => h.state === "online";
