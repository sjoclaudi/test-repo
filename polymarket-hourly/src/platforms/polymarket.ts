/**
 * Polymarket API fetcher
 */

import { Market, PlatformFetcher, formatDuration } from './types';

interface PolymarketRaw {
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

const GAMMA_MARKETS_API = 'https://gamma-api.polymarket.com/markets';

export const polymarket: PlatformFetcher = {
  name: 'Polymarket',

  async fetchMarkets(minutesAhead: number): Promise<Market[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + minutesAhead * 60 * 1000);
    
    const params = new URLSearchParams({
      closed: 'false',
      active: 'true',
      limit: '500',
      end_date_min: now.toISOString(),
      end_date_max: cutoff.toISOString(),
    });

    const response = await fetch(`${GAMMA_MARKETS_API}?${params}`);
    if (!response.ok) {
      throw new Error(`Polymarket API failed: ${response.status}`);
    }

    const rawMarkets = await response.json() as PolymarketRaw[];
    const markets: Market[] = [];

    for (const raw of rawMarkets) {
      if (!raw.endDate || raw.closed || !raw.active) continue;

      const endDate = new Date(raw.endDate);
      if (endDate <= now || endDate > cutoff) continue;

      const msUntilEnd = endDate.getTime() - now.getTime();
      let outcomes: { name: string; probability: number }[] = [];

      try {
        const outcomeList = JSON.parse(raw.outcomes) as string[];
        const priceList = JSON.parse(raw.outcomePrices) as string[];
        outcomes = outcomeList.map((name, i) => ({
          name,
          probability: parseFloat(priceList[i]) * 100,
        }));
      } catch {
        // Skip markets with invalid outcome data
      }

      markets.push({
        id: raw.id,
        platform: 'Polymarket',
        question: raw.question,
        url: `https://polymarket.com/event/${raw.slug}`,
        endDate,
        endsIn: formatDuration(msUntilEnd),
        outcomes,
        volume24h: raw.volume24hr || 0,
        liquidity: raw.liquidityNum || 0,
      });
    }

    return markets.sort((a, b) => 
      (a.endDate?.getTime() || 0) - (b.endDate?.getTime() || 0)
    );
  },
};
