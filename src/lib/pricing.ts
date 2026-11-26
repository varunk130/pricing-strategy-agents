// Isomorphic pricing engine: used by agents (as a tool) and by the browser
// simulator, so the numbers on screen are exactly what the agents saw.
import { ACCOUNTS, CONTRACTS, type Account } from "./data";

export interface Tier {
  name: string;
  platformFee: number; // annual platform fee, USD
  includedRuns: number; // agent runs per year included in the fee
  overagePer1k: number; // USD per 1,000 runs above the included amount
}

export interface PricingModel {
  name: string;
  tiers: Tier[];
  seatPrice: number; // annual list price per human seat (seats counted at renewal)
  migration: {
    year1IncreaseCapPct: number; // max year-1 uplift vs. current ARR
    honorPriceProtection: boolean; // respect contractual renewal caps
    keepDiscounts: boolean; // carry current negotiated discount onto new list
  };
}

export type Status = "saves" | "flat" | "increase" | "at_risk";

export interface AccountResult {
  id: string;
  name: string;
  segment: Account["segment"];
  tier: string;
  oldArr: number;
  newListArr: number;
  year1Arr: number;
  deltaPct: number; // year-1 vs current
  uncappedDeltaPct: number;
  capped: boolean;
  statusQuoNextYear: number; // seat model after seat compression, churn-weighted
  newModelNextYear: number; // usage model incl. usage growth, churn-weighted
  churnProb: number;
  status: Status;
  renewalMonths: number;
}

export interface SimulationSummary {
  modelName: string;
  currentArr: number;
  year1Arr: number;
  statusQuoNrr: number;
  newModelNrr: number;
  arrAtRisk: number;
  counts: Record<Status, number>;
  tierMix: Record<string, number>;
  cappedAccounts: number;
}

export interface Simulation {
  summary: SimulationSummary;
  accounts: AccountResult[];
}

const PRICE_ELASTICITY = 0.35; // churn-probability lift per +100% price change

const round = (v: number) => Math.round(v);

function tierCost(t: Tier, annualRuns: number, seats: number, seatPrice: number) {
  return (
    t.platformFee +
    (Math.max(0, annualRuns - t.includedRuns) / 1000) * t.overagePer1k +
    seats * seatPrice
  );
}

function bestTier(model: PricingModel, annualRuns: number, seats: number) {
  let best = model.tiers[0];
  let bestCost = Infinity;
  for (const t of model.tiers) {
    const c = tierCost(t, annualRuns, seats, model.seatPrice);
    if (c < bestCost) {
      best = t;
      bestCost = c;
    }
  }
  return { tier: best, cost: bestCost };
}

export function baseChurn(a: Account) {
  return Math.min(0.15, Math.max(0.02, 0.18 - 0.0015 * a.health));
}

