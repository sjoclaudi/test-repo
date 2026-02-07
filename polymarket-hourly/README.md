# Polymarket Hourly Bets & Multi-Platform Scanner

Fetches prediction markets from multiple platforms and identifies low-risk betting opportunities.

## Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| **Polymarket** | ✅ Working | Crypto prediction market |
| **PredictIt** | ✅ Working | US politics (long-term markets) |
| **Kalshi** | ⚠️ Limited | May require API key |
| **Metaculus** | ✅ Working | Forecasting (no real money) |
| **Augur** | ⚠️ Limited | Ethereum-based, uses The Graph |
| **Betfair** | ❌ Auth Required | Needs API credentials |
| **Smarkets** | ⚠️ Limited | Rate limited |
| **Iowa Electronic Markets** | ❌ No API | Academic market |

## Installation

```bash
npm install
```

## Usage

### Single Platform (Polymarket)
```bash
# Fetch markets ending in next 60 minutes
npx ts-node src/index.ts

# Custom time window + JSON output
npx ts-node src/index.ts --minutes 480 --output markets.json
```

### Multi-Platform Scanner
```bash
# Scan multiple platforms
npx ts-node src/multi-scanner.ts --minutes 180 --platforms polymarket,predictit

# Save results
npx ts-node src/multi-scanner.ts --minutes 180 --output results.json
```

### Analyze for Opportunities
```bash
# Run analyzer on fetched markets
npx ts-node src/analyzer.ts --input markets.json

# Generate reports
npx ts-node src/report.ts --input opportunities.json --format telegram
npx ts-node src/report.ts --input opportunities.json --format email --output report.html
```

### Quick Scan Script
```bash
./scan.sh 180  # Scan with 3-hour window
```

## Output

The scanner identifies:
- 🟢 **No-risk (arbitrage)**: Odds don't sum to 100% - guaranteed profit
- 🟡 **Low-risk**: One outcome >97% probability
- 🟠 **Medium-risk**: One outcome >90% probability

## Project Structure

```
src/
├── index.ts           # Original Polymarket fetcher
├── analyzer.ts        # Statistical analyzer
├── report.ts          # Report generator (Telegram/Email)
├── multi-scanner.ts   # Multi-platform aggregator
└── platforms/
    ├── types.ts       # Common types
    ├── polymarket.ts  # Polymarket API
    ├── kalshi.ts      # Kalshi API
    ├── predictit.ts   # PredictIt API
    ├── metaculus.ts   # Metaculus API
    ├── augur.ts       # Augur (Ethereum)
    ├── smarkets.ts    # Smarkets API
    ├── betfair.ts     # Betfair (needs auth)
    └── iem.ts         # Iowa Electronic Markets
```

## Adding New Platforms

1. Create `src/platforms/yourplatform.ts`
2. Implement the `PlatformFetcher` interface
3. Export from `src/platforms/index.ts`
4. Add to `platformMap` in `multi-scanner.ts`

## API Notes

- **Polymarket**: Uses gamma-api.polymarket.com (public)
- **Kalshi**: api.elections.kalshi.com (may require auth for some endpoints)
- **PredictIt**: www.predictit.org/api/marketdata/all/ (public)
- **Metaculus**: www.metaculus.com/api2/questions/ (public, rate limited)

## Disclaimer

⚠️ This is statistical analysis only. Not financial advice. Always verify odds before betting.
