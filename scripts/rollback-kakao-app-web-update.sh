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
backup="$(cat "$TX_BACKUP_MARKER")"
previous_live="$(cat "$TX_LIVE_MARKER")"
test -f "$backup"

sudo -n cp "$backup" "$CONF"
sudo -n nginx -t
sudo -n systemctl reload nginx

if [ "$previous_live" = NONE ]; then
  rm -f "$LIVE_MARKER"
else
  printf '%s\n' "$previous_live" > "$LIVE_MARKER"
fi

for i in $(seq 1 20); do
  if curl --fail --silent --show-error --connect-timeout 5 --max-time 10 https://210.109.82.212/health >/dev/null 2>&1; then
    rm -f "$TX_BACKUP_MARKER" "$TX_LIVE_MARKER" "$TX_TARGET_MARKER"
    echo "App-web update rolled back to previous live release: $previous_live"
    exit 0
  fi
  sleep 2
done

echo 'API health did not recover after app-web update rollback; transaction markers preserved.' >&2
exit 1
