#!/usr/bin/env python3
"""Render 서비스의 실제 배포 상태를 읽기만 한다. 아무것도 바꾸지 않는다.

GitHub Actions CI가 통과한 것과 Render 정적 사이트가 실제로 새로 빌드된 것은
다른 파이프라인이다. Render는 정적 사이트를 자기 파이프라인으로 별도
빌드·배포하고, 우리 CI는 그걸 검증하지 않는다.
"""
import json
import os
import sys
import urllib.request

API_KEY = os.environ["RENDER_API_KEY"]
SERVICE = os.environ["SERVICE"]


def call(path: str):
    req = urllib.request.Request(
        f"https://api.render.com/v1{path}",
        headers={"Authorization": f"Bearer {API_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.load(resp)


services = call(f"/services?name={SERVICE}&limit=5")
matches = [s.get("service", s) for s in services if s.get("service", s).get("name") == SERVICE]

if not matches:
    print(f"::error::{SERVICE} 서비스를 Render 계정에서 찾지 못했다.", file=sys.stderr)
    sys.exit(1)

svc = matches[0]
print(f"서비스: {SERVICE} ({svc['id']})")

deploys = call(f"/services/{svc['id']}/deploys?limit=5")
for entry in deploys:
    d = entry.get("deploy", entry)
    commit = (d.get("commit") or {}).get("id", "?")[:8]
    print(f"  {d.get('status', '?'):16} commit={commit} 시작={d.get('createdAt', '?')} 마침={d.get('finishedAt', '-')}")

# 실패한 배포가 있으면 이유를 찾는다 — 배포 객체 자체와 빌드 로그.
#
# **「가장 최근」이 아니라 「가장 최근에 실패한 것」을 본다.** 실패 직후 새 배포가
# 시작되면 목록 첫 줄이 `build_in_progress`가 되고, 그때 첫 줄만 보면 방금 무엇이
# 왜 깨졌는지 못 읽는다 — 실제로 그렇게 놓쳤다(2026-09-09).
failed = next(
    (
        entry.get("deploy", entry)
        for entry in deploys
        if str((entry.get("deploy", entry)).get("status", "")).endswith("failed")
    ),
    None,
)
if failed:
    latest = failed
    print("\n최근 배포 상세:")
    print(json.dumps(latest, ensure_ascii=False, indent=2)[:3000])
    owner = svc.get("ownerId")
    try:
        logs = call(
            f"/logs?ownerId={owner}&resource={svc['id']}&type=build&limit=100&direction=backward"
        )
        print("\n빌드 로그(최근 100줄):")
        for line in (logs.get("logs") if isinstance(logs, dict) else logs) or []:
            print(f"  {line.get('timestamp', '')} {line.get('message', '')}"[:400])
    except Exception as error:  # noqa: BLE001 — 로그를 못 읽어도 상태는 이미 찍었다
        print(f"\n빌드 로그 조회 실패: {error}")
    try:
        events = call(f"/services/{svc['id']}/events?limit=10")
        print("\n서비스 이벤트(최근 10):")
        for entry in events:
            e = entry.get("event", entry)
            print(f"  {e.get('timestamp', '')} {e.get('type', '')} {json.dumps(e.get('details', {}), ensure_ascii=False)[:300]}")
    except Exception as error:  # noqa: BLE001
        print(f"\n이벤트 조회 실패: {error}")
