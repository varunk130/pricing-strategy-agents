// Synthetic, deterministic dataset for "Relaya", a fictional B2B AI workflow
// platform that sells per seat today. Every company here is invented.

export type Segment = "Mid-Market" | "Enterprise" | "Strategic";

export interface Account {
  id: string;
  name: string;
  segment: Segment;
  industry: string;
  seats: number;
  discountPct: number; // current negotiated discount off $720/seat/yr list
  arr: number; // current annual recurring revenue
  aiAdoption: number; // 0-1, share of work done by agents (hidden driver)
  monthlyAgentRuns: number;
  activeWorkflows: number;
  activeUserPct: number; // weekly active users / seats
  seatTrend12m: number; // projected seat change at renewal (negative = compression)
  usageGrowth12m: number; // projected agent-run growth
  health: number; // 0-100
  renewalMonths: number; // months until renewal
  netExpansion12m: number; // trailing 12m net $ expansion rate (outcome)
}

export interface Contract {
  accountId: string;
  termYears: number;
  paymentTerms: string;
  priceProtectionCapPct: number | null; // contractual renewal uplift cap
  procurementNotes: string;
  budgetCycle: string;
  economicBuyer: string;
}

export interface Competitor {
  name: string;
  model: string;
  valueMetric: string;
  entryPrice: string;
  enterprisePrice: string;
  notes: string;
}

export const LIST_SEAT_PRICE = 720;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PREFIX = [
  "Helio", "Corvid", "Lumen", "Tessera", "Brightline", "Quarry", "Ostrava", "Meridian",
  "Kestrel", "Halcyon", "Vantor", "Pinecrest", "Arborly", "Cobalt", "Solstice", "Granite",
  "Fathom", "Juniper", "Tidewater", "Ironleaf", "Starling", "Verdant", "Northvale", "Calder",
  "Bluehaven", "Redwick", "Orchid", "Silvan", "Ember", "Mosaic", "Crescent", "Alder",
  "Westmark", "Lattice", "Prairie", "Driftwood",
];
const INDUSTRY: [string, string][] = [
  ["Healthcare", "Health"], ["Logistics", "Logistics"], ["Financial Services", "Bank"],
  ["Retail", "Retail"], ["Insurance", "Mutual"], ["Software", "Systems"],
  ["Manufacturing", "Industries"], ["Energy", "Energy"], ["Media", "Media"],
];
const BUYERS = ["CIO", "COO", "VP Operations", "CFO", "VP IT", "Head of Shared Services"];
const NOTES = [
  "Procurement benchmarks every renewal against two alternatives.",
  "Finance requires 90-day notice for any price change.",
  "Budget is fixed annually; variable spend needs CFO sign-off.",
  "Champion recently left; new VP is reviewing all automation spend.",
  "Expanding into two new business units next year.",
  "Prefers predictable invoices over pay-as-you-go.",
  "Has asked for usage-based pricing twice in QBRs.",
  "Security review required for any contract change.",
];

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function build() {
  const rand = mulberry32(20261124);
  const accounts: Account[] = [];
  const contracts: Contract[] = [];

  PREFIX.forEach((p, i) => {
    const r = rand();
    const segment: Segment = r < 0.42 ? "Mid-Market" : r < 0.85 ? "Enterprise" : "Strategic";
    const [industry, suffix] = INDUSTRY[Math.floor(rand() * INDUSTRY.length)];
    const seats =
      segment === "Mid-Market"
        ? Math.round(40 + rand() * 160)
        : segment === "Enterprise"
          ? Math.round(220 + rand() * 900)
          : Math.round(1300 + rand() * 3200);
    const discountPct =
      segment === "Mid-Market" ? 0.05 + rand() * 0.1 : segment === "Enterprise" ? 0.15 + rand() * 0.15 : 0.3 + rand() * 0.15;
    const a = clamp(Math.pow(rand(), 0.85), 0.03, 0.97);
    const noise = () => (rand() - 0.5) * 2;

    const monthlyAgentRuns = Math.round(seats * (15 + 360 * a) * (1 + 0.15 * noise()));
    const seatTrend12m = clamp(0.06 - 0.34 * a + 0.04 * noise(), -0.4, 0.15);
    const usageGrowth12m = clamp(0.15 + 0.9 * a + 0.1 * noise(), 0.05, 1.2);
    const health = Math.round(clamp(48 + 42 * a + 8 * noise(), 20, 98));

    accounts.push({
      id: `ACC-${String(101 + i)}`,
      name: `${p} ${suffix}`,
      segment,
      industry,
      seats,
      discountPct: Math.round(discountPct * 100) / 100,
      arr: Math.round(seats * LIST_SEAT_PRICE * (1 - Math.round(discountPct * 100) / 100)),
      aiAdoption: Math.round(a * 100) / 100,
      monthlyAgentRuns,
      activeWorkflows: Math.round(4 + a * (seats / 6) * (1 + 0.2 * noise())),
      activeUserPct: Math.round(clamp(0.82 - 0.42 * a + 0.06 * noise(), 0.2, 0.95) * 100) / 100,
      seatTrend12m: Math.round(seatTrend12m * 100) / 100,
      usageGrowth12m: Math.round(usageGrowth12m * 100) / 100,
      health,
      renewalMonths: 1 + Math.floor(rand() * 18),
      netExpansion12m: Math.round(clamp(-0.12 + 0.35 * a + 0.06 * noise(), -0.3, 0.4) * 100) / 100,
    });

    contracts.push({
      accountId: `ACC-${String(101 + i)}`,
      termYears: segment === "Mid-Market" ? 1 : 1 + Math.floor(rand() * 3),
      paymentTerms: ["Net 30", "Net 45", "Net 60"][Math.floor(rand() * 3)],
      priceProtectionCapPct: segment !== "Mid-Market" && rand() < 0.45 ? 7 : null,
      procurementNotes: NOTES[Math.floor(rand() * NOTES.length)],
      budgetCycle: ["Jan to Dec", "Apr to Mar", "Jul to Jun"][Math.floor(rand() * 3)],
      economicBuyer: BUYERS[Math.floor(rand() * BUYERS.length)],
    });
  });
  return { accounts, contracts };
}

