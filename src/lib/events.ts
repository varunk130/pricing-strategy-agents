import type { PricingModel } from "./pricing";

export type AgentId =
  | "value_metric"
  | "competitor_scout"
  | "contract_analyst"
  | "packaging_architect"
  | "migration_simulator"
  | "renewal_redteam"
  | "rollout_planner"
  | "memo_writer";

export interface ValueMetricOutput {
  metric: string;
  rationale: string;
  runnerUp: string;
  risks: string[];
}
export interface CompetitiveOutput {
  insights: string[];
  positioning: string;
  anchorLowPer1k: number;
  anchorHighPer1k: number;
}
export interface ContractOutput {
  constraints: string[];
  guardrails: string[];
}
export interface PackagingOutput {
  model: PricingModel;
  rationale: string;
}
export interface RecommendationOutput {
  model: PricingModel;
  iterationLog: string[];
  rationale: string;
}
export interface RedTeamFinding {
  accountId: string;
  accountName: string;
  objection: string;
  severity: "high" | "medium" | "low";
  mitigation: string;
}
export interface RedTeamOutput {
  findings: RedTeamFinding[];
}
export interface RolloutOutput {
  waves: { name: string; timing: string; scope: string; actions: string[] }[];
  enablement: string[];
}

export type RunEvent =
  | { type: "run_start"; mode: "live" | "demo"; goal: string }
  | { type: "phase_start"; phase: number }
  | { type: "agent_start"; agent: AgentId; task: string }
  | { type: "skill_loaded"; agent: AgentId; skill: string }
  | { type: "thinking"; agent: AgentId; text: string }
  | { type: "tool_call"; agent: AgentId; tool: string; input: unknown }
  | { type: "tool_result"; agent: AgentId; tool: string; preview: string }
  | { type: "note"; agent: AgentId; text: string }
  | { type: "agent_done"; agent: AgentId; output: unknown }
  | { type: "error"; agent?: AgentId; message: string }
  | { type: "run_done"; tokens?: { input: number; output: number } };

export interface AgentMeta {
  name: string;
  lever: string; // the strategy lever this agent owns
  job: string; // what it does, in plain words
  skill: string;
  phase: number;
}

export const AGENTS: Record<AgentId, AgentMeta> = {
  value_metric: {
    name: "Value Metric Analyst",
    lever: "Value metric",
    job: "Finds the usage unit that grows with customer value",
    skill: "value-metric-selection",
    phase: 1,
  },
  competitor_scout: {
    name: "Competitor Scout",
    lever: "Price level",
    job: "Reviews competitor pricing and sets a price range",
    skill: "competitive-pricing-teardown",
    phase: 1,
  },
  contract_analyst: {
    name: "Contract Analyst",
    lever: "Guardrails",
    job: "Reads every contract for price caps and renewal dates",
    skill: "contract-constraints-review",
    phase: 1,
  },
  packaging_architect: {
    name: "Packaging Architect",
    lever: "Packaging",
    job: "Designs three tiers: seats, platform fee and usage",
    skill: "usage-based-packaging",
    phase: 2,
  },
  migration_simulator: {
    name: "Migration Simulator",
    lever: "Guardrails",
    job: "Reprices all 36 contracts and tunes until risk is gone",
    skill: "migration-and-grandfathering",
    phase: 3,
  },
  renewal_redteam: {
    name: "Renewal Red Team",
    lever: "Sales motion",
    job: "Plays the customer's procurement team and pushes back",
    skill: "procurement-objections",
    phase: 3,
  },
  rollout_planner: {
    name: "Rollout Planner",
    lever: "Sales motion",
    job: "Sequences renewals into waves and plans sales enablement",
    skill: "rollout-planning",
    phase: 3,
  },
  memo_writer: {
    name: "Decision Memo Writer",
    lever: "Decision",
    job: "Writes the one-page memo for the pricing committee",
    skill: "pricing-decision-memo",
    phase: 4,
  },
};

export const PHASES = [
  { n: 1, name: "Research", note: "3 agents in parallel" },
  { n: 2, name: "Design", note: "1 agent" },
  { n: 3, name: "Stress test", note: "3 agents in parallel" },
  { n: 4, name: "Decide", note: "1 agent" },
];

export const AGENT_ORDER = Object.keys(AGENTS) as AgentId[];

/** What a tool call means, in words an exec would use. */
export function describeTool(tool: string, input: unknown, count: number): string {
  switch (tool) {
    case "load_skill":
      return `Loading skill: ${(input as { name?: string })?.name ?? ""}`;
    case "get_base_overview":
      return "Reading the customer base";
    case "analyze_value_metrics":
      return "Testing which usage metric tracks customer value";
    case "get_competitor_pricing":
      return "Reviewing 5 competitor price books";
    case "get_contract_landscape":
      return "Reading 36 contracts for price caps and renewal dates";
    case "simulate_migration":
      return `Repricing all 36 contracts (attempt ${count})`;
    case "get_account_contracts":
      return "Reading contracts of the most affected customers";
    case "get_renewal_calendar":
      return "Mapping renewals by quarter";
    default:
      return tool.startsWith("submit_") ? "Writing up results" : "Working";
  }
}

/** Make model text read like a person wrote it: no em or en dashes. */
export function plain(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\$?\d)/g, "$1 to $2")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+–\s+/g, ", ");
}
