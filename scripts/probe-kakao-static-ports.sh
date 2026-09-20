#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/conf.d/weddingpick-port-probe.conf
MARKER="$ROOT/.static-port-probe-backup"
TMP=""

if [ -r "$MARKER" ]; then
  echo 'A static port probe transaction is already active; refusing to overwrite its rollback state.' >&2
  exit 1
fi

cert="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate" && $2 !~ /_key/ {gsub(/;/,"",$2); print $2; exit}')"
key="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate_key" {gsub(/;/,"",$2); print $2; exit}')"

if [ -z "$cert" ] || [ -z "$key" ]; then
  echo 'Existing TLS certificate directives were not found.' >&2
  exit 1
fi

mkdir -p "$ROOT/nginx-backups"
if sudo -n test -f "$CONF"; then
  backup="$ROOT/nginx-backups/weddingpick-port-probe-$(date -u +%Y%m%dT%H%M%SZ).conf"
  sudo -n cp "$CONF" "$backup"
  printf '%s\n' "$backup" >"$MARKER"
else
  printf '%s\n' NONE >"$MARKER"
fi

restore_previous() {
  local backup
  backup="$(cat "$MARKER")"
  if [ "$backup" = NONE ]; then
    sudo -n rm -f "$CONF"
  else
    test -f "$backup"
    sudo -n cp "$backup" "$CONF"
  fi
  sudo -n nginx -t && sudo -n systemctl reload nginx
}

rollback_on_error() {
  status=$?
  if [ -n "${TMP:-}" ]; then
    rm -f "$TMP" || true
  fi
  if [ "$status" -ne 0 ] && [ -r "$MARKER" ]; then
    echo 'Static port probe setup failed; restoring previous Nginx probe state.' >&2
    if restore_previous; then
      rm -f "$MARKER"
    else
      echo 'Static port probe rollback failed; preserving rollback marker for cleanup retry.' >&2
    fi
  fi
  exit "$status"
}
trap rollback_on_error EXIT

TMP="$(mktemp)"
cat >"$TMP" <<EOF
server {
    listen 9443 ssl;
    listen [::]:9443 ssl;
    server_name _;
    ssl_certificate $cert;
    ssl_certificate_key $key;
    location / {
        add_header X-WeddingPick-Probe static-web always;
        return 204;
    }
}
EOF

sudo -n install -m 0644 "$TMP" "$CONF"
sudo -n nginx -t
sudo -n systemctl reload nginx

rm -f "$TMP" || true
TMP=""
trap - EXIT
echo 'Temporary 9443 website HTTPS probe is active.'
