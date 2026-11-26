"use client";

import { useId, useMemo, useState } from "react";
import { SegmentChart } from "./Charts";
import { simulate, type AccountResult, type PricingModel, type Status, type Tier } from "@/lib/pricing";

const usd = (v: number) =>
  Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : Math.abs(v) < 500 ? "$0" : `$${Math.round(v / 1000)}k`;
const share = (v: number) => `${(v * 100).toFixed(1)}%`;
const pct = (v: number, d = 0) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;

const STATUS_LABEL: Record<Status, string> = {
  saves: "Saves",
  flat: "Flat",
  increase: "Increase",
  at_risk: "At risk",
};

interface Props {
  model: PricingModel;
  setModel: (m: PricingModel) => void;
  recommended?: PricingModel;
  iterationLog?: string[];
  canRerun: boolean;
  onRerun: () => void;
}

export default function Simulator({ model, setModel, recommended, iterationLog, canRerun, onRerun }: Props) {
  const sim = useMemo(() => simulate(model), [model]);
  const s = sim.summary;
  const [filter, setFilter] = useState<Status | "all">("all");
  const edited = recommended && JSON.stringify(recommended) !== JSON.stringify(model);

  const setTier = (i: number, patch: Partial<Tier>) =>
    setModel({ ...model, name: editedName(model), tiers: model.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const setMig = (patch: Partial<PricingModel["migration"]>) =>
    setModel({ ...model, name: editedName(model), migration: { ...model.migration, ...patch } });

  const rows = sim.accounts
    .filter((r) => filter === "all" || r.status === filter)
    .sort((a, b) => b.deltaPct - a.deltaPct);

  return (
    <div>
      <div className="kpis">
        <Kpi label="Retention on seats" value={share(s.statusQuoNrr)} sub="if pricing stays per seat" />
        <Kpi
          label="Retention on this model"
          value={share(s.newModelNrr)}
          sub={`${pct(s.newModelNrr - s.statusQuoNrr, 1).replace("%", "")} points vs seats`}
        />
        <Kpi label="Year 1 ARR" value={usd(s.year1Arr)} sub={`${pct(s.year1Arr / s.currentArr - 1, 1)} vs ${usd(s.currentArr)} today`} />
        <Kpi
          label="ARR at risk"
          value={usd(s.arrAtRisk)}
          sub={`${s.counts.increase + s.counts.at_risk} pay more, ${s.counts.saves} pay less`}
        />
      </div>

      <div className="model-head">
        <div>
          <span className="model-name">{model.name}</span>{" "}
          <span className="hint">
            {recommended ? (edited ? "Your edits. The agent recommendation is saved." : "Recommended by the agents") : "Untuned starting point. Run the agents, or move the sliders."}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {edited && (
            <button className="btn" onClick={() => setModel(recommended!)}>
              Reset to recommendation
            </button>
          )}
          {canRerun && (
            <button className="btn" onClick={onRerun}>
              Send my model to the agents
            </button>
          )}
        </div>
      </div>

      <div className="editor">
        {model.tiers.map((t, i) => (
          <div className="tier" key={i}>
            <h4>{t.name}</h4>
            <Range label="Platform fee / yr" value={t.platformFee} fmt={usd} min={0} max={500000} step={2000} onChange={(v) => setTier(i, { platformFee: v })} />
            <Range
              label="Included runs / yr"
              value={t.includedRuns}
              fmt={(v) => `${(v / 1e6).toFixed(2)}M`}
              min={0}
              max={10_000_000}
              step={50_000}
              onChange={(v) => setTier(i, { includedRuns: v })}
            />
            <Range label="Overage / 1k runs" value={t.overagePer1k} fmt={(v) => `$${v}`} min={10} max={300} step={5} onChange={(v) => setTier(i, { overagePer1k: v })} />
          </div>
        ))}
        <div className="tier">
          <h4>Seats and guardrails</h4>
          <Range label="Seat price / yr" value={model.seatPrice} fmt={(v) => `$${v}`} min={0} max={720} step={10} onChange={(v) => setModel({ ...model, name: editedName(model), seatPrice: v })} />
          <Range
            label="Year 1 increase cap"
            value={model.migration.year1IncreaseCapPct}
            fmt={(v) => `+${v}%`}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setMig({ year1IncreaseCapPct: v })}
          />
          <label className="toggle">
            <input type="checkbox" checked={model.migration.honorPriceProtection} onChange={(e) => setMig({ honorPriceProtection: e.target.checked })} />
            Honor contract price caps
          </label>
          <label className="toggle">
            <input type="checkbox" checked={model.migration.keepDiscounts} onChange={(e) => setMig({ keepDiscounts: e.target.checked })} />
            Carry over discounts
          </label>
        </div>
      </div>

      <div className="chart-pair">
        <div>
          <DeltaChart accounts={sim.accounts} capPct={model.migration.year1IncreaseCapPct} />
        </div>
        <div>
          <p className="sub-title">Retention by segment</p>
          <SegmentChart model={model} />
        </div>
      </div>

      {iterationLog && iterationLog.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p className="sub-title">How the Migration Simulator tuned it</p>
          <ol className="tune-log">
            {iterationLog.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="table-tools">
        <p className="sub-title" style={{ margin: 0 }}>
          Every contract, repriced
        </p>
        <div className="seg" role="group" aria-label="Filter accounts">
          {(["all", "at_risk", "increase", "flat", "saves"] as const).map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? `All ${sim.accounts.length}` : `${STATUS_LABEL[f]} ${s.counts[f]}`}
            </button>
          ))}
        </div>
      </div>
      <div className="tbl-scroll">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Segment</th>
              <th>Tier</th>
              <th className="num">ARR today</th>
              <th className="num">Year 1 ARR</th>
              <th className="num">Change</th>
              <th className="num">Renews in</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.segment}</td>
                <td>{r.tier}</td>
                <td className="num">{usd(r.oldArr)}</td>
                <td className="num">{usd(r.year1Arr)}</td>
                <td className="num">
                  {pct(r.deltaPct, 1)}
                  {r.capped && <span className="hint" title={`Uncapped: ${pct(r.uncappedDeltaPct, 1)}`}> capped</span>}
                </td>
                <td className="num">{r.renewalMonths} mo</td>
                <td>
                  <span className={`tag ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function editedName(m: PricingModel) {
  return m.name.endsWith("(edited)") ? m.name : `${m.name} (edited)`;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

function Range(props: { label: string; value: number; fmt: (v: number) => string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {props.label} <b>{props.fmt(props.value)}</b>
      </label>
      <input id={id} type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </div>
  );
}

/** Diverging bar chart: year-1 price change per account, sorted. */
function DeltaChart({ accounts, capPct }: { accounts: AccountResult[]; capPct: number }) {
  const [hover, setHover] = useState<{ r: AccountResult; x: number; y: number } | null>(null);
  const data = [...accounts].sort((a, b) => b.deltaPct - a.deltaPct);
  const W = 820, H = 220, padL = 40, padR = 8, padT = 10, padB = 14;
  const maxUp = Math.max(0.2, ...data.map((d) => d.deltaPct), capPct / 100);
  const maxDown = Math.min(-0.2, ...data.map((d) => d.deltaPct));
  const y = (v: number) => padT + ((maxUp - v) / (maxUp - maxDown)) * (H - padT - padB);
  const slot = (W - padL - padR) / data.length;
  const bw = Math.max(4, slot - 2); // 2px surface gap between bars
  const ticks = [maxDown, 0, maxUp].map((t) => Math.round(t * 10) / 10).filter((t, i, a) => a.indexOf(t) === i);

  const color = (d: number) => (d <= -0.05 ? "var(--saves)" : d >= 0.05 ? "var(--pays-more)" : "var(--neutral-mark)");

  return (
    <div style={{ position: "relative" }}>
      <p className="sub-title">Year 1 price change for each customer</p>
      <div className="legend">
        <span>
          <span className="swatch" style={{ background: "var(--saves)" }} />
          Pays less
        </span>
        <span>
          <span className="swatch" style={{ background: "var(--neutral-mark)" }} />
          Within 5%
        </span>
        <span>
          <span className="swatch" style={{ background: "var(--pays-more)" }} />
          Pays more
        </span>
        <span>
          <span className="swatch" style={{ background: "none", borderTop: "2px dashed var(--text-3)", height: 0, width: 14 }} />
          Cap (+{capPct}%)
        </span>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Year 1 price change per customer" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end">
              {pct(t)}
            </text>
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={y(capPct / 100)} y2={y(capPct / 100)} stroke="var(--text-3)" strokeDasharray="4 3" strokeWidth={1} />
        {data.map((d, i) => {
          const x = padL + i * slot + 1;
          const y0 = y(0);
          const y1 = y(d.deltaPct);
          const h = Math.abs(y1 - y0);
          const r = Math.min(4, h / 2, bw / 2);
          const up = d.deltaPct >= 0;
          // 4px rounded data-end, square at the baseline
          const path = up
            ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y0} Z`
            : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 - r} V${y0} Z`;
          return (
            <g key={d.id}>
              <rect
                className="hit"
                x={padL + i * slot}
                y={padT}
                width={slot}
                height={H - padT - padB}
                onMouseEnter={() => setHover({ r: d, x: ((padL + i * slot + slot / 2) / W) * 100, y: (Math.min(y0, y1) / H) * 100 })}
              />
              <path d={h < 0.5 ? `M${x},${y0 - 0.5} h${bw} v1 h${-bw} Z` : path} fill={color(d.deltaPct)} pointerEvents="none" />
            </g>
          );
        })}
        <line className="zero" x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} />
      </svg>
      {hover && (
        <div
          className="tooltip"
          style={{
            left: `${Math.min(hover.x, 78)}%`,
            top: `calc(${hover.y}% + 40px)`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <b>{hover.r.name}</b>
          <div className="row">
            <span>{hover.r.segment}</span>
            <span>{hover.r.tier} tier</span>
          </div>
          <div className="row">
            <span>Today to year 1</span>
            <span>
              {usd(hover.r.oldArr)} → {usd(hover.r.year1Arr)}
            </span>
          </div>
          <div className="row">
            <span>Change</span>
            <span>
              {pct(hover.r.deltaPct, 1)}
              {hover.r.capped ? ` (uncapped ${pct(hover.r.uncappedDeltaPct, 0)})` : ""}
            </span>
          </div>
          <div className="row">
            <span>Renews in</span>
            <span>{hover.r.renewalMonths} months</span>
          </div>
        </div>
      )}
    </div>
  );
}
