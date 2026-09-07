#!/usr/bin/env python3
"""infra/render-env.yml을 Render 서비스에 반영한다.

`.github/workflows/render-env-sync.yml`이 부른다. 사람이 대시보드를 여는 일을
없애려고 만들었다 — 값의 원본은 저장소이고, 비밀만 GitHub Secrets에서 온다.

**키 하나씩 upsert만 한다.** 선언에 없는 키는 손대지 않는다. 통째로 바꾸는 API를
쓰면 선언에 없는 비밀(DATABASE_URL 등)이 지워진다.

**값은 절대 찍지 않는다.** 로그에는 키 이름과 HTTP 상태만 남는다.
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

API = 'https://api.render.com/v1'
MANIFEST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'infra', 'render-env.yml')


def flag(name: str, default: bool = False) -> bool:
    raw = (os.environ.get(name) or '').strip().lower()
    if raw in ('true', '1', 'yes'):
        return True
    if raw in ('false', '0', 'no'):
        return False
    return default


def call(method: str, path: str, body: dict | None = None) -> tuple[int, str]:
    """Render API 한 번. 실패해도 던지지 않고 (상태, 본문)으로 돌려준다."""
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(f'{API}{path}', data=data, method=method)
    request.add_header('Authorization', f"Bearer {os.environ['RENDER_API_KEY']}")
    request.add_header('Accept', 'application/json')
    if data is not None:
        request.add_header('Content-Type', 'application/json')

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()[:400]
    except Exception as error:  # 네트워크·타임아웃
        return 0, str(error)[:400]


def service_id(name: str) -> str | None:
    """이름으로 서비스를 찾는다. Render는 이름 접두 검색이라 정확히 일치하는 것만 고른다."""
    status, body = call('GET', f'/services?name={urllib.parse.quote(name)}&limit=20')
    if status != 200:
        print(f'  !! 서비스 조회 실패 (HTTP {status}) {body}')
        return None

    try:
        items = json.loads(body)
    except json.JSONDecodeError:
        print('  !! 서비스 조회 응답을 읽지 못했다')
        return None

    for item in items:
        service = item.get('service', item)
        if service.get('name') == name:
            return service.get('id')

    print(f'  !! 이름이 정확히 일치하는 서비스가 없다: {name}')
    return None


def parse_simple(text: str) -> dict:
    """PyYAML이 없을 때 쓰는 최소 파서.

    이 선언이 쓰는 모양(2단계 들여쓰기, `vars` 사전과 `secrets` 목록)만 읽는다.
    일반 YAML 파서가 아니다 — 선언의 모양을 바꾸면 여기도 같이 봐야 한다.
    """
    services: dict = {}
    section = None  # 'vars' | 'secrets'
    current = None

    for raw in text.split('\n'):
        line = raw.rstrip()
        if not line.strip() or line.strip().startswith('#'):
            continue
        indent = len(line) - len(line.lstrip())
        body = line.strip()

        if indent == 2 and body.endswith(':'):
            current = body[:-1].strip()
            services[current] = {'vars': {}, 'secrets': []}
            section = None
        elif indent == 4 and body in ('vars:', 'secrets:'):
            section = body[:-1]
        elif indent >= 6 and current:
            if section == 'secrets' and body.startswith('- '):
                services[current]['secrets'].append(body[2:].strip())
            elif section == 'vars' and ':' in body:
                key, _, value = body.partition(':')
                services[current]['vars'][key.strip()] = value.strip()

    return services


def load_manifest() -> dict:
    """선언을 읽는다. PyYAML이 없는 러너도 있어 그때는 `parse_simple`로 떨어진다."""
    with open(MANIFEST, encoding='utf-8') as handle:
        text = handle.read()

    try:
        import yaml  # type: ignore
    except ImportError:
        return parse_simple(text)

    return yaml.safe_load(text).get('services', {})


def check() -> int:
    """`--check` — Render를 부르지 않고 선언만 확인한다.

    두 파서(PyYAML·`parse_simple`)가 같은 결과를 내는지 본다. 러너에 PyYAML이
    있고 없고에 따라 반영되는 값이 달라지면 안 된다. 값은 찍지 않는다.
    """
    with open(MANIFEST, encoding='utf-8') as handle:
        text = handle.read()

    fallback = parse_simple(text)
    try:
        import yaml  # type: ignore

        proper = yaml.safe_load(text).get('services', {})
    except ImportError:
        print('PyYAML이 없어 폴백 파서만 확인한다.')
        proper = fallback

    for name, spec in proper.items():
        keys = list((spec.get('vars') or {}).keys())
        names = list(spec.get('secrets') or [])
        print(f'  {name}: vars={keys} secrets={names}')

    def normalize(parsed: dict) -> dict:
        """`secrets:`를 적지 않은 서비스를 PyYAML은 키 없이, 폴백은 빈 목록으로 준다.
        읽는 쪽(`main`)은 둘을 같게 다루므로 견줄 때도 같게 맞춘다."""
        return {
            name: {'vars': dict(spec.get('vars') or {}), 'secrets': list(spec.get('secrets') or [])}
            for name, spec in parsed.items()
        }

    proper, fallback = normalize(proper), normalize(fallback)

    if proper != fallback:
        print('!! 두 파서의 결과가 다르다 — 선언의 모양이 parse_simple이 아는 범위를 벗어났다.')
        for name in sorted(set(proper) | set(fallback)):
            left = (proper.get(name) or {}).get('vars') or {}
            right = (fallback.get(name) or {}).get('vars') or {}
            for key in sorted(set(left) | set(right)):
                if left.get(key) != right.get(key):
                    print(f'   {name}.{key}: yaml={left.get(key)!r} / 폴백={right.get(key)!r}')
        return 1

    print('두 파서의 결과가 같다.')
    return 0


def main() -> int:
    if '--check' in sys.argv:
        return check()

    if not os.environ.get('RENDER_API_KEY'):
        print('RENDER_API_KEY가 없다 — 반영하지 않는다.')
        return 1

    dry_run = flag('DRY_RUN')
    redeploy = flag('REDEPLOY', default=True)
    try:
        available_secrets = json.loads(os.environ.get('ALL_SECRETS') or '{}')
    except json.JSONDecodeError:
        available_secrets = {}

    services = load_manifest()
    if not services:
        print('선언에 서비스가 없다.')
        return 1

    failures: list[str] = []
    for name, spec in services.items():
        print(f'\n== {name}')
        identifier = service_id(name)
        if not identifier:
            failures.append(f'{name}: 서비스를 찾지 못함')
            continue

        wanted: dict[str, str] = dict(spec.get('vars') or {})
        for key in spec.get('secrets') or []:
            value = available_secrets.get(key)
            if value:
                wanted[key] = value
            else:
                print(f'  -- {key}: GitHub Secrets에 없어 건너뛴다')

        changed = False
        for key, value in wanted.items():
            if dry_run:
                print(f'  (dry-run) {key}')
                continue

            status, body = call('PUT', f'/services/{identifier}/env-vars/{urllib.parse.quote(key)}', {'value': value})
            if 200 <= status < 300:
                print(f'  ok {key}')
                changed = True
            else:
                print(f'  !! {key} 실패 (HTTP {status}) {body}')
                failures.append(f'{name}.{key}: HTTP {status}')

        if changed and redeploy and not dry_run:
            status, body = call('POST', f'/services/{identifier}/deploys', {})
            print(f'  재배포 요청 → HTTP {status}' if 200 <= status < 300 else f'  !! 재배포 실패 (HTTP {status}) {body}')
            if not 200 <= status < 300:
                failures.append(f'{name}: 재배포 HTTP {status}')

    if failures:
        print('\n반영하지 못한 항목:')
        for item in failures:
            print(f'  - {item}')
        return 1

    print('\n모두 반영했다.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
