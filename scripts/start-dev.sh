#!/bin/bash
# Start fresh dev server and open in your default browser
set -e
export PATH="$HOME/.local/node/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8080}"

# Stop any old server on this port
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "Stopping old server on port $PORT..."
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 0.5
fi

echo "Starting dev server on port $PORT (no browser cache)..."
node "$ROOT/scripts/dev-server.mjs" "$PORT" &
SERVER_PID=$!
sleep 0.8

URL="http://127.0.0.1:$PORT/?v=$(date +%s)"
echo "Opening $URL"
open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || echo "Open manually: $URL"

wait $SERVER_PID
