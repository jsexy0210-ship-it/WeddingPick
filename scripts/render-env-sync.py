#!/usr/bin/env python3
"""infra/render-env.yml을 Render 서비스에 반영한다.

승인된 `.github/workflows/main.yml` 배포 작업이 부른다. 사람이 대시보드를 여는 일을
없애려고 만들었다 — 값의 원본은 저장소이고, 비밀만 GitHub Secrets에서 온다.

**키 하나씩 upsert만 한다.** 선언에 없는 키는 손대지 않는다. 통째로 바꾸는 API를
쓰면 선언에 없는 비밀(DATABASE_URL 등)이 지워진다.

**값은 절대 찍지 않는다.** 로그에는 키 이름과 HTTP 상태만 남는다.
"""

import json
import os
import re
import subprocess
import sys
import time
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
        print(f'  !! 서비스 조회 실패 (HTTP {status})')
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
                value = value.strip()
                if len(value) >= 2 and value.startswith("'") and value.endswith("'"):
                    value = value[1:-1].replace("''", "'")
                elif len(value) >= 2 and value.startswith('"') and value.endswith('"'):
                    value = json.loads(value)
                services[current]['vars'][key.strip()] = value

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
                    print(f'   {name}.{key}: 파서별 값 불일치')
        return 1

    print('두 파서의 결과가 같다.')
    return 0


def deploys(identifier: str) -> list[dict] | None:
    status, body = call('GET', f'/services/{identifier}/deploys?limit=20')
    if status != 200:
        print(f'  !! 배포 조회 실패 (HTTP {status})')
        return None
    try:
        items = json.loads(body)
        if not isinstance(items, list):
            return None
        return [item.get('deploy', item) for item in items if isinstance(item, dict)]
    except (ValueError, TypeError):
        print('  !! 배포 조회 응답을 읽지 못했다')
        return None


def wait_for_live(identifier: str, requested_id: str, commit: str) -> bool:
    """요청한 배포만 기다린다. 다른 배포의 live는 성공 근거가 아니다."""
    deadline = time.monotonic() + 1200
    failed = {'build_failed', 'update_failed', 'pre_deploy_failed', 'canceled', 'deactivated'}
    while time.monotonic() < deadline:
        items = deploys(identifier)
        if items is None:
            return False
        current = next((item for item in items if item.get('id') == requested_id), None)
        if current:
            state = current.get('status')
            actual_commit = (current.get('commit') or {}).get('id')
            if actual_commit and actual_commit != commit:
                print('  !! 요청한 커밋과 실제 배포 커밋이 다르다')
                return False
            if state in failed:
                print(f'  !! 배포 실패: {state}')
                return False
            if state == 'live':
                if actual_commit != commit:
                    print('  !! live 배포의 커밋을 확인할 수 없다')
                    return False
                print('  요청한 커밋의 live를 확인했다')
                return True
        time.sleep(10)
    print('  !! 배포가 20분 안에 live가 되지 않았다')
    return False


def check_api_health(base_url: str) -> bool:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    try:
        result = subprocess.run([
            'node', os.path.join(root, 'scripts', 'check-api-health.mjs'),
            '--api', base_url, '--migrations-dir', os.path.join(root, 'packages', 'db', 'migrations'),
        ], cwd=root, timeout=360, check=False)
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        print('  !! API health 검사를 완료하지 못했다')
        return False


def main() -> int:
    if '--check' in sys.argv:
        return check()

    if not os.environ.get('RENDER_API_KEY'):
        print('RENDER_API_KEY가 없다 — 반영하지 않는다.')
        return 1

    dry_run = flag('DRY_RUN')
    redeploy = flag('REDEPLOY', default=True)
    wait = flag('WAIT_FOR_LIVE')
    commit = os.environ.get('DEPLOY_COMMIT', '').strip()
    api_name = os.environ.get('API_SERVICE', 'weddingpickl-sg')
    api_base = os.environ.get('API_BASE_URL', 'https://weddingpickl-sg.onrender.com')
    selected = os.environ.get('SERVICE', '').strip()
    if commit and not re.fullmatch(r'[0-9a-fA-F]{40}', commit):
        print('DEPLOY_COMMIT은 전체 Git SHA여야 한다.')
        return 1
    if wait and not dry_run and (not commit or not redeploy):
        print('live 검증에는 DEPLOY_COMMIT과 REDEPLOY=true가 필요하다.')
        return 1
    try:
        available_secrets = json.loads(os.environ.get('ALL_SECRETS') or '{}')
    except json.JSONDecodeError:
        available_secrets = {}

    services = load_manifest()
    if api_name not in services:
        print('선언에 지정한 API 서비스가 없다 — 아무것도 바꾸지 않는다.')
        return 1
    if selected and selected not in services:
        print('SERVICE가 선언의 서비스 이름과 일치하지 않는다.')
        return 1
    api_id = service_id(api_name)
    if not api_id:
        return 1
    ordered = [api_name] + [name for name in services if name != api_name]
    if selected:
        ordered = [selected]
    # 정적 서비스만 복구할 때에도 API가 같은 커밋으로 살아 있어야 한다.
    if wait and not dry_run and selected and selected != api_name:
        items = deploys(api_id)
        if items is None or not any(item.get('status') == 'live'
                                   and (item.get('commit') or {}).get('id') == commit for item in items):
            print('API에 요청한 커밋의 live 배포가 없다 — 정적 서비스를 바꾸지 않는다.')
            return 1
        if not check_api_health(api_base):
            return 1

    for name in ordered:
        spec = services[name]
        print(f'\n== {name}')
        identifier = api_id if name == api_name else service_id(name)
        if not identifier:
            return 1

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
                print(f'  !! {key} 실패 (HTTP {status})')
                return 1

        if redeploy and not dry_run and (changed or wait):
            status, body = call('POST', f'/services/{identifier}/deploys', {'commitId': commit} if commit else {})
            print(f'  재배포 요청 → HTTP {status}')
            if not 200 <= status < 300:
                return 1
            if wait:
                try:
                    requested = json.loads(body)
                    requested_id = requested.get('deploy', requested).get('id')
                except (ValueError, AttributeError):
                    requested_id = None
                if not requested_id:
                    print('  !! 요청한 배포 ID를 확인하지 못했다')
                    return 1
                if not wait_for_live(identifier, requested_id, commit):
                    return 1
                if name == api_name and not check_api_health(api_base):
                    return 1

    print('\n선언 확인을 마쳤다.' if dry_run else
          '\n모든 요청 배포의 live를 확인했다.' if wait else
          '\n환경변수 반영과 배포 요청을 마쳤다. live는 미확인이다.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
