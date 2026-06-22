#!/bin/bash
# done_check.sh — Forcing Function: verify doc sync before commit
#
# Compares source file modification times against harness doc timestamps.
# If source files are newer than docs, agent must update docs first.
#
# Usage: bash docs/harness/done_check.sh
# Exit code: 0 = all good, 1 = docs out of sync, 2 = other error

set -e

HARNESS_DIR="docs/harness"
BACKEND_SRC="project/backend/src"
FRONTEND_SRC="project/frontend/miniapp"

echo "=== Harness Doc Sync Check ==="

# Check that harness files exist
for f in "$HARNESS_DIR/progress.md" "$HARNESS_DIR/feature_list.json" "$HARNESS_DIR/DECISIONS.md"; do
  if [ ! -f "$f" ]; then
    echo "WARN: $f not found — skipping timestamp check"
  fi
done

# Find the newest source file (backend JS)
NEWEST_SRC=$(find "$BACKEND_SRC" -name "*.js" -newer "$HARNESS_DIR/progress.md" 2>/dev/null | head -5)
if [ -n "$NEWEST_SRC" ]; then
  echo "⚠️  Source files newer than progress.md:"
  echo "$NEWEST_SRC"
  echo ""
  echo "Action required: Update docs/harness/progress.md with current session changes."
  echo "Then re-run: bash docs/harness/done_check.sh"
  exit 1
fi

# Check feature_list.json is in sync with git diff
CHANGED=$(git diff --name-only HEAD 2>/dev/null || git diff --name-only)
if [ -n "$CHANGED" ]; then
  HAS_FEATURE_UPDATE=$(echo "$CHANGED" | grep -c "feature_list.json" || true)
  HAS_SOURCE=$(echo "$CHANGED" | grep -c -E "\.(js|wxml|wxss|json)$" || true)
  if [ "$HAS_SOURCE" -gt 0 ] && [ "$HAS_FEATURE_UPDATE" -eq 0 ]; then
    echo "⚠️  Source files changed but feature_list.json is not updated."
    echo "Changed files:"
    echo "$CHANGED" | grep -E "\.(js|wxml|wxss|json)$"
    echo ""
    echo "Action required: Update feature status in docs/harness/feature_list.json"
    exit 1
  fi
fi

# Check .env is not staged for commit
ENV_STAGED=$(git diff --cached --name-only 2>/dev/null | grep -c "\.env$" || true)
if [ "$ENV_STAGED" -gt 0 ]; then
  echo "❌ CRITICAL: .env file is staged for commit! Unstage immediately."
  echo "Run: git reset -- .env"
  exit 1
fi

echo "✅ All checks passed — docs are in sync."
exit 0