export function simulate(model: PricingModel, accounts: Account[] = ACCOUNTS): Simulation {
  const results: AccountResult[] = accounts.map((a) => {
    const contract = CONTRACTS.find((c) => c.accountId === a.id);
    const renewalSeats = Math.max(1, Math.round(a.seats * (1 + a.seatTrend12m)));
    const t12mRuns = a.monthlyAgentRuns * 12;
    const fwdRuns = t12mRuns * (1 + a.usageGrowth12m);
    const discount = model.migration.keepDiscounts ? a.discountPct : 0;

    const { tier, cost } = bestTier(model, t12mRuns, renewalSeats);
    const newListArr = cost * (1 - discount);

    let capPct = model.migration.year1IncreaseCapPct;
    if (model.migration.honorPriceProtection && contract?.priceProtectionCapPct != null) {
      capPct = Math.min(capPct, contract.priceProtectionCapPct);
    }
    const capArr = a.arr * (1 + capPct / 100);
    const year1Arr = Math.min(newListArr, capArr);
    const capped = newListArr > capArr;

    // Growth after migration: incremental usage billed on the same tier.
    const fwdCost = tierCost(tier, fwdRuns, renewalSeats, model.seatPrice) * (1 - discount);
    const growth = Math.max(0, fwdCost - cost * (1 - discount));

    const b = baseChurn(a);
    const deltaPct = (year1Arr - a.arr) / a.arr;
    const churnProb = Math.min(0.6, b + PRICE_ELASTICITY * Math.max(0, deltaPct));
    const statusQuoNextYear = a.arr * (1 + a.seatTrend12m) * (1 - b);
    const newModelNextYear = (year1Arr + growth) * (1 - churnProb);

    let status: Status = "flat";
    if (deltaPct <= -0.05) status = "saves";
    else if (deltaPct >= 0.2 && (a.renewalMonths <= 6 || a.health < 60)) status = "at_risk";
    else if (deltaPct >= 0.05) status = "increase";

    return {
      id: a.id,
      name: a.name,
      segment: a.segment,
      tier: tier.name,
      oldArr: a.arr,
      newListArr: round(newListArr),
      year1Arr: round(year1Arr),
      deltaPct,
      uncappedDeltaPct: (newListArr - a.arr) / a.arr,
      capped,
      statusQuoNextYear: round(statusQuoNextYear),
      newModelNextYear: round(newModelNextYear),
      churnProb,
      status,
      renewalMonths: a.renewalMonths,
    };
  });

  const sum = (f: (r: AccountResult) => number) => results.reduce((s, r) => s + f(r), 0);
  const currentArr = sum((r) => r.oldArr);
  const counts: Record<Status, number> = { saves: 0, flat: 0, increase: 0, at_risk: 0 };
  const tierMix: Record<string, number> = {};
  for (const r of results) {
    counts[r.status]++;
    tierMix[r.tier] = (tierMix[r.tier] ?? 0) + 1;
  }

  return {
    summary: {
      modelName: model.name,
      currentArr,
      year1Arr: sum((r) => r.year1Arr),
      statusQuoNrr: sum((r) => r.statusQuoNextYear) / currentArr,
      newModelNrr: sum((r) => r.newModelNextYear) / currentArr,
      arrAtRisk: sum((r) => (r.status === "at_risk" ? r.oldArr : 0)),
      counts,
      tierMix,
      cappedAccounts: results.filter((r) => r.capped).length,
    },
    accounts: results,
  };
}

/** Compact view handed to agents so tool results stay small. */
export function summarizeForAgent(sim: Simulation) {
  const s = sim.summary;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const worst = [...sim.accounts]
    .sort((a, b) => b.deltaPct - a.deltaPct)
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      name: r.name,
      segment: r.segment,
      tier: r.tier,
      oldArr: r.oldArr,
      year1Arr: r.year1Arr,
      delta: pct(r.deltaPct),
      uncappedDelta: pct(r.uncappedDeltaPct),
      renewalMonths: r.renewalMonths,
      status: r.status,
    }));
  return {
    model: s.modelName,
    currentArr: s.currentArr,
    year1Arr: s.year1Arr,
    statusQuoNrr: pct(s.statusQuoNrr),
    newModelNrr: pct(s.newModelNrr),
    arrAtRisk: s.arrAtRisk,
    counts: s.counts,
    tierMix: s.tierMix,
    cappedAccounts: s.cappedAccounts,
    biggestIncreases: worst,
  };
}

export const STARTER_MODEL: PricingModel = {
  name: "Starter hybrid (unoptimized)",
  seatPrice: 600,
  tiers: [
    { name: "Team", platformFee: 18000, includedRuns: 200_000, overagePer1k: 200 },
    { name: "Business", platformFee: 72000, includedRuns: 1_000_000, overagePer1k: 160 },
    { name: "Enterprise", platformFee: 270000, includedRuns: 5_000_000, overagePer1k: 120 },
  ],
  migration: { year1IncreaseCapPct: 60, honorPriceProtection: false, keepDiscounts: true },
};

/** The model the agent team lands on in the recorded run (used by the case study). */
export const REFERENCE_MODEL: PricingModel = {
  name: "Relaya Flex",
  seatPrice: 600,
  tiers: [
    { name: "Team", platformFee: 18000, includedRuns: 200_000, overagePer1k: 150 },
    { name: "Business", platformFee: 72000, includedRuns: 1_000_000, overagePer1k: 120 },
    { name: "Enterprise", platformFee: 270000, includedRuns: 5_000_000, overagePer1k: 90 },
  ],
  migration: { year1IncreaseCapPct: 15, honorPriceProtection: true, keepDiscounts: true },
};
