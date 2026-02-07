/**
 * Common types for all prediction market platforms
 */

export interface Market {
  id: string;
  platform: string;
  question: string;
  url: string;
  endDate: Date | null;
  endsIn: string;
  outcomes: Outcome[];
  volume24h: number;
  liquidity: number;
}

export interface Outcome {
  name: string;
  probability: number;  // 0-100
}

export interface PlatformFetcher {
  name: string;
  fetchMarkets(minutesAhead: number): Promise<Market[]>;
}

export function formatDuration(ms: number): string {
  if (ms < 0) return 'ended';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'less than a minute';
  if (minutes === 1) return '1 minute';
  if (minutes < 60) return `${minutes} minutes`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    if (remainingMinutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${remainingMinutes}m`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) return `${days} day${days > 1 ? 's' : ''}`;
  return `${days}d ${remainingHours}h`;
}

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}
