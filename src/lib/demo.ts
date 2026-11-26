// Replay mode: a recorded run of the agent team. Agents in the same phase run
// on overlapping timelines, as they do live. Every number comes from the same
// engine and tools the live agents call; only the agents' wording is scripted.
import type { AgentId, RedTeamFinding, RolloutOutput, RunEvent } from "./events";
import { REFERENCE_MODEL, simulate, summarizeForAgent, STARTER_MODEL, type PricingModel } from "./pricing";
import { accountContracts, baseOverview, contractLandscape, renewalCalendar, valueMetricAnalysis } from "./analytics";
import { COMPETITORS } from "./data";

type Timed = { delay: number; event: RunEvent };
type At = { t: number; seq: number; event: RunEvent };

const usd = (v: number) => (Math.abs(v) < 5e4 ? "$0" : `$${(v / 1e6).toFixed(1)}M`);
const pct0 = (v: number) => `${Math.round(v * 100)}%`;
const short = (v: unknown, n = 260) => {
  const s = JSON.stringify(v);
  return s.length > n ? `${s.slice(0, n)}...` : s;
};

export const DEMO_GOAL =
  "Stop losing revenue as seat counts fall. No customer pays more than 15% extra at their next renewal, and every contract is honored.";

/** One agent's timeline. `step` moves its clock forward, so lanes can overlap. */
function lane(out: At[], agent: AgentId, start: number) {
  let t = start;
  let seq = 0;
  const add = (dt: number, event: RunEvent) => {
    t += dt;
    out.push({ t, seq: seq++ + start, event });
  };
  return {
    add,
    tool(dt: number, tool: string, input: unknown, result?: unknown, wait = 700) {
      add(dt, { type: "tool_call", agent, tool, input });
      if (result !== undefined) add(wait, { type: "tool_result", agent, tool, preview: short(result) });
    },
    skill(dt: number, skill: string) {
      add(dt, { type: "tool_call", agent, tool: "load_skill", input: { name: skill } });
      add(200, { type: "skill_loaded", agent, skill });
    },
    get end() {
      return t;
    },
  };
}

