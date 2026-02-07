/**
 * Kalshi API fetcher
 * API: https://api.elections.kalshi.com/trade-api/v2/markets
 */

import { Market, PlatformFetcher, formatDuration } from './types';

interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle?: string;
  status: string;
  close_time: string;
  expiration_time: string;
  expected_expiration_time?: string;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume_24h: number;
  liquidity: number;
  event_ticker: string;
}

interface KalshiResponse {
  markets: KalshiMarket[];
  cursor?: string;
}

const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2/markets';

export const kalshi: PlatformFetcher = {
  name: 'Kalshi',

  async fetchMarkets(minutesAhead: number): Promise<Market[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + minutesAhead * 60 * 1000);
    const markets: Market[] = [];

    let cursor: string | undefined;
    let pages = 0;
    const maxPages = 5; // Limit to avoid rate limiting

    try {
      while (pages < maxPages) {
        const params = new URLSearchParams({
          limit: '100',
          status: 'active',
        });
        if (cursor) {
          params.set('cursor', cursor);
        }

        const response = await fetch(`${KALSHI_API}?${params}`);
        if (!response.ok) {
          console.error(`Kalshi API error: ${response.status}`);
          break;
        }

        const data = await response.json() as KalshiResponse;

        for (const raw of data.markets) {
          if (raw.status !== 'active') continue;

          // Use expected_expiration_time if available, otherwise expiration_time
          const expTime = raw.expected_expiration_time || raw.expiration_time;
          if (!expTime) continue;

          const endDate = new Date(expTime);
          if (endDate <= now || endDate > cutoff) continue;

          const msUntilEnd = endDate.getTime() - now.getTime();

          // Kalshi uses cents (0-100), yes_bid/yes_ask represent probabilities
          const yesProbability = raw.last_price || ((raw.yes_bid + raw.yes_ask) / 2);
          const noProbability = 100 - yesProbability;

          markets.push({
            id: raw.ticker,
            platform: 'Kalshi',
            question: raw.title,
            url: `https://kalshi.com/markets/${raw.event_ticker}`,
            endDate,
            endsIn: formatDuration(msUntilEnd),
            outcomes: [
              { name: 'Yes', probability: yesProbability },
              { name: 'No', probability: noProbability },
            ],
            volume24h: raw.volume_24h || 0,
            liquidity: raw.liquidity || 0,
          });
        }

        cursor = data.cursor;
        if (!cursor) break;
        pages++;
      }
    } catch (error) {
      console.error('Kalshi fetch error:', error);
    }

    return markets.sort((a, b) => 
      (a.endDate?.getTime() || 0) - (b.endDate?.getTime() || 0)
    );
  },
};
