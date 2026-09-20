#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:?production environment file is required}"
MODEL="${2:?Gemini model is required}"

test -r "$ENV_FILE"
case "$MODEL" in
  gemini-[0-9]*-flash*) ;;
  *) echo 'Refusing an unexpected Gemini model name.' >&2; exit 2 ;;
esac

api_key="$({ python3 - "$ENV_FILE" <<'PY'
from pathlib import Path
import re
import sys

for raw in Path(sys.argv[1]).read_text(encoding='utf-8').splitlines():
    match = re.match(r'^\s*GEMINI_API_KEY\s*=\s*(.*?)\s*$', raw)
    if not match:
        continue
    value = match.group(1)
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    if value:
        print(value, end='')
        break
else:
    raise SystemExit('GEMINI_API_KEY is missing from the protected environment file.')
PY
})"

auth_file="$(mktemp)"
body_file="$(mktemp)"
cleanup() { rm -f "$auth_file" "$body_file"; }
trap cleanup EXIT
umask 077
printf 'header = "x-goog-api-key: %s"\n' "$api_key" > "$auth_file"
unset api_key

status="$(curl --config "$auth_file" --silent --show-error --output "$body_file" --write-out '%{http_code}' \
  --connect-timeout 10 --max-time 20 "https://generativelanguage.googleapis.com/v1beta/models/$MODEL")"

if [ "$status" != 200 ]; then
  python3 - "$body_file" "$status" <<'PY'
import json
import sys

try:
    error = json.load(open(sys.argv[1], encoding='utf-8')).get('error', {})
except (OSError, ValueError):
    error = {}
print(f"Gemini model lookup failed: HTTP {sys.argv[2]}; "
      f"code={error.get('code', '<unavailable>')} "
      f"status={error.get('status', '<unavailable>')} "
      f"message={error.get('message', '<unavailable>')}", file=sys.stderr)
PY
  exit 1
fi

python3 - "$body_file" "$MODEL" <<'PY'
import json
import sys

try:
    model = json.load(open(sys.argv[1], encoding='utf-8'))
except (OSError, ValueError) as error:
    raise SystemExit(f'Gemini model lookup returned an unreadable response: {error}')

if model.get('name') != f'models/{sys.argv[2]}' or 'generateContent' not in model.get('supportedGenerationMethods', []):
    raise SystemExit('Gemini model lookup succeeded, but this model cannot serve the generateContent runtime path.')
PY

python3 - "$ENV_FILE" "$MODEL" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
model = sys.argv[2]
source = path.read_text(encoding='utf-8')
updated, count = re.subn(r'^\s*GEMINI_MODEL\s*=.*$', f'GEMINI_MODEL={model}', source, flags=re.MULTILINE)
if count == 0:
    updated = source.rstrip('\n') + f'\nGEMINI_MODEL={model}\n'
path.write_text(updated, encoding='utf-8')
PY

echo "Gemini model is available and the protected environment now uses: $MODEL"
