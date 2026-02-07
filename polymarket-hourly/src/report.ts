#!/usr/bin/env npx ts-node

/**
 * Multi-Platform Report Generator
 * 
 * Generates formatted reports for Telegram and Email from scanner output.
 * 
 * Usage:
 *   npx ts-node src/report.ts --input results.json --format telegram|email|text
 */

import { readFileSync, writeFileSync } from 'fs';

interface Outcome {
  name: string;
  probability: number;
}

interface Market {
  id: string;
  platform: string;
  question: string;
  url: string;
  endDate: string;
  endsIn: string;
  outcomes: Outcome[];
  volume24h: number;
  liquidity: number;
}

interface Opportunity {
  type: 'arbitrage' | 'near-certain' | 'mispriced' | 'high-confidence' | 'cross-platform';
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

interface ScanResults {
  markets: Market[];
  opportunities: Opportunity[];
}

function formatTelegram(data: ScanResults | Opportunity[]): string {
  // Handle both old format (array) and new format (object with markets/opportunities)
  const opportunities = Array.isArray(data) ? data : data.opportunities;
  const markets = Array.isArray(data) ? [] : data.markets;
  
  if (opportunities.length === 0) {
    return '📊 *Market Scan*\n\nNo opportunities found this scan.';
  }

  const noRisk = opportunities.filter(o => o.analysis.riskLevel === 'no-risk');
  const lowRisk = opportunities.filter(o => o.analysis.riskLevel === 'low-risk');
  const medRisk = opportunities.filter(o => o.analysis.riskLevel === 'medium-risk');

  // Count by platform
  const platforms = new Map<string, number>();
  for (const opp of opportunities) {
    const p = opp.market.platform || 'Unknown';
    platforms.set(p, (platforms.get(p) || 0) + 1);
  }

  let msg = `🎲 *Prediction Market Scanner*\n`;
  msg += `📅 ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/Madrid' })}\n\n`;

  msg += `📊 *Summary:*\n`;
  msg += `🟢 Arbitrage: ${noRisk.length}\n`;
  msg += `🟡 Low-risk (>97%): ${lowRisk.length}\n`;
  msg += `🟠 Medium-risk (>90%): ${medRisk.length}\n`;
  
  if (platforms.size > 1) {
    msg += `\n📍 *By Platform:*\n`;
    for (const [platform, count] of platforms) {
      msg += `   ${platform}: ${count}\n`;
    }
  }
  msg += `\n`;

  // Show arbitrage first if any
  if (noRisk.length > 0) {
    msg += `🚨 *ARBITRAGE ALERTS:*\n`;
    for (const opp of noRisk.slice(0, 3)) {
      msg += `\n🟢 *${opp.market.question.slice(0, 60)}*\n`;
      msg += `   📍 ${opp.market.platform} | ⏰ ${opp.market.endsIn}\n`;
      msg += `   💰 Edge: ${opp.analysis.edge.toFixed(2)}%\n`;
      msg += `   🔗 [View](${opp.market.url})\n`;
    }
    msg += `\n`;
  }

  // Show top low-risk
  const topLowRisk = lowRisk.slice(0, 5);
  if (topLowRisk.length > 0) {
    msg += `🟡 *TOP LOW-RISK:*\n`;
    for (const opp of topLowRisk) {
      const bestOutcome = opp.market.outcomes.reduce((a, b) => 
        a.probability > b.probability ? a : b
      );

      msg += `\n*${opp.market.question.slice(0, 50)}${opp.market.question.length > 50 ? '...' : ''}*\n`;
      msg += `   📍 ${opp.market.platform} | ⏰ ${opp.market.endsIn}\n`;
      msg += `   📈 ${bestOutcome.name}: ${bestOutcome.probability.toFixed(1)}%\n`;
      if (opp.market.liquidity > 0) {
        msg += `   💰 Liquidity: $${opp.market.liquidity.toLocaleString()}\n`;
      }
      msg += `   🔗 [View](${opp.market.url})\n`;
    }
  }

  if (opportunities.length > 8) {
    msg += `\n_...and ${opportunities.length - 8} more opportunities_\n`;
  }

  msg += `\n⚠️ _Not financial advice. Verify before betting._`;

  return msg;
}

function formatEmail(data: ScanResults | Opportunity[]): string {
  const opportunities = Array.isArray(data) ? data : data.opportunities;
  const markets = Array.isArray(data) ? [] : data.markets;
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Madrid' });

  // Count by platform
  const platformCounts = new Map<string, number>();
  for (const m of markets) {
    platformCounts.set(m.platform, (platformCounts.get(m.platform) || 0) + 1);
  }
  
  let html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f8fafc; }
    .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #1e293b; margin-bottom: 5px; }
    .subtitle { color: #64748b; margin-bottom: 20px; }
    .summary { background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .stat { text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .stat-label { color: #64748b; font-size: 14px; }
    .green { color: #22c55e; }
    .yellow { color: #eab308; }
    .orange { color: #f97316; }
    .section { margin: 30px 0; }
    .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #1e293b; }
    .opportunity { border: 1px solid #e2e8f0; padding: 20px; margin: 15px 0; border-radius: 8px; background: white; }
    .no-risk { border-left: 4px solid #22c55e; background: #f0fdf4; }
    .low-risk { border-left: 4px solid #eab308; }
    .medium-risk { border-left: 4px solid #f97316; }
    .opp-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; }
    .opp-title { font-weight: bold; color: #1e293b; flex: 1; }
    .tag { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; margin-left: 8px; }
    .tag-platform { background: #dbeafe; color: #1e40af; }
    .tag-risk { background: #dcfce7; color: #166534; }
    .opp-meta { color: #64748b; font-size: 13px; margin-bottom: 12px; }
    .odds-container { margin: 12px 0; }
    .odds-row { display: flex; align-items: center; margin: 6px 0; }
    .odds-label { width: 120px; font-size: 13px; }
    .odds-bar { flex: 1; background: #e2e8f0; height: 24px; border-radius: 4px; overflow: hidden; }
    .odds-fill { background: linear-gradient(90deg, #3b82f6, #60a5fa); height: 100%; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; }
    .odds-value { color: white; font-size: 12px; font-weight: bold; }
    .recommendation { background: #fef3c7; padding: 10px 15px; border-radius: 6px; margin-top: 12px; font-size: 13px; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .cta { display: inline-block; background: #3b82f6; color: white; padding: 8px 16px; border-radius: 6px; margin-top: 10px; font-size: 13px; }
    .disclaimer { color: #94a3b8; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .platforms { display: flex; gap: 10px; margin-top: 10px; }
    .platform-badge { background: #e0e7ff; color: #4338ca; padding: 5px 12px; border-radius: 20px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎲 Prediction Market Report</h1>
    <p class="subtitle">Generated: ${now}</p>
    
    <div class="summary">
      <div class="summary-grid">
        <div class="stat">
          <div class="stat-value green">${opportunities.filter(o => o.analysis.riskLevel === 'no-risk').length}</div>
          <div class="stat-label">Arbitrage</div>
        </div>
        <div class="stat">
          <div class="stat-value yellow">${opportunities.filter(o => o.analysis.riskLevel === 'low-risk').length}</div>
          <div class="stat-label">Low-risk (>97%)</div>
        </div>
        <div class="stat">
          <div class="stat-value orange">${opportunities.filter(o => o.analysis.riskLevel === 'medium-risk').length}</div>
          <div class="stat-label">Medium-risk</div>
        </div>
      </div>
      <div class="platforms">
        ${Array.from(platformCounts.entries()).map(([p, c]) => 
          `<span class="platform-badge">${p}: ${c} markets</span>`
        ).join('')}
      </div>
    </div>
`;

  // Arbitrage section
  const arbitrage = opportunities.filter(o => o.analysis.riskLevel === 'no-risk');
  if (arbitrage.length > 0) {
    html += `
    <div class="section">
      <div class="section-title">🚨 ARBITRAGE OPPORTUNITIES</div>
`;
    for (const opp of arbitrage) {
      html += formatOpportunityHtml(opp);
    }
    html += `</div>`;
  }

  // Low-risk section
  const lowRisk = opportunities.filter(o => o.analysis.riskLevel === 'low-risk').slice(0, 10);
  if (lowRisk.length > 0) {
    html += `
    <div class="section">
      <div class="section-title">🟡 LOW-RISK OPPORTUNITIES (>97%)</div>
`;
    for (const opp of lowRisk) {
      html += formatOpportunityHtml(opp);
    }
    html += `</div>`;
  }

  html += `
    <div class="disclaimer">
      <p>⚠️ <strong>Disclaimer:</strong> This is statistical analysis, not financial advice. 
      Always verify odds before placing bets. Past patterns do not guarantee future results.</p>
      <p>Generated by JoClaudi 🦊</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

function formatOpportunityHtml(opp: Opportunity): string {
  const riskClass = opp.analysis.riskLevel;
  const bestOutcome = opp.market.outcomes.reduce((a, b) => 
    a.probability > b.probability ? a : b
  );

  return `
      <div class="opportunity ${riskClass}">
        <div class="opp-header">
          <span class="opp-title">${opp.market.question}</span>
          <span class="tag tag-platform">${opp.market.platform}</span>
        </div>
        <div class="opp-meta">
          ⏰ Ends: ${opp.market.endsIn}
          ${opp.market.liquidity > 0 ? `| 💰 Liquidity: $${opp.market.liquidity.toLocaleString()}` : ''}
        </div>
        <div class="odds-container">
          ${opp.market.outcomes.slice(0, 4).map(o => `
            <div class="odds-row">
              <span class="odds-label">${o.name}</span>
              <div class="odds-bar">
                <div class="odds-fill" style="width:${Math.max(o.probability, 5)}%">
                  <span class="odds-value">${o.probability.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="recommendation">💡 ${opp.analysis.recommendation}</div>
        <a href="${opp.market.url}" class="cta">View Market →</a>
      </div>
`;
}

function formatText(data: ScanResults | Opportunity[]): string {
  const opportunities = Array.isArray(data) ? data : data.opportunities;
  
  if (opportunities.length === 0) {
    return 'Market Scan: No opportunities found.';
  }

  let text = `PREDICTION MARKET OPPORTUNITIES REPORT\n`;
  text += `Generated: ${new Date().toISOString()}\n`;
  text += `${'='.repeat(50)}\n\n`;

  const noRisk = opportunities.filter(o => o.analysis.riskLevel === 'no-risk');
  const lowRisk = opportunities.filter(o => o.analysis.riskLevel === 'low-risk');
  const medRisk = opportunities.filter(o => o.analysis.riskLevel === 'medium-risk');

  text += `SUMMARY:\n`;
  text += `  Arbitrage:           ${noRisk.length}\n`;
  text += `  Low-risk (>97%):     ${lowRisk.length}\n`;
  text += `  Medium-risk (>90%):  ${medRisk.length}\n`;
  text += `  Total:               ${opportunities.length}\n\n`;

  text += `${'='.repeat(50)}\n\n`;

  for (const opp of opportunities) {
    text += `[${opp.analysis.riskLevel.toUpperCase()}] [${opp.market.platform}] ${opp.market.question}\n`;
    text += `  Ends: ${opp.market.endsIn}\n`;
    text += `  Edge: ${opp.analysis.edge.toFixed(2)}%\n`;
    text += `  ${opp.analysis.recommendation}\n`;
    text += `  URL: ${opp.market.url}\n\n`;
  }

  return text;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let inputFile = 'results.json';
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
    const raw = readFileSync(inputFile, 'utf-8');
    const data = JSON.parse(raw);

    let output: string;
    switch (format) {
      case 'telegram':
        output = formatTelegram(data);
        break;
      case 'email':
        output = formatEmail(data);
        break;
      default:
        output = formatText(data);
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
