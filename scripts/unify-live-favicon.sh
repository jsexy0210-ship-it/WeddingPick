#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
LIVE_ROOT=/var/www/weddingpick/releases
CANONICAL="$GITHUB_WORKSPACE/apps/mobile/assets/images/favicon.png"
VERSION=20260918-unified1

test -f "$CANONICAL"
test -r "$ROOT/static-live-app"
release_sha="$(cat "$ROOT/static-live-app")"
release_root="$LIVE_ROOT/$release_sha"
test -d "$release_root/app"
test -d "$release_root/admin"
test -d "$release_root/web"

backup_dir="$ROOT/favicon-backups/$(date -u +%Y%m%dT%H%M%SZ)-$release_sha"
mkdir -p "$backup_dir"
for role in app admin web; do
  if [ -d "$release_root/$role" ]; then
    sudo -n tar -C "$release_root/$role" -czf "$backup_dir/$role-html.tgz" --wildcards '*.html' 2>/dev/null || true
  fi
done

restore() {
  set +e
  for role in app admin web; do
    if [ -f "$backup_dir/$role-html.tgz" ]; then
      sudo -n tar -C "$release_root/$role" -xzf "$backup_dir/$role-html.tgz" >/dev/null 2>&1 || true
    fi
  done
}
trap 'status=$?; if [ "$status" -ne 0 ]; then restore; fi; exit "$status"' EXIT

# 같은 바이트 하나를 443 root에서 서비스한다.
sudo -n install -m 0644 "$CANONICAL" "$release_root/app/favicon.png"

python3 - "$release_root" "$VERSION" <<'PY'
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
version = sys.argv[2]
tag = f'<link rel="icon" type="image/png" href="/favicon.png?v={version}">'

# rel=icon 후보를 전부 지운 다음 하나만 넣는다. apple-touch-icon/manifest는 유지한다.
icon_re = re.compile(
    r'<link\b(?=[^>]*\brel=["\'](?:shortcut\s+)?icon["\'])[^>]*>',
    re.IGNORECASE,
)

changed = 0
for role in ('app', 'admin', 'web'):
    base = root / role
    if not base.exists():
        continue
    for path in base.rglob('*.html'):
        html = path.read_text(encoding='utf-8')
        cleaned = icon_re.sub('', html)
        if tag not in cleaned:
            if '</head>' not in cleaned:
                raise SystemExit(f'missing </head>: {path}')
            cleaned = cleaned.replace('</head>', tag + '</head>', 1)
        if cleaned != html:
            path.write_text(cleaned, encoding='utf-8')
            changed += 1

print(f'favicon_html_changed={changed}')
PY

# 세 대표 화면이 같은 URL을 선언하는지 확인한다.
for url in   https://210.109.82.212/   https://210.109.82.212/login   https://210.109.82.212/admin/login   https://210.109.82.212/website.html; do
  out="$(mktemp)"
  curl --fail --silent --show-error --connect-timeout 5 --max-time 15 "$url" -o "$out"
  grep -Fq "/favicon.png?v=$VERSION" "$out"
  rm -f "$out"
done

remote="$(mktemp)"
curl --fail --silent --show-error --connect-timeout 5 --max-time 15   "https://210.109.82.212/favicon.png?v=$VERSION" -o "$remote"
cmp -s "$CANONICAL" "$remote"
rm -f "$remote"

trap - EXIT
echo "Unified live favicon: release=$release_sha url=/favicon.png?v=$VERSION"
