#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
ENV_FILE="$ROOT/.env.kakao-prod"
MARKER="$ROOT/.cors-cutover-backup"

if [ ! -r "$MARKER" ]; then
  echo 'No active CORS rollback transaction; nothing to restore.'
  exit 0
fi

backup_name="$(awk -F= '$1=="container"{print $2}' "$MARKER")"
env_backup="$(awk -F= '$1=="env_backup"{print $2}' "$MARKER")"
test -n "$backup_name"
test -f "$env_backup"

if ! sudo -n docker inspect "$backup_name" >/dev/null 2>&1; then
  echo "CORS recovery container is missing: $backup_name" >&2
  echo 'Current weddingpick-api was preserved.' >&2
  exit 1
fi

cp -p "$env_backup" "$ENV_FILE"

current_id="$(sudo -n docker inspect -f '{{.Id}}' weddingpick-api 2>/dev/null || true)"
if [ -n "$current_id" ]; then
  sudo -n docker rm -f "$current_id" >/dev/null
fi

sudo -n docker rename "$backup_name" weddingpick-api
sudo -n docker start weddingpick-api >/dev/null

for i in $(seq 1 30); do
  if curl --fail --silent --show-error --connect-timeout 5 --max-time 10 http://127.0.0.1:3001/health >/dev/null 2>&1; then
    rm -f "$MARKER"
    echo 'CORS cutover rolled back and previous API restored.'
    exit 0
  fi
  sleep 2
done

echo 'Previous API container did not become healthy after rollback; rollback marker preserved.' >&2
exit 1
