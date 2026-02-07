# Polymarket Hourly Bets Extractor 🎲

A CLI tool to extract open bets from [Polymarket](https://polymarket.com) that finish within the hour.

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
# Run directly with ts-node
npm start

# Or after building
node dist/index.js

# Options
npm start -- --json          # Output as JSON
npm start -- --minutes 30    # Look ahead 30 minutes instead of 60
```

## Example Output

```
🎲 Polymarket Bets Ending Within 60 Minutes
   Fetched at: 2026-02-07T10:30:00.000Z
   Total markets scanned: 1247
   Markets ending soon: 3

────────────────────────────────────────────────────────────
📊 Will Bitcoin close above $70,000 today?
   ⏰ Ends in: 45 minutes
   🔗 https://polymarket.com/event/btc-70k-today
   📈 Odds:
      Yes: 23.5% ████
      No: 76.5% ███████████████
   💰 24h Volume: $1.2M | Liquidity: $89.5K
```

## API

This tool uses the [Polymarket Gamma API](https://gamma-api.polymarket.com/markets) to fetch market data.

## Features

- ✅ Fetches all active, open markets
- ✅ Filters by end time (within next hour by default)
- ✅ Displays outcomes with probabilities
- ✅ Shows volume and liquidity stats
- ✅ JSON output for piping to other tools
- ✅ Configurable time window

## License

MIT
