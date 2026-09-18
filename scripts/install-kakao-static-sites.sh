#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/conf.d/weddingpick-static-sites.conf
BACKUP_MARKER="$ROOT/.weddingpick-static-sites-backup"
LIVE_MARKER="$ROOT/static-live-admin-web"
LIVE_BACKUP_MARKER="$ROOT/.weddingpick-static-sites-live-backup"

release_sha="${1:-}"
if [ -z "$release_sha" ]; then
  candidate_marker="$ROOT/static-releases/latest-candidate"
  if [ ! -r "$candidate_marker" ]; then
    echo 'Validated static candidate marker was not found; refusing mtime fallback.' >&2
    exit 1
  fi

  IFS= read -r release_sha < "$candidate_marker" || true
  if [[ ! "$release_sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo 'Validated static candidate marker is invalid.' >&2
    exit 1
  fi
fi

source_dir="$ROOT/static-releases/$release_sha"
if [ ! -f "$source_dir/admin/admin/login.html" ] || [ ! -f "$source_dir/web/privacy.html" ]; then
  echo "Static candidate release is incomplete: $release_sha" >&2
  exit 1
fi

target="/var/www/weddingpick/releases/$release_sha"
static_is_live=false
if grep -Eq '/var/www/weddingpick/releases/.*/(admin|web)' "$CONF" 2>/dev/null; then
  static_is_live=true
fi

live_sha=''
if [ -f "$LIVE_MARKER" ]; then
  live_sha="$(cat "$LIVE_MARKER")"
fi

# 현재 Nginx가 static release를 제공 중이면 live marker와 실제 root가 일치해야 한다.
# marker 유실/불일치 상태에서 현재 served admin/web를 먼저 rm -rf 하면, 이 시점에는
# rollback trap이 아직 없어서 복구할 수 없다.
if [ "$static_is_live" = true ]; then
  if [ -z "$live_sha" ]; then
    echo 'Static admin/web is live but the live release marker is missing.' >&2
    exit 1
  fi
  live_root="/var/www/weddingpick/releases/$live_sha"
  if ! grep -Fq "root $live_root/admin;" "$CONF" 2>/dev/null ||      ! grep -Fq "root $live_root/web;" "$CONF" 2>/dev/null; then
    echo "Static live marker does not match the active Nginx roots: $live_sha" >&2
    exit 1
  fi
fi

if [ "$live_sha" = "$release_sha" ]; then
  # 같은 immutable release를 재실행할 때 현재 제공 중인 디렉터리를 지우지 않는다.
  test -f "$target/admin/admin/login.html"
  test -f "$target/web/privacy.html"
  echo "Static release $release_sha is already live; preserving served files."
else
  sudo -n mkdir -p "$target"
  sudo -n rm -rf "$target/admin" "$target/web"
  sudo -n cp -a "$source_dir/admin" "$target/admin"
  sudo -n cp -a "$source_dir/web" "$target/web"
  sudo -n chmod -R a+rX /var/www/weddingpick
fi

cert="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate" && $2 !~ /_key/ {gsub(/;/,"",$2); print $2; exit}')"
key="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate_key" {gsub(/;/,"",$2); print $2; exit}')"
test -n "$cert"
test -n "$key"

mkdir -p "$ROOT/nginx-backups"
if [ -f "$LIVE_MARKER" ]; then
  cp -p "$LIVE_MARKER" "$LIVE_BACKUP_MARKER"
else
  printf '%s\n' NONE >"$LIVE_BACKUP_MARKER"
fi

if sudo -n test -f "$CONF"; then
  backup="$ROOT/nginx-backups/weddingpick-static-sites-$(date -u +%Y%m%dT%H%M%SZ).conf"
  sudo -n cp "$CONF" "$backup"
  printf '%s\n' "$backup" >"$BACKUP_MARKER"
else
  printf '%s\n' NONE >"$BACKUP_MARKER"
fi

tmp=''

rollback_on_error() {
  status=$?
  if [ -n "${tmp:-}" ]; then
    rm -f "$tmp" || true
  fi
  if [ "$status" -ne 0 ] && [ -r "$BACKUP_MARKER" ]; then
    echo 'Static site cutover failed; restoring previous Nginx config.' >&2
    bash "$(dirname "$0")/rollback-kakao-static-sites.sh" || true
  fi
  exit "$status"
}
trap rollback_on_error EXIT

tmp="$(mktemp)"
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
sudo -n nginx -t
sudo -n systemctl reload nginx

rm -f "$tmp" || true
tmp=''
printf '%s\n' "$release_sha" >"$LIVE_MARKER"
trap - EXIT
echo "Kakao static admin/web enabled from release $release_sha"
