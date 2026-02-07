#!/bin/bash
# Polymarket Scanner - Automated scan and report script
# Usage: ./scan.sh [minutes]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MINUTES=${1:-120}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🎲 Polymarket Scanner - $(date)"
echo "   Looking ahead: ${MINUTES} minutes"
echo ""

# Fetch markets
echo "📡 Fetching markets..."
npx ts-node src/index.ts --minutes "$MINUTES" --output "markets.json" > /dev/null 2>&1

# Analyze
echo "🔍 Analyzing opportunities..."
npx ts-node src/analyzer.ts --input "markets.json" --json > "opportunities.json" 2>/dev/null

# Count opportunities
TOTAL=$(jq 'length' opportunities.json)
NO_RISK=$(jq '[.[] | select(.analysis.riskLevel == "no-risk")] | length' opportunities.json)
LOW_RISK=$(jq '[.[] | select(.analysis.riskLevel == "low-risk")] | length' opportunities.json)

echo ""
echo "📊 Found:"
echo "   🟢 No-risk: $NO_RISK"
echo "   🟡 Low-risk: $LOW_RISK"
echo "   Total: $TOTAL"

# Generate reports
echo ""
echo "📝 Generating reports..."
npx ts-node src/report.ts --input "opportunities.json" --format telegram --output "report_telegram.txt"
npx ts-node src/report.ts --input "opportunities.json" --format email --output "report_email.html"

echo "✅ Done!"
echo "   Telegram: report_telegram.txt"
echo "   Email: report_email.html"
