#!/usr/bin/env bash
set -euo pipefail

ROOT="${GITHUB_WORKSPACE:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

files=(
  scripts/split-admin-dist.mjs
  scripts/install-kakao-app-web.sh
  scripts/install-kakao-preview-routes.sh
  scripts/install-kakao-static-sites.sh
  scripts/add-kakao-static-cors.sh
  scripts/probe-kakao-static-ports.sh
  .github/workflows/main.yml
  .github/workflows/pr-validation.yml
  .github/workflows/cutover-kakao-app-web.yml
  .github/workflows/cutover-kakao-admin-web.yml
  .github/workflows/preview-kakao-admin-web.yml
  .github/workflows/preview-kakao-app-web.yml
  .github/workflows/enable-kakao-static-cors.yml
  .github/workflows/probe-kakao-static-ports.yml
)

for file in "${files[@]}"; do
  test -f "$file"
  if grep -Eq '210\.109\.82\.212:8443|listen[[:space:]]+8443([[:space:]]|;)|static-admin' "$file"; then
    echo "Admin 443 lock violation in $file" >&2
    exit 1
  fi
done

if grep -Fq 'process.env.ADMIN_ORIGIN' scripts/split-admin-dist.mjs; then
  echo 'ADMIN_ORIGIN environment override is forbidden.' >&2
  exit 1
fi

grep -Fq "const ADMIN_ORIGIN = 'https://210.109.82.212';" scripts/split-admin-dist.mjs
grep -Fq 'https://210.109.82.212/admin/login' scripts/install-kakao-app-web.sh

echo 'Admin origin lock OK: https://210.109.82.212/admin on 443'
