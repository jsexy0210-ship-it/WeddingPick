#!/usr/bin/env python3
"""공유 링크 미리보기가 실제로 나가는지 확인한다.

공개 정적 사이트와 카카오 API를 읽기만 한다. 저장·배포 요청은 하지 않는다.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request

WEB = os.environ.get("WEDDINGPICK_WEB_ORIGIN", "https://210.109.82.212:9443").rstrip("/")
API = os.environ.get("WEDDINGPICK_API_ORIGIN", "https://210.109.82.212").rstrip("/")

# 카드가 뜨려면 넷이 다 있어야 한다. 하나라도 없으면 크롤러는 카드를 접는다.
REQUIRED = ("og:title", "og:description", "og:image", "og:url")

TAG = re.compile(r'<meta (?:property|name)="([^"]+)" content="([^"]*)"')
VENDOR_LINK = re.compile(r'href="/v/([^"]+)\.html"')

failures: list[str] = []


def get(url: str, *, binary: bool = False):
    request = urllib.request.Request(url, headers={"user-agent": "weddingpick-og-probe"})
    with urllib.request.urlopen(request, timeout=20) as response:
        body = response.read()
        return response.status, body if binary else body.decode("utf-8", "replace")


def tags(html: str) -> dict[str, str]:
    return dict(TAG.findall(html))


def check_page(label: str, path: str) -> str | None:
    url = f"{WEB}{path}"
    try:
        status, html = get(url)
    except urllib.error.HTTPError as error:
        failures.append(f"{label} {url} — HTTP {error.code}")
        print(f"  ✗ {label}: HTTP {error.code}")
        return None
    except Exception as error:  # noqa: BLE001 — 어떤 실패든 사실로 적는다
        failures.append(f"{label} {url} — {error}")
        print(f"  ✗ {label}: {error}")
        return None

    found = tags(html)
    missing = [name for name in REQUIRED if not found.get(name)]

    print(f"  {'✗' if missing else '✓'} {label} (HTTP {status})")
    for name in REQUIRED:
        print(f"      {name} = {found.get(name) or '없음'}")

    if missing:
        failures.append(f"{label} {url} — 빠진 태그 {', '.join(missing)}")

    return html


print("웹 페이지")
landing = check_page("랜딩", "/")
search = check_page("검색", "/search.html")
check_page("소개", "/intro.html")

print("\n업체 상세")
ids = VENDOR_LINK.findall(search or "")
if not ids:
    failures.append("검색 화면에 업체 상세 링크가 없다 — 공유할 페이지가 만들어지지 않았다")
    print("  ✗ 검색 화면이 건 상세 링크가 없다")
else:
    print(f"  검색 화면이 건 상세 {len(ids)}곳 — 첫 곳만 확인한다")
    check_page(f"상세 {ids[0]}", f"/v/{ids[0]}.html")

print("\n관리자가 고친 문구가 빌드에 닿는 경로")
try:
    status, body = get(f"{API}/v1/site-meta")
    meta = json.loads(body)
    print(f"  ✓ GET /v1/site-meta (HTTP {status})")
    for key in ("ogTitle", "ogDescription", "ogImageUrl", "ogImageAlt"):
        print(f"      {key} = {meta.get(key) or '없음'}")

    # 지금 나가 있는 제목과 API가 주는 제목이 다르면 저장은 됐고 반영이 안 된 것이다.
    live = tags(landing or "").get("og:title")
    if live and meta.get("ogTitle") and live != meta["ogTitle"]:
        print(f"  ! 저장된 제목과 나가 있는 제목이 다르다 — 저장 {meta['ogTitle']} / 나감 {live}")
        print("    정적 사이트 별도 배포가 필요하다. 이 도구와 관리자 화면은 배포를 요청하지 않는다.")
except Exception as error:  # noqa: BLE001
    failures.append(f"GET /v1/site-meta — {error}")
    print(f"  ✗ GET /v1/site-meta: {error}")

print("\n올린 카드 그림")
try:
    status, body = get(f"{API}/v1/site-meta/og-image", binary=True)
    print(f"  ✓ 올려 둔 그림이 나간다 (HTTP {status} · {len(body)}바이트)")
except urllib.error.HTTPError as error:
    if error.code == 404:
        # 올려 둔 것이 없으면 404가 맞다. 빈 그림을 내보내는 것보다 낫다.
        print("  · 올려 둔 그림이 없다 (HTTP 404) — 기본 그림이 나간다")
    else:
        failures.append(f"GET /v1/site-meta/og-image — HTTP {error.code}")
        print(f"  ✗ HTTP {error.code}")
except Exception as error:  # noqa: BLE001
    failures.append(f"GET /v1/site-meta/og-image — {error}")
    print(f"  ✗ {error}")

print()
if failures:
    print(f"실패 {len(failures)}건")
    for line in failures:
        print(f"  - {line}")
    sys.exit(1)

print("확인 완료 — 공유 링크에 카드 태그가 모두 나가고 있다")
