#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/sites-available/weddingpick-api
BACKUP_MARKER="$ROOT/.app-web-cutover-backup"
LIVE_MARKER="$ROOT/static-live-app"
UPDATE_BACKUP_MARKER="$ROOT/.app-web-update-backup"
CUTOVER_MODE_MARKER="$ROOT/.app-web-last-cutover-mode"

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

# 이미 app-web이 443을 소유하는 상태에서 보존 marker가 깨졌다면 새 설정을 쓰기 전에
# 중단한다. 현재 app config를 API-only backup으로 덮어쓰면 rollback 경로가 사라진다.
preserved_backup=''
app_web_is_live=false
if grep -q '/var/www/weddingpick/releases/.*/app' "$CONF" 2>/dev/null; then
  app_web_is_live=true
  if [ ! -r "$BACKUP_MARKER" ]; then
    echo 'App-web is live but the API-only rollback marker is missing.' >&2
    exit 1
  fi
  preserved_backup="$(cat "$BACKUP_MARKER")"
  if [ ! -f "$preserved_backup" ]; then
    echo "Preserved API-only rollback backup is missing: $preserved_backup" >&2
    exit 1
  fi
fi

live_sha=''
if [ -r "$LIVE_MARKER" ]; then
  live_sha="$(cat "$LIVE_MARKER")"
fi

# 현재 443이 이미 app release를 가리키면 marker와 실제 Nginx root가 반드시 일치해야 한다.
# 여기서 fail-closed 하지 않으면 marker 유실/불일치 상태에서 현재 served directory를
# rm -rf 하다가 실패해도 rollback trap이 아직 등록되지 않은 구간이라 복구할 수 없다.
if [ "$app_web_is_live" = true ]; then
  if [ -z "$live_sha" ]; then
    echo 'App-web is live but the live release marker is missing.' >&2
    exit 1
  fi
  live_target="/var/www/weddingpick/releases/$live_sha/app"
  if ! grep -Fq "root $live_target;" "$CONF" 2>/dev/null; then
    echo "App-web live marker does not match the active Nginx root: $live_sha" >&2
    exit 1
  fi
fi

same_live_release=false
if [ "$live_sha" = "$release_sha" ] && grep -Fq "root $target;" "$CONF" 2>/dev/null; then
  same_live_release=true
  # 같은 immutable release 재실행은 현재 서비스 중인 디렉터리를 지우지 않는다.
  test -f "$target/index.html"
  if [ ! -f "$target/login.html" ] && [ ! -f "$target/login/index.html" ]; then
    echo "Live app login export is missing for release: $release_sha" >&2
    exit 1
  fi
  echo "App release $release_sha is already live; preserving served files."
else
  sudo -n mkdir -p "$(dirname "$target")"
  sudo -n rm -rf "$target"
  sudo -n cp -a "$source_dir" "$target"
  sudo -n chmod -R a+rX /var/www/weddingpick
fi

cert="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate" && $2 !~ /_key/ {gsub(/;/,"",$2); print $2; exit}')"
key="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate_key" {gsub(/;/,"",$2); print $2; exit}')"
test -n "$cert"
test -n "$key"

mkdir -p "$ROOT/nginx-backups"
cutover_mode='api-only'
if [ "$same_live_release" = true ]; then
  cutover_mode='noop'
  echo "Same live release; public verify failure will not tear app-web down."
elif [ "$app_web_is_live" = true ]; then
  update_backup="$ROOT/nginx-backups/weddingpick-app-update-$(date -u +%Y%m%dT%H%M%SZ).conf"
  sudo -n cp "$CONF" "$update_backup"
  marker_tmp="$(mktemp)"
  printf 'config=%s\nrelease=%s\n' "$update_backup" "$live_sha" > "$marker_tmp"
  mv "$marker_tmp" "$UPDATE_BACKUP_MARKER"
  cutover_mode='update'
  echo "Previous live app release preserved for update rollback: $live_sha"
elif [ -n "$preserved_backup" ]; then
  backup="$preserved_backup"
  echo "Existing API-only rollback backup preserved: $backup"
else
  backup="$ROOT/nginx-backups/weddingpick-api-$(date -u +%Y%m%dT%H%M%SZ).conf"
  sudo -n cp "$CONF" "$backup"
  printf '%s\n' "$backup" > "$BACKUP_MARKER"
fi
printf '%s\n' "$cutover_mode" > "$CUTOVER_MODE_MARKER"

tmp=''
rollback_on_error() {
  status=$?
  if [ -n "${tmp:-}" ]; then
    rm -f "$tmp" || true
  fi
  if [ "$status" -ne 0 ] && [ -r "$CUTOVER_MODE_MARKER" ]; then
    echo 'App-web cutover failed; restoring the appropriate previous 443 state.' >&2
    if ! bash "$(dirname "$0")/rollback-kakao-app-web-failed-cutover.sh"; then
      echo 'Automatic app-web rollback failed; inspect the Kakao VM before another cutover.' >&2
    fi
  fi
  exit "$status"
}
trap rollback_on_error EXIT

tmp="$(mktemp)"
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
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

    location ^~ /v1/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
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
sudo -n nginx -t
sudo -n systemctl reload nginx

health="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 10 https://210.109.82.212/health)"
printf '%s' "$health" | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("ok") is True and d.get("database")=="ok" else 1)'

login_smoke="$(mktemp)"
curl --fail --silent --show-error --connect-timeout 5 --max-time 10 \
  https://210.109.82.212/login -o "$login_smoke"
grep -qi '<html' "$login_smoke"
rm -f "$login_smoke"

curl --fail --silent --show-error --connect-timeout 5 --max-time 10   https://210.109.82.212/v1/auth/providers | python3 -c 'import json,sys; json.load(sys.stdin)'

printf '%s\n' "$release_sha" > "$LIVE_MARKER"
rm -f "$tmp"
tmp=''
trap - EXIT
echo "Kakao app web enabled on 443 from release $release_sha"
