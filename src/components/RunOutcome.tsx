"use client";

import { useEffect, useMemo, useRef } from "react";
import type { TimedEvent } from "./Lab";
import type {
  AgentId,
  CompetitiveOutput,
  PackagingOutput,
  RecommendationOutput,
  RedTeamOutput,
  RolloutOutput,
  ValueMetricOutput,
} from "@/lib/events";
import { simulate, STARTER_MODEL, type PricingModel } from "@/lib/pricing";

export type ResultTab = "simulator" | "research" | "redteam" | "rollout" | "memo";

const usd = (v: number) =>
  Math.abs(v) < 500 ? "$0" : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}k`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const runs = (n: number) => (n >= 1e6 ? `${n / 1e6}M` : `${n / 1e3}k`);

/** What the run has produced so far, derived from the event stream. */
function useRunState(events: TimedEvent[]) {
  return useMemo(() => {
    const out: Partial<Record<AgentId, unknown>> = {};
    let testing: { model: PricingModel; label: string } | null = null;
    let attempt = 0;
    let finished = false;
    for (const e of events) {
      if (e.type === "agent_done") {
        out[e.agent] = e.output;
        if (e.agent === "packaging_architect") testing = { model: (e.output as PackagingOutput).model, label: "First draft from the Packaging Architect" };
        if (e.agent === "migration_simulator") testing = { model: (e.output as RecommendationOutput).model, label: "Final model from the Migration Simulator" };
      }
      if (e.type === "tool_call" && e.tool === "simulate_migration") {
        const m = (e.input as { model?: PricingModel })?.model;
        if (m) {
          attempt += 1;
          testing = { model: m, label: `Migration Simulator, attempt ${attempt}: ${m.name}` };
        }
      }
      if (e.type === "run_done") finished = true;
    }
    return { out, testing, finished: finished && !!out.memo_writer };
  }, [events]);
}

interface Check {
  label: string;
  value: string;
  sub: string;
  ok: boolean | null; // null = nothing to judge yet
  target: string;
}

function scorecard(model: PricingModel | null): Check[] {
  // Status quo retention does not depend on the model, so any model gives it.
  const base = simulate(model ?? STARTER_MODEL);
  if (!model) {
    return [
      { label: "Revenue retention", value: pct(base.summary.statusQuoNrr), sub: "on seats today", ok: false, target: "Goal: above 100%" },
      { label: "Largest increase at renewal", value: "Not set", sub: "no new model yet", ok: null, target: "Goal: 15% or less" },
      { label: "Revenue at risk", value: "Not set", sub: "no new model yet", ok: null, target: "Goal: $0" },
      { label: "Contract price caps", value: "Not set", sub: "no new model yet", ok: null, target: "Goal: all honored" },
    ];
  }
  const s = base.summary;
  const maxInc = Math.max(...base.accounts.map((a) => a.deltaPct));
  const honored = model.migration.honorPriceProtection;
  return [
    { label: "Revenue retention", value: pct(s.newModelNrr), sub: `vs ${pct(s.statusQuoNrr)} on seats`, ok: s.newModelNrr > 1, target: "Goal: above 100%" },
    { label: "Largest increase at renewal", value: `+${pct(maxInc)}`, sub: `cap set at ${model.migration.year1IncreaseCapPct}%`, ok: maxInc <= 0.155, target: "Goal: 15% or less" },
    { label: "Revenue at risk", value: usd(s.arrAtRisk), sub: s.counts.at_risk === 1 ? "1 customer likely to push back" : `${s.counts.at_risk} customers likely to push back`, ok: s.arrAtRisk < 500, target: "Goal: $0" },
    { label: "Contract price caps", value: honored ? "Honored" : "Broken", sub: honored ? "every contract respected" : "some caps exceeded", ok: honored, target: "Goal: all honored" },
  ];
}

export function LiveScorecard({ events, running }: { events: TimedEvent[]; running: boolean }) {
  const { testing, finished } = useRunState(events);
  const checks = scorecard(testing?.model ?? null);
  const met = checks.filter((c) => c.ok).length;
  const label = testing ? testing.label : running ? "Agents are researching. A model appears once the design phase is done." : "Pricing today: seats only";
  return (
    <div className="scorecard">
      <div className="scorecard-head">
        <div>
          <span className="brief-label">Live scorecard</span>
          <span className="scorecard-model">{label}</span>
        </div>
        <span className={`goal-pill ${testing ? (met === 4 ? "ok" : "bad") : ""}`}>
          {testing ? `${met} of 4 goals met` : "Checked against the brief"}
          {finished && met === 4 ? " ✓" : ""}
        </span>
      </div>
      <div className="score-grid">
        {checks.map((c) => (
          <div className={`score ${c.ok === null ? "" : c.ok ? "ok" : "bad"}`} key={c.label}>
            <div className="kpi-label">{c.label}</div>
            <div className="score-value" key={c.value}>
              {c.value}
            </div>
            <div className="kpi-sub">{c.sub}</div>
            <div className="score-target">
              {c.ok === null ? "" : c.ok ? "✓ " : "✗ "}
              {c.target}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecommendationPanel({
  events,
  running,
  onOpen,
}: {
  events: TimedEvent[];
  running: boolean;
  onOpen: (tab: ResultTab) => void;
}) {
  const { out, finished } = useRunState(events);
  const ref = useRef<HTMLDivElement>(null);
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running && finished) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    wasRunning.current = running;
  }, [running, finished]);

  if (!events.length) return null;

  const vm = out.value_metric as ValueMetricOutput | undefined;
  const cs = out.competitor_scout as CompetitiveOutput | undefined;
  const pa = out.packaging_architect as PackagingOutput | undefined;
  const ms = out.migration_simulator as RecommendationOutput | undefined;
  const rt = out.renewal_redteam as RedTeamOutput | undefined;
  const ro = out.rollout_planner as RolloutOutput | undefined;
  const final = ms?.model ?? pa?.model;
  const sim = ms ? simulate(ms.model).summary : null;

  const rows: { lever: string; by: string; call?: string; detail?: string }[] = [
    { lever: "Value metric", by: "Value Metric Analyst", call: vm && `Charge for ${vm.metric.toLowerCase()}`, detail: vm && `Runner up: ${vm.runnerUp}` },
    {
      lever: "Price level",
      by: "Competitor Scout",
      call: final && ms ? `$${Math.min(...final.tiers.map((t) => t.overagePer1k))} to $${Math.max(...final.tiers.map((t) => t.overagePer1k))} per 1,000 extra runs` : cs && `Market range $${cs.anchorLowPer1k} to $${cs.anchorHighPer1k} per 1,000 runs`,
      detail: cs && `Market range $${cs.anchorLowPer1k} to $${cs.anchorHighPer1k}`,
    },
    {
      lever: "Packaging",
      by: "Packaging Architect",
      call: final && `3 tiers plus seats at $${final.seatPrice}`,
      detail: final && final.tiers.map((t) => `${t.name} ${usd(t.platformFee)} with ${runs(t.includedRuns)} runs`).join(" · "),
    },
    {
      lever: "Guardrails",
      by: "Migration Simulator",
      call: ms && `Cap year 1 increases at ${ms.model.migration.year1IncreaseCapPct}%`,
      detail: ms && `${ms.model.migration.honorPriceProtection ? "Every contract cap honored" : "Contract caps not honored"}, discounts kept, ${sim?.cappedAccounts} customers phased over two renewals`,
    },
    {
      lever: "Sales motion",
      by: "Rollout Planner, Renewal Red Team",
      call: ro && `${ro.waves.length} waves over 18 months`,
      detail: ro && `${ro.waves[0].name.replace(/^Wave 1: /, "Start with: ")}${rt ? ` · ${rt.findings.length} procurement objections prepared` : ""}`,
    },
  ];

  return (
    <div className="rec" ref={ref}>
      <div className="rec-head">
        <span className="brief-label">The recommendation, as the agents build it</span>
        <span className="hint">{rows.filter((r) => r.call).length} of 5 levers decided</span>
      </div>
      <div className="rec-rows">
        {rows.map((r) => (
          <div className={`rec-row ${r.call ? "set" : ""}`} key={r.lever}>
            <div className="rec-lever">{r.lever}</div>
            <div className="rec-call">
              {r.call ? (
                <>
                  <b>{r.call}</b>
                  {r.detail && <span>{r.detail}</span>}
                </>
              ) : (
                <span className="rec-wait">{running ? "Waiting on " : "Not decided: "}{r.by}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {finished && ms && sim && (
        <div className="verdict">
          <div className="verdict-main">
            <div className="verdict-kicker">Recommendation to the pricing committee</div>
            <h3>
              Move to {ms.model.name}: seats plus metered agent runs
            </h3>
            <p>
              Revenue retention goes from <b>{pct(sim.statusQuoNrr)}</b> on seats to <b>{pct(sim.newModelNrr)}</b>. No customer pays more than{" "}
              {ms.model.migration.year1IncreaseCapPct}% extra at renewal, every contract is honored, and no revenue is at risk.
            </p>
          </div>
          <div className="verdict-actions">
            <button className="btn btn-primary" onClick={() => onOpen("memo")}>
              Read the decision memo
            </button>
            <button className="btn" onClick={() => onOpen("simulator")}>
              Test it in the simulator
            </button>
            <button className="btn" onClick={() => onOpen("redteam")}>
              See customer objections
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