const built = build();
export const ACCOUNTS: Account[] = built.accounts;
export const CONTRACTS: Contract[] = built.contracts;

export const COMPETITORS: Competitor[] = [
  {
    name: "Flowgrid",
    model: "Hybrid: platform fee + credits",
    valueMetric: "Automation credits",
    entryPrice: "$18k/yr incl. 250k credits",
    enterprisePrice: "$120k+/yr, custom credit pools",
    notes: "Moved off seats in 2025. Credit rollover is a common procurement ask.",
  },
  {
    name: "Taskwright",
    model: "Per seat",
    valueMetric: "Seats",
    entryPrice: "$65/seat/mo",
    enterprisePrice: "$48/seat/mo at 1,000+ seats",
    notes: "Aggressive seat discounting; losing share in AI-heavy accounts.",
  },
  {
    name: "Agentry",
    model: "Pure usage",
    valueMetric: "Agent runs",
    entryPrice: "$0.30 per run, no minimum",
    enterprisePrice: "$0.12 per run at volume",
    notes: "Cheap to start, but buyers complain about invoice volatility.",
  },
  {
    name: "OpsPilot",
    model: "Outcome-based (pilot)",
    valueMetric: "Tickets resolved",
    entryPrice: "$1.10 per resolved case",
    enterprisePrice: "Custom",
    notes: "Only works for support use cases; hard to audit outcomes.",
  },
  {
    name: "Stackline",
    model: "Seat + usage add-on",
    valueMetric: "Seats + AI actions",
    entryPrice: "$40/seat/mo + $0.08/action",
    enterprisePrice: "Enterprise bundle, 3-yr commits",
    notes: "Customers dislike paying twice; confusing invoices.",
  },
];
