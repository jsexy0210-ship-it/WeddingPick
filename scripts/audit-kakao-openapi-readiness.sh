#!/usr/bin/env bash
set -euo pipefail

ROOT=/home/ubuntu/WeddingPick
ENV_FILE="$ROOT/.env.kakao-prod"

echo '#### Kakao OpenAPI readiness'
if [ -r "$ENV_FILE" ]; then
  python3 - "$ENV_FILE" <<'PY'
from pathlib import Path
import re, sys
names=[]
for raw in Path(sys.argv[1]).read_text(encoding='utf-8').splitlines():
    line=raw.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key=line.split('=',1)[0].strip()
    if re.search(r'(KAKAO|IAM|OPENAPI|TOKEN|PROJECT|USER).*?(KEY|ID|SECRET|UUID)?$|^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)$', key):
        names.append(key)
for key in sorted(set(names)):
    kind = 's3' if key in {'AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY'} else 'candidate'
    print(f'- {key}: present ({kind})')
PY
else
  echo '- production env: unreadable'
fi

for bin in openstack kc kakaocloud aws curl jq python3; do
  if command -v "$bin" >/dev/null 2>&1; then
    echo "- tool:$bin=present"
  else
    echo "- tool:$bin=missing"
  fi
done

# 보안 그룹 API에 쓸 IAM 자격이 흔히 저장되는 파일이 있는지만 이름으로 확인한다.
for path in   "$HOME/.config/openstack/clouds.yaml"   "$HOME/.config/kakaocloud"   "$HOME/.kakaocloud"   "$ROOT/.env.kakao-openapi"; do
  if [ -e "$path" ]; then
    echo "- credential_file:$(basename "$path")=present"
  fi
done
