#!/usr/bin/env bash
set -euo pipefail
CONF=/etc/nginx/conf.d/weddingpick-port-probe.conf
sudo -n rm -f "$CONF"
sudo -n nginx -t
sudo -n systemctl reload nginx
echo 'Temporary 8443/9443 HTTPS probes removed.'
