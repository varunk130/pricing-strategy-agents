import fs from "node:fs";
import path from "node:path";
import { COMPETITORS } from "../data";
import { simulate, summarizeForAgent, type PricingModel } from "../pricing";
import { accountContracts, baseOverview, contractLandscape, renewalCalendar, valueMetricAnalysis } from "../analytics";

// ---------- JSON schemas (strict) ----------

const tierSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    platformFee: { type: "number", description: "Annual platform fee in USD" },
    includedRuns: { type: "number", description: "Agent runs per year included" },
    overagePer1k: { type: "number", description: "USD per 1,000 runs above included" },
  },
  required: ["name", "platformFee", "includedRuns", "overagePer1k"],
  additionalProperties: false,
} as const;

export const pricingModelSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    seatPrice: { type: "number", description: "Annual list price per human seat" },
    tiers: { type: "array", items: tierSchema, description: "Exactly 3 tiers, smallest first" },
    migration: {
      type: "object",
      properties: {
        year1IncreaseCapPct: { type: "number" },
        honorPriceProtection: { type: "boolean" },
        keepDiscounts: { type: "boolean" },
      },
      required: ["year1IncreaseCapPct", "honorPriceProtection", "keepDiscounts"],
      additionalProperties: false,
    },
  },
  required: ["name", "seatPrice", "tiers", "migration"],
  additionalProperties: false,
} as const;

const strArr = { type: "array", items: { type: "string" } } as const;

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** submit_* tools end the agent's loop and become its output. */
  terminal?: boolean;
}

export const TOOL_DEFS: Record<string, ToolDef> = {
  load_skill: {
    name: "load_skill",
    description:
      "Load one of your skills (a playbook written by the pricing team). Load the relevant skill before doing the work.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  get_base_overview: {
    name: "get_base_overview",
    description: "Summary of the installed base: ARR by segment, seat trends, usage growth.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  analyze_value_metrics: {
    name: "analyze_value_metrics",
    description:
      "Correlates candidate value metrics with net expansion, account health and AI adoption across all accounts, plus usage concentration.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  get_competitor_pricing: {
    name: "get_competitor_pricing",
    description: "Pricing models of the five main competitors (collected by the market intel team).",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  simulate_migration: {
    name: "simulate_migration",
    description:
      "Reprices every current customer contract under a pricing model. Returns year-1 ARR, status-quo vs new-model NRR, ARR at risk, tier mix and the largest increases.",
    input_schema: {
      type: "object",
      properties: { model: pricingModelSchema },
      required: ["model"],
      additionalProperties: false,
    },
  },
  get_account_contracts: {
    name: "get_account_contracts",
    description: "Contract terms and procurement notes for specific accounts.",
    input_schema: {
      type: "object",
      properties: { accountIds: strArr },
      required: ["accountIds"],
      additionalProperties: false,
    },
  },
  get_contract_landscape: {
    name: "get_contract_landscape",
    description: "Summary of all customer contracts: price protection clauses, renewal dates by quarter, multi-year terms and common procurement notes.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  get_renewal_calendar: {
    name: "get_renewal_calendar",
    description: "Groups renewals into time windows under a pricing model, with ARR, number of increases and savings, and the largest increase in each window.",
    input_schema: {
      type: "object",
      properties: { model: pricingModelSchema },
      required: ["model"],
      additionalProperties: false,
    },
  },
  submit_contract_constraints: {
    name: "submit_contract_constraints",
    terminal: true,
    description: "Submit the contract constraints the new model must respect and the guardrails you recommend. Call exactly once.",
    input_schema: {
      type: "object",
      properties: { constraints: strArr, guardrails: strArr },
      required: ["constraints", "guardrails"],
      additionalProperties: false,
    },
  },
  submit_rollout_plan: {
    name: "submit_rollout_plan",
    terminal: true,
    description: "Submit a 3 wave rollout plan and the sales enablement it needs. Call exactly once.",
    input_schema: {
      type: "object",
      properties: {
        waves: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, timing: { type: "string" }, scope: { type: "string" }, actions: strArr },
            required: ["name", "timing", "scope", "actions"],
            additionalProperties: false,
          },
        },
        enablement: strArr,
      },
      required: ["waves", "enablement"],
      additionalProperties: false,
    },
  },
  submit_value_metric: {
    name: "submit_value_metric",
    terminal: true,
    description: "Submit your final value-metric recommendation. Call exactly once when done.",
    input_schema: {
      type: "object",
      properties: {
        metric: { type: "string" },
        rationale: { type: "string" },
        runnerUp: { type: "string" },
        risks: strArr,
      },
      required: ["metric", "rationale", "runnerUp", "risks"],
      additionalProperties: false,
    },
  },
  submit_competitive_insights: {
    name: "submit_competitive_insights",
    terminal: true,
    description: "Submit your final competitive teardown. Call exactly once when done.",
    input_schema: {
      type: "object",
      properties: {
        insights: strArr,
        positioning: { type: "string" },
        anchorLowPer1k: { type: "number" },
        anchorHighPer1k: { type: "number" },
      },
      required: ["insights", "positioning", "anchorLowPer1k", "anchorHighPer1k"],
      additionalProperties: false,
    },
  },
  submit_pricing_model: {
    name: "submit_pricing_model",
    terminal: true,
    description: "Submit your proposed pricing model. Call exactly once when done.",
    input_schema: {
      type: "object",
      properties: { model: pricingModelSchema, rationale: { type: "string" } },
      required: ["model", "rationale"],
      additionalProperties: false,
    },
  },
  submit_recommendation: {
    name: "submit_recommendation",
    terminal: true,
    description:
      "Submit the final model after simulation, with a one-line log entry per simulation you ran. Call exactly once.",
    input_schema: {
      type: "object",
      properties: {
        model: pricingModelSchema,
        iterationLog: strArr,
        rationale: { type: "string" },
      },
      required: ["model", "iterationLog", "rationale"],
      additionalProperties: false,
    },
  },
  submit_redteam_findings: {
    name: "submit_redteam_findings",
    terminal: true,
    description: "Submit 4 to 6 procurement objections with mitigations. Call exactly once.",
    input_schema: {
      type: "object",
      properties: {
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              accountId: { type: "string" },
              accountName: { type: "string" },
              objection: { type: "string" },
              severity: { type: "string", enum: ["high", "medium", "low"] },
              mitigation: { type: "string" },
            },
            required: ["accountId", "accountName", "objection", "severity", "mitigation"],
            additionalProperties: false,
          },
        },
      },
      required: ["findings"],
      additionalProperties: false,
    },
  },
};

