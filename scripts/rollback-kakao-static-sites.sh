#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/conf.d/weddingpick-static-sites.conf
BACKUP_MARKER="$ROOT/.weddingpick-static-sites-backup"

backup=NONE
if [ -r "$BACKUP_MARKER" ]; then
  backup="$(cat "$BACKUP_MARKER")"
fi

if [ "$backup" != NONE ] && [ -f "$backup" ]; then
  sudo -n cp "$backup" "$CONF"
else
  sudo -n rm -f "$CONF"
fi

sudo -n nginx -t
sudo -n systemctl reload nginx
echo 'Kakao static admin/web nginx config rolled back.'
