"use client";

import { useMemo, useState } from "react";
import { adoptionVsSeats, baseOverview, contractLandscape, renewalCalendar, valueMetricAnalysis } from "@/lib/analytics";
import { REFERENCE_MODEL, simulate, STARTER_MODEL } from "@/lib/pricing";
import { TrendChart, Waterfall } from "./Charts";
import { Cite, SourceTag } from "./Sources";

const usdM = (v: number) => (Math.abs(v) < 5e4 ? "$0" : `$${(v / 1e6).toFixed(1)}M`);
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function useCaseNumbers() {
  return useMemo(() => {
    const o = baseOverview();
    const vma = valueMetricAnalysis();
    const ref = simulate(REFERENCE_MODEL).summary;
    const naiveModel = { ...STARTER_MODEL, migration: { year1IncreaseCapPct: 100, honorPriceProtection: false, keepDiscounts: true } };
    const naive = simulate(naiveModel);
    const land = contractLandscape();
    const cal = renewalCalendar(REFERENCE_MODEL);
    const seatsNext = o.totalArr * ref.statusQuoNrr;
    const usageNext = o.totalArr * ref.newModelNrr;
    const runs = vma.metrics.find((m) => m.metric === "agentRunsPerSeat")!;
    const seats = vma.metrics.find((m) => m.metric === "seats")!;
    return {
      arr: o.totalArr,
      accounts: o.accounts,
      seatChange: o.seatChangeAtRenewal,
      runGrowth: o.agentRunGrowth,
      seatsNrr: ref.statusQuoNrr,
      usageNrr: ref.newModelNrr,
      seatsNext,
      usageNext,
      swing: usageNext - seatsNext,
      atRisk: ref.arrAtRisk,
      tierMix: ref.tierMix,
      capped: land.withPriceProtection,
      cappedArr: land.priceProtectionArr,
      naiveMax: Math.max(...naive.accounts.map((a) => a.deltaPct)),
      naiveOver15: naive.accounts.filter((a) => a.deltaPct > 0.15).length,
      rRuns: runs.corrWithNetExpansion,
      rSeats: seats.corrWithNetExpansion,
      wave1: cal[0],
    };
  }, []);
}

type Nums = ReturnType<typeof useCaseNumbers>;

export function SectionHead({ num, kicker, title, lede }: { num: string; kicker: string; title: string; lede?: React.ReactNode }) {
  return (
    <div className="section-head">
      <p className="section-kicker">
        <span className="k-num">{num}</span>
        {kicker}
      </p>
      <h2>{title}</h2>
      {lede && <p className="section-lede">{lede}</p>}
    </div>
  );
}

export function Hero({ n, onWatch }: { n: Nums; onWatch?: () => void }) {
  return (
    <header className="hero">
      <div className="container">
        <p className="eyebrow">Case study · B2B monetization</p>
        <h1>
          Moving an enterprise SaaS business from seats to usage, <em>without losing customers</em>
        </h1>
        <p className="hero-sub">
          AI is cutting the seats this company charges for. A team of agents, each with its own skill, designed and stress tested new
          pricing on every customer contract.
        </p>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-value num">
              {pct(n.seatsNrr)} → <span>{pct(n.usageNrr)}</span>
            </div>
            <div className="hero-stat-label">Revenue retention, seats vs new model</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value num">
              <span>+{usdM(n.swing)}</span>
            </div>
            <div className="hero-stat-label">Next year revenue vs staying on seats</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value num">{usdM(n.atRisk)}</div>
            <div className="hero-stat-label">Revenue at risk at renewal</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-value num">8 agents</div>
            <div className="hero-stat-label">8 skills, 4 phases, 1 shared pricing engine</div>
          </div>
        </div>
        <div className="hero-cta">
          <a className="btn btn-gold" href="#agents" onClick={onWatch}>
            Watch the agents work
          </a>
          <a className="btn btn-ghost-dark" href="#why-now">
            Read the case
          </a>
        </div>
      </div>
    </header>
  );
}

