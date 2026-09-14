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
# 빌드 캐시를 지우고 배포할지. 캐시 tar가 CRC 오류로 반쯤 풀려 node_modules가
# 망가지면 `npm install`이 「up to date」라고 답해 스스로 못 고친다(2026-09-09,
# app-web 4연속 실패). scripts/ensure-modules.mjs가 빌드 안에서 그 상태를 잡아
# 다시 깔지만, 캐시 자체를 버리고 싶을 때 이 값을 쓴다.
CLEAR_CACHE = os.environ.get("CLEAR_CACHE", "").lower() in {"1", "true", "yes"}


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
    print(f"branch가 'main'이 아니라 '{branch}'다 — main으로 바로잡는다.")
    print("오래된 브랜치가 계속 남아 있었던 것이 자동 배포가 멈춰 있던 진짜 원인이다.")

    fixed = call(f"/services/{svc['id']}", method="PATCH", body={"branch": "main"})
    fixed = fixed.get("service", fixed)
    new_branch = fixed.get("branch") or (fixed.get("serviceDetails") or {}).get("branch")
    print(f"branch를 '{new_branch}'로 바꿨다.")

# 바로잡힌(또는 이미 맞던) 브랜치의 최신 커밋으로 배포한다.
body = {"clearCache": "clear"} if CLEAR_CACHE else {}
print(f"빌드 캐시: {'지우고 배포' if CLEAR_CACHE else '그대로 사용'}")
result = call(f"/services/{svc['id']}/deploys", method="POST", body=body)
deploy = result.get("deploy", result)
commit = (deploy.get("commit") or {}).get("id", "?")[:8]
print(f"배포 요청됨: id={deploy.get('id')} status={deploy.get('status')} commit={commit}")
