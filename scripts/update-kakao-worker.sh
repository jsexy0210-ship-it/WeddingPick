#!/usr/bin/env bash
set -euo pipefail

IMAGE="${1:-}"
NAME=weddingpick-worker
ENV_FILE=/home/ubuntu/WeddingPick/.env.kakao-prod

if [ -z "$IMAGE" ]; then
  IMAGE="$(sudo -n docker inspect -f '{{.Config.Image}}' weddingpick-api)"
fi

test -r "$ENV_FILE"

if sudo -n docker inspect "$NAME" >/dev/null 2>&1; then
  current_image="$(sudo -n docker inspect -f '{{.Config.Image}}' "$NAME")"
  running="$(sudo -n docker inspect -f '{{.State.Running}}' "$NAME")"
  if [ "$running" = true ] && [ "$current_image" = "$IMAGE" ]; then
    echo "Worker already runs target image: $IMAGE"
    exit 0
  fi
fi

backup="weddingpick-worker-previous-${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}"
had_old=0

restore_old() {
  set +e
  sudo -n docker rm -f "$NAME" >/dev/null 2>&1
  if [ "$had_old" -eq 1 ] && sudo -n docker inspect "$backup" >/dev/null 2>&1; then
    sudo -n docker rename "$backup" "$NAME" >/dev/null 2>&1
    sudo -n docker start "$NAME" >/dev/null 2>&1
  fi
}

if sudo -n docker inspect "$NAME" >/dev/null 2>&1; then
  had_old=1
  sudo -n docker stop --time 30 "$NAME" >/dev/null
  sudo -n docker rename "$NAME" "$backup"
fi

trap 'status=$?; if [ "$status" -ne 0 ]; then restore_old; fi; exit "$status"' EXIT

sudo -n docker run -d --pull=never --name "$NAME" --restart=unless-stopped \
  --env-file "$ENV_FILE" \
  "$IMAGE" npm run worker --workspace @weddingpick/api >/dev/null

sleep 8
test "$(sudo -n docker inspect -f '{{.State.Running}}' "$NAME")" = true
sudo -n docker logs "$NAME" 2>&1 | grep -F '분석 워커 시작'

trap - EXIT
echo "Worker updated successfully: $IMAGE"
if [ "$had_old" -eq 1 ]; then
  echo "Stopped recovery worker retained: $backup"
fi
