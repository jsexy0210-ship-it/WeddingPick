#!/usr/bin/env bash
set -euo pipefail

ROOT="${GITHUB_WORKSPACE:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

# 새 workflow/배포 script가 추가되어도 목록 갱신 없이 자동 탐지한다.
mapfile -t files < <(
  {
    find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) -print
    find scripts -maxdepth 1 -type f \( -name '*.sh' -o -name '*.mjs' -o -name '*.cjs' -o -name '*.js' \) -print
  } | sort -u
)

for file in "${files[@]}"; do
  # 이 guard는 금지 문자열 자체를 검사식으로 포함하므로 자기 자신은 제외한다.
  [ "$file" = "scripts/assert-admin-origin-443.sh" ] && continue
  if grep -Eq '210\.109\.82\.212:8443|listen[[:space:]]+8443([[:space:]]|;)|static-admin' "$file"; then
    echo "Admin 443 lock violation in $file" >&2
    exit 1
  fi
done

if grep -R -n --include='*.yml' --include='*.yaml' 'ADMIN_ORIGIN' .github/workflows; then
  echo 'Workflow-level ADMIN_ORIGIN override is forbidden.' >&2
  exit 1
fi

if grep -Fq 'process.env.ADMIN_ORIGIN' scripts/split-admin-dist.mjs; then
  echo 'ADMIN_ORIGIN environment override is forbidden.' >&2
  exit 1
fi

grep -Fq "const ADMIN_ORIGIN = 'https://210.109.82.212';" scripts/split-admin-dist.mjs
grep -Fq 'listen 443 ssl default_server;' scripts/install-kakao-app-web.sh
grep -Fq 'location ^~ /admin/' scripts/install-kakao-app-web.sh
grep -Fq 'https://210.109.82.212/admin/login' scripts/install-kakao-app-web.sh

echo 'Admin origin lock OK: https://210.109.82.212/admin on 443'
