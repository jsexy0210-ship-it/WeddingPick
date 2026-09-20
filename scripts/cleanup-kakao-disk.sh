#!/usr/bin/env bash
set -euo pipefail

ROOT="${WEDDINGPICK_ROOT:-/home/ubuntu/WeddingPick}"
RELEASES="$ROOT/static-releases"
PUBLIC_HEALTH_URL="${WEDDINGPICK_PUBLIC_HEALTH_URL:-https://210.109.82.212/health}"
APPLY=false

if [ "${1:-}" = '--apply' ]; then
  APPLY=true
elif [ "$#" -ne 0 ]; then
  echo "Unknown argument: $*" >&2
  exit 1
fi

if [ "$APPLY" = true ] && [ "${WP_RETENTION_APPROVED:-}" != '1' ]; then
  echo 'Apply mode requires WP_RETENTION_APPROVED=1 from the production-approved workflow.' >&2
  exit 1
fi

health_ok() {
  local url="$1"
  curl --fail --silent --show-error --connect-timeout 5 --max-time 15 "$url" |
    python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("ok") is True and d.get("database")=="ok" else 1)'
}

assert_runtime_healthy() {
  test "$(sudo -n docker inspect -f '{{.State.Running}}' weddingpick-api)" = true
  test "$(sudo -n docker inspect -f '{{.State.Running}}' weddingpick-worker)" = true
  health_ok http://127.0.0.1:3001/health
  health_ok "$PUBLIC_HEALTH_URL"
}

read_optional_marker() {
  local path="$1"
  if [ ! -e "$path" ]; then
    return 0
  fi
  if [ ! -r "$path" ]; then
    echo "Cleanup protection marker is not readable: $path" >&2
    return 1
  fi
  cat "$path"
}

collect_plan() {
  local output="$1"
  local image_id image_ref live candidate dir name kept_recent
  local container_ids image_refs recent_dirs all_dirs
  declare -A protected_image_ids=()
  declare -A keep_release=()

  : > "$output"
  container_ids="$(sudo -n docker ps -aq)"
  while IFS= read -r container_id; do
    [ -n "$container_id" ] || continue
    image_id="$(sudo -n docker inspect -f '{{.Image}}' "$container_id")"
    [ -n "$image_id" ] && protected_image_ids["$image_id"]=1
  done <<< "$container_ids"

  image_refs="$(sudo -n docker images --format '{{.Repository}}:{{.Tag}}' | sort -u)"
  while IFS= read -r image_ref; do
    [[ "$image_ref" =~ ^weddingpick-(api|worker):[0-9a-f]{40}$ ]] || continue
    image_id="$(sudo -n docker image inspect -f '{{.Id}}' "$image_ref" 2>/dev/null || true)"
    if [ -n "$image_id" ] && [ -z "${protected_image_ids[$image_id]:-}" ]; then
      printf 'image\t%s\t%s\n' "$image_ref" "$image_id" >> "$output"
    fi
  done <<< "$image_refs"

  if [ -d "$RELEASES" ]; then
    live="$(read_optional_marker "$ROOT/static-live-app")"
    candidate="$(read_optional_marker "$RELEASES/latest-candidate")"
    [[ "$live" =~ ^[0-9a-f]{40}$ ]] && keep_release["$live"]=1
    [[ "$candidate" =~ ^[0-9a-f]{40}$ ]] && keep_release["$candidate"]=1
    [[ "${GITHUB_SHA:-}" =~ ^[0-9a-f]{40}$ ]] && keep_release["$GITHUB_SHA"]=1

    kept_recent=0
    recent_dirs="$(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)"
    while IFS= read -r dir; do
      [ -n "$dir" ] || continue
      name="$(basename "$dir")"
      [[ "$name" =~ ^[0-9a-f]{40}$ ]] || continue
      if [ "$kept_recent" -lt 2 ]; then
        keep_release["$name"]=1
        kept_recent=$((kept_recent + 1))
      fi
    done <<< "$recent_dirs"

    all_dirs="$(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -print)"
    while IFS= read -r dir; do
      [ -n "$dir" ] || continue
      name="$(basename "$dir")"
      [[ "$name" =~ ^[0-9a-f]{40}$ ]] || continue
      if [ -z "${keep_release[$name]:-}" ]; then
        printf 'release\t%s\n' "$name" >> "$output"
      fi
    done <<< "$all_dirs"
  fi

  sort -o "$output" "$output"
}

plan_hash() {
  sha256sum "$1" | cut -d' ' -f1
}

assert_release_target() {
  local name="$1" target parent
  [[ "$name" =~ ^[0-9a-f]{40}$ ]] || return 1
  target="$(realpath -m "$RELEASES/$name")"
  parent="$(realpath -m "$RELEASES")"
  [ "$(dirname "$target")" = "$parent" ]
}

plan="$(mktemp)"
fresh="$(mktemp)"
trap 'rm -f "$plan" "$fresh"' EXIT

assert_runtime_healthy
collect_plan "$plan"
hash="$(plan_hash "$plan")"

echo "mode=$([ "$APPLY" = true ] && echo apply || echo dry-run)"
echo "before-disk=$(df -Pk "$ROOT" | tail -n1)"
sudo -n docker system df || true
echo "candidate-images=$(awk -F '\t' '$1=="image" {count++} END {print count+0}' "$plan")"
echo "candidate-static-releases=$(awk -F '\t' '$1=="release" {count++} END {print count+0}' "$plan")"
sed 's/^/CANDIDATE /' "$plan"
echo "plan-hash=$hash"

if [ "$APPLY" != true ]; then
  echo 'dry-run only: no images, containers, markers, databases, object storage, or files were deleted'
  exit 0
fi

expected="${WP_CLEANUP_EXPECTED_PLAN_HASH:-}"
if [[ ! "$expected" =~ ^[0-9a-f]{64}$ ]] || [ "$hash" != "$expected" ]; then
  echo 'Cleanup plan changed or the approved plan hash is missing; refusing to delete.' >&2
  exit 1
fi

while IFS=$'\t' read -r kind value planned_id; do
  collect_plan "$fresh"
  if [ "$kind" = image ]; then
    grep -Fqx $'image\t'"$value"$'\t'"$planned_id" "$fresh" || {
      echo "Image candidate changed before delete: $value" >&2
      exit 1
    }
    echo "Removing unreferenced runtime image: $value"
    sudo -n docker image rm "$value" >/dev/null
  elif [ "$kind" = release ]; then
    assert_release_target "$value" || {
      echo "Refusing static release outside the release root: $value" >&2
      exit 1
    }
    grep -Fqx $'release\t'"$value" "$fresh" || {
      echo "Static release candidate changed before delete: $value" >&2
      exit 1
    }
    echo "Removing stale static release: $value"
    rm -rf -- "$RELEASES/$value"
  else
    echo "Unknown cleanup plan row: $kind" >&2
    exit 1
  fi
done < "$plan"

assert_runtime_healthy
collect_plan "$fresh"
test ! -s "$fresh"
echo "after-disk=$(df -Pk "$ROOT" | tail -n1)"
sudo -n docker system df || true
echo 'cleanup=ok'
echo 'Running containers, rollback containers, markers, databases, environment files, and object storage were not modified.'
