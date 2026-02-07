#!/usr/bin/env npx ts-node

/**
 * Arbitrage Alert Scanner
 * 
 * Quick scanner for true arbitrage opportunities (odds < 100%)
 * and high-volume near-certain bets. Designed for frequent runs.
 * 
 * Usage:
 *   npx ts-node src/alerts.ts [--minutes N] [--telegram] [--quiet]
 */

import { writeFileSync } from 'fs';
import { polymarket } from './platforms/polymarket';
import { predictit } from './platforms/predictit';
import { manifold } from './platforms/manifold';
import { oddsapi, findBookmakerArbitrage } from './platforms/oddsapi';
import { Market, formatCurrency } from './platforms';

interface Alert {
  type: 'arbitrage' | 'near-certain-high-volume' | 'price-spike' | 'bookmaker-arb';
  severity: 'critical' | 'high' | 'medium';
  market: Market;
  details: {
    totalProbability?: number;
    topOutcome?: string;
    topProbability?: number;
    edge?: number;
    volume?: number;
  };
  message: string;
}

async function scanForAlerts(minutesAhead: number): Promise<Alert[]> {
  const alerts: Alert[] = [];
  
  console.error('🔍 Scanning for alerts...');
  
  // Fetch from all platforms
  const results = await Promise.allSettled([
    polymarket.fetchMarkets(minutesAhead),
    predictit.fetchMarkets(minutesAhead * 10), // PredictIt has longer-term markets
    manifold.fetchMarkets(minutesAhead * 5),   // Manifold also has longer markets
    oddsapi.fetchMarkets(minutesAhead),        // OddsAPI for cross-bookmaker arb
  ]);

  const allMarkets: Market[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allMarkets.push(...result.value);
    }
  }

  console.error(`   Found ${allMarkets.length} markets`);

  for (const market of allMarkets) {
    if (market.outcomes.length < 2) continue;

    const total = market.outcomes.reduce((sum, o) => sum + o.probability, 0);
    const sorted = [...market.outcomes].sort((a, b) => b.probability - a.probability);
    const max = sorted[0].probability;
    const maxOutcome = sorted[0].name;

    // 🚨 CRITICAL: True arbitrage (odds sum to < 98%)
    if (total < 98 && total > 0) {
      const edge = 100 - total;
      alerts.push({
        type: 'arbitrage',
        severity: 'critical',
        market,
        details: {
          totalProbability: total,
          edge,
        },
        message: `🚨 ARBITRAGE: ${market.question}\n` +
                 `   Platform: ${market.platform}\n` +
                 `   Total odds: ${total.toFixed(2)}% (${edge.toFixed(2)}% edge)\n` +
                 `   Bet ALL outcomes for guaranteed profit!\n` +
                 `   ${market.url}`,
      });
    }

    // 🟢 HIGH: Near-certain with high volume (>97%, >$10k volume)
    if (max >= 97 && market.volume24h >= 10000) {
      alerts.push({
        type: 'near-certain-high-volume',
        severity: 'high',
        market,
        details: {
          topOutcome: maxOutcome,
          topProbability: max,
          volume: market.volume24h,
        },
        message: `🟢 HIGH-VOLUME NEAR-CERTAIN: ${market.question}\n` +
                 `   Platform: ${market.platform}\n` +
                 `   "${maxOutcome}" at ${max.toFixed(1)}%\n` +
                 `   24h Volume: ${formatCurrency(market.volume24h)}\n` +
                 `   Ends: ${market.endsIn}\n` +
                 `   ${market.url}`,
      });
    }

    // 🟡 MEDIUM: Near-certain with decent volume (>97%, >$1k volume)  
    else if (max >= 97 && market.volume24h >= 1000) {
      alerts.push({
        type: 'near-certain-high-volume',
        severity: 'medium',
        market,
        details: {
          topOutcome: maxOutcome,
          topProbability: max,
          volume: market.volume24h,
        },
        message: `🟡 NEAR-CERTAIN: ${market.question}\n` +
                 `   Platform: ${market.platform}\n` +
                 `   "${maxOutcome}" at ${max.toFixed(1)}%\n` +
                 `   24h Volume: ${formatCurrency(market.volume24h)}\n` +
                 `   Ends: ${market.endsIn}\n` +
                 `   ${market.url}`,
      });
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

function formatTelegramAlert(alerts: Alert[]): string {
  if (alerts.length === 0) {
    return '';
  }

  const critical = alerts.filter(a => a.severity === 'critical');
  const high = alerts.filter(a => a.severity === 'high');

  let msg = `🚨 *BETTING ALERTS*\n`;
  msg += `${new Date().toLocaleString('en-GB', { timeZone: 'Europe/Madrid' })}\n\n`;

  if (critical.length > 0) {
    msg += `*⚠️ ARBITRAGE OPPORTUNITIES:*\n`;
    for (const alert of critical) {
      msg += `\n🚨 *${alert.market.question.slice(0, 50)}*\n`;
      msg += `   📍 ${alert.market.platform}\n`;
      msg += `   💰 Edge: ${alert.details.edge?.toFixed(2)}%\n`;
      msg += `   🔗 [View](${alert.market.url})\n`;
    }
    msg += `\n`;
  }

  if (high.length > 0) {
    msg += `*🟢 HIGH-VOLUME NEAR-CERTAIN:*\n`;
    for (const alert of high.slice(0, 5)) {
      msg += `\n*${alert.market.question.slice(0, 45)}...*\n`;
      msg += `   📍 ${alert.market.platform} | ⏰ ${alert.market.endsIn}\n`;
      msg += `   📈 ${alert.details.topOutcome}: ${alert.details.topProbability?.toFixed(1)}%\n`;
      msg += `   💰 Vol: ${formatCurrency(alert.details.volume || 0)}\n`;
      msg += `   🔗 [View](${alert.market.url})\n`;
    }
  }

  msg += `\n⚠️ _Act fast - markets move quickly!_`;

  return msg;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const telegramFormat = args.includes('--telegram');

  let minutesAhead = 180;
  const minutesIndex = args.indexOf('--minutes');
  if (minutesIndex !== -1 && args[minutesIndex + 1]) {
    minutesAhead = parseInt(args[minutesIndex + 1], 10) || 180;
  }

  const alerts = await scanForAlerts(minutesAhead);

  const critical = alerts.filter(a => a.severity === 'critical');
  const high = alerts.filter(a => a.severity === 'high');
  const medium = alerts.filter(a => a.severity === 'medium');

  if (!quiet) {
    console.error(`\n📊 Alert Summary:`);
    console.error(`   🚨 Critical (arbitrage): ${critical.length}`);
    console.error(`   🟢 High (near-certain + volume): ${high.length}`);
    console.error(`   🟡 Medium: ${medium.length}`);
  }

  if (telegramFormat) {
    // Only output if there are critical or high alerts
    if (critical.length > 0 || high.length > 0) {
      console.log(formatTelegramAlert(alerts));
    }
  } else {
    // Print all alerts
    for (const alert of alerts) {
      console.log(alert.message);
      console.log('');
    }
  }

  // Save to file
  writeFileSync('/tmp/alerts.json', JSON.stringify(alerts, null, 2));

  // Exit with code 1 if critical alerts found (useful for scripting)
  if (critical.length > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
