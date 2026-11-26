// Read-only analysis over the synthetic customer base. Safe to import in the
// browser (no fs), so the case study page and the agents share the same facts.
import { ACCOUNTS, CONTRACTS, LIST_SEAT_PRICE, type Account } from "./data";
import { simulate, type PricingModel } from "./pricing";

const totalArr = ACCOUNTS.reduce((s, a) => s + a.arr, 0);
const arrWeighted = (f: (a: Account) => number) => ACCOUNTS.reduce((s, a) => s + f(a) * a.arr, 0) / totalArr;

function corr(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return Math.round((num / Math.sqrt(dx * dy)) * 100) / 100;
}

export function baseOverview() {
  const bySegment: Record<string, { accounts: number; arr: number; seats: number }> = {};
  for (const a of ACCOUNTS) {
    const s = (bySegment[a.segment] ??= { accounts: 0, arr: 0, seats: 0 });
    s.accounts++;
    s.arr += a.arr;
    s.seats += a.seats;
  }
  return {
    company: "Relaya, an AI workflow platform priced per seat",
    listSeatPricePerYear: LIST_SEAT_PRICE,
    accounts: ACCOUNTS.length,
    totalArr,
    bySegment,
    seatChangeAtRenewal: arrWeighted((a) => a.seatTrend12m),
    agentRunGrowth: arrWeighted((a) => a.usageGrowth12m),
    totalAnnualAgentRuns: ACCOUNTS.reduce((s, a) => s + a.monthlyAgentRuns * 12, 0),
    renewalsNext6Months: ACCOUNTS.filter((a) => a.renewalMonths <= 6).length,
  };
}

export function valueMetricAnalysis() {
  const exp = ACCOUNTS.map((a) => a.netExpansion12m);
  const health = ACCOUNTS.map((a) => a.health);
  const ai = ACCOUNTS.map((a) => a.aiAdoption);
  const candidates: Record<string, number[]> = {
    seats: ACCOUNTS.map((a) => a.seats),
    weeklyActiveUserPct: ACCOUNTS.map((a) => a.activeUserPct),
    agentRunsPerSeat: ACCOUNTS.map((a) => a.monthlyAgentRuns / a.seats),
    activeWorkflowsPerSeat: ACCOUNTS.map((a) => a.activeWorkflows / a.seats),
  };
  const metrics = Object.entries(candidates).map(([metric, xs]) => ({
    metric,
    corrWithNetExpansion: corr(xs, exp),
    corrWithHealth: corr(xs, health),
    corrWithAiAdoption: corr(xs, ai),
  }));
  const runs = ACCOUNTS.map((a) => a.monthlyAgentRuns).sort((a, b) => b - a);
  const top = runs.slice(0, Math.ceil(runs.length * 0.1)).reduce((s, v) => s + v, 0);
  return {
    metrics,
    topTenPctShareOfRuns: Math.round((top / runs.reduce((s, v) => s + v, 0)) * 100),
    medianAnnualRunsPerAccount: runs[Math.floor(runs.length / 2)] * 12,
    note: "Agent runs are metered per account and customers can see them in their admin dashboard.",
  };
}

export function contractLandscape() {
  const withCap = CONTRACTS.filter((c) => c.priceProtectionCapPct != null);
  const quarters = [0, 0, 0, 0, 0, 0];
  for (const a of ACCOUNTS) quarters[Math.min(5, Math.floor((a.renewalMonths - 1) / 3))]++;
  const themes: Record<string, number> = {};
  for (const c of CONTRACTS) themes[c.procurementNotes] = (themes[c.procurementNotes] ?? 0) + 1;
  return {
    contracts: CONTRACTS.length,
    withPriceProtection: withCap.length,
    priceProtectionArr: ACCOUNTS.filter((a) => withCap.some((c) => c.accountId === a.id)).reduce((s, a) => s + a.arr, 0),
    typicalCapPct: 7,
    renewalsByQuarter: quarters.map((n, i) => ({ quarter: `Q${i + 1}`, renewals: n })),
    multiYearContracts: CONTRACTS.filter((c) => c.termYears > 1).length,
    procurementThemes: Object.entries(themes)
      .sort((a, b) => b[1] - a[1])
      .map(([note, count]) => ({ note, count })),
  };
}

export function accountContracts(ids: string[]) {
  return ids.slice(0, 8).map((id) => {
    const a = ACCOUNTS.find((x) => x.id === id);
    const c = CONTRACTS.find((x) => x.accountId === id);
    if (!a || !c) return { id, error: "unknown account" as const };
    return { id, name: a.name, segment: a.segment, industry: a.industry, currentArr: a.arr, health: a.health, renewalMonths: a.renewalMonths, ...c };
  });
}

export function renewalCalendar(model: PricingModel) {
  const sim = simulate(model);
  const waves = [
    { window: "Next 3 months", from: 1, to: 3 },
    { window: "Months 4 to 6", from: 4, to: 6 },
    { window: "Months 7 to 12", from: 7, to: 12 },
    { window: "Months 13 to 18", from: 13, to: 18 },
  ];
  return waves.map((w) => {
    const accts = sim.accounts.filter((r) => r.renewalMonths >= w.from && r.renewalMonths <= w.to);
    return {
      window: w.window,
      renewals: accts.length,
      arr: accts.reduce((s, r) => s + r.oldArr, 0),
      increases: accts.filter((r) => r.deltaPct >= 0.05).length,
      savings: accts.filter((r) => r.deltaPct <= -0.05).length,
      largestIncrease: accts.sort((a, b) => b.deltaPct - a.deltaPct)[0]?.name ?? null,
    };
  });
}

/** Points for the "problem" chart: AI adoption vs seat change at renewal. */
export function adoptionVsSeats() {
  return ACCOUNTS.map((a) => ({
    name: a.name,
    segment: a.segment,
    adoption: a.aiAdoption,
    seatChange: a.seatTrend12m,
    runGrowth: a.usageGrowth12m,
    arr: a.arr,
  }));
}
