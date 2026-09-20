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

if [ "$previous_live" != NONE ]; then
  previous_target="/var/www/weddingpick/releases/$previous_live/app"
  previous_admin_target="/var/www/weddingpick/releases/$previous_live/admin"
  test -f "$previous_target/index.html"
  if [ ! -f "$previous_target/login.html" ] && [ ! -f "$previous_target/login/index.html" ]; then
    echo "Previous live app login export is missing: $previous_live" >&2
    exit 1
  fi
  if ! grep -Fq "root $previous_target;" "$backup" 2>/dev/null; then
    echo "Update rollback backup does not point to the recorded previous release: $previous_live" >&2
    exit 1
  fi
  if grep -Fq 'location ^~ /admin/' "$backup" 2>/dev/null; then
    test -f "$previous_admin_target/admin/login.html"
    if ! grep -Fq "root $previous_admin_target;" "$backup" 2>/dev/null; then
      echo "Rollback backup admin route does not point to the recorded previous release: $previous_live" >&2
      exit 1
    fi
  fi
fi

sudo -n cp "$backup" "$CONF"
sudo -n nginx -t
sudo -n systemctl reload nginx

if [ "$previous_live" = NONE ]; then
  rm -f "$LIVE_MARKER"
else
  printf '%s\n' "$previous_live" > "$LIVE_MARKER"
fi

for i in $(seq 1 20); do
  health_ok=0
  login_ok=0
  admin_ok=1
  if curl --fail --silent --show-error --connect-timeout 5 --max-time 10 https://210.109.82.212/health >/dev/null 2>&1; then
    health_ok=1
  fi
  if [ "$previous_live" = NONE ]; then
    login_ok=1
  elif curl --fail --silent --show-error --connect-timeout 5 --max-time 10 https://210.109.82.212/login 2>/dev/null | grep -qi '<html'; then
    login_ok=1
  fi
  if [ "$previous_live" != NONE ] && grep -Fq 'location ^~ /admin/' "$backup" 2>/dev/null; then
    if curl --fail --silent --show-error --connect-timeout 5 --max-time 10 https://210.109.82.212/admin/login 2>/dev/null | grep -qi '<html'; then
      admin_ok=1
    else
      admin_ok=0
    fi
  fi
  if [ "$health_ok" -eq 1 ] && [ "$login_ok" -eq 1 ] && [ "$admin_ok" -eq 1 ]; then
    rm -f "$TX_BACKUP_MARKER" "$TX_LIVE_MARKER" "$TX_TARGET_MARKER"
    echo "App-web update rolled back to previous live release: $previous_live"
    exit 0
  fi
  sleep 2
done

echo 'Previous app-web state was restored but public health/login did not recover; transaction markers preserved.' >&2
exit 1
