#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/conf.d/weddingpick-static-sites.conf
BACKUP_MARKER="$ROOT/.weddingpick-static-sites-backup"

release_sha="${1:-}"
if [ -z "$release_sha" ] && [ -r "$ROOT/static-releases/latest-candidate" ]; then
  release_sha="$(cat "$ROOT/static-releases/latest-candidate")"
fi
if [ -z "$release_sha" ]; then
  release_sha="$(find "$ROOT/static-releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' 2>/dev/null | sort -nr | awk 'NR==1{print $2}')"
fi

if [ -z "$release_sha" ]; then
  echo 'Static candidate release was not found.' >&2
  exit 1
fi

source_dir="$ROOT/static-releases/$release_sha"
test -f "$source_dir/admin/admin/login.html"
test -f "$source_dir/web/privacy.html"

target="/var/www/weddingpick/releases/$release_sha"
sudo -n mkdir -p "$target"
sudo -n rm -rf "$target/admin" "$target/web"
sudo -n cp -a "$source_dir/admin" "$target/admin"
sudo -n cp -a "$source_dir/web" "$target/web"
sudo -n chmod -R a+rX /var/www/weddingpick

cert="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate" && $2 !~ /_key/ {gsub(/;/,"",$2); print $2; exit}')"
key="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate_key" {gsub(/;/,"",$2); print $2; exit}')"
test -n "$cert"
test -n "$key"

mkdir -p "$ROOT/nginx-backups"
if sudo -n test -f "$CONF"; then
  backup="$ROOT/nginx-backups/weddingpick-static-sites-$(date -u +%Y%m%dT%H%M%SZ).conf"
  sudo -n cp "$CONF" "$backup"
  printf '%s\n' "$backup" >"$BACKUP_MARKER"
else
  printf '%s\n' NONE >"$BACKUP_MARKER"
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
cat >"$tmp" <<EOF
server {
    listen 8443 ssl;
    listen [::]:8443 ssl;
    server_name _;
    ssl_certificate $cert;
    ssl_certificate_key $key;
    root $target/admin;
    index index.html;

    location / {
        try_files \$uri \$uri.html \$uri/index.html /index.html;
    }
}

server {
    listen 9443 ssl;
    listen [::]:9443 ssl;
    server_name _;
    ssl_certificate $cert;
    ssl_certificate_key $key;
    root $target/web;
    index index.html;

    location / {
        try_files \$uri \$uri.html \$uri/index.html /index.html;
    }
}
EOF

sudo -n install -m 0644 "$tmp" "$CONF"
if ! sudo -n nginx -t; then
  bash "$(dirname "$0")/rollback-kakao-static-sites.sh"
  exit 1
fi
sudo -n systemctl reload nginx
printf '%s\n' "$release_sha" >"$ROOT/static-live-admin-web"
echo "Kakao static admin/web enabled from release $release_sha"
