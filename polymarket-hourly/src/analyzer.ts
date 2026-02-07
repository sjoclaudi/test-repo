#!/usr/bin/env npx ts-node

/**
 * Polymarket Arbitrage & Low-Risk Bet Analyzer
 * 
 * Identifies betting opportunities with favorable risk profiles:
 * - Arbitrage: Odds that don't sum to 100% (guaranteed profit)
 * - Near-certain: One outcome has very high probability (>90%)
 * - Mispriced: Odds significantly deviate from implied fair value
 * - High liquidity + tight spreads: Low slippage opportunities
 * 
 * Usage:
 *   npx ts-node src/analyzer.ts [--input FILE] [--json] [--threshold N]
 */

import { readFileSync } from 'fs';

interface Market {
  id: string;
  question: string;
  url: string;
  endDate: string;
  endsIn: string;
  outcomes: { name: string; probability: number }[];
  volume24h: number;
  liquidity: number;
}

interface Opportunity {
  type: 'arbitrage' | 'near-certain' | 'mispriced' | 'high-confidence';
  market: Market;
  analysis: {
    totalProbability: number;
    edge: number;
    confidence: string;
    recommendation: string;
    expectedValue?: number;
    riskLevel: 'no-risk' | 'low-risk' | 'medium-risk';
  };
}

function analyzeProbabilities(outcomes: { name: string; probability: number }[]): {
  total: number;
  max: number;
  maxOutcome: string;
  spread: number;
  isArbitrage: boolean;
  isMispriced: boolean;
} {
  if (outcomes.length === 0) {
    return { total: 0, max: 0, maxOutcome: '', spread: 0, isArbitrage: false, isMispriced: false };
  }

  const total = outcomes.reduce((sum, o) => sum + o.probability, 0);
  const sorted = [...outcomes].sort((a, b) => b.probability - a.probability);
  const max = sorted[0].probability;
  const maxOutcome = sorted[0].name;
  const min = sorted[sorted.length - 1].probability;
  const spread = max - min;

  // Arbitrage: total < 100% means you can bet both sides and profit
  // Or total > 100% means the market is overpriced (less common opportunity)
  const isArbitrage = total < 99 || total > 101;

  // Mispriced: probabilities significantly off from 100%
  const isMispriced = Math.abs(total - 100) > 2;

  return { total, max, maxOutcome, spread, isArbitrage, isMispriced };
}

function calculateImpliedOdds(probability: number): number {
  // Convert probability to decimal odds
  if (probability <= 0) return Infinity;
  return 100 / probability;
}

function findOpportunities(markets: Market[], threshold: number = 90): Opportunity[] {
  const opportunities: Opportunity[] = [];

  for (const market of markets) {
    if (market.outcomes.length < 2) continue;

    const analysis = analyzeProbabilities(market.outcomes);

    // 1. ARBITRAGE: Total probability significantly under 100%
    if (analysis.total < 98) {
      const edge = 100 - analysis.total;
      opportunities.push({
        type: 'arbitrage',
        market,
        analysis: {
          totalProbability: analysis.total,
          edge,
          confidence: 'GUARANTEED',
          recommendation: `Bet on ALL outcomes proportionally. Edge: ${edge.toFixed(2)}%`,
          expectedValue: edge,
          riskLevel: 'no-risk',
        },
      });
      continue;
    }

    // 2. NEAR-CERTAIN: One outcome has very high probability
    if (analysis.max >= threshold) {
      const impliedOdds = calculateImpliedOdds(analysis.max);
      const edge = analysis.max - (100 / market.outcomes.length);

      opportunities.push({
        type: 'near-certain',
        market,
        analysis: {
          totalProbability: analysis.total,
          edge,
          confidence: `${analysis.max.toFixed(1)}% likely`,
          recommendation: `Strong lean: "${analysis.maxOutcome}" at ${analysis.max.toFixed(1)}%. Odds: ${impliedOdds.toFixed(2)}x`,
          expectedValue: analysis.max - 100 / impliedOdds,
          riskLevel: analysis.max >= 97 ? 'low-risk' : 'medium-risk',
        },
      });
      continue;
    }

    // 3. MISPRICED: Probabilities don't add to ~100%
    if (analysis.isMispriced && analysis.total > 102) {
      // Overpriced market - opportunities to sell/short if available
      const overpricing = analysis.total - 100;
      opportunities.push({
        type: 'mispriced',
        market,
        analysis: {
          totalProbability: analysis.total,
          edge: overpricing,
          confidence: `Market overpriced by ${overpricing.toFixed(1)}%`,
          recommendation: `Market inefficiency detected. Total odds: ${analysis.total.toFixed(1)}%`,
          riskLevel: 'medium-risk',
        },
      });
    }
  }

  // Sort by risk level (no-risk first) then by edge
  const riskOrder = { 'no-risk': 0, 'low-risk': 1, 'medium-risk': 2 };
  opportunities.sort((a, b) => {
    const riskDiff = riskOrder[a.analysis.riskLevel] - riskOrder[b.analysis.riskLevel];
    if (riskDiff !== 0) return riskDiff;
    return b.analysis.edge - a.analysis.edge;
  });

  return opportunities;
}