export function WhyNow() {
  const cards = [
    { v: "$234B", t: "of enterprise app spend is exposed to agentic AI by 2030, about 20% of all enterprise SaaS spend.", s: 1 },
    { v: "40%", t: "of enterprise SaaS spend will shift to usage, agent or outcome-based pricing by 2030 (Gartner).", s: 2 },
    { v: "57%", t: "of hypergrowth SaaS companies already use hybrid pricing, per a Stripe survey of 2,000 businesses.", s: 5 },
    { v: "32%", t: "of companies skipped buying software they could build themselves with agentic coding tools.", s: 3 },
  ];
  return (
    <section className="section" id="why-now">
      <div className="container">
        <SectionHead
          num="01"
          kicker="Why now"
          title="The market is moving off the seat"
          lede={
            <>
              AI agents now do work that used to need a person per license. 40% of large companies are scaling agents, up from 27% a year
              earlier
              <Cite n={3} />. Analysts expect pricing to follow the work, not the headcount.
            </>
          }
        />
        <div className="grid-4">
          {cards.map((c) => (
            <div className="card market-card" key={c.v}>
              <div className="stat-value num">{c.v}</div>
              <p>{c.t}</p>
              <SourceTag n={c.s} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Problem({ n }: { n: Nums }) {
  return (
    <section className="section" id="problem">
      <div className="container">
        <SectionHead
          num="02"
          kicker="The problem"
          title="AI is cutting the seats we charge for"
          lede={
            <>
              Relaya sells an AI workflow platform at $720 per seat to {n.accounts} enterprise customers ({usdM(n.arr)} ARR). Its agents
              do more of the work each quarter, so the customers who get the most value buy fewer seats. Gartner calls this breaking
              &ldquo;the link between user growth and revenue growth.&rdquo;
              <Cite n={1} />
            </>
          }
        />
        <div className="stats-row">
          <div className="card stat">
            <div className="stat-value num bad">{pct(n.seatChange)}</div>
            <div className="stat-label">Seats at next renewal, weighted by revenue</div>
          </div>
          <div className="card stat">
            <div className="stat-value num good">+{pct(n.runGrowth)}</div>
            <div className="stat-label">Agent runs per year</div>
          </div>
          <div className="card stat">
            <div className="stat-value num bad">{pct(n.seatsNrr)}</div>
            <div className="stat-label">Revenue retention if pricing stays per seat</div>
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="card pad">
            <p className="chart-title">Usage is climbing while seats fall</p>
            <p className="chart-sub">All customers, indexed to today = 100</p>
            <TrendChart seatChange={n.seatChange} runGrowth={n.runGrowth} />
          </div>
          <div className="card pad">
            <p className="chart-title">The more a customer uses AI, the more seats they cut</p>
            <p className="chart-sub">Each dot is a customer, sized by revenue</p>
            <ScatterChart />
          </div>
        </div>
      </div>
    </section>
  );
}

export function Opportunity({ n }: { n: Nums }) {
  return (
    <section className="section" id="opportunity">
      <div className="container">
        <SectionHead
          num="03"
          kicker="Opportunity sizing"
          title={`A ${usdM(n.swing)} swing on a ${usdM(n.arr)} business`}
          lede="Same customers, same year. One path keeps charging per seat, the other moves to seats plus usage. Both include seat cuts and expected churn."
        />
        <div className="split-wide">
          <div className="card pad">
            <p className="chart-title">Where the {usdM(n.swing)} comes from</p>
            <p className="chart-sub">Next year revenue from today&apos;s {n.accounts} customers. Hover a bar for detail.</p>
            <Waterfall model={REFERENCE_MODEL} />
          </div>
          <div className="stat-stack">
            <div className="card stat">
              <div className="stat-value num bad">−{usdM(n.arr - n.seatsNext)}</div>
              <div className="stat-label">Lost next year if nothing changes ({usdM(n.arr)} today)</div>
            </div>
            <div className="card stat">
              <div className="stat-value num good">+{usdM(n.usageNext - n.arr)}</div>
              <div className="stat-label">Gained with the new model, from the same customers</div>
            </div>
            <div className="callout">
              <b>At scale:</b> a $100M ARR company with the same mix would see about <b>${Math.round((n.swing / n.arr) * 100)}M a year</b>{" "}
              of difference. Across the market, Gartner puts the exposed spend at $234B by 2030.
              <Cite n={1} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function WhyHard({ n }: { n: Nums }) {
  const items = [
    {
      icon: "doc",
      title: "Contracts limit price changes",
      fig: `${n.capped} of ${n.accounts}`,
      text: <>contracts cap renewal increases at 7%, covering {usdM(n.cappedArr)} of revenue.</>,
    },
    {
      icon: "wallet",
      title: "Buyers need a predictable bill",
      fig: "Committed spend",
      text: (
        <>
          Most enterprise buyers prefer the predictability of hybrid and committed spending over pure usage.
          <Cite n={5} />
        </>
      ),
    },
    {
      icon: "alert",
      title: "A bad price hits the best customers",
      fig: `+${pct(n.naiveMax)}`,
      text: <>is the largest increase an untuned model gives the heaviest AI users, the accounts we can least afford to lose.</>,
    },
  ];
  return (
    <section className="section" id="why">
      <div className="container">
        <SectionHead num="04" kicker="Why it is hard" title="Changing the price is easy. Keeping the customers is not." />
        <div className="grid-3">
          {items.map((it) => (
            <div className="card pad hard" key={it.title}>
              <div className="icon-badge">
                <Icon name={it.icon} />
              </div>
              <h3>{it.title}</h3>
              <div className="fig num">{it.fig}</div>
              <p>{it.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Strategy({ n }: { n: Nums }) {
  const tiers = Object.entries(n.tierMix)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
  const levers = [
    {
      name: "Value metric",
      q: "What do customers pay for?",
      what: "The unit the bill is based on.",
      does: "Ties revenue to the value customers get, so revenue grows when they succeed instead of when they hire.",
      call: "Agent runs",
      callNote: "One finished agent task. Metered and visible to customers today.",
      impact: `${n.rRuns} correlation`,
      impactNote: `with net expansion, vs ${n.rSeats} for seats`,
      owner: "Value Metric Analyst",
      skill: "value-metric-selection",
    },
    {
      name: "Price level",
      q: "Where should the price sit?",
      what: "The rate per unit, set against what buyers can compare.",
      does: "Keeps deals moving by staying inside the range procurement already accepts.",
      call: "$90 to $150 per 1k runs",
      callNote: "Market range is $80 to $150. We sell predictability, not the lowest rate.",
      impact: "−25%",
      impactNote: "overage cut that kept increases under the cap",
      owner: "Competitor Scout",
      skill: "competitive-pricing-teardown",
    },
    {
      name: "Packaging",
      q: "How do tiers fit each customer?",
      what: "How seats, a platform fee and usage combine into tiers.",
      does: "Gives buyers a fixed budget line with usage included, plus a clear path to upgrade.",
      call: "3 tiers plus $600 seats",
      callNote: "Platform fee includes 200k, 1M or 5M runs. Overage drops by tier.",
      impact: `${Object.keys(n.tierMix).length} tiers used`,
      impactNote: tiers,
      owner: "Packaging Architect",
      skill: "usage-based-packaging",
      cite: 5,
    },
    {
      name: "Guardrails",
      q: "How do we move customers safely?",
      what: "Rules that limit how much any one customer's price can change.",
      does: "Protects renewals and trust while customers move to the new model.",
      call: "15% cap, honor every contract",
      callNote: "Keep negotiated discounts. Ramp the rest over two renewals.",
      impact: `+${pct(n.naiveMax)} → +15%`,
      impactNote: `largest increase. ${n.naiveOver15} customers protected.`,
      owner: "Contract Analyst, Migration Simulator",
      skill: "migration-and-grandfathering",
    },
    {
      name: "Sales motion",
      q: "Who moves when, and how?",
      what: "The order customers move in and what sales needs to sell it.",
      does: "Puts low-risk renewals first so the team learns before large accounts renew.",
      call: "3 waves over 18 months",
      callNote: "120 day notice. Executive calls for increases above 10%.",
      impact: `${n.wave1.renewals} renewals`,
      impactNote: `in wave 1 (${usdM(n.wave1.arr)} ARR) to prove the pitch`,
      owner: "Renewal Red Team, Rollout Planner",
      skill: "rollout-planning",
    },
  ];
  return (
    <section className="section" id="strategy">
      <div className="container">
        <SectionHead
          num="05"
          kicker="Strategy"
          title="Five levers, pulled together"
          lede={
            <>
              A pricing change works only when all five levers move at once. The recommended model is a hybrid, which BCG finds is the
              leading approach today
              <Cite n={5} />. Each lever is owned by an agent with a skill that encodes how a pricing team makes that call.
            </>
          }
        />
        <div className="card lever-table">
          <div className="lever-row head">
            <div>Lever</div>
            <div>What it is</div>
            <div>What it does</div>
            <div>Our call</div>
            <div>Effect in this case</div>
          </div>
          {levers.map((l, i) => (
            <div className="lever-row" key={l.name}>
              <div className="lever-name">
                <span className="lever-badge">{i + 1}</span>
                <div>
                  <b>{l.name}</b>
                  <i>{l.q}</i>
                  <div className="lever-owner">
                    {l.owner}
                    <br />
                    <code>{l.skill}</code>
                  </div>
                </div>
              </div>
              <div className="lever-cell">
                <span className="mobile-label">What it is</span>
                {l.what}
              </div>
              <div className="lever-cell">
                <span className="mobile-label">What it does</span>
                {l.does}
              </div>
              <div className="lever-call">
                <span className="mobile-label">Our call</span>
                <b>{l.call}</b>
                {l.callNote}
                {l.cite && <Cite n={l.cite} />}
              </div>
              <div className="lever-impact">
                <span className="mobile-label">Effect in this case</span>
                <span className="num">{l.impact}</span>
                {l.impactNote}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Icon({ name }: { name: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      {name === "doc" && (
        <>
          <path {...p} d="M7 3h7l5 5v13H7z" />
          <path {...p} d="M14 3v5h5M10 13h6M10 17h6" />
        </>
      )}
      {name === "wallet" && (
        <>
          <rect {...p} x="3" y="6" width="18" height="13" rx="2" />
          <path {...p} d="M16 12.5h2M3 9h18" />
        </>
      )}
      {name === "alert" && (
        <>
          <path {...p} d="M12 3 2.5 20h19z" />
          <path {...p} d="M12 10v4M12 17.2v.1" />
        </>
      )}
    </svg>
  );
}

/** AI adoption (x) vs seat change at renewal (y), one dot per customer. */
function ScatterChart() {
  const pts = useMemo(() => adoptionVsSeats(), []);
  const [hover, setHover] = useState<(typeof pts)[number] | null>(null);
  const W = 640, H = 300, L = 44, R = 12, T = 16, B = 36;
  const yMin = -0.4, yMax = 0.15;
  const x = (v: number) => L + v * (W - L - R);
  const y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B);
  const r = (arr: number) => 4 + Math.sqrt(arr / 2.2e6) * 9;
  return (
    <div style={{ position: "relative" }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="AI adoption against seat change for each customer" onMouseLeave={() => setHover(null)}>
        {[-0.4, -0.3, -0.2, -0.1, 0, 0.1].map((t) => (
          <g key={t}>
            <line className={t === 0 ? "zero" : "grid"} x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end">
              {t > 0 ? "+" : ""}
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text key={t} x={x(t)} y={H - 16} textAnchor="middle">
            {Math.round(t * 100)}%
          </text>
        ))}
        <text x={(L + W - R) / 2} y={H - 1} textAnchor="middle">
          Share of work done by agents
        </text>
        <text x={L} y={T - 4}>
          Seat change at renewal
        </text>
        {pts.map((p) => (
          <circle
            key={p.name}
            cx={x(p.adoption)}
            cy={y(p.seatChange)}
            r={r(p.arr)}
            fill="var(--saves)"
            fillOpacity={hover && hover.name !== p.name ? 0.25 : 0.7}
            stroke="var(--surface)"
            strokeWidth={2}
            onMouseEnter={() => setHover(p)}
          />
        ))}
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: `${(x(hover.adoption) / W) * 100}%`, top: `${(y(hover.seatChange) / H) * 100}%`, transform: "translate(-50%, calc(-100% - 14px))" }}>
          <b>{hover.name}</b>
          <div className="row">
            <span>Work done by agents</span>
            <span>{pct(hover.adoption)}</span>
          </div>
          <div className="row">
            <span>Seat change</span>
            <span>
              {hover.seatChange > 0 ? "+" : ""}
              {pct(hover.seatChange)}
            </span>
          </div>
          <div className="row">
            <span>Agent run growth</span>
            <span>+{pct(hover.runGrowth)}</span>
          </div>
          <div className="row">
            <span>ARR</span>
            <span>{usdM(hover.arr)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
