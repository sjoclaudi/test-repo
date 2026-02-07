#!/usr/bin/env npx ts-node

/**
 * Multi-Platform Prediction Market Scanner
 * 
 * Fetches markets from multiple prediction platforms and finds opportunities.
 * 
 * Usage:
 *   npx ts-node src/multi-scanner.ts [options]
 * 
 * Options:
 *   --minutes N      Look ahead N minutes (default: 180)
 *   --platforms X    Comma-separated list: polymarket,kalshi,predictit,metaculus,augur
 *   --output FILE    Save results to JSON file
 *   --json           Output as JSON only
 */

import { writeFileSync } from 'fs';
import { Market, PlatformFetcher, formatCurrency } from './platforms';
import { polymarket } from './platforms/polymarket';
import { kalshi } from './platforms/kalshi';
import { predictit } from './platforms/predictit';
import { metaculus } from './platforms/metaculus';
import { augur } from './platforms/augur';

import { manifold } from './platforms/manifold';

const platformMap: Record<string, PlatformFetcher> = {
  polymarket,
  kalshi,
  predictit,
  metaculus,
  augur,
  manifold,
};

interface Opportunity {
  type: 'arbitrage' | 'near-certain' | 'mispriced' | 'cross-platform';
  market: Market;
  analysis: {
    totalProbability: number;
    edge: number;
    confidence: string;
    recommendation: string;
    riskLevel: 'no-risk' | 'low-risk' | 'medium-risk';
  };
}

function analyzeMarket(market: Market): Opportunity | null {
  if (market.outcomes.length < 2) return null;

  const total = market.outcomes.reduce((sum, o) => sum + o.probability, 0);
  const sorted = [...market.outcomes].sort((a, b) => b.probability - a.probability);
  const max = sorted[0].probability;
  const maxOutcome = sorted[0].name;

  // Arbitrage: probabilities don't sum to 100%
  if (total < 98) {
    return {
      type: 'arbitrage',
      market,
      analysis: {
        totalProbability: total,
        edge: 100 - total,
        confidence: 'GUARANTEED',
        recommendation: `Bet on ALL outcomes. Edge: ${(100 - total).toFixed(2)}%`,
        riskLevel: 'no-risk',
      },
    };
  }

  // Near-certain: one outcome >97%
  if (max >= 97) {
    return {
      type: 'near-certain',
      market,
      analysis: {
        totalProbability: total,
        edge: max - 50,
        confidence: `${max.toFixed(1)}% likely`,
        recommendation: `Strong lean: "${maxOutcome}" at ${max.toFixed(1)}%`,
        riskLevel: 'low-risk',
      },
    };
  }

  // Medium confidence: >90%
  if (max >= 90) {
    return {
      type: 'near-certain',
      market,
      analysis: {
        totalProbability: total,
        edge: max - 50,
        confidence: `${max.toFixed(1)}% likely`,
        recommendation: `Lean: "${maxOutcome}" at ${max.toFixed(1)}%`,
        riskLevel: 'medium-risk',
      },
    };
  }

  return null;
}

function printMarket(market: Market): void {
  console.log('\n' + '─'.repeat(70));
  console.log(`[${market.platform}] 📊 ${market.question}`);
  console.log(`   ⏰ Ends: ${market.endsIn}`);
  console.log(`   🔗 ${market.url}`);
  
  if (market.outcomes.length > 0) {
    console.log('   📈 Odds:');
    for (const outcome of market.outcomes.slice(0, 5)) {
      const bar = '█'.repeat(Math.round(outcome.probability / 5));
      console.log(`      ${outcome.name}: ${outcome.probability.toFixed(1)}% ${bar}`);
    }
    if (market.outcomes.length > 5) {
      console.log(`      ... and ${market.outcomes.length - 5} more`);
    }
  }
  
  if (market.volume24h > 0 || market.liquidity > 0) {
    console.log(`   💰 Volume: ${formatCurrency(market.volume24h)} | Liquidity: ${formatCurrency(market.liquidity)}`);
  }
}

