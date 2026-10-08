// Pure, testable project state transitions. No generation is simulated here:
// artifacts are either authored by the user or returned by the worker.
import { z } from "zod";
import { getPipeline } from "./upstream";
import type { LogEntry, NewProjectInput, Project, StageState, StageStatus } from "./types";

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 24);

const snapshot = (stages: StageState[]) =>
  Object.fromEntries(stages.map((s) => [s.name, s.status])) as Record<string, StageStatus>;

export function log(p: Project, entry: Omit<LogEntry, "id" | "ts" | "snapshot">): Project {
  const e: LogEntry = { ...entry, id: uid(), ts: Date.now(), snapshot: snapshot(p.stages) };
  return { ...p, decisionLog: [...p.decisionLog, e], updatedAt: Date.now() };
}

export function createProject(input: NewProjectInput): Project {
  const manifest = getPipeline(input.pipeline);
  if (!manifest) throw new Error(`Unknown pipeline: ${input.pipeline}`);
  const manualAll = input.checkpointPolicy === "manual_all";
  const stages: StageState[] = manifest.stages.map((s, i) => ({
    name: s.name,
    ...(s.skill ? { skill: s.skill } : {}),
    produces: s.produces ?? [],
    approvalRequired: manualAll || !!s.human_approval_default,
    status: i === 0 ? "ready" : "locked",
    artifact: "",
    notes: "",
    revisions: 0,
    updatedAt: Date.now(),
  }));
  const now = Date.now();
  const p: Project = {
    schema: "openmontage-web-studio/project@1",
    id: uid(),
    ...input,
    title: input.title.trim() || "Untitled production",
    stages,
    script: [],
    scenes: [],
    assets: [],
    timeline: [],
    renders: [],
    decisionLog: [],
    costLog: [],
    workerSynced: false,
    createdAt: now,
    updatedAt: now,
  };
  return log(p, { kind: "created", message: `Created with pipeline ${input.pipeline}` });
}

function setStage(p: Project, name: string, patch: Partial<StageState>): Project {
  return { ...p, stages: p.stages.map((s) => (s.name === name ? { ...s, ...patch, updatedAt: Date.now() } : s)) };
}

function unlockNext(p: Project, name: string): Project {
  const i = p.stages.findIndex((s) => s.name === name);
  const next = p.stages[i + 1];
  if (next && next.status === "locked") return setStage(p, next.name, { status: "ready" });
  return p;
}

export function isValidJson(text: string): boolean {
  if (!text.trim()) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function startStage(p: Project, name: string): Project {
  const s = p.stages.find((x) => x.name === name);
  if (!s || (s.status !== "ready" && s.status !== "revision_requested")) throw new Error("Stage is not ready");
  return log(setStage(p, name, { status: "in_progress" }), { kind: "stage_status", stage: name, message: "Started" });
}

export function saveArtifact(p: Project, name: string, artifact: string): Project {
  return log(setStage(p, name, { artifact }), { kind: "edit", stage: name, message: "Artifact edited" });
}

/** Submit a stage. Gated stages move to awaiting_approval; others complete and unlock the next. */
export function submitStage(p: Project, name: string): Project {
  const s = p.stages.find((x) => x.name === name);
  if (!s || s.status !== "in_progress") throw new Error("Stage must be in progress to submit");
  if (!isValidJson(s.artifact)) throw new Error("Stage artifact must be valid, non-empty JSON before submission");
  if (s.approvalRequired) {
    return log(setStage(p, name, { status: "awaiting_approval" }), {
      kind: "stage_status",
      stage: name,
      message: "Submitted for approval",
    });
  }
  const done = setStage(p, name, { status: "completed" });
  return log(unlockNext(done, name), { kind: "stage_status", stage: name, message: "Completed (no gate)" });
}

export function approveStage(p: Project, name: string, notes = ""): Project {
  const s = p.stages.find((x) => x.name === name);
  if (!s || s.status !== "awaiting_approval") throw new Error("Only stages awaiting approval can be approved");
  const approved = setStage(p, name, { status: "approved", notes });
  return log(unlockNext(approved, name), { kind: "approval", stage: name, message: `Approved${notes ? `: ${notes}` : ""}` });
}

export function requestRevision(p: Project, name: string, notes: string): Project {
  const s = p.stages.find((x) => x.name === name);
  if (!s || s.status !== "awaiting_approval") throw new Error("Only stages awaiting approval can be sent back");
  if (!notes.trim()) throw new Error("Revision notes are required");
  return log(setStage(p, name, { status: "revision_requested", notes, revisions: s.revisions + 1 }), {
    kind: "revision",
    stage: name,
    message: `Revision requested: ${notes}`,
  });
}

export const stageDone = (s: StageState) => s.status === "approved" || s.status === "completed";

/** Reconstruct stage statuses as of a given log index (decision replay). */
export function replayAt(p: Project, index: number): Record<string, StageStatus> {
  const e = p.decisionLog[Math.max(0, Math.min(index, p.decisionLog.length - 1))];
  return e?.snapshot ?? snapshot(p.stages);
}

export const totalCost = (p: Project) => p.costLog.reduce((a, c) => a + c.usd, 0);

// ------------------------------------------------------------ import/export
const stageSchema = z.object({
  name: z.string(),
  produces: z.array(z.string()),
  approvalRequired: z.boolean(),
  status: z.enum(["locked", "ready", "in_progress", "awaiting_approval", "approved", "completed", "revision_requested"]),
  artifact: z.string(),
  notes: z.string(),
  revisions: z.number(),
  updatedAt: z.number(),
  skill: z.string().optional(),
});
export const projectSchema = z
  .object({
    schema: z.literal("openmontage-web-studio/project@1"),
    id: z.string().min(1),
    title: z.string(),
    prompt: z.string(),
    pipeline: z.string(),
    style: z.string(),
    stages: z.array(stageSchema).min(1),
    script: z.array(z.any()),
    scenes: z.array(z.any()),
    assets: z.array(z.any()),
    timeline: z.array(z.any()),
    renders: z.array(z.any()),
    decisionLog: z.array(z.any()),
    costLog: z.array(z.any()),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .passthrough();

export function exportProject(p: Project): string {
  return JSON.stringify(p, null, 2);
}

export function importProject(text: string, existingIds: string[] = []): Project {
  const parsed = projectSchema.parse(JSON.parse(text)) as unknown as Project;
  const p: Project = existingIds.includes(parsed.id) ? { ...parsed, id: uid(), title: `${parsed.title} (imported)` } : parsed;
  // Local blobs don't travel in JSON; keep metadata, drop dangling blob refs.
  const clean = { ...p, assets: p.assets.map((a) => (({ blobKey, ...rest }) => rest)(a)), workerSynced: false };
  return log(clean, { kind: "import", message: "Imported from JSON" });
}
