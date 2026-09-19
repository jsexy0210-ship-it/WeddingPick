#!/usr/bin/env bash
set -euo pipefail

IMAGE="${1:-}"
NAME=weddingpick-worker
ENV_FILE=/home/ubuntu/WeddingPick/.env.kakao-prod

if [ -z "$IMAGE" ]; then
  IMAGE="$(sudo -n docker inspect -f '{{.Config.Image}}' weddingpick-api)"
fi

test -r "$ENV_FILE"

verify_expected_revision() {
  local expected="${GITHUB_SHA:-}" actual
  if [[ ! "$expected" =~ ^[0-9a-f]{40}$ ]]; then
    return 0
  fi
  actual="$(sudo -n docker inspect -f '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$NAME")"
  if [ "$actual" != "$expected" ]; then
    echo "Worker revision mismatch: expected $expected" >&2
    return 1
  fi
}

if sudo -n docker inspect "$NAME" >/dev/null 2>&1; then
  current_image="$(sudo -n docker inspect -f '{{.Config.Image}}' "$NAME")"
  running="$(sudo -n docker inspect -f '{{.State.Running}}' "$NAME")"
  if [ "$running" = true ] && [ "$current_image" = "$IMAGE" ]; then
    verify_expected_revision
    echo "Worker already runs target image: $IMAGE"
    exit 0
  fi
fi

backup="weddingpick-worker-previous-${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}"
had_old=0
old_id=''

if sudo -n docker inspect "$NAME" >/dev/null 2>&1; then
  had_old=1
  old_id="$(sudo -n docker inspect -f '{{.Id}}' "$NAME")"
fi

restore_old() {
  set +e
  local current_id old_name

  current_id="$(sudo -n docker inspect -f '{{.Id}}' "$NAME" 2>/dev/null || true)"
  if [ "$had_old" -eq 1 ]; then
    if [ -n "$current_id" ] && [ "$current_id" != "$old_id" ]; then
      sudo -n docker rm -f "$current_id" >/dev/null 2>&1 || true
    fi

    old_name="$(sudo -n docker inspect -f '{{.Name}}' "$old_id" 2>/dev/null || true)"
    if [ -n "$old_name" ]; then
      if [ "$old_name" != "/$NAME" ]; then
        sudo -n docker rename "$old_id" "$NAME" >/dev/null 2>&1 || true
      fi
      sudo -n docker start "$old_id" >/dev/null 2>&1 || true
    else
      echo 'Previous worker container is missing; automatic recovery cannot restore it.' >&2
    fi
  elif [ -n "$current_id" ]; then
    sudo -n docker rm -f "$current_id" >/dev/null 2>&1 || true
  fi
}

trap 'status=$?; if [ "$status" -ne 0 ]; then restore_old; fi; exit "$status"' EXIT

if [ "$had_old" -eq 1 ]; then
  sudo -n docker stop --time 30 "$old_id" >/dev/null
  sudo -n docker rename "$old_id" "$backup"
fi

sudo -n docker run -d --pull=never --name "$NAME" --restart=unless-stopped \
  --env-file "$ENV_FILE" \
  "$IMAGE" /opt/tsx/node_modules/.bin/tsx apps/api/src/worker.ts >/dev/null

sleep 8
test "$(sudo -n docker inspect -f '{{.State.Running}}' "$NAME")" = true
sudo -n docker logs "$NAME" 2>&1 | grep -F '분석 워커 시작'
verify_expected_revision

trap - EXIT
echo "Worker updated successfully: $IMAGE"
if [ "$had_old" -eq 1 ]; then
  echo "Stopped recovery worker retained: $backup"
fi
