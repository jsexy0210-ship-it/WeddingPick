#!/usr/bin/env python3
"""Pretendard를 둘로 나눈다 — 흔한 글자 한 벌, 나머지 한 벌.

**왜 나누나.** 한글 폰트가 큰 이유는 음절 11,172자를 다 담기 때문이다. 원본
`PretendardVariable.woff2`는 2.0MB이고, 웹에서는 화면을 열 때마다 그것을 받는다.

**연속 구간으로 자르는 것은 소용이 없다.** 1,000자씩 열둘로 잘라 재 봤더니 우리 문구가
쓰는 음절 841개가 **열두 덩이 전부에** 흩어져 있었다(2026-09-17 측정). 그래서 빈도로
가른다.

    ko-common   KS X 1001 완성형 2,350자 + 라틴 · 숫자 · 문장부호 · 자모     493KB
    ko-rest     나머지 음절 8,822자 + 가나 · 키릴 · 그리스 · IPA           1.3MB

브라우저는 `unicode-range`를 보고 **그 화면에 실제로 나온 글자가 든 쪽만** 받는다.
보통 화면은 `ko-common` 하나로 끝나고, 드문 글자(업체 이름 · 사용자 입력)가 나오면
그때 `ko-rest`를 더 받는다. **빠지는 글자는 없다** — 둘을 합치면 원본을 덮는다.

재서 확인했다(2026-09-17 · Chromium):

    보통 화면   받은 폰트 [ko-common.woff2]                  ← 1.5MB 안 받는다
    드문 글자   받은 폰트 [ko-common.woff2, ko-rest.woff2]   ← 빠짐 없이 그려진다

**KS X 1001 2,350자는 지어낸 목록이 아니다.** 완성형 표의 `0xB0A1~0xC8FE` 바이트쌍을
cp949로 디코드해 얻는다. 우리 문구가 쓰는 음절 841개가 전부 그 안에 들어간다(측정).

돌리는 법: `python3 scripts/subset-fonts.py` (fonttools · brotli 필요).
"""

import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'PretendardVariable.woff2')

# 나온 파일을 놓는 곳 둘. 앱 웹과 웹사이트가 각자 자기 public에서 서빙한다.
DESTS = [
    os.path.join(ROOT, 'apps', 'mobile', 'public', 'fonts'),
    os.path.join(ROOT, 'apps', 'web', 'public', 'assets', 'fonts'),
]

# 한글 말고 같이 담는 것. 라틴 · 문장부호 · 통화 · 화살표 · 도형 · 이모지 일부 ·
# 전각 · 한글 자모(조합형 · 자음 모음 단독 표기).
COMMON_EXTRA = (
    'U+0000-024F,U+2000-206F,U+20A0-20BF,U+2190-21FF,U+25A0-25FF,'
    'U+2600-26FF,U+3000-303F,U+FF00-FFEF,U+1100-11FF,U+3130-318F'
)

# 드문 쪽에 담는 것. 있어도 거의 안 쓰지만 없으면 그 글자만 시스템 서체로 떨어진다.
REST_EXTRA = 'U+0250-036F,U+0370-03FF,U+0400-052F,U+3040-30FF,U+31F0-31FF,U+A960-A97F,U+D7B0-D7FF'


def ks_x_1001() -> list[int]:
    """KS X 1001 완성형 한글 2,350자."""
    out = []
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            try:
                ch = bytes([hi, lo]).decode('cp949')
            except UnicodeDecodeError:
                continue
            if 0xAC00 <= ord(ch) <= 0xD7A3:
                out.append(ord(ch))

    return sorted(set(out))


def compact(codes: list[int]) -> str:
    """낱개로 적으면 16KB, 이어지는 것을 묶으면 14KB다. CSS에 그대로 들어가는 글자다."""
    parts = []
    start = prev = codes[0]
    for code in codes[1:]:
        if code == prev + 1:
            prev = code
            continue
        parts.append(f'U+{start:X}' if start == prev else f'U+{start:X}-{prev:X}')
        start = prev = code
    parts.append(f'U+{start:X}' if start == prev else f'U+{start:X}-{prev:X}')

    return ','.join(parts)


def subset(unicodes: str, name: str) -> int:
    first = os.path.join(DESTS[0], name)
    result = subprocess.run(
        [sys.executable, '-m', 'fontTools.subset', SRC, f'--unicodes={unicodes}',
         '--flavor=woff2', f'--output-file={first}', '--layout-features=*',
         '--no-hinting', '--desubroutinize'],
        capture_output=True, text=True,
    )
    if result.returncode:
        raise SystemExit(f'{name} 실패\n{result.stderr[-800:]}')

    size = os.path.getsize(first)
    for other in DESTS[1:]:
        os.makedirs(other, exist_ok=True)
        with open(first, 'rb') as src, open(os.path.join(other, name), 'wb') as dst:
            dst.write(src.read())

    return size