export function buildDemoScript(goal: string): Timed[] {
  const out: At[] = [];
  const overview = baseOverview();
  const vma = valueMetricAnalysis();
  const land = contractLandscape();
  const runs = vma.metrics.find((m) => m.metric === "agentRunsPerSeat")!;
  const seats = vma.metrics.find((m) => m.metric === "seats")!;
  const wau = vma.metrics.find((m) => m.metric === "weeklyActiveUserPct")!;

  out.push({ t: 0, seq: 0, event: { type: "run_start", mode: "demo", goal } });
  out.push({ t: 150, seq: 1, event: { type: "phase_start", phase: 1 } });

  // ---------- Phase 1: three research agents at once ----------
  const vm = lane(out, "value_metric", 300);
  vm.add(0, { type: "agent_start", agent: "value_metric", task: "Find the unit to charge for" });
  vm.skill(500, "value-metric-selection");
  vm.tool(500, "get_base_overview", {}, overview);
  vm.add(400, {
    type: "note",
    agent: "value_metric",
    text: `Seats fall ${pct0(-overview.seatChangeAtRenewal)} at renewal while agent runs grow ${pct0(overview.agentRunGrowth)}. Testing which metric follows value.`,
  });
  vm.tool(500, "analyze_value_metrics", {}, vma, 900);
  vm.add(600, {
    type: "thinking",
    agent: "value_metric",
    text: `Runs per seat track expansion at ${runs.corrWithNetExpansion}. Seats track it at ${seats.corrWithNetExpansion}. Active users fall as AI use rises (${wau.corrWithAiAdoption}).`,
  });
  const vmOut = {
    metric: "Agent runs",
    rationale: `Agent runs rise with customer value (correlation ${runs.corrWithNetExpansion} with net expansion, ${runs.corrWithHealth} with account health). Seats and active users fall in the same accounts. Runs are already metered and visible to customers, so finance teams can budget for them.`,
    runnerUp: "Active workflows. Easy to explain, but growth stops once workflows are built.",
    risks: [
      `The top 10% of accounts drive ${vma.topTenPctShareOfRuns}% of runs, so tier design matters more than unit price.`,
      "Define a run as one finished agent task, so customers can't lower the bill by batching.",
      "Accounts with low AI use still need seats, so keep a seat fee.",
    ],
  };
  vm.tool(600, "submit_value_metric", vmOut);
  vm.add(200, { type: "agent_done", agent: "value_metric", output: vmOut });

  const cs = lane(out, "competitor_scout", 450);
  cs.add(0, { type: "agent_start", agent: "competitor_scout", task: "Set the competitive price range" });
  cs.skill(600, "competitive-pricing-teardown");
  cs.tool(600, "get_competitor_pricing", {}, COMPETITORS, 900);
  cs.add(700, {
    type: "thinking",
    agent: "competitor_scout",
    text: "At enterprise volume: Agentry $120 per 1k runs, Stackline about $80 plus seats, Flowgrid credits about $100 to $150.",
  });
  const csOut = {
    insights: [
      "3 of 5 competitors have already moved off pure seats. The one that stayed is discounting hard to keep share.",
      "Pure usage pricing wins pilots but loses enterprise deals, because buyers can't predict the bill.",
      "Seats plus a usage add on feels like paying twice. Put usage inside the platform fee instead.",
      "Outcome pricing only works for support tickets. It is not a threat for general workflows yet.",
    ],
    positioning: "Price in the upper middle of the market and sell predictability: a committed yearly pool, no surprise invoices.",
    anchorLowPer1k: 80,
    anchorHighPer1k: 150,
  };
  cs.tool(800, "submit_competitive_insights", csOut);
  cs.add(200, { type: "agent_done", agent: "competitor_scout", output: csOut });

  const ca = lane(out, "contract_analyst", 600);
  ca.add(0, { type: "agent_start", agent: "contract_analyst", task: "Find contract limits on price changes" });
  ca.skill(550, "contract-constraints-review");
  ca.tool(700, "get_contract_landscape", {}, land, 900);
  ca.add(600, {
    type: "note",
    agent: "contract_analyst",
    text: `${land.withPriceProtection} contracts cap renewal increases at 7%. That covers ${usd(land.priceProtectionArr)} of ARR.`,
  });
  const caOut = {
    constraints: [
      `${land.withPriceProtection} of ${land.contracts} contracts cap renewal increases at 7%, covering ${usd(land.priceProtectionArr)} of ARR.`,
      `${land.renewalsByQuarter[0].renewals} renewals land in the next 3 months and ${land.renewalsByQuarter[1].renewals} in the 3 after, so early waves are small enough to learn from.`,
      `${land.multiYearContracts} customers are on multi year terms and can only move at renewal.`,
      `Most common procurement note: "${land.procurementThemes[0].note}"`,
    ],
    guardrails: [
      "Cap any year 1 increase at 15%.",
      "Honor every contract price cap. Ramp the rest at the next renewal.",
      "Send notice 120 days before any price change.",
      "Keep negotiated discounts. Change one thing per renewal conversation.",
    ],
  };
  ca.tool(700, "submit_contract_constraints", caOut);
  ca.add(200, { type: "agent_done", agent: "contract_analyst", output: caOut });

  // ---------- Phase 2: design ----------
  const p2 = Math.max(vm.end, cs.end, ca.end) + 500;
  out.push({ t: p2, seq: 0, event: { type: "phase_start", phase: 2 } });
  const draft: PricingModel = { ...STARTER_MODEL, name: "Relaya Flex draft" };
  const pa = lane(out, "packaging_architect", p2 + 200);
  pa.add(0, { type: "agent_start", agent: "packaging_architect", task: "Design the tiers" });
  pa.skill(500, "usage-based-packaging");
  pa.tool(500, "get_base_overview", {}, overview);
  pa.add(800, {
    type: "thinking",
    agent: "packaging_architect",
    text: `The median account runs about ${Math.round(vma.medianAnnualRunsPerAccount / 1000)}k agent runs a year. Team includes 200k, Business 1M, Enterprise 5M. Seat price drops to $600 because usage now carries growth.`,
  });
  const paOut = {
    model: draft,
    rationale:
      "Seats keep low AI accounts stable. Platform fees give buyers a fixed budget line with runs included. Overage starts at $200 per 1k runs and drops about 20% per tier. Rates start high so the simulator has room to tune down.",
  };
  pa.tool(700, "submit_pricing_model", paOut);
  pa.add(200, { type: "agent_done", agent: "packaging_architect", output: paOut });

  // ---------- Phase 3: three stress-test agents at once ----------
  const p3 = pa.end + 500;
  out.push({ t: p3, seq: 0, event: { type: "phase_start", phase: 3 } });

  const ms = lane(out, "migration_simulator", p3 + 200);
  ms.add(0, { type: "agent_start", agent: "migration_simulator", task: "Reprice every contract and tune" });
  ms.skill(500, "migration-and-grandfathering");
  const v2: PricingModel = {
    ...draft,
    name: "Relaya Flex v2",
    migration: { year1IncreaseCapPct: 20, honorPriceProtection: true, keepDiscounts: true },
  };
  const tries: [PricingModel, string][] = [
    [draft, "Start with the draft as designed."],
    [v2, "Cap year 1 increases at 20% and honor contract price caps."],
    [REFERENCE_MODEL, "Cut overage 25% into the market range and tighten the cap to 15%."],
  ];
  const log: string[] = [];
  tries.forEach(([m, why], i) => {
    const s = summarizeForAgent(simulate(m));
    ms.add(i === 0 ? 500 : 700, { type: "note", agent: "migration_simulator", text: why });
    ms.tool(300, "simulate_migration", { model: m }, s, 900);
    const top = s.biggestIncreases[0];
    log.push(
      `Try ${i + 1}: retention ${s.newModelNrr} vs ${s.statusQuoNrr} on seats. Largest increase ${top.delta} (${top.name}). ARR at risk ${usd(s.arrAtRisk)}.`,
    );
  });
  const finalSim = summarizeForAgent(simulate(REFERENCE_MODEL));
  const recOut = {
    model: REFERENCE_MODEL,
    iterationLog: log,
    rationale: `Retention rises from ${finalSim.statusQuoNrr} on seats to ${finalSim.newModelNrr}. No customer pays more than 15% extra at renewal and every contract cap is honored. ${finalSim.cappedAccounts} customers reach the new price over two renewals.`,
  };
  ms.tool(600, "submit_recommendation", recOut);
  ms.add(200, { type: "agent_done", agent: "migration_simulator", output: recOut });

  const draftSim = summarizeForAgent(simulate(draft));
  const ids = draftSim.biggestIncreases.slice(0, 5).map((r) => r.id);
  const contracts = accountContracts(ids);
  const rt = lane(out, "renewal_redteam", p3 + 350);
  rt.add(0, { type: "agent_start", agent: "renewal_redteam", task: "Push back as customer procurement" });
  rt.skill(600, "procurement-objections");
  rt.add(500, {
    type: "note",
    agent: "renewal_redteam",
    text: `The draft raises 5 customers by ${draftSim.biggestIncreases[4].delta} to ${draftSim.biggestIncreases[0].delta}. Reading their contracts.`,
  });
  rt.tool(400, "get_account_contracts", { accountIds: ids }, contracts, 1000);
  rt.add(900, {
    type: "thinking",
    agent: "renewal_redteam",
    text: "As procurement, the strongest lines are a fixed budget and being charged more for our own efficiency.",
  });
  const findings = contracts
    .map((c, i) => ("error" in c ? null : objectionFor(c, draftSim.biggestIncreases.find((x) => x.id === c.id)!.delta, i)))
    .filter(Boolean) as RedTeamFinding[];
  rt.tool(1600, "submit_redteam_findings", { findings });
  rt.add(200, { type: "agent_done", agent: "renewal_redteam", output: { findings } });

  const cal = renewalCalendar(draft);
  const ro = lane(out, "rollout_planner", p3 + 500);
  ro.add(0, { type: "agent_start", agent: "rollout_planner", task: "Plan the rollout waves" });
  ro.skill(600, "rollout-planning");
  ro.tool(700, "get_renewal_calendar", { model: draft }, cal, 900);
  const roOut: RolloutOutput = {
    waves: [
      {
        name: "Wave 1: Prove it",
        timing: "Months 0 to 3",
        scope: `All new customers, plus ${cal[0].renewals} renewals (${usd(cal[0].arr)} ARR)`,
        actions: ["Launch the new price book for new deals", "Move renewals that save or stay flat first", "Track win rate and deal cycle against seat deals"],
      },
      {
        name: "Wave 2: Hard conversations",
        timing: "Months 4 to 6",
        scope: `${cal[1].renewals} renewals (${usd(cal[1].arr)} ARR)`,
        actions: ["Send notice 120 days ahead", "Executive call for every increase above 10%", "Offer a migration credit where budgets are fixed"],
      },
      {
        name: "Wave 3: Full base",
        timing: "Months 7 to 18",
        scope: `${cal[2].renewals + cal[3].renewals} renewals (${usd(cal[2].arr + cal[3].arr)} ARR)`,
        actions: ["Move each customer at their renewal date", "Review overage rates after 6 months of data", "Retire the seat only price book"],
      },
    ],
    enablement: [
      "One page pitch: why usage pricing protects the customer's budget",
      "A usage forecast for every account, built into the CRM",
      "Clear approval rules for exceptions above the 15% cap",
      "Pay reps on committed usage, not seat count",
    ],
  };
  ro.add(800, { type: "note", agent: "rollout_planner", text: `${cal[0].renewals} renewals in the next 3 months make a safe first wave.` });
  ro.tool(700, "submit_rollout_plan", roOut);
  ro.add(200, { type: "agent_done", agent: "rollout_planner", output: roOut });

  // ---------- Phase 4: decide ----------
  const p4 = Math.max(ms.end, rt.end, ro.end) + 500;
  out.push({ t: p4, seq: 0, event: { type: "phase_start", phase: 4 } });
  const mw = lane(out, "memo_writer", p4 + 200);
  mw.add(0, { type: "agent_start", agent: "memo_writer", task: "Write the decision memo" });
  mw.skill(500, "pricing-decision-memo");
  mw.add(700, { type: "note", agent: "memo_writer", text: "Pulling the numbers, objections and rollout into one page." });
  mw.add(1300, { type: "agent_done", agent: "memo_writer", output: memo(REFERENCE_MODEL, finalSim, findings, roOut) });
  out.push({ t: mw.end + 200, seq: 0, event: { type: "run_done" } });

  out.sort((a, b) => a.t - b.t || a.seq - b.seq);
  let prev = 0;
  return out.map((x) => {
    const delay = x.t - prev;
    prev = x.t;
    return { delay, event: x.event };
  });
}

