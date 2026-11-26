"use client";

import { useMemo, useState } from "react";
import { ACCOUNTS } from "@/lib/data";
import { AGENTS, type AgentId } from "@/lib/events";
import { baseChurn, simulate, type PricingModel } from "@/lib/pricing";

const usdM = (v: number) => `$${(v / 1e6).toFixed(1)}M`;
const signedM = (v: number) => `${v >= 0 ? "+" : "−"}$${Math.abs(v / 1e6).toFixed(1)}M`;

function Tip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className="tooltip" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, calc(-100% - 12px))" }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Trend: seats vs agent runs, indexed, history + projection         */
/* ------------------------------------------------------------------ */

const QUARTERS = ["Q4 24", "Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26", "Q3 26", "Q4 26", "Q1 27", "Q2 27", "Q3 27", "Q4 27"];
const TODAY = 8; // index of Q4 26

function trendSeries(seatChange: number, runGrowth: number) {
  // Before AI agents took off, seats grew ~2% a quarter and usage ~4%.
  // Rates blend toward today's annual rates, centered on Q1 26.
  const seatQ = Math.pow(1 + seatChange, 1 / 4) - 1;
  const runQ = Math.pow(1 + runGrowth, 1 / 4) - 1;
  const seats = [100];
  const runs = [100];
  for (let i = 1; i < QUARTERS.length; i++) {
    const w = 1 / (1 + Math.exp(-(i - 5) * 1.1));
    seats.push(seats[i - 1] * (1 + (0.02 * (1 - w) + seatQ * w)));
    runs.push(runs[i - 1] * (1 + (0.04 * (1 - w) + runQ * w)));
  }
  const s0 = seats[TODAY], r0 = runs[TODAY];
  return { seats: seats.map((v) => (v / s0) * 100), runs: runs.map((v) => (v / r0) * 100) };
}

