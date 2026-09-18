#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/sites-available/weddingpick-api
BACKUP_MARKER="$ROOT/.app-web-cutover-backup"

release_sha="${1:-}"
if [ -z "$release_sha" ]; then
  release_sha="$(find "$ROOT/static-releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' 2>/dev/null | sort -nr | awk 'NR==1{print $2}')"
fi
test -n "$release_sha"

source_dir="$ROOT/static-releases/$release_sha/app"
test -f "$source_dir/index.html"
if [ ! -f "$source_dir/login.html" ] && [ ! -f "$source_dir/login/index.html" ]; then
  echo "App login export was not found in release: $release_sha" >&2
  find "$source_dir" -maxdepth 2 -type f -name 'login*.html' -o -path '*/login/index.html' 2>/dev/null | head -20 >&2 || true
  exit 1
fi
echo "Using staged app release: $release_sha"

target="/var/www/weddingpick/releases/$release_sha/app"
sudo -n mkdir -p "$(dirname "$target")"
sudo -n rm -rf "$target"
sudo -n cp -a "$source_dir" "$target"
sudo -n chmod -R a+rX /var/www/weddingpick

cert="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate" && $2 !~ /_key/ {gsub(/;/,"",$2); print $2; exit}')"
key="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate_key" {gsub(/;/,"",$2); print $2; exit}')"
test -n "$cert"
test -n "$key"

mkdir -p "$ROOT/nginx-backups"
if [ -r "$BACKUP_MARKER" ] && grep -q '/var/www/weddingpick/releases/.*/app' "$CONF" 2>/dev/null; then
  backup="$(cat "$BACKUP_MARKER")"
  echo "Existing API-only rollback backup preserved: $backup"
else
  backup="$ROOT/nginx-backups/weddingpick-api-$(date -u +%Y%m%dT%H%M%SZ).conf"
  sudo -n cp "$CONF" "$backup"
  printf '%s\n' "$backup" > "$BACKUP_MARKER"
fi

rollback_on_error() {
  status=$?
  if [ "$status" -ne 0 ] && [ -r "$BACKUP_MARKER" ]; then
    echo 'App-web smoke failed; restoring previous 443 Nginx config.' >&2
    bash "$(dirname "$0")/rollback-kakao-app-web.sh" || true
  fi
  exit "$status"
}
trap rollback_on_error EXIT

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
cat >"$tmp" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://210.109.82.212\$request_uri;
    }
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;

    server_name _;

    ssl_certificate $cert;
    ssl_certificate_key $key;

    root $target;
    index index.html;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location = /health {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

    location ^~ /v1/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

    location / {
        try_files \$uri \$uri.html \$uri/index.html /index.html;
    }
}
EOF

sudo -n install -m 0644 "$tmp" "$CONF"
if ! sudo -n nginx -t; then
  sudo -n cp "$backup" "$CONF"
  sudo -n nginx -t
  sudo -n systemctl reload nginx
  exit 1
fi

sudo -n systemctl reload nginx

health="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 10 https://210.109.82.212/health)"
printf '%s' "$health" | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("ok") is True and d.get("database")=="ok" else 1)'

login_smoke="$(mktemp)"
curl --fail --silent --show-error --connect-timeout 5 --max-time 10 \
  https://210.109.82.212/login -o "$login_smoke"
grep -qi '<html' "$login_smoke"
rm -f "$login_smoke"

curl --fail --silent --show-error --connect-timeout 5 --max-time 10   https://210.109.82.212/v1/auth/providers | python3 -c 'import json,sys; json.load(sys.stdin)'

printf '%s\n' "$release_sha" > "$ROOT/static-live-app"
trap - EXIT
echo "Kakao app web enabled on 443 from release $release_sha"