function objectionFor(
  c: Exclude<ReturnType<typeof accountContracts>[number], { error: string }>,
  delta: string,
  i: number,
): RedTeamFinding {
  const n = c.procurementNotes;
  let objection = `This is ${delta} more for the same work. Our ${c.economicBuyer} will ask why automation that should cut costs now costs more.`;
  let mitigation = "Show cost per run against the headcount it replaced. Offer a year 1 credit worth half the increase.";
  let severity: RedTeamFinding["severity"] = "medium";
  if (/fixed annually/.test(n)) {
    objection = `Our budget runs ${c.budgetCycle} and is fixed. ${delta} more plus variable overage needs CFO approval we won't get mid year.`;
    mitigation = "Bill overage once a year as a true up, not monthly, and cap year 1 spend at the committed pool.";
    severity = "high";
  } else if (/Champion recently left/.test(n)) {
    objection = "Our new VP is reviewing all automation spend. A new pricing model right now will trigger a full RFP.";
    mitigation = "Executive call before the renewal notice. Offer one more year on seats with an option to switch.";
    severity = "high";
  } else if (/predictable/.test(n)) {
    objection = "We picked you because the bill was predictable. Overage makes our spend impossible to forecast.";
    mitigation = "Size their committed pool at their busiest month, and let unused runs roll over for one quarter.";
  } else if (/usage-based/.test(n)) {
    objection = "We asked for usage pricing, but we expected to pay less as our seat count drops, not more.";
    mitigation = "Show the seat savings they keep. Lock the per run rate for 3 years in exchange for a multi year deal.";
    severity = "low";
  } else if (/benchmarks/.test(n)) {
    objection = "Agentry quotes $0.12 per run at our volume. Why is your overage higher?";
    mitigation = "Sell predictability: at their forecast usage, the committed pool costs less per run than Agentry.";
  } else if (/90-day notice/.test(n)) {
    objection = "Our contract needs 90 days notice of any price change. Miss it and we renew on current terms.";
    mitigation = "Send the notice with the migration letter at least 120 days before renewal.";
    severity = "low";
  }
  if (c.priceProtectionCapPct != null) {
    objection += ` And our contract caps increases at ${c.priceProtectionCapPct}%.`;
    mitigation += ` Honor the ${c.priceProtectionCapPct}% cap and ramp the rest next term.`;
    if (severity === "low") severity = "medium";
  }
  return { accountId: c.id, accountName: c.name, objection, severity: i === 0 && severity === "medium" ? "high" : severity, mitigation };
}

