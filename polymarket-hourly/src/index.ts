#!/usr/bin/env npx ts-node

/**
 * Polymarket Hourly Bets Extractor
 * 
 * Fetches open bets from Polymarket that finish within the next hour.
 * 
 * Usage:
 *   npx ts-node src/index.ts [--json] [--minutes N] [--output FILE]
 * 
 * Options:
 *   --json        Output as JSON instead of human-readable format
 *   --minutes N   Look ahead N minutes instead of default 60
 *   --output FILE Write JSON output to specified file
 */

import { writeFileSync } from 'fs';

interface Market {
  id: string;
  question: string;
  slug: string;
  endDate: string;
  outcomes: string;
  outcomePrices: string;
  volume24hr: number;
  liquidityNum: number;
  active: boolean;
  closed: boolean;
}

interface ProcessedMarket {
  id: string;
  question: string;
  url: string;
  endDate: Date;
  endsIn: string;
  outcomes: { name: string; probability: number }[];
  volume24h: number;
  liquidity: number;
}

const GAMMA_MARKETS_API = 'https://gamma-api.polymarket.com/markets';
const GAMMA_EVENTS_API = 'https://gamma-api.polymarket.com/events';

async function fetchMarketsFromEndpoint(url: string, endDateMin?: string, endDateMax?: string): Promise<Market[]> {
  const params = new URLSearchParams({
    closed: 'false',
    active: 'true',
    limit: '500',
  });
  
  // If we have date filters, use them for better results
  if (endDateMin && endDateMax) {
    params.set('end_date_min', endDateMin);
    params.set('end_date_max', endDateMax);
  }

  const response = await fetch(`${url}?${params}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<Market[]>;
}

interface Event {
  id: string;
  title: string;
  slug: string;
  endDate: string;
  markets?: Market[];
}

async function fetchMarkets(minutesAhead: number): Promise<Market[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + minutesAhead * 60 * 1000);
  const endDateMin = now.toISOString();
  const endDateMax = cutoff.toISOString();
  
  // Fetch from both markets and events endpoints with date filters
  const [marketsData, eventsData] = await Promise.all([
    fetchMarketsFromEndpoint(GAMMA_MARKETS_API, endDateMin, endDateMax),
    fetch(`${GAMMA_EVENTS_API}?closed=false&active=true&limit=500`)
      .then(r => r.json() as Promise<Event[]>)
      .catch(() => [] as Event[]),
  ]);

  // Extract markets from events that have nested market data
  const eventMarkets: Market[] = [];
  for (const event of eventsData) {
    if (event.markets) {
      for (const market of event.markets) {
        if (!market.closed && market.active) {
          eventMarkets.push(market);
        }
      }
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const allMarkets: Market[] = [];
  
  for (const market of [...marketsData, ...eventMarkets]) {
    if (!seen.has(market.id)) {
      seen.add(market.id);
      allMarkets.push(market);
    }
  }

  return allMarkets;
}

function parseOutcomes(outcomes: string, prices: string): { name: string; probability: number }[] {
  try {
    const outcomeList = JSON.parse(outcomes) as string[];
    const priceList = JSON.parse(prices) as string[];
    
    return outcomeList.map((name, i) => ({
      name,
      probability: parseFloat(priceList[i]) * 100,
    }));
  } catch {
    return [];
  }
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'less than a minute';
  if (minutes === 1) return '1 minute';
  if (minutes < 60) return `${minutes} minutes`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours}h ${remainingMinutes}m`;
}

function filterMarketsEndingSoon(markets: Market[], minutesAhead: number): ProcessedMarket[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + minutesAhead * 60 * 1000);

  const endingSoon: ProcessedMarket[] = [];

  for (const market of markets) {
    if (!market.endDate || market.closed || !market.active) continue;

    const endDate = new Date(market.endDate);
    
    // Skip if already ended or ends after cutoff
    if (endDate <= now || endDate > cutoff) continue;

    const msUntilEnd = endDate.getTime() - now.getTime();

    endingSoon.push({
      id: market.id,
      question: market.question,
      url: `https://polymarket.com/event/${market.slug}`,
      endDate,
      endsIn: formatDuration(msUntilEnd),
      outcomes: parseOutcomes(market.outcomes, market.outcomePrices),
      volume24h: market.volume24hr || 0,
      liquidity: market.liquidityNum || 0,
    });
  }

  // Sort by end date (soonest first)
  endingSoon.sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

  return endingSoon;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function printMarket(market: ProcessedMarket): void {
  console.log('\n' + '─'.repeat(60));
  console.log(`📊 ${market.question}`);
  console.log(`   ⏰ Ends in: ${market.endsIn}`);
  console.log(`   🔗 ${market.url}`);
  
  if (market.outcomes.length > 0) {
    console.log('   📈 Odds:');
    for (const outcome of market.outcomes) {
      const bar = '█'.repeat(Math.round(outcome.probability / 5));
      console.log(`      ${outcome.name}: ${outcome.probability.toFixed(1)}% ${bar}`);
    }
  }
  
  console.log(`   💰 24h Volume: ${formatCurrency(market.volume24h)} | Liquidity: ${formatCurrency(market.liquidity)}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  
  let minutesAhead = 60;
  const minutesIndex = args.indexOf('--minutes');
  if (minutesIndex !== -1 && args[minutesIndex + 1]) {
    minutesAhead = parseInt(args[minutesIndex + 1], 10);
    if (isNaN(minutesAhead) || minutesAhead < 1) {
      console.error('Error: --minutes must be a positive number');
      process.exit(1);
    }
  }

  let outputFile: string | null = null;
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    outputFile = args[outputIndex + 1];
  }

  try {
    const markets = await fetchMarkets(minutesAhead);
    const endingSoon = filterMarketsEndingSoon(markets, minutesAhead);

    if (jsonOutput) {
      console.log(JSON.stringify(endingSoon, null, 2));
      if (outputFile) {
        writeFileSync(outputFile, JSON.stringify(endingSoon, null, 2));
        console.error(`\nJSON written to: ${outputFile}`);
      }
      return;
    }

    // Always write JSON file if --output specified
    if (outputFile) {
      writeFileSync(outputFile, JSON.stringify(endingSoon, null, 2));
    }

    console.log(`\n🎲 Polymarket Bets Ending Within ${minutesAhead} Minutes`);
    console.log(`   Fetched at: ${new Date().toISOString()}`);
    console.log(`   Total markets scanned: ${markets.length}`);

    if (endingSoon.length === 0) {
      console.log('\n   No markets ending within the specified timeframe.');
      console.log('   Try increasing --minutes or check back later.');
    } else {
      console.log(`   Markets ending soon: ${endingSoon.length}`);
      
      for (const market of endingSoon) {
        printMarket(market);
      }
    }

    if (outputFile) {
      console.log(`\n   📁 JSON saved to: ${outputFile}`);
    }

    console.log('\n' + '─'.repeat(60));
  } catch (error) {
    console.error('Error fetching markets:', error);
    process.exit(1);
  }
}

main();
