"use client";

import { useEffect, useMemo, useState } from "react";
import { RunTimeline, type Span } from "./Charts";
import type { TimedEvent } from "./Lab";
import {
  AGENT_ORDER,
  AGENTS,
  PHASES,
  describeTool,
  plain,
  type AgentId,
  type CompetitiveOutput,
  type ContractOutput,
  type PackagingOutput,
  type RecommendationOutput,
  type RedTeamOutput,
  type RolloutOutput,
  type ValueMetricOutput,
} from "@/lib/events";
import { simulate } from "@/lib/pricing";

type Status = "idle" | "running" | "done" | "error";
interface AgentState {
  status: Status;
  activity: string;
  skillLoaded: boolean;
  output?: unknown;
}

function resultLine(agent: AgentId, o: unknown): string {
  switch (agent) {
    case "value_metric":
      return `Charge for ${(o as ValueMetricOutput).metric.toLowerCase()}`;
    case "competitor_scout": {
      const c = o as CompetitiveOutput;
      return `Market range $${c.anchorLowPer1k} to $${c.anchorHighPer1k} per 1k runs`;
    }
    case "contract_analyst":
      return `${(o as ContractOutput).guardrails.length} guardrails set`;
    case "packaging_architect":
      return `3 tiers, seats at $${(o as PackagingOutput).model.seatPrice}`;
    case "migration_simulator": {
      const s = simulate((o as RecommendationOutput).model).summary;
      return `Retention ${Math.round(s.newModelNrr * 100)}% vs ${Math.round(s.statusQuoNrr * 100)}% on seats`;
    }
    case "renewal_redteam": {
      const f = (o as RedTeamOutput).findings;
      return `${f.length} objections, ${f.filter((x) => x.severity === "high").length} high risk`;
    }
    case "rollout_planner":
      return `${(o as RolloutOutput).waves.length} waves over 18 months`;
    case "memo_writer":
      return "Memo ready for the committee";
  }
}

const trim = (s: string, n = 110) => (s.length > n ? `${s.slice(0, n).trimEnd()}...` : s);

interface Props {
  events: TimedEvent[];
  running: boolean;
  mode: "demo" | "live";
  setMode: (m: "demo" | "live") => void;
  liveAvailable: boolean;
  goal: string;
  setGoal: (g: string) => void;
  onRun: () => void;
  onStop: () => void;
}

