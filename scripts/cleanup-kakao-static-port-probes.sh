#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/conf.d/weddingpick-port-probe.conf
MARKER="$ROOT/.static-port-probe-backup"
CURRENT=""

if [ ! -r "$MARKER" ]; then
  echo 'No active static port probe transaction; nothing to clean up.'
  exit 0
fi

backup="$(cat "$MARKER")"
if [ "$backup" != NONE ] && [ ! -f "$backup" ]; then
  echo "Static port probe backup is missing: $backup" >&2
  exit 1
fi

CURRENT="$(mktemp)"
cleanup_tmp() {
  rm -f "$CURRENT" || true
}
trap cleanup_tmp EXIT

had_current=0
if sudo -n test -f "$CONF"; then
  sudo -n cp "$CONF" "$CURRENT"
  had_current=1
fi

restore_probe_on_error() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo 'Static port probe cleanup failed; restoring the pre-cleanup probe config.' >&2
    if [ "$had_current" -eq 1 ]; then
      sudo -n cp "$CURRENT" "$CONF" || true
    else
      sudo -n rm -f "$CONF" || true
    fi
    if sudo -n nginx -t >/dev/null 2>&1; then
      sudo -n systemctl reload nginx || true
    fi
  fi
  cleanup_tmp
  exit "$status"
}
trap restore_probe_on_error EXIT

if [ "$backup" = NONE ]; then
  sudo -n rm -f "$CONF"
else
  sudo -n cp "$backup" "$CONF"
fi

sudo -n nginx -t
sudo -n systemctl reload nginx
rm -f "$MARKER"
trap - EXIT
cleanup_tmp
echo 'Temporary 8443/9443 HTTPS probes removed and previous Nginx state restored.'
