"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "@/lib/events";
import { STARTER_MODEL, type PricingModel } from "@/lib/pricing";
import AgentBoard from "./AgentBoard";
import { Hero, Opportunity, Problem, SectionHead, Strategy, useCaseNumbers, WhyHard, WhyNow } from "./CaseStudy";
import { SourcesList } from "./Sources";
import UseCases from "./UseCases";
import Simulator from "./Simulator";
import { Memo, RedTeam, Research, Rollout } from "./Results";
import type { ResultTab } from "./RunOutcome";

const DEFAULT_GOAL =
  "Stop losing revenue as seat counts fall. No customer pays more than 15% extra at their next renewal, and every contract is honored.";

export type TimedEvent = RunEvent & { at: number };

type Tab = ResultTab;

export default function Lab() {
  const n = useCaseNumbers();
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [events, setEvents] = useState<TimedEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<Tab>("simulator");
  const [view, setView] = useState<"case" | "usecases">("case");
  const [model, setModel] = useState<PricingModel>(STARTER_MODEL);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: { live: boolean }) => setLiveAvailable(s.live))
      .catch(() => {});
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

  const outputs = useMemo(() => {
    const o: Partial<Record<AgentId, unknown>> = {};
    for (const e of events) if (e.type === "agent_done") o[e.agent] = e.output;
    return o;
  }, [events]);
  const recommended = outputs.migration_simulator as RecommendationOutput | undefined;
  const proposal = outputs.packaging_architect as PackagingOutput | undefined;

  useEffect(() => {
    if (recommended?.model) setModel(recommended.model);
    else if (proposal?.model) setModel(proposal.model);
  }, [recommended, proposal]);

  async function run(startModel?: PricingModel) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setEvents([]);
    setRunning(true);
    if (!startModel) setModel(STARTER_MODEL);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, goal, startModel }),
        signal: ac.signal,
      });
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        const batch: TimedEvent[] = [];
        const at = Date.now();
        for (const p of parts) {
          const line = p.trim();
          if (line.startsWith("data: ")) batch.push({ ...(JSON.parse(line.slice(6)) as RunEvent), at });
        }
        if (batch.length) setEvents((prev) => [...prev, ...batch]);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setEvents((prev) => [...prev, { type: "error", message: (err as Error).message, at: Date.now() }]);
    } finally {
      setRunning(false);
    }
  }

  const tabs: [Tab, string, boolean][] = [
    ["simulator", "Pricing simulator", !!recommended],
    ["research", "Research", !!outputs.contract_analyst],
    ["redteam", "Red team", !!outputs.renewal_redteam],
    ["rollout", "Rollout plan", !!outputs.rollout_planner],
    ["memo", "Decision memo", !!outputs.memo_writer],
  ];

  return (
    <>
      <nav className="nav">
        <div className="container nav-inner">
          <div className="nav-left">
            <div className="nav-brand">
              <span className="nav-mark" aria-hidden />
              <span className="nav-name">Pricing Strategy Agents</span>
            </div>
            <div className="view-tabs" role="tablist" aria-label="Page">
              {(
                [
                  ["case", "Case study"],
                  ["usecases", "Use cases"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="nav-links" style={{ visibility: view === "case" ? "visible" : "hidden" }}>
            <a href="#why-now">Why now</a>
            <a href="#problem">Problem</a>
            <a href="#opportunity">Opportunity</a>
            <a href="#strategy">Strategy</a>
            <a href="#agents">Agents</a>
            <a href="#results">Results</a>
          </div>
        </div>
      </nav>

      {view === "usecases" ? (
        <UseCases />
      ) : (
        <>
      <Hero n={n} onWatch={() => !running && run()} />
      <WhyNow />
      <Problem n={n} />
      <Opportunity n={n} />
      <WhyHard n={n} />
      <Strategy n={n} />

      <section className="section" id="agents">
        <div className="container">
          <SectionHead
            num="06"
            kicker="How it works"
            title="Eight agents, eight skills, four phases"
            lede="Each agent owns one lever and loads one skill: a short playbook written by the pricing team. Agents in the same phase work at the same time. All math runs in one shared pricing engine, so no agent can make up a number."
          />
          <AgentBoard
            events={events}
            running={running}
            mode={mode}
            setMode={setMode}
            liveAvailable={liveAvailable}
            goal={goal}
            setGoal={setGoal}
            onRun={() => run()}
            onStop={() => abortRef.current?.abort()}
            onOpen={(t) => {
              setTab(t);
              document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>
      </section>

      <section className="section" id="results">
        <div className="container">
          <SectionHead
            num="07"
            kicker="Results"
            title="The recommendation, and the proof behind it"
            lede="Move any lever to see how every contract changes. The agents' research, objections, rollout plan and memo are in the other tabs."
          />
          <div className="card">
            <div className="tabs" role="tablist">
              {tabs.map(([id, label, ready]) => (
                <button key={id} role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {label}
                  {ready && <span className="badge" aria-label="ready" />}
                </button>
              ))}
            </div>
            <div className="pad">
              {tab === "simulator" && (
                <Simulator
                  model={model}
                  setModel={setModel}
                  recommended={recommended?.model}
                  iterationLog={recommended?.iterationLog}
                  canRerun={mode === "live" && !running}
                  onRerun={() => run(model)}
                />
              )}
              {tab === "research" && (
                <Research
                  vm={outputs.value_metric as ValueMetricOutput | undefined}
                  cs={outputs.competitor_scout as CompetitiveOutput | undefined}
                  ca={outputs.contract_analyst as ContractOutput | undefined}
                />
              )}
              {tab === "redteam" && <RedTeam rt={outputs.renewal_redteam as RedTeamOutput | undefined} />}
              {tab === "rollout" && <Rollout ro={outputs.rollout_planner as RolloutOutput | undefined} />}
              {tab === "memo" && <Memo text={outputs.memo_writer as string | undefined} />}
            </div>
          </div>
        </div>
      </section>

        </>
      )}

      <SourcesList />
      <footer className="footer">
        <div className="container">Pricing Strategy Agents · a case study in B2B monetization with agents and skills.</div>
      </footer>
    </>
  );
}
