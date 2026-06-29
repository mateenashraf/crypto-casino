#!/bin/bash
# Push crypto-casino to GitHub (no local git required)
set -e
export PATH="$HOME/.local/gh/bin:$HOME/.local/node/bin:$PATH"

if ! gh auth status >/dev/null 2>&1; then
  echo ""
  echo ">>> Sign in to GitHub (browser will open)"
  echo ">>> Approve access, then this script continues automatically."
  echo ""
  gh auth login -h github.com -p https -w
fi

REPO_NAME="${1:-crypto-casino}"
export GITHUB_TOKEN="$(gh auth token)"
node "$(dirname "$0")/push-github.mjs" "$REPO_NAME"