function formatOpportunity(opp: Opportunity, index: number): void {
  const riskEmoji = {
    'no-risk': '🟢',
    'low-risk': '🟡',
    'medium-risk': '🟠',
  };

  console.log('\n' + '═'.repeat(70));
  console.log(`${riskEmoji[opp.analysis.riskLevel]} #${index + 1} | ${opp.type.toUpperCase()} | Risk: ${opp.analysis.riskLevel}`);
  console.log('═'.repeat(70));
  console.log(`📊 ${opp.market.question}`);
  console.log(`⏰ Ends: ${opp.market.endsIn}`);
  console.log(`🔗 ${opp.market.url}`);
  console.log('');
  console.log(`📈 Odds breakdown:`);
  for (const outcome of opp.market.outcomes) {
    const bar = '█'.repeat(Math.round(outcome.probability / 5));
    console.log(`   ${outcome.name}: ${outcome.probability.toFixed(1)}% ${bar}`);
  }
  console.log('');
  console.log(`📐 Total probability: ${opp.analysis.totalProbability.toFixed(1)}%`);
  console.log(`📊 Edge: ${opp.analysis.edge.toFixed(2)}%`);
  console.log(`💡 ${opp.analysis.confidence}`);
  console.log(`✅ ${opp.analysis.recommendation}`);
  console.log(`💰 Volume: $${opp.market.volume24h.toLocaleString()} | Liquidity: $${opp.market.liquidity.toLocaleString()}`);
}

function printSummary(opportunities: Opportunity[]): void {
  const noRisk = opportunities.filter(o => o.analysis.riskLevel === 'no-risk');
  const lowRisk = opportunities.filter(o => o.analysis.riskLevel === 'low-risk');
  const medRisk = opportunities.filter(o => o.analysis.riskLevel === 'medium-risk');

  console.log('\n' + '═'.repeat(70));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(70));
  console.log(`🟢 No-risk (arbitrage):     ${noRisk.length}`);
  console.log(`🟡 Low-risk (>97% certain): ${lowRisk.length}`);
  console.log(`🟠 Medium-risk (>90%):      ${medRisk.length}`);
  console.log(`   Total opportunities:     ${opportunities.length}`);

  if (noRisk.length > 0) {
    console.log('\n🎯 TOP ARBITRAGE OPPORTUNITIES:');
    for (const opp of noRisk.slice(0, 3)) {
      console.log(`   • ${opp.market.question.slice(0, 50)}... (${opp.analysis.edge.toFixed(2)}% edge)`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  let inputFile = 'markets.json';
  const inputIndex = args.indexOf('--input');
  if (inputIndex !== -1 && args[inputIndex + 1]) {
    inputFile = args[inputIndex + 1];
  }

  let threshold = 90;
  const thresholdIndex = args.indexOf('--threshold');
  if (thresholdIndex !== -1 && args[thresholdIndex + 1]) {
    threshold = parseFloat(args[thresholdIndex + 1]);
  }

  try {
    const data = readFileSync(inputFile, 'utf-8');
    const markets: Market[] = JSON.parse(data);

    const opportunities = findOpportunities(markets, threshold);

    if (jsonOutput) {
      console.log(JSON.stringify(opportunities, null, 2));
      return;
    }

    console.log('\n🎲 POLYMARKET LOW-RISK BET ANALYZER');
    console.log(`   Input: ${inputFile}`);
    console.log(`   Markets analyzed: ${markets.length}`);
    console.log(`   Threshold: ${threshold}%`);
    console.log(`   Time: ${new Date().toISOString()}`);

    if (opportunities.length === 0) {
      console.log('\n   ❌ No opportunities found matching criteria.');
      console.log('   Try lowering --threshold or fetching more markets.');
    } else {
      for (let i = 0; i < opportunities.length; i++) {
        formatOpportunity(opportunities[i], i);
      }
      printSummary(opportunities);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('⚠️  DISCLAIMER: This is statistical analysis, not financial advice.');
    console.log('   Always verify odds on Polymarket before placing bets.');
    console.log('   Past patterns do not guarantee future results.');
    console.log('═'.repeat(70));

  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`Error: Input file "${inputFile}" not found.`);
      console.error('Run the fetcher first: npx ts-node src/index.ts --output markets.json');
    } else {
      console.error('Error:', error);
    }
    process.exit(1);
  }
}

main();
