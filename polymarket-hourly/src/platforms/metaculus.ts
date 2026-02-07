/**
 * Metaculus API fetcher (forecasting platform, no real money)
 * API: https://www.metaculus.com/api2/questions/
 */

import { Market, PlatformFetcher, formatDuration } from './types';

interface MetaculusQuestion {
  id: number;
  title: string;
  url: string;
  close_time: string;
  resolve_time: string;
  prediction_count: number;
  community_prediction?: {
    full?: {
      q2?: number; // median prediction
    };
  };
  possibilities?: {
    type: string;
  };
}

interface MetaculusResponse {
  results: MetaculusQuestion[];
  next?: string;
}

const METACULUS_API = 'https://www.metaculus.com/api2/questions/';

export const metaculus: PlatformFetcher = {
  name: 'Metaculus',

  async fetchMarkets(minutesAhead: number): Promise<Market[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + minutesAhead * 60 * 1000);

    // Fetch open binary questions
    const params = new URLSearchParams({
      status: 'open',
      type: 'forecast',
      limit: '100',
      order_by: 'close_time',
    });

    const response = await fetch(`${METACULUS_API}?${params}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Metaculus might rate limit, just return empty
      console.error(`Metaculus API failed: ${response.status}`);
      return [];
    }

    const data = await response.json() as MetaculusResponse;
    const markets: Market[] = [];

    for (const raw of data.results) {
      if (!raw.close_time) continue;

      const endDate = new Date(raw.close_time);
      if (endDate <= now || endDate > cutoff) continue;

      const msUntilEnd = endDate.getTime() - now.getTime();

      // Get community prediction (0-1 for binary)
      const prediction = raw.community_prediction?.full?.q2;
      const yesProbability = prediction !== undefined ? prediction * 100 : 50;

      markets.push({
        id: String(raw.id),
        platform: 'Metaculus',
        question: raw.title,
        url: `https://www.metaculus.com${raw.url}`,
        endDate,
        endsIn: formatDuration(msUntilEnd),
        outcomes: [
          { name: 'Yes', probability: yesProbability },
          { name: 'No', probability: 100 - yesProbability },
        ],
        volume24h: raw.prediction_count || 0, // Use prediction count as proxy
        liquidity: 0,
      });
    }

    return markets.sort((a, b) => 
      (a.endDate?.getTime() || 0) - (b.endDate?.getTime() || 0)
    );
  },
};