// ---------- executors ----------

const SKILLS_DIR = path.join(process.cwd(), "skills");

export function readSkill(name: string): string | null {
  if (!/^[a-z0-9-]+$/.test(name)) return null;
  const file = path.join(SKILLS_DIR, name, "SKILL.md");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

export function executeTool(name: string, input: Record<string, unknown>, allowedSkills: string[]): Record<string, unknown> | unknown[] {
  switch (name) {
    case "load_skill": {
      const skill = String(input.name);
      if (!allowedSkills.includes(skill))
        return { error: `Skill not available to you. Available: ${allowedSkills.join(", ")}` };
      return { skill, content: readSkill(skill) ?? "missing" };
    }
    case "get_base_overview":
      return baseOverview();
    case "analyze_value_metrics":
      return valueMetricAnalysis();
    case "get_competitor_pricing":
      return COMPETITORS;
    case "simulate_migration":
      return summarizeForAgent(simulate(input.model as PricingModel));
    case "get_account_contracts":
      return accountContracts((input.accountIds as string[]) ?? []);
    case "get_contract_landscape":
      return contractLandscape();
    case "get_renewal_calendar":
      return renewalCalendar(input.model as PricingModel);
    default:
      return { error: `Unknown tool ${name}` };
  }
}

/** Validate a pricing model coming back from a model-generated tool input. */
export function isPricingModel(m: unknown): m is PricingModel {
  const x = m as PricingModel;
  return (
    !!x &&
    typeof x.seatPrice === "number" &&
    Array.isArray(x.tiers) &&
    x.tiers.length > 0 &&
    x.tiers.every(
      (t) =>
        typeof t.platformFee === "number" &&
        typeof t.includedRuns === "number" &&
        typeof t.overagePer1k === "number",
    ) &&
    typeof x.migration?.year1IncreaseCapPct === "number"
  );
}
