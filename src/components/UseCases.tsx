"use client";

import { Cite } from "./Sources";
import { SectionHead } from "./CaseStudy";

interface UseCase {
  title: string;
  who: string;
  situation: React.ReactNode;
  reuse: string[];
  newSkill: string;
  decision: string;
}

const CASES: UseCase[] = [
  {
    title: "Pricing a new AI agent product",
    who: "CPO, Pricing",
    situation: (
      <>
        A vendor launches an agent that does a full job, like triaging tickets or drafting contracts. Seats make no sense for it, and
        40% of enterprise apps are expected to embed task-specific agents by the end of 2026.
        <Cite n={6} />
      </>
    ),
    reuse: ["Value Metric Analyst", "Competitor Scout", "Packaging Architect", "Decision Memo Writer"],
    newSkill: "outcome-measurement",
    decision: "Charge per task, per outcome, or a hybrid, and at what price.",
  },
  {
    title: "Support software moving to per-resolution pricing",
    who: "CRO, CFO",
    situation: (
      <>
        A customer service platform wants to bill for tickets its AI resolves instead of agent seats. Gartner expects at least 40% of
        enterprise SaaS spend to move to usage, agent or outcome-based pricing by 2030.
        <Cite n={2} />
      </>
    ),
    reuse: ["Contract Analyst", "Migration Simulator", "Renewal Red Team", "Rollout Planner"],
    newSkill: "resolution-definition",
    decision: "What counts as a resolution, the price per resolution, and how current contracts move.",
  },
  {
    title: "Defending renewals against build-it-yourself",
    who: "CRO, Customer Success",
    situation: (
      <>
        Buyers now ask whether they can build the product with coding agents. 32% of companies already skipped a software purchase for
        that reason.
        <Cite n={3} />
      </>
    ),
    reuse: ["Value Metric Analyst", "Renewal Red Team", "Decision Memo Writer"],
    newSkill: "build-vs-buy-cost-model",
    decision: "Which renewals are at risk, and the price and proof of value that keeps them.",
  },
  {
    title: "Committed spend for a data or infrastructure platform",
    who: "CFO, RevOps",
    situation: (
      <>
        A consumption-priced platform wants more predictable revenue. Consumption pricing has more than doubled across software since
        2015, and buyers want commitments with flexibility.
        <Cite n={[4, 5]} />
      </>
    ),
    reuse: ["Packaging Architect", "Migration Simulator", "Rollout Planner"],
    newSkill: "commit-and-drawdown",
    decision: "Commit sizes, discounts for commitment, rollover rules and overage rates.",
  },
  {
    title: "Annual price increase program",
    who: "CFO, Pricing",
    situation: (
      <>
        A company needs a yearly price increase across thousands of contracts without a churn spike. Price caps, notice periods and
        discounts differ by customer.
      </>
    ),
    reuse: ["Contract Analyst", "Migration Simulator", "Renewal Red Team", "Rollout Planner"],
    newSkill: "value-based-uplift",
    decision: "Uplift by segment, which customers to exempt, and the timing of notices.",
  },
  {
    title: "Price book consolidation after an acquisition",
    who: "CEO, Pricing, Sales Ops",
    situation: (
      <>
        Two companies merge with overlapping products and different pricing models. Customers on both price books need one path
        forward.
      </>
    ),
    reuse: ["Packaging Architect", "Contract Analyst", "Migration Simulator", "Rollout Planner"],
    newSkill: "sku-mapping",
    decision: "One price book, a mapping from old SKUs to new tiers, and a migration plan.",
  },
];

export default function UseCases() {
  return (
    <>
      <header className="hero">
        <div className="container">
          <p className="eyebrow">Use cases</p>
          <h1>
            One agent pattern, <em>many pricing decisions</em>
          </h1>
          <p className="hero-sub">
            The case study is one example. The same set of agents, skills and pricing engine fits any B2B pricing decision that touches
            existing contracts. Swap the data and a skill or two, and the rest carries over.
          </p>
        </div>
      </header>

      <section className="section">
        <div className="container">
          <SectionHead num="01" kicker="How it transfers" title="Keep the engine, change the inputs" />
          <div className="card pattern">
            <div>
              <span className="swap change">Change</span>
              <h3>Customer data</h3>
              <p>Contracts, usage and renewal dates from your CRM and billing system.</p>
            </div>
            <div>
              <span className="swap change">Change</span>
              <h3>Skills</h3>
              <p>Short playbooks in plain text. Edit one or add one for the new decision.</p>
            </div>
            <div>
              <span className="swap keep">Keep</span>
              <h3>Agents and phases</h3>
              <p>Research, design, stress test, decide. The same orchestration in code.</p>
            </div>
            <div>
              <span className="swap keep">Keep</span>
              <h3>Pricing engine</h3>
              <p>One place where all math runs, so every agent and every chart agrees.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead num="02" kicker="Where it applies" title="Six decisions this pattern can run" />
          <div className="uc-grid">
            {CASES.map((c) => (
              <div className="card uc" key={c.title}>
                <div className="uc-top">
                  <h3>{c.title}</h3>
                  <span className="uc-who">{c.who}</span>
                </div>
                <div className="uc-row">
                  <span className="label">Situation</span>
                  <p>{c.situation}</p>
                </div>
                <div className="uc-row">
                  <span className="label">Agents reused</span>
                  <div className="chips">
                    {c.reuse.map((r) => (
                      <span className="chip agent" key={r}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="uc-row">
                  <span className="label">New skill</span>
                  <div className="chips">
                    <span className="chip new">{c.newSkill}</span>
                  </div>
                </div>
                <div className="uc-out">
                  <b>Decision it produces:</b> {c.decision}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
