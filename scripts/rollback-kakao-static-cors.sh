#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
ENV_FILE="$ROOT/.env.kakao-prod"
MARKER="$ROOT/.cors-cutover-backup"

test -r "$MARKER"
backup_name="$(awk -F= '$1=="container"{print $2}' "$MARKER")"
env_backup="$(awk -F= '$1=="env_backup"{print $2}' "$MARKER")"
test -n "$backup_name"
test -f "$env_backup"

sudo -n docker rm -f weddingpick-api >/dev/null 2>&1 || true
sudo -n docker rename "$backup_name" weddingpick-api
sudo -n docker start weddingpick-api >/dev/null
cp -p "$env_backup" "$ENV_FILE"

for i in $(seq 1 30); do
  if curl --fail --silent --show-error --connect-timeout 5 --max-time 10 http://127.0.0.1:3001/health >/dev/null 2>&1; then
    echo 'CORS cutover rolled back and previous API restored.'
    exit 0
  fi
  sleep 2
done

echo 'Previous API container did not become healthy after rollback.' >&2
exit 1
