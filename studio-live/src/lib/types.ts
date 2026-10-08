export type StageStatus =
  | "locked"
  | "ready"
  | "in_progress"
  | "awaiting_approval"
  | "approved"
  | "completed"
  | "revision_requested";

export interface StageState {
  name: string;
  skill?: string;
  produces: string[];
  approvalRequired: boolean;
  status: StageStatus;
  artifact: string; // JSON text authored or returned by worker
  notes: string;
  revisions: number;
  updatedAt: number;
}

export interface Take {
  id: string;
  label: string;
  assetId?: string;
  status: "pending" | "selected" | "rejected";
  notes: string;
}
export interface Scene {
  id: string;
  title: string;
  description: string;
  durationSec: number;
  takes: Take[];
}
export interface ScriptSection { id: string; heading: string; text: string }

export interface Asset {
  id: string;
  name: string;
  kind: "video" | "audio" | "image" | "document" | "other";
  mime: string;
  size: number;
  source: "upload" | "worker";
  blobKey?: string; // IndexedDB blob key for local uploads
  workerPath?: string; // path inside worker project workspace
  createdAt: number;
}
export interface TimelineClip {
  id: string;
  track: "video" | "audio" | "overlay";
  sceneId?: string;
  assetId?: string;
  start: number;
  duration: number;
  label: string;
}
export interface RenderJob {
  id: string;
  profile: string;
  status: "draft" | "queued" | "running" | "succeeded" | "failed";
  workerJobId?: string;
  tool: string;
  outputPath?: string;
  error?: string;
  createdAt: number;
}
export interface LogEntry {
  id: string;
  ts: number;
  stage?: string;
  kind: "created" | "stage_status" | "edit" | "approval" | "revision" | "asset" | "render" | "worker" | "import";
  message: string;
  snapshot?: Record<string, StageStatus>;
}
export interface CostEntry { id: string; ts: number; tool: string; usd: number; note: string; source: "estimate" | "worker" }

export interface OutputProfile { aspect: "16:9" | "9:16" | "1:1" | "4:5"; resolution: "720p" | "1080p" | "4k"; fps: 24 | 25 | 30 | 60 }

export interface Project {
  schema: "openmontage-web-studio/project@1";
  id: string;
  title: string;
  prompt: string;
  pipeline: string;
  style: string;
  checkpointPolicy: "guided" | "manual_all" | "auto_noncreative";
  output: OutputProfile;
  durationSec: number;
  budgetUsd: number;
  referenceVideoUrl: string;
  stages: StageState[];
  script: ScriptSection[];
  scenes: Scene[];
  assets: Asset[];
  timeline: TimelineClip[];
  renders: RenderJob[];
  decisionLog: LogEntry[];
  costLog: CostEntry[];
  workerSynced: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NewProjectInput {
  title: string;
  prompt: string;
  pipeline: string;
  style: string;
  checkpointPolicy: Project["checkpointPolicy"];
  output: OutputProfile;
  durationSec: number;
  budgetUsd: number;
  referenceVideoUrl: string;
}
