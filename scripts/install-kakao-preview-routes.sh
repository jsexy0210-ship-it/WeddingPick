#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/sites-available/weddingpick-api
MARKER="$ROOT/.preview-routes-backup"

test -r "$ROOT/static-live-app"
release_sha="$(cat "$ROOT/static-live-app")"
source_root="$ROOT/static-releases/$release_sha"
app_root="/var/www/weddingpick/releases/$release_sha/app"
admin_root="/var/www/weddingpick/releases/$release_sha/admin"
web_root="/var/www/weddingpick/releases/$release_sha/web"

test -f "$app_root/index.html"
test -f "$source_root/admin/admin/login.html"
test -f "$source_root/web/index.html"
test -f "$source_root/web/privacy.html"

backup=''
if [ -r "$MARKER" ]; then
  backup="$(cat "$MARKER")"
  if [ ! -f "$backup" ]; then
    echo "Preview rollback backup is missing: $backup" >&2
    exit 1
  fi
elif grep -Fq 'location ^~ /admin/' "$CONF" 2>/dev/null; then
  echo 'Preview routes are active but their rollback marker is missing.' >&2
  exit 1
fi

if [ -n "$backup" ] &&
   grep -Fq "root $admin_root;" "$CONF" 2>/dev/null &&
   grep -Fq "root $web_root;" "$CONF" 2>/dev/null; then
  test -f "$admin_root/admin/login.html"
  test -f "$web_root/privacy.html"
  echo "Preview routes already use release $release_sha; preserving served files."
else
  sudo -n mkdir -p "/var/www/weddingpick/releases/$release_sha"
  sudo -n rm -rf "$admin_root" "$web_root"
  sudo -n cp -a "$source_root/admin" "$admin_root"
  sudo -n cp -a "$source_root/web" "$web_root"
  sudo -n chmod -R a+rX /var/www/weddingpick
fi

cert="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate" && $2 !~ /_key/ {gsub(/;/,"",$2); print $2; exit}')"
key="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate_key" {gsub(/;/,"",$2); print $2; exit}')"
test -n "$cert"
test -n "$key"

mkdir -p "$ROOT/nginx-backups"
if [ -z "$backup" ]; then
  backup="$ROOT/nginx-backups/weddingpick-preview-routes-$(date -u +%Y%m%dT%H%M%SZ).conf"
  sudo -n cp "$CONF" "$backup"
  printf '%s\n' "$backup" > "$MARKER"
fi

tmp=''

rollback_on_error() {
  status=$?
  if [ -n "${tmp:-}" ]; then
    rm -f "$tmp" || true
  fi
  if [ "$status" -ne 0 ]; then
    echo 'Preview route setup failed; restoring previous Nginx config.' >&2
    if ! bash "$(dirname "$0")/rollback-kakao-preview-routes.sh"; then
      echo 'Automatic preview route rollback failed; inspect the Kakao VM before another cutover.' >&2
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

    root $app_root;
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

    # 관리자 운영 경로. 443의 /admin으로 고정하며 별도 포트로 분리하지 않는다.
    location = /admin {
        return 302 /admin/home;
    }

    location ^~ /admin/ {
        root $admin_root;
        try_files \$uri \$uri.html \$uri/index.html =404;
        add_header X-Robots-Tag "noindex, nofollow" always;
    }

    # 웹사이트 확인용 진입점. 법적 문서·서브페이지는 원래 .html 주소로 함께 노출한다.
    location = /website {
        return 302 /website.html;
    }

    location = /website.html {
        alias $web_root/index.html;
        add_header X-Robots-Tag "noindex, nofollow" always;
    }

    location ~ ^/(search|intro|faq|support|terms|privacy|about)\.html$ {
        root $web_root;
        try_files \$uri =404;
        add_header X-Robots-Tag "noindex, nofollow" always;
    }

    location ^~ /v/ {
        root $web_root;
        try_files \$uri =404;
        add_header X-Robots-Tag "noindex, nofollow" always;
    }

    location / {
        try_files \$uri \$uri.html \$uri/index.html /index.html;
    }
}
EOF

sudo -n install -m 0644 "$tmp" "$CONF"
sudo -n nginx -t
sudo -n systemctl reload nginx

curl --fail --silent --show-error --connect-timeout 5 --max-time 10   https://210.109.82.212/admin/login -o /tmp/wp-admin-preview.html
cmp -s /tmp/wp-admin-preview.html "$admin_root/admin/login.html"
grep -Fq '/_expo/static/js/web/' /tmp/wp-admin-preview.html
! grep -Eq '관리자 콘솔 주소가 바뀌었어요|210\.109\.82\.212:8443' /tmp/wp-admin-preview.html

curl --fail --silent --show-error --connect-timeout 5 --max-time 10   https://210.109.82.212/website.html -o /tmp/wp-web-preview.html
grep -qi '<html' /tmp/wp-web-preview.html

curl --fail --silent --show-error --connect-timeout 5 --max-time 10   https://210.109.82.212/privacy.html -o /tmp/wp-privacy-preview.html
grep -qi '<html' /tmp/wp-privacy-preview.html

curl --fail --silent --show-error --connect-timeout 5 --max-time 10   https://210.109.82.212/health >/dev/null

rm -f "$tmp" || true
tmp=''
trap - EXIT
echo "Kakao admin 443 route and website preview routes enabled from release $release_sha"
