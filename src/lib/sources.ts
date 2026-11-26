// Every external claim on the page links to one of these. Figures were checked
// against the publisher's own page in November 2026.
export interface Source {
  n: number;
  publisher: string;
  title: string;
  date: string;
  url: string;
  finding: string;
}

export const SOURCES: Source[] = [
  {
    n: 1,
    publisher: "Gartner",
    title: "Gartner Says $234 Billion in Enterprise Application Software Spend Is at Risk from Agentic AI",
    date: "July 1, 2026",
    url: "https://www.gartner.com/en/newsroom/press-releases/2026-07-01-gartner-says-us-dollars-234-billion-in-enterprise-application-software-spend-is-at-risk-from-agentic-artificial-intelligence",
    finding: "Up to $234B of enterprise app spend, about 20% of enterprise SaaS spend, is exposed to agentic AI by 2030. Agents break the link between user growth and revenue growth.",
  },
  {
    n: 2,
    publisher: "Deloitte",
    title: "TMT Predictions 2026: SaaS meets AI agents",
    date: "2026 edition",
    url: "https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/saas-ai-agents.html",
    finding: "Seat-based licensing could give way to hybrid usage and outcome pricing. Cites Gartner: by 2030, at least 40% of enterprise SaaS spend shifts to usage, agent or outcome-based pricing.",
  },
  {
    n: 3,
    publisher: "McKinsey",
    title: "The State of AI: Global Survey 2026",
    date: "August 25, 2026",
    url: "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai",
    finding: "40% of large organizations are scaling AI agents, up from 27%. 32% decided against buying software they could build with agentic coding tools.",
  },
  {
    n: 4,
    publisher: "McKinsey",
    title: "AI adjusts the software bill",
    date: "January 27, 2026",
    url: "https://www.mckinsey.com/featured-insights/week-in-charts/ai-adjusts-the-software-bill",
    finding: "The number of software companies using consumption-based pricing more than doubled from 2015 to 2024.",
  },
  {
    n: 5,
    publisher: "BCG",
    title: "As AI Reshapes SaaS, Companies Need Pivot-Ready Pricing",
    date: "2026",
    url: "https://www.bcg.com/publications/2026/saas-pricing-must-change-agentic-ai",
    finding: "Hybrid pricing is the leading approach. 57% of hypergrowth SaaS companies use it (Stripe survey of 2,000). Buyers prefer the predictability of hybrid and committed spend.",
  },
  {
    n: 6,
    publisher: "Deloitte",
    title: "2026 Global Software Industry Outlook",
    date: "February 12, 2026",
    url: "https://www.deloitte.com/us/en/insights/industry/technology/technology-media-telecom-outlooks/software-industry-outlook.html",
    finding: "Cites Gartner: 40% of enterprise applications will be integrated with task-specific AI agents by the end of 2026.",
  },
];
