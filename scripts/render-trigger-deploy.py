#!/usr/bin/env python3
"""Render 서비스에 배포를 건다. 최신 main으로 수동 배포한다.

autoDeploy가 어떤 이유로든 멈췄을 때 쓴다 — 2026-09-07, weddingpick-app-web이
03:09 이후 여러 번의 merge에도 재배포되지 않은 것을 확인한 뒤 만들었다.
"""
import json
import os
import sys
import urllib.request

API_KEY = os.environ["RENDER_API_KEY"]
SERVICE = os.environ["SERVICE"]


def call(path: str, method: str = "GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"https://api.render.com/v1{path}",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        method=method,
        data=data,
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.load(resp)


services = call(f"/services?name={SERVICE}&limit=5")
matches = [s.get("service", s) for s in services if s.get("service", s).get("name") == SERVICE]

if not matches:
    print(f"::error::{SERVICE} 서비스를 Render 계정에서 찾지 못했다.", file=sys.stderr)
    sys.exit(1)

svc = matches[0]
detail = call(f"/services/{svc['id']}")
detail = detail.get("service", detail)
branch = (detail.get("branch")
          or (detail.get("serviceDetails") or {}).get("branch")
          or (detail.get("staticSiteDetails") or {}).get("branch"))
print(f"서비스: {SERVICE} ({svc['id']}) — 배포 브랜치: {branch}")

if branch and branch != "main":
    print(f"::warning::배포 브랜치가 main이 아니라 '{branch}'다. 이 상태로 배포해도 최신 코드가 아닐 수 있다.")

# clearCache 없이, 설정된 브랜치의 최신 커밋으로 배포한다.
result = call(f"/services/{svc['id']}/deploys", method="POST", body={})
deploy = result.get("deploy", result)
commit = (deploy.get("commit") or {}).get("id", "?")[:8]
print(f"배포 요청됨: id={deploy.get('id')} status={deploy.get('status')} commit={commit}")
