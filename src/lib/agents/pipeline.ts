import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentId,
  CompetitiveOutput,
  ContractOutput,
  PackagingOutput,
  RecommendationOutput,
  RedTeamOutput,
  RolloutOutput,
  RunEvent,
  ValueMetricOutput,
} from "../events";
import { simulate, summarizeForAgent, type PricingModel } from "../pricing";
import { runAgent, type Usage } from "./runAgent";
import { isPricingModel } from "./tools";

type Emit = (e: RunEvent) => void;

const SYS = "You are a senior B2B monetization strategist. Use the numbers the tools return and never invent data.";

/**
 * Orchestration is plain code. Four phases; agents inside a phase run at the
 * same time and only get the context they need from earlier phases.
 */
export async function runPipeline(goal: string, emit: Emit, startModel?: PricingModel) {
  const client = new Anthropic();
  const usage: Usage = { input: 0, output: 0 };
  const common = { client, emit, usage, system: SYS };
  const brief = `Pricing committee brief: ${goal}`;

  const step = async <T>(agent: AgentId, task: string, run: () => Promise<unknown>) => {
    emit({ type: "agent_start", agent, task });
    const out = (await run()) as T | null;
    if (out == null) throw new Error(`${agent} did not produce an output`);
    emit({ type: "agent_done", agent, output: out });
    return out;
  };

  emit({ type: "run_start", mode: "live", goal });

  // Phase 1: research, three agents at once
  emit({ type: "phase_start", phase: 1 });
  const [vm, cs, ca] = await Promise.all([
    step<ValueMetricOutput>("value_metric", "Find the unit to charge for", () =>
      runAgent({
        ...common,
        agent: "value_metric",
        effort: "low",
        tools: ["get_base_overview", "analyze_value_metrics", "submit_value_metric"],
        prompt: `${brief}\nRecommend the value metric for the new model.`,
      }),
    ),
    step<CompetitiveOutput>("competitor_scout", "Set the competitive price range", () =>
      runAgent({
        ...common,
        agent: "competitor_scout",
        effort: "low",
        tools: ["get_competitor_pricing", "submit_competitive_insights"],
        prompt: `${brief}\nWe meter "agent runs". Review competitor pricing and give a price range per 1,000 runs at enterprise volume.`,
      }),
    ),
    step<ContractOutput>("contract_analyst", "Find contract limits on price changes", () =>
      runAgent({
        ...common,
        agent: "contract_analyst",
        effort: "low",
        tools: ["get_contract_landscape", "submit_contract_constraints"],
        prompt: `${brief}\nList what our contracts allow and forbid for a price change, and the guardrails the new model needs.`,
      }),
    ),
  ]);
  const research = `Value metric: ${JSON.stringify(vm)}\nCompetition: ${JSON.stringify(cs)}\nContracts: ${JSON.stringify(ca)}`;

  // Phase 2: design
  emit({ type: "phase_start", phase: 2 });
  let model: PricingModel;
  if (startModel) {
    model = startModel;
  } else {
    const pa = await step<PackagingOutput>("packaging_architect", "Design the tiers", () =>
      runAgent({
        ...common,
        agent: "packaging_architect",
        effort: "medium",
        tools: ["get_base_overview", "submit_pricing_model"],
        prompt: `${brief}\n${research}\nDesign a 3 tier hybrid model: seat price, platform fee with included agent runs, and overage. Size tiers from the base overview. Do not simulate; another agent will.`,
      }),
    );
    if (!isPricingModel(pa.model)) throw new Error("Packaging Architect returned an invalid model");
    model = pa.model;
  }

  // Phase 3: stress test, three agents at once
  emit({ type: "phase_start", phase: 3 });
  const draftSim = JSON.stringify(summarizeForAgent(simulate(model)));
  const [rec, rt, ro] = await Promise.all([
    step<RecommendationOutput>("migration_simulator", "Reprice every contract and tune", () =>
      runAgent({
        ...common,
        agent: "migration_simulator",
        effort: "medium",
        maxTurns: 12,
        tools: ["simulate_migration", "submit_recommendation"],
        prompt: `${brief}\nContract guardrails: ${JSON.stringify(ca.guardrails)}\nDraft model:\n${JSON.stringify(model)}\nSimulate it, change one lever at a time (max 4 simulations), then submit the best model.`,
      }),
    ),
    step<RedTeamOutput>("renewal_redteam", "Push back as customer procurement", () =>
      runAgent({
        ...common,
        agent: "renewal_redteam",
        effort: "low",
        tools: ["get_account_contracts", "submit_redteam_findings"],
        prompt: `${brief}\nDraft model: ${JSON.stringify(model)}\nDraft impact: ${draftSim}\nPull contracts for the most affected customers and push back as their procurement team.`,
      }),
    ),
    step<RolloutOutput>("rollout_planner", "Plan the rollout waves", () =>
      runAgent({
        ...common,
        agent: "rollout_planner",
        effort: "low",
        tools: ["get_renewal_calendar", "submit_rollout_plan"],
        prompt: `${brief}\nContract constraints: ${JSON.stringify(ca.constraints)}\nDraft model: ${JSON.stringify(model)}\nPlan the rollout in 3 waves using the renewal calendar.`,
      }),
    ),
  ]);
  if (!isPricingModel(rec.model)) throw new Error("Migration Simulator returned an invalid model");
  const finalSim = summarizeForAgent(simulate(rec.model));

  // Phase 4: decide
  emit({ type: "phase_start", phase: 4 });
  await step<string>("memo_writer", "Write the decision memo", () =>
    runAgent({
      ...common,
      agent: "memo_writer",
      effort: "medium",
      tools: [],
      prompt: `${brief}\n${research}\nFinal model: ${JSON.stringify(rec.model)}\nImpact: ${JSON.stringify(finalSim)}\nTuning log: ${JSON.stringify(rec.iterationLog)}\nObjections: ${JSON.stringify(rt.findings)}\nRollout: ${JSON.stringify(ro)}\nWrite the memo in markdown. Output only the memo.`,
    }),
  );

  emit({ type: "run_done", tokens: usage });
}
