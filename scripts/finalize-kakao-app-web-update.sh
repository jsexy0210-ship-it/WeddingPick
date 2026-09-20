#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
CONF=/etc/nginx/sites-available/weddingpick-api
LIVE_MARKER="$ROOT/static-live-app"
TX_BACKUP_MARKER="$ROOT/.app-web-update-backup"
TX_LIVE_MARKER="$ROOT/.app-web-update-live-backup"
TX_TARGET_MARKER="$ROOT/.app-web-update-target"

test -r "$TX_BACKUP_MARKER"
test -r "$TX_LIVE_MARKER"
test -r "$TX_TARGET_MARKER"
target="$(cat "$TX_TARGET_MARKER")"
test -n "$target"
test -r "$LIVE_MARKER"
live="$(cat "$LIVE_MARKER")"
if [ "$live" != "$target" ]; then
  echo "App-web live marker does not match pending transaction target: live=$live target=$target" >&2
  exit 1
fi
expected_root="/var/www/weddingpick/releases/$target/app"
if ! grep -Fq "root $expected_root;" "$CONF" 2>/dev/null; then
  echo "Active Nginx root does not match pending app-web target: $target" >&2
  exit 1
fi

rm -f "$TX_BACKUP_MARKER" "$TX_LIVE_MARKER" "$TX_TARGET_MARKER"

# 공개 검증이 끝난 뒤에는 이전 정적 release를 보존할 이유가 없다.
# 다음 배포의 rollback은 그 시점의 현재 release를 이전 release로 사용하므로,
# 성공한 현재 SHA 하나만 남겨 오래된 산출물/설정 문자열이 VM에 쌓이지 않게 한다.
for base in "$ROOT/static-releases" /var/www/weddingpick/releases; do
  [ -d "$base" ] || continue
  while IFS= read -r dir; do
    [ "$(basename "$dir")" = "$target" ] && continue
    sudo -n rm -rf "$dir"
  done < <(find "$base" -mindepth 1 -maxdepth 1 -type d -print)
done

echo "App/admin update finalized and stale static releases removed: $target"
