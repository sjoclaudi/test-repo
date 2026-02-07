/**
 * Iowa Electronic Markets fetcher
 * Academic prediction market run by University of Iowa
 * Limited public API - scrapes available data
 */

import { Market, PlatformFetcher, formatDuration } from './types';

const IEM_BASE = 'https://iemweb.biz.uiowa.edu/markets/';

export const iem: PlatformFetcher = {
  name: 'Iowa Electronic Markets',

  async fetchMarkets(minutesAhead: number): Promise<Market[]> {
    // IEM doesn't have a public JSON API
    // Markets are primarily US political events with long horizons
    // Most don't expire within hourly windows
    
    console.log('Iowa Electronic Markets: No public JSON API available');
    console.log('See: https://iemweb.biz.uiowa.edu/');
    
    return [];
  },
};
