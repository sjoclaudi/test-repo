/**
 * Augur decentralized prediction market (Ethereum)
 * Note: Augur requires reading from Ethereum blockchain or their subgraph
 */

import { Market, PlatformFetcher, formatDuration } from './types';

// Augur uses The Graph for indexing
const AUGUR_SUBGRAPH = 'https://api.thegraph.com/subgraphs/name/augurproject/augur-v2';

interface AugurMarket {
  id: string;
  description: string;
  endTime: string;
  outcomes: string[];
  volume: string;
  openInterest: string;
}

export const augur: PlatformFetcher = {
  name: 'Augur',

  async fetchMarkets(minutesAhead: number): Promise<Market[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + minutesAhead * 60 * 1000);

    const query = `
      query {
        markets(
          first: 100,
          where: {
            finalized: false,
            endTime_gt: "${Math.floor(now.getTime() / 1000)}",
            endTime_lt: "${Math.floor(cutoff.getTime() / 1000)}"
          },
          orderBy: endTime,
          orderDirection: asc
        ) {
          id
          description
          endTime
          outcomes
          volume
          openInterest
        }
      }
    `;

    try {
      const response = await fetch(AUGUR_SUBGRAPH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        console.error(`Augur subgraph failed: ${response.status}`);
        return [];
      }

      const data = await response.json() as { data?: { markets?: AugurMarket[] } };
      const rawMarkets: AugurMarket[] = data?.data?.markets || [];
      const markets: Market[] = [];

      for (const raw of rawMarkets) {
        const endDate = new Date(parseInt(raw.endTime) * 1000);
        const msUntilEnd = endDate.getTime() - now.getTime();

        markets.push({
          id: raw.id,
          platform: 'Augur',
          question: raw.description,
          url: `https://augur.net/market/${raw.id}`,
          endDate,
          endsIn: formatDuration(msUntilEnd),
          outcomes: (raw.outcomes || ['Yes', 'No']).map((name, i) => ({
            name,
            probability: 50, // Would need AMM state for real prices
          })),
          volume24h: parseFloat(raw.volume || '0'),
          liquidity: parseFloat(raw.openInterest || '0'),
        });
      }

      return markets;
    } catch (error) {
      console.error('Augur fetch error:', error);
      return [];
    }
  },
};
