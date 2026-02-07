#!/usr/bin/env npx ts-node

/**
 * Polymarket Report Generator
 * 
 * Generates formatted reports for Telegram and Email from analyzer output.
 * 
 * Usage:
 *   npx ts-node src/report.ts --input opportunities.json --format telegram|email|text
 */

import { readFileSync, writeFileSync } from 'fs';

interface Opportunity {
  type: 'arbitrage' | 'near-certain' | 'mispriced' | 'high-confidence';
  market: {
    id: string;
    question: string;
    url: string;
    endDate: string;
    endsIn: string;
    outcomes: { name: string; probability: number }[];
    volume24h: number;
    liquidity: number;
  };
  analysis: {
    totalProbability: number;
    edge: number;
    confidence: string;
    recommendation: string;
    expectedValue?: number;
    riskLevel: 'no-risk' | 'low-risk' | 'medium-risk';
  };
}

function formatTelegram(opportunities: Opportunity[]): string {
  if (opportunities.length === 0) {
    return '📊 *Polymarket Scan*\n\nNo opportunities found this scan.';
  }

  const noRisk = opportunities.filter(o => o.analysis.riskLevel === 'no-risk');
  const lowRisk = opportunities.filter(o => o.analysis.riskLevel === 'low-risk');
  const medRisk = opportunities.filter(o => o.analysis.riskLevel === 'medium-risk');

  let msg = `🎲 *Polymarket Opportunities*\n`;
  msg += `📅 ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/Madrid' })}\n\n`;

  msg += `📊 *Summary:*\n`;
  msg += `🟢 No-risk: ${noRisk.length}\n`;
  msg += `🟡 Low-risk: ${lowRisk.length}\n`;
  msg += `🟠 Medium-risk: ${medRisk.length}\n\n`;

  // Show top 5 opportunities
  const top = opportunities.slice(0, 5);
  
  for (const opp of top) {
    const emoji = opp.analysis.riskLevel === 'no-risk' ? '🟢' : 
                  opp.analysis.riskLevel === 'low-risk' ? '🟡' : '🟠';
    
    const bestOutcome = opp.market.outcomes.reduce((a, b) => 
      a.probability > b.probability ? a : b
    );

    msg += `${emoji} *${opp.market.question.slice(0, 50)}${opp.market.question.length > 50 ? '...' : ''}*\n`;
    msg += `   ⏰ ${opp.market.endsIn}\n`;
    msg += `   📈 ${bestOutcome.name}: ${bestOutcome.probability.toFixed(1)}%\n`;
    msg += `   💰 Liquidity: $${opp.market.liquidity.toLocaleString()}\n`;
    msg += `   🔗 [View](${opp.market.url})\n\n`;
  }

  if (opportunities.length > 5) {
    msg += `_...and ${opportunities.length - 5} more opportunities_\n`;
  }

  msg += `\n⚠️ _Not financial advice. Verify before betting._`;

  return msg;
}