function memo(m: PricingModel, s: ReturnType<typeof summarizeForAgent>, f: RedTeamFinding[], r: RolloutOutput) {
  const fmt = (v: number) => `$${v.toLocaleString("en-US")}`;
  return `## Decision requested
Approve **Relaya Flex**, a seat plus usage model, for new customers now and for renewals from next quarter.

## Why now
Customers are using AI agents to do work that used to need people, so they buy fewer seats. If we keep pricing per seat, revenue retention falls to **${s.statusQuoNrr}**. Our most successful customers shrink the fastest.

## Recommended model
| Tier | Platform fee per year | Agent runs included | Overage per 1k runs |
|---|---|---|---|
${m.tiers.map((t) => `| ${t.name} | ${fmt(t.platformFee)} | ${t.includedRuns.toLocaleString("en-US")} | ${fmt(t.overagePer1k)} |`).join("\n")}

Plus **${fmt(m.seatPrice)} per seat per year**, down from $720. Current discounts carry over.

## Impact on current customers
- Revenue retention: **${s.newModelNrr}**, against ${s.statusQuoNrr} on seats
- Year 1 ARR: **${usd(s.year1Arr)}**, from ${usd(s.currentArr)} today
- ${s.counts.saves} customers pay less, ${s.counts.flat} stay within 5%, ${s.counts.increase + s.counts.at_risk} pay more, all capped at 15%
- ARR at risk: **${usd(s.arrAtRisk)}**. ${s.cappedAccounts} customers reach the new price over two renewals.

## Top risks
${f.slice(0, 4).map((x) => `- **${x.accountName}** (${x.severity}): ${x.mitigation}`).join("\n")}

## Rollout
${r.waves.map((w) => `- **${w.name}** (${w.timing}): ${w.scope}`).join("\n")}

## What we are not doing
- **Pure usage pricing.** It wins pilots but loses enterprise budgets, because the bill is hard to predict.
- **Renegotiating discounts at the same time.** One change per renewal conversation.`;
}
