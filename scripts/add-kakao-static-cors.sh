#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
ENV_FILE="$ROOT/.env.kakao-prod"
MARKER="$ROOT/.cors-cutover-backup"

test -r "$ENV_FILE"

mkdir -p "$ROOT/env-backups"
env_backup="$ROOT/env-backups/env-kakao-prod-$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$ENV_FILE" "$env_backup"


health_ok() {
  local url="$1" attempts="${2:-20}" delay="${3:-2}" body
  for ((i=0; i<attempts; i++)); do
    body="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 10 "$url" 2>/dev/null || true)"
    if printf '%s' "$body" | python3 -c 'import json,sys; d=json.load(sys.stdin); s=d.get("schema"); sys.exit(0 if d.get("ok") is True and d.get("database")=="ok" and isinstance(s,dict) and s.get("ok") is True and s.get("pending")==[] else 1)' 2>/dev/null; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

old_id="$(sudo -n docker inspect -f '{{.Id}}' weddingpick-api)"
image="$(sudo -n docker inspect -f '{{.Config.Image}}' "$old_id")"
backup_name="weddingpick-api-cors-previous-${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}"

if sudo -n docker inspect "$backup_name" >/dev/null 2>&1; then
  echo "Recovery container already exists: $backup_name" >&2
  cp -p "$env_backup" "$ENV_FILE"
  exit 1
fi

restore() {
  set +e
  local current_id old_name

  current_id="$(sudo -n docker inspect -f '{{.Id}}' weddingpick-api 2>/dev/null || true)"
  if [ -n "$current_id" ] && [ "$current_id" != "$old_id" ]; then
    sudo -n docker rm -f "$current_id" >/dev/null 2>&1 || true
  fi

  old_name="$(sudo -n docker inspect -f '{{.Name}}' "$old_id" 2>/dev/null || true)"
  if [ -n "$old_name" ]; then
    if [ "$old_name" != "/weddingpick-api" ]; then
      sudo -n docker rename "$old_id" weddingpick-api >/dev/null 2>&1 || true
    fi
    sudo -n docker start "$old_id" >/dev/null 2>&1 || true
    if ! health_ok http://127.0.0.1:3001/health 30 2; then
      echo 'Previous API container did not recover after CORS cutover failure.' >&2
    fi
  else
    echo 'Previous API container is missing; automatic CORS recovery cannot restore it.' >&2
  fi

  cp -p "$env_backup" "$ENV_FILE"
}
trap 'status=$?; if [ "$status" -ne 0 ]; then restore; fi; exit "$status"' EXIT

python3 - "$ENV_FILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
wanted = [
    'https://210.109.82.212',
]
lines = text.splitlines()
found = False
out = []
for line in lines:
    if line.startswith('CORS_ORIGINS='):
        found = True
        value = line.split('=', 1)[1].strip().strip('"').strip("'")
        origins = [x.strip() for x in value.split(',') if x.strip()]
        for origin in wanted:
            if origin not in origins:
                origins.append(origin)
        out.append('CORS_ORIGINS=' + ','.join(origins))
    else:
        out.append(line)
if not found:
    out.append('CORS_ORIGINS=' + ','.join(wanted))
path.write_text('\n'.join(out) + '\n', encoding='utf-8')
PY


sudo -n docker stop --time 30 "$old_id" >/dev/null
sudo -n docker rename "$old_id" "$backup_name"
sudo -n docker run -d --pull=never --name weddingpick-api --restart=unless-stopped \
  --label "org.opencontainers.image.revision=$(sudo -n docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$backup_name")" \
  --env-file "$ENV_FILE" -e RUN_WORKER_IN_API=false \
  -p 127.0.0.1:3001:3000 "$image" >/dev/null

test "$(sudo -n docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' weddingpick-api | sed -n 's/^RUN_WORKER_IN_API=//p' | tail -n1)" = false
health_ok http://127.0.0.1:3001/health 30 2
health_ok https://210.109.82.212/health 20 3

printf 'container=%s\nenv_backup=%s\n' "$backup_name" "$env_backup" > "$MARKER"
trap - EXIT
echo 'Kakao static origins added to CORS; API restarted with the same image.'
