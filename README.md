# Stock Investment Research

A personal stock-research web app that ranks the S&P 500 with an **explainable, evidence-based scoring engine** and tracks **US politicians' stock trades** from official STOCK Act disclosures.

> **Disclaimer:** This is a research and education tool, not financial advice. Factor scores are computed from historical data, which does not predict future returns. Congressional trades may be disclosed up to 45 days after they happen.

## What it does

- **Top Picks** (`/picks`) — every S&P 500 stock scored 0–100 and graded A–F on four evidence-based factors, with plain-English reasons ("Trades at 14× earnings vs. S&P 500 median 21×"):
  - **Quality 30%** — return on equity, operating margin, debt/equity
  - **Value 25%** — P/E, price/free-cash-flow, EV/EBITDA
  - **Growth 25%** — revenue and EPS growth
  - **Momentum 20%** — 12-month return excluding the most recent month
- **Stock detail** (`/stocks/NVDA`) — 1-year chart, full factor breakdown with all the "why" bullets, key fundamentals, and congressional activity in that stock.
- **Congress Trades** (`/congress`) — searchable, filterable feed of politician trades, plus "most bought" and "most active traders" aggregations. Congressional buying also appears as a 🏛 badge on picks — it's shown as a signal overlay, never silently mixed into scores.
- **Dashboard** (`/`) — market indices, top-scored stocks, and the latest disclosures.
- **Watchlist** (`/watchlist`) — star stocks to track them.

## Data sources (all free)

| Data | Source |
|---|---|
| Quotes, fundamentals, price history | Yahoo Finance via [`yahoo-finance2`](https://github.com/gadicc/yahoo-finance2) (unofficial, no key) |
| S&P 500 constituents | [datasets/s-and-p-500-companies](https://github.com/datasets/s-and-p-500-companies) |
| Senate trades | Official [Senate eFD](https://efdsearch.senate.gov) electronic filings, scraped directly |
| Politician party/state | [unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) |
| House trades (optional) | [Financial Modeling Prep](https://financialmodelingprep.com) — set `FMP_API_KEY` (free tier) |

Notes: paper (scanned-PDF) Senate filings can't be parsed and are skipped. House disclosures are only published as PDFs, so House coverage requires the optional free FMP key.

## Setup

```bash
npm install
npx drizzle-kit push       # create the local SQLite database (data/app.db)
npm run refresh-data       # fetch + score everything (~2 minutes)
npm run dev                # http://localhost:3000
```

Re-run `npm run refresh-data` whenever you want fresh data (e.g. daily or weekly). Subsequent congress refreshes are incremental.

Optional: for House trade coverage, get a free API key at financialmodelingprep.com and run with `FMP_API_KEY=yourkey npm run refresh-data`.

## Tech

Next.js (App Router) + TypeScript + Tailwind CSS, SQLite via Drizzle ORM (`data/app.db`, gitignored), a dependency-free SVG price chart, Vitest (`npm test` covers the scoring math). The market-data source is isolated behind `src/lib/provider/types.ts` so it can be swapped; deploying later to Vercel + Postgres only requires changing the Drizzle driver.

## How the scoring works

Each metric (e.g. P/E) is converted to a **percentile rank (0–100) across the S&P 500**, oriented so higher = better (cheap P/E ranks high, heavy debt ranks low). Metrics average into the four factor scores; factors combine into the weighted composite; the composite maps to a letter grade (A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 35, else F). Stocks with fewer than 4 available metrics are graded N/A rather than mis-scored. Bullets are generated for any metric in the top 30% (strength) or bottom 30% (concern) of the index.
