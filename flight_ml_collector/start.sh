#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$DIR/.env" ]; then
  # Load env variables safely
  export $(grep -v '^#' "$DIR/.env" | xargs)
fi

MODE="${1:-test}"

if [ -z "$DUFFEL_ACCESS_TOKEN" ]; then
  echo "⚠️  DUFFEL_ACCESS_TOKEN is not set in the environment or .env file."
  echo "Please export your Duffel token before running:"
  echo "  export DUFFEL_ACCESS_TOKEN=\"duffel_test_...\""
  echo "Or run: DUFFEL_ACCESS_TOKEN=\"...\" ./start.sh $MODE"
  exit 1
fi

echo "🚀 Starting 24-Hour Flight ML Worker (Mode: $MODE)..."
cd "$DIR/collection_worker"
python3 worker.py run --mode "$MODE"
