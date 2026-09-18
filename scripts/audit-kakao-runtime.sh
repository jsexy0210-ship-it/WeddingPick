#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
PROD_ENV="$ROOT/.env.kakao-prod"
SMOKE_ENV="$ROOT/.env.kakao-smoke"

print_env_summary() {
  local file="$1" label="$2"
  echo "#### $label non-secret environment"
  if [ ! -r "$file" ]; then
    echo "- file: missing or unreadable"
    return
  fi
  python3 - "$file" <<'PY'
from pathlib import Path
import sys
allowed = {
    "NODE_ENV", "PORT", "RUN_WORKER_IN_API", "RETENTION_MODE",
    "STORAGE_DRIVER", "S3_BUCKET", "S3_REGION", "S3_ENDPOINT",
    "GEMINI_MODEL", "WEDDING_FEED_AUTOWRITE", "EXPO_AUTO_DELETE_ENABLED",
    "CORS_ORIGINS",
}
values = {}
for raw in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    key = key.strip()
    if key in allowed:
        values[key] = value.strip().strip('"').strip("'")
for key in sorted(allowed):
    value = values.get(key)
    print(f"- {key}={value if value is not None else '<unset>'}")
PY
}

echo '#### Detected listeners'
sudo -n ss -ltnp 2>/dev/null |
  awk 'NR==1 || /:80 |:443 |:3001 |:3002 /' |
  sed -E 's/users:\(\([^)]*\)\)/users:(redacted)/g' || true
echo

echo '#### Web server services'
for unit in nginx caddy apache2; do
  state="$(systemctl is-active "$unit" 2>/dev/null || true)"
  printf -- '- %s: %s\n' "$unit" "${state:-not-found}"
done
echo

echo '#### Sanitized routing directives'
if command -v nginx >/dev/null 2>&1; then
  sudo -n nginx -T 2>/dev/null |
    grep -E '^[[:space:]]*(listen|server_name|root|location|try_files|proxy_pass|ssl_certificate)' |
    sed -E 's#(ssl_certificate(_key)?[[:space:]]+).*#\1[redacted];#' |
    head -160 || true
elif command -v caddy >/dev/null 2>&1; then
  sudo -n caddy adapt --config /etc/caddy/Caddyfile --pretty 2>/dev/null |
    grep -E '"(listen|host|handler|upstreams|root)"' |
    head -160 || true
else
  echo '- no nginx/caddy executable detected'
fi
echo

echo '#### TLS certificate on 127.0.0.1:443'
if command -v openssl >/dev/null 2>&1; then
  timeout 8 openssl s_client -connect 127.0.0.1:443 -servername 210.109.82.212 </dev/null 2>/dev/null |
    openssl x509 -noout -issuer -subject -dates -ext subjectAltName 2>/dev/null || echo '- certificate inspection unavailable'
else
  echo '- openssl unavailable'
fi
echo

echo '#### Certificate renewal schedulers'
systemctl list-timers --all --no-pager 2>/dev/null |
  grep -Ei 'certbot|acme|letsencrypt|certificate' || echo '- no matching systemd timer'
for dir in /etc/cron.d /etc/cron.daily /etc/cron.hourly; do
  if [ -d "$dir" ]; then
    find "$dir" -maxdepth 1 -type f -printf '%f\n' 2>/dev/null |
      grep -Ei 'certbot|acme|letsencrypt|certificate' || true
  fi
done
echo

print_env_summary "$PROD_ENV" 'Production'
echo
print_env_summary "$SMOKE_ENV" 'Smoke'
echo

echo '#### Running containers'
sudo -n docker ps --format '- {{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}' 2>/dev/null || echo '- docker status unavailable'
echo

echo '#### Retained recovery containers'
count="$(sudo -n docker ps -a --filter 'name=weddingpick-api-previous-' --format '{{.Names}}' 2>/dev/null | wc -l | tr -d ' ')"
echo "- count: $count"
echo

echo '#### Disk'
df -h "$ROOT" 2>/dev/null | sed -n '1,2p' || true
if [ -d "$ROOT/static-releases" ]; then
  printf -- '- static release directories: %s\n' "$(find "$ROOT/static-releases" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
  du -sh "$ROOT/static-releases" 2>/dev/null || true
fi
