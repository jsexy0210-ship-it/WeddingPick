#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/sites-available/weddingpick-api
UPDATE_BACKUP_MARKER="$ROOT/.app-web-update-backup"
LIVE_MARKER="$ROOT/static-live-app"

test -r "$UPDATE_BACKUP_MARKER"
backup="$(awk -F= '$1=="config"{print substr($0,index($0,"=")+1)}' "$UPDATE_BACKUP_MARKER")"
release_sha="$(awk -F= '$1=="release"{print substr($0,index($0,"=")+1)}' "$UPDATE_BACKUP_MARKER")"
test -n "$backup"
test -n "$release_sha"
test -f "$backup"

target="/var/www/weddingpick/releases/$release_sha/app"
test -f "$target/index.html"
if [ ! -f "$target/login.html" ] && [ ! -f "$target/login/index.html" ]; then
  echo "Previous live app login export is missing: $release_sha" >&2
  exit 1
fi
if ! grep -Fq "root $target;" "$backup" 2>/dev/null; then
  echo "Update rollback backup does not point to the recorded release: $release_sha" >&2
  exit 1
fi

sudo -n cp "$backup" "$CONF"
sudo -n nginx -t
sudo -n systemctl reload nginx

# Nginx now points back to the previous app release. Keep the live marker aligned
# even if a later health check fails; the retained update marker is the evidence
# that recovery still needs operator attention.
printf '%s\n' "$release_sha" > "$LIVE_MARKER"

for i in $(seq 1 20); do
  if curl --fail --silent --show-error --connect-timeout 5 --max-time 10       https://210.109.82.212/health >/dev/null 2>&1     && curl --fail --silent --show-error --connect-timeout 5 --max-time 10       https://210.109.82.212/login 2>/dev/null | grep -qi '<html'; then
    rm -f "$UPDATE_BACKUP_MARKER"
    echo "App-web update rolled back to previous live release: $release_sha"
    exit 0
  fi
  sleep 2
done

echo "Previous app release was restored in Nginx but public health/login did not recover." >&2
exit 1
