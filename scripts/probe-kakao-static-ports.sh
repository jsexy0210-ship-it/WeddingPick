#!/usr/bin/env bash
set -euo pipefail

CONF=/etc/nginx/conf.d/weddingpick-port-probe.conf
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

cert="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate" && $2 !~ /_key/ {gsub(/;/,"",$2); print $2; exit}')"
key="$(sudo -n nginx -T 2>/dev/null | awk '$1=="ssl_certificate_key" {gsub(/;/,"",$2); print $2; exit}')"

if [ -z "$cert" ] || [ -z "$key" ]; then
  echo 'Existing TLS certificate directives were not found.' >&2
  exit 1
fi

cat >"$TMP" <<EOF
server {
    listen 8443 ssl;
    listen [::]:8443 ssl;
    server_name _;
    ssl_certificate $cert;
    ssl_certificate_key $key;
    location / {
        add_header X-WeddingPick-Probe static-admin always;
        return 204;
    }
}
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
echo 'Temporary 8443/9443 HTTPS probes are active.'
