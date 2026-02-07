/**
 * Manifold Markets API fetcher
 * API: https://api.manifold.markets/v0/markets
 * 
 * Manifold is a play-money prediction market (no real money),
 * but useful for probability signals and cross-platform comparison.
 */

import { Market, PlatformFetcher, formatDuration } from './types';

interface ManifoldMarket {
  id: string;
  question: string;
  slug: string;
  url: string;
  createdTime: number;
  closeTime: number;
  probability: number;
  pool?: { YES: number; NO: number };
  totalLiquidity: number;
  volume: number;
  volume24Hours: number;
  isResolved: boolean;
  outcomeType: string;
  mechanism: string;
}

const MANIFOLD_API = 'https://api.manifold.markets/v0/markets';

export const manifold: PlatformFetcher = {
  name: 'Manifold',

  async fetchMarkets(minutesAhead: number): Promise<Market[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + minutesAhead * 60 * 1000);
    const markets: Market[] = [];

    try {
      // Manifold returns markets sorted by recent activity
      const response = await fetch(`${MANIFOLD_API}?limit=500`);
      if (!response.ok) {
        console.error(`Manifold API error: ${response.status}`);
        return [];
      }

      const data = await response.json() as ManifoldMarket[];

      for (const raw of data) {
        // Skip resolved markets
        if (raw.isResolved) continue;
        
        // Only binary markets for now
        if (raw.outcomeType !== 'BINARY') continue;
        
        // Check close time
        if (!raw.closeTime) continue;
        const endDate = new Date(raw.closeTime);
        if (endDate <= now || endDate > cutoff) continue;

        const msUntilEnd = endDate.getTime() - now.getTime();
        const probability = (raw.probability || 0.5) * 100;

        markets.push({
          id: raw.id,
          platform: 'Manifold',
          question: raw.question,
          url: raw.url || `https://manifold.markets/${raw.slug}`,
          endDate,
          endsIn: formatDuration(msUntilEnd),
          outcomes: [
            { name: 'Yes', probability },
            { name: 'No', probability: 100 - probability },
          ],
          volume24h: raw.volume24Hours || 0,
          liquidity: raw.totalLiquidity || 0,
        });
      }

      return markets.sort((a, b) =>
        (a.endDate?.getTime() || 0) - (b.endDate?.getTime() || 0)
      );
    } catch (error) {
      console.error('Manifold fetch error:', error);
      return [];
    }
  },
};
