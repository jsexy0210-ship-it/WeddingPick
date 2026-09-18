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
backup_id="$(awk -F= '$1=="container_id"{print $2}' "$MARKER")"
test -n "$backup_name"
test -f "$env_backup"

recovery_in_place=0
if sudo -n docker inspect "$backup_name" >/dev/null 2>&1; then
  actual_backup_id="$(sudo -n docker inspect -f '{{.Id}}' "$backup_name")"
  test -n "$actual_backup_id"

  if [ -n "$backup_id" ] && [ "$backup_id" != "$actual_backup_id" ]; then
    echo "CORS recovery container ID changed: expected $backup_id, got $actual_backup_id" >&2
    echo 'Current weddingpick-api was preserved.' >&2
    exit 1
  fi

  if [ -z "$backup_id" ]; then
    backup_id="$actual_backup_id"
    printf 'container_id=%s\n' "$backup_id" >> "$MARKER"
  fi
else
  current_id="$(sudo -n docker inspect -f '{{.Id}}' weddingpick-api 2>/dev/null || true)"
  if [ -n "$backup_id" ] && [ "$current_id" = "$backup_id" ]; then
    recovery_in_place=1
    echo 'Recovery container is already in the production slot; resuming rollback verification.'
  else
    echo "CORS recovery container is missing: $backup_name" >&2
    echo 'Current weddingpick-api was preserved.' >&2
    exit 1
  fi
fi

cp -p "$env_backup" "$ENV_FILE"

if [ "$recovery_in_place" -eq 0 ]; then
  current_id="$(sudo -n docker inspect -f '{{.Id}}' weddingpick-api 2>/dev/null || true)"
  if [ -n "$current_id" ] && [ "$current_id" != "$backup_id" ]; then
    sudo -n docker rm -f "$current_id" >/dev/null
  fi

  sudo -n docker rename "$backup_name" weddingpick-api
fi

sudo -n docker start "$backup_id" >/dev/null

for i in $(seq 1 30); do
  if curl --fail --silent --show-error --connect-timeout 5 --max-time 10 http://127.0.0.1:3001/health >/dev/null 2>&1; then
    rm -f "$MARKER"
    echo 'CORS cutover rolled back and previous API restored.'
    exit 0
  fi
  sleep 2
done

echo 'Previous API container did not become healthy after rollback; rollback marker preserved for retry.' >&2
exit 1
