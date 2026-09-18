#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/conf.d/weddingpick-static-sites.conf
BACKUP_MARKER="$ROOT/.weddingpick-static-sites-backup"
LIVE_MARKER="$ROOT/static-live-admin-web"
LIVE_BACKUP_MARKER="$ROOT/.weddingpick-static-sites-live-backup"

backup=NONE
if [ -r "$BACKUP_MARKER" ]; then
  backup="$(cat "$BACKUP_MARKER")"
fi

if [ "$backup" = NONE ]; then
  sudo -n rm -f "$CONF"
elif [ -f "$backup" ]; then
  sudo -n cp "$backup" "$CONF"
else
  echo "Static rollback backup is missing: $backup" >&2
  exit 1
fi

sudo -n nginx -t
sudo -n systemctl reload nginx

if [ -r "$LIVE_BACKUP_MARKER" ]; then
  previous_live="$(cat "$LIVE_BACKUP_MARKER")"
  if [ "$previous_live" = NONE ]; then
    rm -f "$LIVE_MARKER"
  else
    cp -p "$LIVE_BACKUP_MARKER" "$LIVE_MARKER"
  fi
  rm -f "$LIVE_BACKUP_MARKER"
fi

echo 'Kakao static admin/web nginx config and live marker rolled back.'
