#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
MODE_MARKER="$ROOT/.app-web-last-cutover-mode"

test -r "$MODE_MARKER"
mode="$(cat "$MODE_MARKER")"

case "$mode" in
  update)
    bash "$(dirname "$0")/rollback-kakao-app-web-update.sh"
    ;;
  api-only)
    bash "$(dirname "$0")/rollback-kakao-app-web.sh"
    ;;
  noop)
    echo 'App-web cutover changed no live state; rollback is a no-op.'
    ;;
  *)
    echo "Unknown app-web rollback mode: $mode" >&2
    exit 1
    ;;
esac

rm -f "$MODE_MARKER"
