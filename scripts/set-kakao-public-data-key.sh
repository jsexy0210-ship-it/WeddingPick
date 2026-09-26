#!/usr/bin/env bash
# 공공데이터포털 인증키(DATA_GO_KR_MY_KEY)를 운영 환경 파일에 넣는다 — 홈 날씨(0447) 수집용.
#
# 값은 GitHub Secret `DATA_GO_KR_MY_KEY`에서 환경변수로만 받는다(인자로 받지 않는다 — 프로세스
# 목록에 남는다). 값을 찍지 않는다. Secret이 비어 있으면 환경 파일을 건드리지 않는다 — 이미 VM에
# 손으로 넣어 둔 값이 있으면 그대로 쓰이고, 없으면 워커가 수집을 끄고 홈은 날씨 자리를 그리지 않는다.
set -euo pipefail

ENV_FILE="${1:?production environment file is required}"
test -w "$ENV_FILE"

if [ -z "${DATA_GO_KR_MY_KEY:-}" ]; then
  echo 'DATA_GO_KR_MY_KEY secret is not set; the production environment file is unchanged.'
  exit 0
fi

python3 - "$ENV_FILE" <<'PY'
from pathlib import Path
import os
import re
import sys

value = os.environ['DATA_GO_KR_MY_KEY'].strip()
if not value or '\n' in value or '\r' in value:
    raise SystemExit('DATA_GO_KR_MY_KEY secret has an unexpected shape; the environment file is unchanged.')

path = Path(sys.argv[1])
source = path.read_text(encoding='utf-8')
line = f'DATA_GO_KR_MY_KEY={value}'
updated, count = re.subn(r'^\s*DATA_GO_KR_MY_KEY\s*=.*$', lambda _m: line, source, flags=re.MULTILINE)
if count == 0:
    updated = source.rstrip('\n') + '\n' + line + '\n'
if updated != source:
    path.write_text(updated, encoding='utf-8')
    print('DATA_GO_KR_MY_KEY was written to the protected environment file (value not printed).')
else:
    print('DATA_GO_KR_MY_KEY in the protected environment file is already current.')
PY
