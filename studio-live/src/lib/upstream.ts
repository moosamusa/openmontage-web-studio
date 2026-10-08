// Typed access to manifests imported verbatim from upstream OpenMontage
// (pipeline_defs/*.yaml, styles/*.yaml, tools/**, schemas/**, skills/**).
// Regenerate with: node scripts/import-upstream.cjs <path-to-OpenMontage> src/data/upstream.json
import raw from "../data/upstream.json";

export interface UpstreamStage {
  name: string;
  skill?: string;
  produces?: string[];
  tools_available?: string[];
  checkpoint_required?: boolean;
  human_approval_default?: boolean;
  review_focus?: string[];
  success_criteria?: string[];
  sub_stages?: unknown;
}
export interface UpstreamPipeline {
  file: string;
  name: string;
  version?: string;
  description?: string;
  category?: string;
  stability?: string;
  default_checkpoint_policy?: string;
  reference_input?: { supported?: boolean; analysis_tools?: string[] };
  required_skills?: string[];
  orchestration?: { budget_default_usd?: number; max_revisions_per_stage?: number; mode?: string };
  compatible_playbooks?: { recommended?: string[]; also_works?: string[] };
  stages: UpstreamStage[];
}
export interface UpstreamTool {
  name: string;
  file: string;
  category: string;
  tier: string;
  capability: string | null;
  provider: string | null;
  stability: string;
  runtime: string;
  execution_mode: string;
  dependencies: string[];
  env_vars: string[];
}
export interface UpstreamStyle { id: string; file: string; name: string; description: string }
export interface UpstreamSchema { id: string; group: string; file: string; title: string; required: string[] }

interface UpstreamData {
  upstream: { repo: string; commit: string; license: string };
  pipelines: UpstreamPipeline[];
  styles: UpstreamStyle[];
  tools: UpstreamTool[];
  schemas: UpstreamSchema[];
  skills: string[];
}

const data = raw as unknown as UpstreamData;

export const UPSTREAM = data.upstream;
export const PIPELINES = data.pipelines;
export const STYLES = data.styles;
export const TOOLS = data.tools.map((t) => ({
  ...t,
  runtime: (t.runtime || "UNKNOWN").split(/\s/)[0] || "UNKNOWN",
}));
export const SCHEMAS = data.schemas;
export const SKILLS = data.skills;

export const getPipeline = (name: string) => PIPELINES.find((p) => p.name === name);
export const sourceUrl = (file: string) => `${UPSTREAM.repo}/blob/${UPSTREAM.commit}/${file}`;
