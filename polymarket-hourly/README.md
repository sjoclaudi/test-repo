# Multi-Platform Prediction Market Scanner

Fetches prediction markets from multiple platforms and identifies low-risk betting opportunities.

## Supported Platforms

| Platform | Status | API | Notes |
|----------|--------|-----|-------|
| **Polymarket** | ✅ Working | Public | Crypto prediction market, real money |
| **PredictIt** | ✅ Working | Public | US politics, real money (max $850/contract) |
| **Manifold** | ✅ Working | Public | Play money, good probability signals |
| **Metaculus** | ✅ Working | Public | Forecasting platform (no money) |
| **Kalshi** | ⚠️ Limited | May need auth | CFTC-regulated, real money |
| **Augur** | ⚠️ Rebooting | N/A | Ethereum-based, currently rebuilding |
| **Smarkets** | ⚠️ Rate limited | Public | UK betting exchange |
| **Betfair** | ❌ Auth Required | Private | Needs developer account |
| **Iowa Electronic Markets** | ❌ No API | N/A | Academic market |

## Installation

```bash
npm install
```

## Usage

### Multi-Platform Scanner
```bash
# Scan multiple platforms
npx ts-node src/multi-scanner.ts --minutes 180 --platforms polymarket,predictit,manifold

# Save results
npx ts-node src/multi-scanner.ts --minutes 180 --output results.json
```

### Alert Scanner (for arbitrage)
```bash
# Quick scan for arbitrage and high-volume near-certain bets
npx ts-node src/alerts.ts --minutes 240

# Telegram-formatted output
npx ts-node src/alerts.ts --minutes 240 --telegram
```

### Report Generation
```bash
# Telegram report
npx ts-node src/report.ts --input results.json --format telegram

# Email (HTML) report
npx ts-node src/report.ts --input results.json --format email --output report.html
```

### Single Platform (Polymarket only)
```bash
npx ts-node src/index.ts --minutes 60 --output markets.json
```

## Opportunity Types

The scanner identifies:
- 🟢 **Arbitrage (No-risk):** Odds sum to <98% — guaranteed profit betting all outcomes
- 🟡 **Low-risk:** One outcome at >97% probability
- 🟠 **Medium-risk:** One outcome at >90% probability

## Project Structure

```
src/
├── index.ts           # Original Polymarket fetcher
├── multi-scanner.ts   # Multi-platform aggregator
├── alerts.ts          # Arbitrage & high-volume alert scanner
├── analyzer.ts        # Statistical analyzer
├── report.ts          # Report generator (Telegram/Email)
└── platforms/
    ├── types.ts       # Common types
    ├── polymarket.ts  # Polymarket API
    ├── predictit.ts   # PredictIt API
    ├── manifold.ts    # Manifold Markets API
    ├── kalshi.ts      # Kalshi API
    ├── metaculus.ts   # Metaculus API
    ├── augur.ts       # Augur (Ethereum)
    ├── smarkets.ts    # Smarkets API
    ├── betfair.ts     # Betfair (needs auth)
    └── iem.ts         # Iowa Electronic Markets
```

## Adding New Platforms

1. Create `src/platforms/yourplatform.ts`
2. Implement the `PlatformFetcher` interface:
   ```typescript
   export const yourplatform: PlatformFetcher = {
     name: 'YourPlatform',
     async fetchMarkets(minutesAhead: number): Promise<Market[]> {
       // Fetch and return markets
     }
   };
   ```
3. Export from `src/platforms/index.ts`
4. Add to `platformMap` in `multi-scanner.ts`

## API Documentation

- **Polymarket:** https://gamma-api.polymarket.com/markets
- **PredictIt:** https://www.predictit.org/api/marketdata/all/
- **Manifold:** https://api.manifold.markets/v0/markets
- **Metaculus:** https://www.metaculus.com/api2/questions/
- **Kalshi:** https://api.elections.kalshi.com/trade-api/v2/markets

## Cron Jobs

This scanner is designed to run on schedule:
- **Full reports:** 4x daily (9, 13, 17, 21h)
- **Alert scans:** Every 30 minutes (for time-sensitive arbitrage)

## Disclaimer

⚠️ **This is statistical analysis only. Not financial advice.**

- Always verify odds on the actual platform before betting
- Past patterns do not guarantee future results
- Different platforms have different fees, limits, and regulations
- Manifold uses play money (mana), not real currency
