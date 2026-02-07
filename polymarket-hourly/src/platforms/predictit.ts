/**
 * PredictIt API fetcher
 * API: https://www.predictit.org/api/marketdata/all/
 */

import { Market, PlatformFetcher, formatDuration } from './types';

interface PredictItContract {
  id: number;
  name: string;
  shortName: string;
  status: string;
  lastTradePrice: number;
  bestBuyYesCost: number;
  bestBuyNoCost: number;
  dateEnd: string;
}

interface PredictItMarket {
  id: number;
  name: string;
  shortName: string;
  url: string;
  contracts: PredictItContract[];
}

interface PredictItResponse {
  markets: PredictItMarket[];
}

const PREDICTIT_API = 'https://www.predictit.org/api/marketdata/all/';

export const predictit: PlatformFetcher = {
  name: 'PredictIt',

  async fetchMarkets(minutesAhead: number): Promise<Market[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + minutesAhead * 60 * 1000);

    const response = await fetch(PREDICTIT_API);
    if (!response.ok) {
      throw new Error(`PredictIt API failed: ${response.status}`);
    }

    const data = await response.json() as PredictItResponse;
    const markets: Market[] = [];

    for (const raw of data.markets) {
      // PredictIt markets have multiple contracts (outcomes)
      // Check if any contract ends within our window
      let earliestEnd: Date | null = null;
      const outcomes: { name: string; probability: number }[] = [];

      for (const contract of raw.contracts) {
        if (contract.status !== 'Open') continue;

        // PredictIt uses "NA" for markets with no end date
        if (contract.dateEnd && contract.dateEnd !== 'NA') {
          const contractEnd = new Date(contract.dateEnd);
          if (contractEnd > now && contractEnd <= cutoff) {
            if (!earliestEnd || contractEnd < earliestEnd) {
              earliestEnd = contractEnd;
            }
          }
        }

        // Price is 0-1, convert to percentage
        const probability = (contract.lastTradePrice || contract.bestBuyYesCost || 0) * 100;
        outcomes.push({
          name: contract.shortName || contract.name,
          probability,
        });
      }

      // Only include markets with end dates in our window
      if (!earliestEnd) continue;

      const msUntilEnd = earliestEnd.getTime() - now.getTime();

      markets.push({
        id: String(raw.id),
        platform: 'PredictIt',
        question: raw.name,
        url: raw.url,
        endDate: earliestEnd,
        endsIn: formatDuration(msUntilEnd),
        outcomes,
        volume24h: 0, // PredictIt doesn't expose volume in API
        liquidity: 0,
      });
    }

    return markets.sort((a, b) => 
      (a.endDate?.getTime() || 0) - (b.endDate?.getTime() || 0)
    );
  },
};
