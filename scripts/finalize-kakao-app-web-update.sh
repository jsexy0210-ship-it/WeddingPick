#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/sites-available/weddingpick-api
LIVE_MARKER="$ROOT/static-live-app"
TX_BACKUP_MARKER="$ROOT/.app-web-update-backup"
TX_LIVE_MARKER="$ROOT/.app-web-update-live-backup"
TX_TARGET_MARKER="$ROOT/.app-web-update-target"

test -r "$TX_BACKUP_MARKER"
test -r "$TX_LIVE_MARKER"
test -r "$TX_TARGET_MARKER"
target="$(cat "$TX_TARGET_MARKER")"
test -n "$target"
test -r "$LIVE_MARKER"
live="$(cat "$LIVE_MARKER")"
if [ "$live" != "$target" ]; then
  echo "App-web live marker does not match pending transaction target: live=$live target=$target" >&2
  exit 1
fi
expected_root="/var/www/weddingpick/releases/$target/app"
if ! grep -Fq "root $expected_root;" "$CONF" 2>/dev/null; then
  echo "Active Nginx root does not match pending app-web target: $target" >&2
  exit 1
fi

rm -f "$TX_BACKUP_MARKER" "$TX_LIVE_MARKER" "$TX_TARGET_MARKER"
echo "App-web update finalized after public verification: $target"
