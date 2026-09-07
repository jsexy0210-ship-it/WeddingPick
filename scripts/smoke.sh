#!/usr/bin/env bash
# 배포된 시스템을 실제로 때려본다.
#
# 왜 필요한가. 2026-09-07에 CI가 타입·린트·테스트 1,678개·번들·랜딩을 전부 통과한
# 상태로 운영 인증 API가 전부 500이었다. merge 전 검사는 **코드**를 보고, 이 검사는
# **배포된 것**을 본다. 오늘 무너진 것은 후자다. 앞의 것을 아무리 늘려도 안 잡힌다.
#
# 사용: scripts/smoke.sh https://weddingpickl.onrender.com
set -uo pipefail

BASE="${1:-}"
if [ -z "$BASE" ]; then
  echo "사용법: $0 <API 주소>" >&2
  exit 2
fi

FAILED=0

fail() { echo "  ✗ $1"; FAILED=1; }
pass() { echo "  ✓ $1"; }

echo "대상: $BASE"

# 1) 살아 있는가 + 스키마가 코드와 같은 자리인가.
#    /health가 SELECT 1만 보던 동안 테이블이 없어도 초록이었다.
BODY=$(curl -sS --max-time 30 "$BASE/health" 2>/dev/null) || BODY=''
echo "health: ${BODY:-(응답 없음)}"

case "$BODY" in
  *'"database":"ok"'*|*'"database": "ok"'*) pass "DB 연결" ;;
  *) fail "DB 연결 — /health가 정상 응답을 주지 않는다" ;;
esac

case "$BODY" in
  *'"ok":true'*'"pending":[]'*|*'"pending":[]'*) pass "스키마가 코드와 같다" ;;
  *'"pending"'*) fail "운영 DB 스키마가 코드보다 뒤에 있다 — 위 pending 목록 확인" ;;
  *) echo "  - 스키마 상태를 보고하지 않는 버전이다(건너뜀)" ;;
esac

# 2) 공개 API. 여기가 깨지면 로그인 화면이 제공자 목록을 못 받는다.
CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$BASE/v1/auth/providers" 2>/dev/null) || CODE=000
[ "$CODE" = "200" ] && pass "GET /v1/auth/providers 200" || fail "GET /v1/auth/providers → $CODE"

# 3) 인증 경로가 5xx를 내지 않는가.
#    성공을 요구하지 않는다 — 없는 계정이면 정상적으로 "없음"이 나와야 한다.
#    500이면 서버 내부가 깨진 것이고, 그것만 잡는다.
CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 \
  -X POST -H 'content-type: application/json' \
  -d '{"email":"smoke-check@weddingpick.invalid"}' \
  "$BASE/v1/auth/email/lookup" 2>/dev/null) || CODE=000
case "$CODE" in
  5*|000) fail "POST /v1/auth/email/lookup → $CODE (서버 내부 오류)" ;;
  *) pass "POST /v1/auth/email/lookup → $CODE (5xx 아님)" ;;
esac

# 4) 보호 경로는 토큰 없이 401이어야 한다. 200이면 인증이 새는 것이고,
#    5xx면 인증 계층 자체가 깨진 것이다.
CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$BASE/v1/me" 2>/dev/null) || CODE=000
[ "$CODE" = "401" ] && pass "GET /v1/me 401 (토큰 없음)" || fail "GET /v1/me → $CODE (401이어야 한다)"

echo
if [ "$FAILED" -eq 0 ]; then
  echo "스모크 통과."
else
  echo "스모크 실패 — 배포된 시스템이 정상이 아니다."
fi
exit "$FAILED"
