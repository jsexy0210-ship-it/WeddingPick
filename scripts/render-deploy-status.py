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
