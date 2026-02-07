/**
 * Platform registry - exports all available fetchers
 */

export * from './types';
export { polymarket } from './polymarket';
export { kalshi } from './kalshi';
export { predictit } from './predictit';
export { metaculus } from './metaculus';
export { smarkets } from './smarkets';
export { betfair } from './betfair';
export { augur } from './augur';
export { iem } from './iem';

import { PlatformFetcher } from './types';
import { polymarket } from './polymarket';
import { kalshi } from './kalshi';
import { predictit } from './predictit';
import { metaculus } from './metaculus';
import { smarkets } from './smarkets';
import { betfair } from './betfair';
import { augur } from './augur';
import { iem } from './iem';

// All available platforms
export const allPlatforms: PlatformFetcher[] = [
  polymarket,
  kalshi,
  predictit,
  metaculus,
  smarkets,
  betfair,
  augur,
  iem,
];

// Platforms with working public APIs
export const activePlatforms: PlatformFetcher[] = [
  polymarket,
  kalshi,
  predictit,
  metaculus,
  // smarkets, // Needs rate limit handling
  augur,
];
