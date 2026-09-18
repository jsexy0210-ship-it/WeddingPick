#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/sites-available/weddingpick-api
BACKUP_MARKER="$ROOT/.app-web-cutover-backup"

test -r "$BACKUP_MARKER"
backup="$(cat "$BACKUP_MARKER")"
test -f "$backup"

sudo -n cp "$backup" "$CONF"
sudo -n nginx -t
sudo -n systemctl reload nginx

for i in $(seq 1 20); do
  if curl --fail --silent --show-error --connect-timeout 5 --max-time 10     https://210.109.82.212/health >/dev/null 2>&1; then
    rm -f "$ROOT/static-live-app"
    rm -f "$ROOT/.app-web-update-backup" "$ROOT/.app-web-last-cutover-mode"
    echo 'App-web cutover rolled back; API-only 443 restored.'
    exit 0
  fi
  sleep 2
done

echo 'API health did not recover after Nginx rollback.' >&2
exit 1