function formatEmail(opportunities: Opportunity[]): string {
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Madrid' });
  
  let html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .opportunity { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; }
    .no-risk { border-left: 4px solid #22c55e; }
    .low-risk { border-left: 4px solid #eab308; }
    .medium-risk { border-left: 4px solid #f97316; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .tag-no-risk { background: #dcfce7; color: #166534; }
    .tag-low-risk { background: #fef9c3; color: #854d0e; }
    .tag-medium-risk { background: #ffedd5; color: #9a3412; }
    .odds-bar { background: #e5e7eb; height: 20px; border-radius: 4px; overflow: hidden; margin: 5px 0; }
    .odds-fill { background: #3b82f6; height: 100%; }
    a { color: #2563eb; }
    .disclaimer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>🎲 Polymarket Daily Report</h1>
  <p>Generated: ${now}</p>
  
  <div class="summary">
    <h3>📊 Summary</h3>
    <p>
      🟢 No-risk (arbitrage): <strong>${opportunities.filter(o => o.analysis.riskLevel === 'no-risk').length}</strong><br>
      🟡 Low-risk (>97%): <strong>${opportunities.filter(o => o.analysis.riskLevel === 'low-risk').length}</strong><br>
      🟠 Medium-risk (>90%): <strong>${opportunities.filter(o => o.analysis.riskLevel === 'medium-risk').length}</strong><br>
      Total: <strong>${opportunities.length}</strong>
    </p>
  </div>

  <h2>Top Opportunities</h2>
`;

  for (const opp of opportunities.slice(0, 10)) {
    const bestOutcome = opp.market.outcomes.reduce((a, b) => 
      a.probability > b.probability ? a : b
    );
    const riskClass = opp.analysis.riskLevel.replace('-', '-');

    html += `
  <div class="opportunity ${riskClass}">
    <span class="tag tag-${riskClass}">${opp.analysis.riskLevel.toUpperCase()}</span>
    <span class="tag" style="background:#dbeafe;color:#1e40af;">${opp.type}</span>
    <h3>${opp.market.question}</h3>
    <p>⏰ Ends: ${opp.market.endsIn}</p>
    
    <p><strong>Odds:</strong></p>
    ${opp.market.outcomes.map(o => `
      <div>
        ${o.name}: ${o.probability.toFixed(1)}%
        <div class="odds-bar"><div class="odds-fill" style="width:${o.probability}%"></div></div>
      </div>
    `).join('')}
    
    <p>
      📊 Edge: ${opp.analysis.edge.toFixed(2)}%<br>
      💰 Liquidity: $${opp.market.liquidity.toLocaleString()}<br>
      💡 ${opp.analysis.recommendation}
    </p>
    <p><a href="${opp.market.url}">View on Polymarket →</a></p>
  </div>
`;
  }

  html += `
  <div class="disclaimer">
    <p>⚠️ <strong>Disclaimer:</strong> This is statistical analysis, not financial advice. 
    Always verify odds on Polymarket before placing bets. Past patterns do not guarantee future results.</p>
    <p>Generated by JoClaudi 🦊</p>
  </div>
</body>
</html>`;

  return html;
}

function formatText(opportunities: Opportunity[]): string {
  if (opportunities.length === 0) {
    return 'Polymarket Scan: No opportunities found.';
  }

  let text = `POLYMARKET OPPORTUNITIES REPORT\n`;
  text += `Generated: ${new Date().toISOString()}\n`;
  text += `${'='.repeat(50)}\n\n`;

  const noRisk = opportunities.filter(o => o.analysis.riskLevel === 'no-risk');
  const lowRisk = opportunities.filter(o => o.analysis.riskLevel === 'low-risk');
  const medRisk = opportunities.filter(o => o.analysis.riskLevel === 'medium-risk');

  text += `SUMMARY:\n`;
  text += `  No-risk (arbitrage): ${noRisk.length}\n`;
  text += `  Low-risk (>97%):     ${lowRisk.length}\n`;
  text += `  Medium-risk (>90%):  ${medRisk.length}\n`;
  text += `  Total:               ${opportunities.length}\n\n`;

  text += `${'='.repeat(50)}\n\n`;

  for (const opp of opportunities) {
    text += `[${opp.analysis.riskLevel.toUpperCase()}] ${opp.market.question}\n`;
    text += `  Ends: ${opp.market.endsIn}\n`;
    text += `  Edge: ${opp.analysis.edge.toFixed(2)}%\n`;
    text += `  ${opp.analysis.recommendation}\n`;
    text += `  URL: ${opp.market.url}\n\n`;
  }

  return text;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let inputFile = 'opportunities.json';
  const inputIndex = args.indexOf('--input');
  if (inputIndex !== -1 && args[inputIndex + 1]) {
    inputFile = args[inputIndex + 1];
  }

  let format = 'text';
  const formatIndex = args.indexOf('--format');
  if (formatIndex !== -1 && args[formatIndex + 1]) {
    format = args[formatIndex + 1];
  }

  let outputFile: string | null = null;
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    outputFile = args[outputIndex + 1];
  }

  try {
    const data = readFileSync(inputFile, 'utf-8');
    const opportunities: Opportunity[] = JSON.parse(data);

    let output: string;
    switch (format) {
      case 'telegram':
        output = formatTelegram(opportunities);
        break;
      case 'email':
        output = formatEmail(opportunities);
        break;
      default:
        output = formatText(opportunities);
    }

    if (outputFile) {
      writeFileSync(outputFile, output);
      console.error(`Report written to: ${outputFile}`);
    } else {
      console.log(output);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