function printOpportunity(opp: Opportunity, index: number): void {
  const riskEmoji = {
    'no-risk': '🟢',
    'low-risk': '🟡',
    'medium-risk': '🟠',
  };

  console.log('\n' + '═'.repeat(70));
  console.log(`${riskEmoji[opp.analysis.riskLevel]} #${index + 1} | ${opp.type.toUpperCase()} | ${opp.market.platform}`);
  console.log('═'.repeat(70));
  console.log(`📊 ${opp.market.question}`);
  console.log(`⏰ Ends: ${opp.market.endsIn}`);
  console.log(`🔗 ${opp.market.url}`);
  
  console.log('\n📈 Odds:');
  for (const outcome of opp.market.outcomes.slice(0, 5)) {
    const bar = '█'.repeat(Math.round(outcome.probability / 5));
    console.log(`   ${outcome.name}: ${outcome.probability.toFixed(1)}% ${bar}`);
  }
  
  console.log(`\n📐 Total: ${opp.analysis.totalProbability.toFixed(1)}% | Edge: ${opp.analysis.edge.toFixed(2)}%`);
  console.log(`💡 ${opp.analysis.recommendation}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  // Parse minutes
  let minutesAhead = 180;
  const minutesIndex = args.indexOf('--minutes');
  if (minutesIndex !== -1 && args[minutesIndex + 1]) {
    minutesAhead = parseInt(args[minutesIndex + 1], 10) || 180;
  }

  // Parse platforms
  let selectedPlatforms = ['polymarket', 'kalshi', 'predictit'];
  const platformsIndex = args.indexOf('--platforms');
  if (platformsIndex !== -1 && args[platformsIndex + 1]) {
    selectedPlatforms = args[platformsIndex + 1].split(',').map(p => p.trim().toLowerCase());
  }

  // Parse output file
  let outputFile: string | null = null;
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    outputFile = args[outputIndex + 1];
  }

  const fetchers = selectedPlatforms
    .map(name => platformMap[name])
    .filter(Boolean);

  if (!jsonOutput) {
    console.log('\n🎲 MULTI-PLATFORM PREDICTION MARKET SCANNER');
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log(`   Looking ahead: ${minutesAhead} minutes`);
    console.log(`   Platforms: ${selectedPlatforms.join(', ')}`);
  }

  // Fetch from all platforms in parallel
  const results = await Promise.allSettled(
    fetchers.map(async (fetcher) => {
      const start = Date.now();
      try {
        const markets = await fetcher.fetchMarkets(minutesAhead);
        if (!jsonOutput) {
          console.log(`   ✓ ${fetcher.name}: ${markets.length} markets (${Date.now() - start}ms)`);
        }
        return { platform: fetcher.name, markets };
      } catch (error) {
        if (!jsonOutput) {
          console.log(`   ✗ ${fetcher.name}: ${error}`);
        }
        return { platform: fetcher.name, markets: [] };
      }
    })
  );

  // Combine all markets
  const allMarkets: Market[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allMarkets.push(...result.value.markets);
    }
  }

  // Analyze for opportunities
  const opportunities: Opportunity[] = [];
  for (const market of allMarkets) {
    const opp = analyzeMarket(market);
    if (opp) opportunities.push(opp);
  }

  // Sort by risk level then edge
  const riskOrder = { 'no-risk': 0, 'low-risk': 1, 'medium-risk': 2 };
  opportunities.sort((a, b) => {
    const riskDiff = riskOrder[a.analysis.riskLevel] - riskOrder[b.analysis.riskLevel];
    if (riskDiff !== 0) return riskDiff;
    return b.analysis.edge - a.analysis.edge;
  });

  if (jsonOutput) {
    const output = { markets: allMarkets, opportunities };
    console.log(JSON.stringify(output, null, 2));
    if (outputFile) {
      writeFileSync(outputFile, JSON.stringify(output, null, 2));
    }
    return;
  }

  // Print summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Total markets found: ${allMarkets.length}`);
  
  const byPlatform = allMarkets.reduce((acc, m) => {
    acc[m.platform] = (acc[m.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  for (const [platform, count] of Object.entries(byPlatform)) {
    console.log(`   ${platform}: ${count}`);
  }

  const noRisk = opportunities.filter(o => o.analysis.riskLevel === 'no-risk');
  const lowRisk = opportunities.filter(o => o.analysis.riskLevel === 'low-risk');
  const medRisk = opportunities.filter(o => o.analysis.riskLevel === 'medium-risk');

  console.log(`\n🎯 Opportunities:`);
  console.log(`   🟢 No-risk (arbitrage): ${noRisk.length}`);
  console.log(`   🟡 Low-risk (>97%):     ${lowRisk.length}`);
  console.log(`   🟠 Medium-risk (>90%):  ${medRisk.length}`);

  // Print top opportunities
  if (opportunities.length > 0) {
    console.log('\n🏆 TOP OPPORTUNITIES:');
    for (let i = 0; i < Math.min(10, opportunities.length); i++) {
      printOpportunity(opportunities[i], i);
    }
  }

  if (outputFile) {
    const output = { markets: allMarkets, opportunities };
    writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n📁 Results saved to: ${outputFile}`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('⚠️  DISCLAIMER: Statistical analysis only. Not financial advice.');
  console.log('═'.repeat(70));
}

main().catch(console.error);