export function TrendChart({ seatChange, runGrowth }: { seatChange: number; runGrowth: number }) {
  const { seats, runs } = useMemo(() => trendSeries(seatChange, runGrowth), [seatChange, runGrowth]);
  const [hi, setHi] = useState<number | null>(null);
  const W = 640, H = 280, L = 40, R = 70, T = 16, B = 30;
  const max = Math.ceil(Math.max(...runs, ...seats) / 25) * 25;
  const min = Math.floor(Math.min(...runs, ...seats) / 25) * 25;
  const x = (i: number) => L + (i / (QUARTERS.length - 1)) * (W - L - R);
  const y = (v: number) => T + ((max - v) / (max - min)) * (H - T - B);
  const path = (vals: number[], from: number, to: number) =>
    vals
      .slice(from, to + 1)
      .map((v, k) => `${k ? "L" : "M"}${x(from + k)},${y(v)}`)
      .join(" ");
  const series = [
    { name: "Agent runs", vals: runs, color: "var(--saves)" },
    { name: "Seats", vals: seats, color: "var(--pays-more)" },
  ];
  const ticks = [];
  for (let t = min; t <= max; t += 50) ticks.push(t);

  return (
    <div style={{ position: "relative" }}>
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}>
            <span className="swatch" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
        <span className="muted">Dashed = projection</span>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Seats and agent runs over time, indexed to today" onMouseLeave={() => setHi(null)}>
        <rect x={x(TODAY)} y={T} width={x(QUARTERS.length - 1) - x(TODAY)} height={H - T - B} fill="var(--surface-2)" />
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 100 ? "zero" : "grid"} x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {QUARTERS.map((q, i) =>
          i % 2 === 0 ? (
            <text key={q} x={x(i)} y={H - 10} textAnchor="middle">
              {q}
            </text>
          ) : null,
        )}
        <text x={x(TODAY) + 6} y={T + 12} className="lbl" style={{ fontSize: 11 }}>
          Today
        </text>
        {series.map((s) => (
          <g key={s.name}>
            <path d={path(s.vals, 0, TODAY)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            <path d={path(s.vals, TODAY, QUARTERS.length - 1)} fill="none" stroke={s.color} strokeWidth={2.5} strokeDasharray="5 5" strokeLinecap="round" />
            <text x={x(QUARTERS.length - 1) + 8} y={y(s.vals[QUARTERS.length - 1]) + 4} className="lbl" style={{ fill: s.color }}>
              {Math.round(s.vals[QUARTERS.length - 1])}
            </text>
          </g>
        ))}
        {hi != null && (
          <>
            <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke="var(--text-3)" strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.name} cx={x(hi)} cy={y(s.vals[hi])} r={5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </>
        )}
        {QUARTERS.map((q, i) => (
          <rect key={q} x={x(i) - (W - L - R) / (QUARTERS.length - 1) / 2} y={T} width={(W - L - R) / (QUARTERS.length - 1)} height={H - T - B} fill="transparent" onMouseEnter={() => setHi(i)} />
        ))}
      </svg>
      {hi != null && (
        <Tip x={(x(hi) / W) * 100} y={(Math.min(y(seats[hi]), y(runs[hi])) / H) * 100}>
          <b>
            {QUARTERS[hi]}
            {hi > TODAY ? " (projected)" : ""}
          </b>
          <div className="row">
            <span>Agent runs</span>
            <span>{Math.round(runs[hi])}</span>
          </div>
          <div className="row">
            <span>Seats</span>
            <span>{Math.round(seats[hi])}</span>
          </div>
        </Tip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Waterfall: where the swing between the two paths comes from      */
/* ------------------------------------------------------------------ */

export function bridge(model: PricingModel) {
  const sim = simulate(model);
  let seatsPath = 0, reprice = 0, growth = 0, churn = 0;
  for (const r of sim.accounts) {
    const a = ACCOUNTS.find((x) => x.id === r.id)!;
    const b = baseChurn(a);
    const g = r.newModelNextYear / (1 - r.churnProb) - r.year1Arr;
    seatsPath += r.statusQuoNextYear;
    reprice += (r.year1Arr - a.arr * (1 + a.seatTrend12m)) * (1 - b);
    growth += g * (1 - b);
    churn -= (r.year1Arr + g) * (r.churnProb - b);
  }
  return { seatsPath, reprice, growth, churn, usagePath: seatsPath + reprice + growth + churn };
}

export function Waterfall({ model }: { model: PricingModel }) {
  const d = useMemo(() => bridge(model), [model]);
  const [hi, setHi] = useState<number | null>(null);
  const steps = [
    { label: "Stay on seats", value: d.seatsPath, total: true, note: "Next year revenue if pricing stays per seat" },
    { label: "Price on usage", value: d.reprice, note: "Moving each contract to seats plus usage at renewal" },
    { label: "Usage growth", value: d.growth, note: "Agent runs keep growing after the switch" },
    { label: "Churn risk", value: d.churn, note: "Extra expected churn from price increases" },
    { label: "Move to usage", value: d.usagePath, total: true, note: "Next year revenue on the new model" },
  ];
  const W = 640, H = 280, L = 12, R = 12, T = 28, B = 40;
  const top = Math.max(d.usagePath, d.seatsPath + d.reprice + d.growth) * 1.08;
  const floor = 0;
  const y = (v: number) => T + ((top - v) / (top - floor)) * (H - T - B);
  const slot = (W - L - R) / steps.length;
  const bw = slot * 0.56;
  let run = 0;
  const bars = steps.map((s) => {
    let y0: number, y1: number;
    if (s.total) {
      y0 = floor;
      y1 = s.value;
      run = s.value;
    } else {
      y0 = run;
      y1 = run + s.value;
      run = y1;
    }
    return { ...s, lo: Math.min(y0, y1), hi: Math.max(y0, y1), end: run };
  });
  const color = (s: (typeof bars)[number]) =>
    s.total ? (s.label === "Stay on seats" ? "var(--neutral-mark)" : "var(--accent)") : s.value >= 0 ? "var(--saves)" : "var(--pays-more)";

  return (
    <div style={{ position: "relative" }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue bridge from seat pricing to usage pricing" onMouseLeave={() => setHi(null)}>
        <line className="grid" x1={L} x2={W - R} y1={H - B} y2={H - B} />
        {bars.map((s, i) => {
          const x = L + i * slot + (slot - bw) / 2;
          const yTop = y(s.hi), yBot = y(s.lo);
          return (
            <g key={s.label} onMouseEnter={() => setHi(i)}>
              <rect x={L + i * slot} y={T - 20} width={slot} height={H - T - B + 20} className="hit" />
              <rect x={x} y={yTop} width={bw} height={Math.max(1, yBot - yTop)} rx={4} fill={color(s)} />
              {i < bars.length - 1 && (
                <line x1={x + bw} x2={x + slot} y1={y(s.end)} y2={y(s.end)} stroke="var(--text-3)" strokeDasharray="3 3" />
              )}
              <text x={x + bw / 2} y={yTop - 8} textAnchor="middle" className="lbl">
                {s.total ? usdM(s.value) : signedM(s.value)}
              </text>
              <text x={x + bw / 2} y={H - B + 18} textAnchor="middle">
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hi != null && (
        <Tip x={((L + hi * slot + slot / 2) / W) * 100} y={(y(bars[hi].hi) / H) * 100 - 4}>
          <b>{bars[hi].label}</b>
          <div className="row" style={{ maxWidth: 240, whiteSpace: "normal" }}>
            <span>{bars[hi].note}</span>
          </div>
        </Tip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Retention by segment: seats vs model                             */
/* ------------------------------------------------------------------ */

export function SegmentChart({ model }: { model: PricingModel }) {
  const data = useMemo(() => {
    const sim = simulate(model);
    return (["Mid-Market", "Enterprise", "Strategic"] as const).map((seg) => {
      const rows = sim.accounts.filter((r) => r.segment === seg);
      const arr = rows.reduce((s, r) => s + r.oldArr, 0);
      return {
        seg,
        count: rows.length,
        seats: rows.reduce((s, r) => s + r.statusQuoNextYear, 0) / arr,
        usage: rows.reduce((s, r) => s + r.newModelNextYear, 0) / arr,
      };
    });
  }, [model]);
  const [hi, setHi] = useState<number | null>(null);
  const W = 420, H = 230, L = 36, R = 8, T = 22, B = 34;
  const max = Math.max(1.4, ...data.map((d) => d.usage));
  const y = (v: number) => T + ((max - v) / max) * (H - T - B);
  const slot = (W - L - R) / data.length;
  const bw = Math.min(40, slot / 3);
  const series = [
    { key: "seats" as const, name: "On seats", color: "var(--neutral-mark)" },
    { key: "usage" as const, name: "This model", color: "var(--accent)" },
  ];
  return (
    <div style={{ position: "relative" }}>
      <div className="legend">
        {series.map((s) => (
          <span key={s.key}>
            <span className="swatch" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue retention by segment" onMouseLeave={() => setHi(null)}>
        {[0, 0.5, 1, 1.5].filter((t) => t <= max).map((t) => (
          <g key={t}>
            <line className={t === 1 ? "zero" : "grid"} x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = L + i * slot + slot / 2;
          return (
            <g key={d.seg} onMouseEnter={() => setHi(i)}>
              <rect x={L + i * slot} y={T} width={slot} height={H - T - B} className="hit" />
              {series.map((s, k) => {
                const x = cx - bw - 1 + k * (bw + 2);
                const v = d[s.key];
                return (
                  <g key={s.key}>
                    <path d={`M${x},${y(0)} V${y(v) + 4} Q${x},${y(v)} ${x + 4},${y(v)} H${x + bw - 4} Q${x + bw},${y(v)} ${x + bw},${y(v) + 4} V${y(0)} Z`} fill={s.color} />
                    <text x={x + bw / 2} y={y(v) - 6} textAnchor="middle" className="lbl" style={{ fontSize: 11 }}>
                      {Math.round(v * 100)}%
                    </text>
                  </g>
                );
              })}
              <text x={cx} y={H - 12} textAnchor="middle">
                {d.seg}
              </text>
            </g>
          );
        })}
      </svg>
      {hi != null && (
        <Tip x={((L + hi * slot + slot / 2) / W) * 100} y={(y(data[hi].usage) / H) * 100}>
          <b>
            {data[hi].seg} ({data[hi].count} customers)
          </b>
          <div className="row">
            <span>Retention on seats</span>
            <span>{Math.round(data[hi].seats * 100)}%</span>
          </div>
          <div className="row">
            <span>Retention on this model</span>
            <span>{Math.round(data[hi].usage * 100)}%</span>
          </div>
        </Tip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Run timeline: when each agent worked (proves the parallel phases) */
/* ------------------------------------------------------------------ */

export interface Span {
  agent: AgentId;
  start: number;
  end: number | null;
}

export function RunTimeline({ spans, now }: { spans: Span[]; now: number }) {
  if (!spans.length) return null;
  const t0 = Math.min(...spans.map((s) => s.start));
  const tEnd = Math.max(now, ...spans.map((s) => s.end ?? now));
  const total = Math.max(1, tEnd - t0);
  const order = Object.keys(AGENTS) as AgentId[];
  return (
    <div className="timeline">
      {order.map((a) => {
        const s = spans.find((x) => x.agent === a);
        const left = s ? ((s.start - t0) / total) * 100 : 0;
        const width = s ? (((s.end ?? now) - s.start) / total) * 100 : 0;
        return (
          <div className="tl-row" key={a}>
            <div className="tl-name">{AGENTS[a].name}</div>
            <div className="tl-track">
              {s && (
                <div className={`tl-bar phase-${AGENTS[a].phase} ${s.end ? "" : "live"}`} style={{ left: `${left}%`, width: `${Math.max(width, 0.8)}%` }}>
                  <span>{(((s.end ?? now) - s.start) / 1000).toFixed(1)}s</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div className="tl-axis">
        <span>0s</span>
        <span>{(total / 1000).toFixed(0)}s</span>
      </div>
    </div>
  );
}
