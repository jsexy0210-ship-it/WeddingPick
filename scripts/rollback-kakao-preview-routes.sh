#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/sites-available/weddingpick-api
MARKER="$ROOT/.preview-routes-backup"

test -r "$MARKER"
backup="$(cat "$MARKER")"
test -f "$backup"

sudo -n cp "$backup" "$CONF"
sudo -n nginx -t
sudo -n systemctl reload nginx
rm -f "$MARKER"

echo 'Kakao admin/web preview routes rolled back.'
