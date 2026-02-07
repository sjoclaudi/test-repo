/**
 * Smarkets API fetcher
 * API: https://api.smarkets.com/v3/events/
 */

import { Market, PlatformFetcher, formatDuration } from './types';

interface SmarketsContract {
  id: string;
  name: string;
  slug: string;
}

interface SmarketsMarket {
  id: string;
  name: string;
  slug: string;
  event_id: string;
  contracts: SmarketsContract[];
}

interface SmarketsEvent {
  id: string;
  name: string;
  slug: string;
  start_datetime: string;
  end_datetime?: string;
}

interface SmarketsQuote {
  contract_id: string;
  bids: { price: number; quantity: number }[];
  offers: { price: number; quantity: number }[];
}

const SMARKETS_API = 'https://api.smarkets.com/v3';

export const smarkets: PlatformFetcher = {
  name: 'Smarkets',

  async fetchMarkets(minutesAhead: number): Promise<Market[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + minutesAhead * 60 * 1000);

    try {
      // Get upcoming events
      const eventsResponse = await fetch(`${SMARKETS_API}/events/?state=upcoming&type=football,politics,entertainment&limit=50`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!eventsResponse.ok) {
        console.error(`Smarkets events API failed: ${eventsResponse.status}`);
        return [];
      }

      const eventsData = await eventsResponse.json() as { events?: SmarketsEvent[] };
      const events: SmarketsEvent[] = eventsData.events || [];
      const markets: Market[] = [];

      for (const event of events) {
        const endDate = event.end_datetime ? new Date(event.end_datetime) : new Date(event.start_datetime);
        if (endDate <= now || endDate > cutoff) continue;

        // Get markets for this event
        const marketsResponse = await fetch(`${SMARKETS_API}/events/${event.id}/markets/`, {
          headers: { 'Accept': 'application/json' },
        });

        if (!marketsResponse.ok) continue;

        const marketsData = await marketsResponse.json() as { markets?: SmarketsMarket[] };
        const eventMarkets: SmarketsMarket[] = marketsData.markets || [];

        for (const market of eventMarkets) {
          const msUntilEnd = endDate.getTime() - now.getTime();

          // Get quotes for contracts
          const outcomes: { name: string; probability: number }[] = [];
          for (const contract of market.contracts || []) {
            // Smarkets prices are in basis points (10000 = 100%)
            // We'd need another API call for quotes, simplified here
            outcomes.push({
              name: contract.name,
              probability: 50, // Default, would need quotes API
            });
          }

          markets.push({
            id: market.id,
            platform: 'Smarkets',
            question: `${event.name}: ${market.name}`,
            url: `https://smarkets.com/event/${event.id}/${event.slug}`,
            endDate,
            endsIn: formatDuration(msUntilEnd),
            outcomes,
            volume24h: 0,
            liquidity: 0,
          });
        }
      }

      return markets.sort((a, b) => 
        (a.endDate?.getTime() || 0) - (b.endDate?.getTime() || 0)
      );
    } catch (error) {
      console.error('Smarkets fetch error:', error);
      return [];
    }
  },
};
