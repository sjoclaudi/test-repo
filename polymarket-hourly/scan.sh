#!/bin/bash
# Multi-Platform Prediction Market Scanner
# Usage: ./scan.sh [minutes]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MINUTES=${1:-180}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🎲 Multi-Platform Scanner - $(date)"
echo "   Looking ahead: ${MINUTES} minutes"
echo ""

# Run multi-scanner
echo "📡 Scanning platforms..."
npx ts-node src/multi-scanner.ts --minutes "$MINUTES" --platforms polymarket,predictit --output "results.json" 2>&1 | tee scan_output.txt

# Count opportunities from JSON
if [ -f results.json ]; then
  TOTAL=$(jq '.markets | length' results.json 2>/dev/null || echo "0")
  OPPS=$(jq '.opportunities | length' results.json 2>/dev/null || echo "0")
  echo ""
  echo "📊 Results:"
  echo "   Total markets: $TOTAL"
  echo "   Opportunities: $OPPS"
fi

# Generate reports
echo ""
echo "📝 Generating reports..."
npx ts-node src/report.ts --input "results.json" --format telegram --output "report_telegram.txt" 2>/dev/null || true
npx ts-node src/report.ts --input "results.json" --format email --output "report_email.html" 2>/dev/null || true

echo "✅ Done!"
