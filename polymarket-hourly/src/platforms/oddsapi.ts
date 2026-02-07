/**
 * The Odds API integration
 * Aggregates odds from multiple bookmakers - great for arbitrage detection!
 * 
 * API: https://api.the-odds-api.com/v4/
 * Free tier: 500 credits/month
 * 
 * Key advantage: Returns odds from MULTIPLE bookmakers for the same event,
 * making it possible to find true arbitrage opportunities.
 */

import { Market, PlatformFetcher, formatDuration, Outcome } from './types';

// Store API key (from environment or hardcoded for now)
const ODDS_API_KEY = process.env.ODDS_API_KEY || 'd726f1a4b68c105386554e18e2078b0e';
const BASE_URL = 'https://api.the-odds-api.com/v4';

interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string | null;
  away_team: string | null;
  bookmakers: {
    key: string;
    title: string;
    last_update: string;
    markets: {
      key: string;
      outcomes: {
        name: string;
        price: number; // Decimal odds
      }[];
    }[];
  }[];
}

interface AggregatedOdds {
  outcome: string;
  bestOdds: number;
  bestBookmaker: string;
  allBookmakers: { bookmaker: string; odds: number }[];
}

function aggregateBestOdds(event: OddsApiEvent): AggregatedOdds[] {
  const outcomeMap = new Map<string, AggregatedOdds>();

  for (const bookmaker of event.bookmakers) {
    for (const market of bookmaker.markets) {
      if (market.key !== 'h2h' && market.key !== 'outrights') continue;
      
      for (const outcome of market.outcomes) {
        const existing = outcomeMap.get(outcome.name);
        if (!existing) {
          outcomeMap.set(outcome.name, {
            outcome: outcome.name,
            bestOdds: outcome.price,
            bestBookmaker: bookmaker.title,
            allBookmakers: [{ bookmaker: bookmaker.title, odds: outcome.price }],
          });
        } else {
          existing.allBookmakers.push({ bookmaker: bookmaker.title, odds: outcome.price });
          if (outcome.price > existing.bestOdds) {
            existing.bestOdds = outcome.price;
            existing.bestBookmaker = bookmaker.title;
          }
        }
      }
    }
  }

  return Array.from(outcomeMap.values());
}

// Convert decimal odds to implied probability
function decimalToProb(decimal: number): number {
  return (1 / decimal) * 100;
}

export const oddsapi: PlatformFetcher = {
  name: 'OddsAPI',

  async fetchMarkets(minutesAhead: number): Promise<Market[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + minutesAhead * 60 * 1000);
    const markets: Market[] = [];

    try {
      // Get active sports first
      const sportsRes = await fetch(`${BASE_URL}/sports/?apiKey=${ODDS_API_KEY}`);
      if (!sportsRes.ok) {
        console.error(`OddsAPI sports error: ${sportsRes.status}`);
        return [];
      }
      
      const sports = await sportsRes.json() as { key: string; active: boolean; has_outrights: boolean }[];
      
      // Focus on sports with upcoming events (limit API calls)
      const prioritySports = [
        'americanfootball_nfl',
        'basketball_nba',
        'icehockey_nhl',
        'soccer_epl',
        'soccer_uefa_champs_league',
        'politics_us_presidential_election_winner',
      ];

      for (const sportKey of prioritySports) {
        const sport = sports.find(s => s.key === sportKey);
        if (!sport?.active) continue;

        const oddsRes = await fetch(
          `${BASE_URL}/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=us,uk,eu&oddsFormat=decimal`
        );
        if (!oddsRes.ok) continue;

        const events = await oddsRes.json() as OddsApiEvent[];

        for (const event of events) {
          const startTime = new Date(event.commence_time);
          // Skip events outside our window (or already started for non-outrights)
          if (!sport.has_outrights && (startTime <= now || startTime > cutoff)) continue;

          const aggregated = aggregateBestOdds(event);
          if (aggregated.length < 2) continue;

          // Calculate arbitrage opportunity
          const totalImpliedProb = aggregated.reduce(
            (sum, o) => sum + decimalToProb(o.bestOdds),
            0
          );

          const msUntilStart = startTime.getTime() - now.getTime();
          const question = event.home_team && event.away_team
            ? `${event.away_team} @ ${event.home_team}`
            : event.sport_title;

          const outcomes: Outcome[] = aggregated.slice(0, 10).map(o => ({
            name: o.outcome,
            probability: decimalToProb(o.bestOdds),
            metadata: {
              bestBookmaker: o.bestBookmaker,
              bestOdds: o.bestOdds,
              bookmakerCount: o.allBookmakers.length,
            },
          }));

          markets.push({
            id: event.id,
            platform: 'OddsAPI',
            question,
            url: `https://the-odds-api.com`,
            endDate: startTime,
            endsIn: formatDuration(msUntilStart),
            outcomes,
            metadata: {
              sport: event.sport_key,
              sportTitle: event.sport_title,
              totalImpliedProb: totalImpliedProb.toFixed(1),
              arbitrageOpportunity: totalImpliedProb < 100,
            },
          });
        }
      }

      return markets.sort((a, b) =>
        (a.endDate?.getTime() || 0) - (b.endDate?.getTime() || 0)
      );
    } catch (error) {
      console.error('OddsAPI fetch error:', error);
      return [];
    }
  },
};

// Special function to find arbitrage across bookmakers
export async function findBookmakerArbitrage(): Promise<{
  event: string;
  sport: string;
  totalImplied: number;
  profit: number;
  bets: { outcome: string; bookmaker: string; odds: number; stake: number }[];
}[]> {
  const arbitrageOpps: any[] = [];
  
  const sportsRes = await fetch(`${BASE_URL}/sports/?apiKey=${ODDS_API_KEY}`);
  const sports = await sportsRes.json() as { key: string; active: boolean }[];
  
  // Check NFL, NBA, NHL for arbitrage
  for (const sportKey of ['americanfootball_nfl', 'basketball_nba', 'icehockey_nhl']) {
    const sport = sports.find(s => s.key === sportKey);
    if (!sport?.active) continue;

    const oddsRes = await fetch(
      `${BASE_URL}/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=us,uk,eu&oddsFormat=decimal`
    );
    if (!oddsRes.ok) continue;

    const events = await oddsRes.json() as OddsApiEvent[];

    for (const event of events) {
      const aggregated = aggregateBestOdds(event);
      if (aggregated.length < 2) continue;

      const totalImplied = aggregated.reduce(
        (sum, o) => sum + decimalToProb(o.bestOdds),
        0
      );

      // True arbitrage: total implied < 100%
      if (totalImplied < 100) {
        const profit = ((100 / totalImplied) - 1) * 100;
        const totalStake = 100; // $100 example
        
        const bets = aggregated.map(o => ({
          outcome: o.outcome,
          bookmaker: o.bestBookmaker,
          odds: o.bestOdds,
          stake: (totalStake * decimalToProb(o.bestOdds)) / totalImplied,
        }));

        arbitrageOpps.push({
          event: event.home_team && event.away_team
            ? `${event.away_team} @ ${event.home_team}`
            : 'Unknown',
          sport: sportKey,
          totalImplied,
          profit,
          bets,
        });
      }
    }
  }

  return arbitrageOpps;
}