export default function AgentBoard({ events, running, mode, setMode, liveAvailable, goal, setGoal, onRun, onStop }: Props) {
  const { states, phase } = useMemo(() => {
    const s = Object.fromEntries(AGENT_ORDER.map((a) => [a, { status: "idle", activity: "Waiting", skillLoaded: false }])) as Record<
      AgentId,
      AgentState
    >;
    const sims: Partial<Record<AgentId, number>> = {};
    let ph = 0;
    for (const e of events) {
      if (e.type === "phase_start") ph = e.phase;
      if (!("agent" in e) || !e.agent) continue;
      const st = s[e.agent];
      if (e.type === "agent_start") {
        st.status = "running";
        st.activity = "Starting";
      } else if (e.type === "skill_loaded") {
        st.skillLoaded = true;
        st.activity = "Skill loaded";
      } else if (e.type === "tool_call") {
        if (e.tool === "simulate_migration") sims[e.agent] = (sims[e.agent] ?? 0) + 1;
        st.activity = describeTool(e.tool, e.input, sims[e.agent] ?? 0);
      } else if (e.type === "note") {
        st.activity = trim(plain(e.text));
      } else if (e.type === "agent_done") {
        st.status = "done";
        st.output = e.output;
        st.activity = resultLine(e.agent, e.output);
      } else if (e.type === "error") {
        st.status = "error";
        st.activity = e.message;
      }
    }
    if (!running) for (const a of AGENT_ORDER) if (s[a].status === "running") s[a].status = "error";
    return { states: s, phase: ph };
  }, [events, running]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running]);
  const spans = useMemo(() => {
    const out: Span[] = [];
    for (const e of events) {
      if (e.type === "agent_start") out.push({ agent: e.agent, start: e.at, end: null });
      if (e.type === "agent_done") {
        const sp = out.find((x) => x.agent === e.agent);
        if (sp) sp.end = e.at;
      }
    }
    return out;
  }, [events]);
  const lastAt = events.length ? events[events.length - 1].at : 0;

  const done = AGENT_ORDER.filter((a) => states[a].status === "done").length;
  const logRows = events.filter((e) => e.type !== "tool_result" && e.type !== "phase_start");

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="board-bar">
        <div className="brief">
          <div className="brief-label">Brief to the agents</div>
          {mode === "live" ? (
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} disabled={running} aria-label="Brief to the agents" />
          ) : (
            <p className="brief-text">{goal}</p>
          )}
        </div>
        <div className="controls">
          {liveAvailable && (
            <div className="seg" role="group" aria-label="Mode">
              <button aria-pressed={mode === "demo"} onClick={() => setMode("demo")} disabled={running}>
                Replay
              </button>
              <button aria-pressed={mode === "live"} onClick={() => setMode("live")} disabled={running}>
                Live
              </button>
            </div>
          )}
          {running ? (
            <button className="btn" onClick={onStop}>
              <span className="spinner" />
              {done} of 8 done · Stop
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onRun}>
              {events.length ? "Run again" : "Run the agents"}
            </button>
          )}
        </div>
      </div>

      <div className="phases">
        {PHASES.map((p) => (
          <div key={p.n} className={`phase ${running && phase === p.n ? "active" : ""}`}>
            <div className="phase-head">
              <div className="phase-name">
                <span>{p.n}</span>
                {p.name}
              </div>
              <div className="phase-note">{p.note}</div>
            </div>
            <div className="agent-cards">
              {AGENT_ORDER.filter((a) => AGENTS[a].phase === p.n).map((a) => {
                const st = states[a];
                const meta = AGENTS[a];
                return (
                  <div key={a} className={`agent ${st.status}`}>
                    <div className="agent-top">
                      <div className="agent-name">{meta.name}</div>
                      <span className="agent-dot" aria-label={st.status} />
                    </div>
                    <div className="agent-job">{meta.job}</div>
                    <span className={`skill-chip ${st.skillLoaded ? "loaded" : ""}`} title="Skill this agent loads">
                      skill · {meta.skill}
                    </span>
                    <div className="agent-activity">
                      {st.status === "running" && <span className="spinner" />}
                      {st.status === "done" && "✓ "}
                      {st.activity}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {spans.length > 0 && (
        <div className="timeline-wrap">
          <div className="timeline-head">
            <span className="brief-label">Run timeline</span>
            <span className="hint">Bars that overlap ran at the same time</span>
          </div>
          <RunTimeline spans={spans} now={running ? now : lastAt} />
        </div>
      )}

      <details className="log">
        <summary>Detailed log{logRows.length ? ` (${logRows.length} steps)` : ""}</summary>
        <div className="log-body">
          {logRows.length === 0 && <p className="empty">Run the agents to see each step.</p>}
          {logRows.map((e, i) => {
            const who = "agent" in e && e.agent ? AGENTS[e.agent].name : "Orchestrator";
            let what = "";
            if (e.type === "run_start") what = "Run started";
            else if (e.type === "agent_start") what = `Started: ${e.task}`;
            else if (e.type === "skill_loaded") what = `Loaded skill ${e.skill}`;
            else if (e.type === "tool_call") what = e.tool === "load_skill" ? "" : describeTool(e.tool, e.input, 0).replace(" (attempt 0)", "");
            else if (e.type === "thinking") what = `Thinking: ${plain(e.text)}`;
            else if (e.type === "note") what = plain(e.text);
            else if (e.type === "agent_done") what = `Done: ${resultLine(e.agent, e.output)}`;
            else if (e.type === "error") what = `Error: ${e.message}`;
            else if (e.type === "run_done") what = e.tokens ? `Run complete. ${e.tokens.input.toLocaleString()} input and ${e.tokens.output.toLocaleString()} output tokens.` : "Run complete";
            if (!what) return null;
            return (
              <div className="log-row" key={i}>
                <span className="log-who">{who}</span>
                <span className="log-what">{what}</span>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