# 네이티브가 앱에 박는 TTF 넷. **여기서는 한글을 줄이지 않는다** — 앱은 필요할 때
# 더 받는 길이 없어서, 없는 글자는 그냥 안 그려진다. 덜어내는 것은 안 쓰는 문자
# 계열(키릴 · 그리스 · 가나 · IPA)뿐이고 그것만으로 18% 줄었다.
NATIVE_KEEP = (
    'U+AC00-D7A3,U+1100-11FF,U+3130-318F,U+A960-A97F,U+D7B0-D7FF,'
    'U+0000-024F,U+2000-206F,U+20A0-20BF,U+2190-21FF,U+25A0-25FF,'
    'U+2600-26FF,U+3000-303F,U+FF00-FFEF'
)
NATIVE_DIR = os.path.join(ROOT, 'apps', 'mobile', 'assets', 'fonts')


def native() -> None:
    """앱에 박는 TTF 넷을 제자리에서 줄인다. 이미 줄어 있으면 더 줄지 않는다."""
    before = after = 0
    for name in sorted(os.listdir(NATIVE_DIR)):
        if not name.endswith('.ttf'):
            continue

        src = os.path.join(NATIVE_DIR, name)
        tmp = src + '.tmp'
        before += os.path.getsize(src)
        result = subprocess.run(
            [sys.executable, '-m', 'fontTools.subset', src, f'--unicodes={NATIVE_KEEP}',
             f'--output-file={tmp}', '--layout-features=*', '--no-hinting', '--desubroutinize'],
            capture_output=True, text=True,
        )
        if result.returncode:
            os.path.exists(tmp) and os.remove(tmp)
            raise SystemExit(f'{name} 실패\n{result.stderr[-800:]}')

        os.replace(tmp, src)
        after += os.path.getsize(src)

    print(f'  네이티브  {after:>9,} bytes  (TTF 넷 · 전 {before:,})')


def main() -> int:
    if not os.path.exists(SRC):
        raise SystemExit(f'원본이 없다: {SRC}')

    common = ks_x_1001()
    if len(common) != 2350:
        raise SystemExit(f'KS X 1001이 2,350자가 아니다: {len(common)}')

    picked = set(common)
    rest = [c for c in range(0xAC00, 0xD7A4) if c not in picked]

    def codes(values: list[int]) -> str:
        return ','.join(f'U+{c:04X}' for c in values)

    for dest in DESTS:
        os.makedirs(dest, exist_ok=True)

    a = subset(codes(common) + ',' + COMMON_EXTRA, 'PretendardVariable-koCommon.woff2')
    b = subset(codes(rest) + ',' + REST_EXTRA, 'PretendardVariable-koRest.woff2')

    # 화면 쪽이 읽는 자리. 여기 적힌 것을 손으로 옮겨 적지 않는다.
    spec = {
        '$note': ('scripts/subset-fonts.py가 만든다. 손으로 고치지 않는다 — 폰트 파일과 '
                  '짝이라 한쪽만 바뀌면 글자가 빠진다.'),
        'common': {
            'file': 'PretendardVariable-koCommon.woff2',
            'bytes': a,
            'unicodeRange': compact(common) + ',' + COMMON_EXTRA,
            '$note': 'KS X 1001 2,350자 + 라틴 · 부호. 보통 화면은 이것만 받는다.',
        },
        'rest': {
            'file': 'PretendardVariable-koRest.woff2',
            'bytes': b,
            # 한글 전체를 적는다. **먼저 선언하고** common을 뒤에 둬서 겹치는 자리를
            # common이 이기게 한다 — 그래야 낱개 목록을 한 번만 적는다.
            'unicodeRange': 'U+AC00-D7A3,' + REST_EXTRA,
            '$note': '나머지 음절 8,822자 + 가나 · 키릴 · 그리스. 드문 글자가 나올 때만 받는다.',
        },
    }
    with open(os.path.join(ROOT, 'spec', 'font-subsets.json'), 'w', encoding='utf-8') as out:
        json.dump(spec, out, ensure_ascii=False, indent=2)
        out.write('\n')

    native()

    print(f'  ko-common {a:>9,} bytes  (KS X 1001 {len(common):,}자 + 라틴 · 부호)')
    print(f'  ko-rest   {b:>9,} bytes  (나머지 음절 {len(rest):,}자 + 가나 · 키릴 · 그리스)')
    print(f'  원본      {os.path.getsize(SRC):>9,} bytes')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
