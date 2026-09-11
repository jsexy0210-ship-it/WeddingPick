#!/usr/bin/env python3
"""배포된 API의 응답시간을 실제로 잰다. 아무것도 바꾸지 않는다.

**왜 이 스크립트가 필요한가.** 서버에 응답시간 계측이 없다(`apps/api/src/server.ts`에
`onResponse` 훅이 없다). 그래서 «홈이 느리다»가 네트워크 탓인지, Node 탓인지,
DB 탓인지 가를 근거가 지금까지 없었다. 이 스크립트는 서버를 고치지 않고
**밖에서** 그 셋을 가른다.

가르는 방법은 이 API가 이미 가진 두 경로의 차이다.

    GET /         DB를 한 번도 안 본다 (server.ts «name/health/version»만 돌려준다)
    GET /health   `SELECT 1` + 스키마 조회 = DB 왕복 2회 (server.ts)

둘 다 Node가 처리하고 둘 다 같은 네트워크를 탄다. 그래서

    (health의 TTFB − /의 TTFB) / 2  ≈  API에서 DB까지 한 번 왕복하는 시간

이 값이 한 자리 ms면 API와 DB가 사실상 같은 곳에 있고, 수십~수백 ms면 멀리 있다.
접속 문자열을 들여다보지 않고도 «같은 리전인가»에 답할 수 있다.

연결을 새로 맺을 때와 이어 쓸 때를 따로 잰다. 새로 맺는 쪽은 DNS·TCP·TLS가 들어간
«앱이 처음 열 때» 값이고, 이어 쓰는 쪽은 그게 빠진 «서버가 실제로 일한 시간»에 가깝다.
둘을 안 가르면 TLS 핸드셰이크를 서버가 느린 것으로 읽는다.

평균 하나만 보지 않는다 — p50·p95·최대를 같이 낸다. 느린 꼬리가 체감을 만든다.
"""

from __future__ import annotations

import json
import os
import statistics
import subprocess
import sys
import urllib.parse

API = os.environ.get("API", "").rstrip("/")
SAMPLES = int(os.environ.get("SAMPLES", "12"))

# 시험용 계정 토큰. 있으면 로그인 경로도 잰다.
#
# **없이 재면 홈을 잰 것이 아니다.** 토큰이 없으면 `routes/app.ts`의 bootstrap이
# `member`를 null로 두고 첫 묶음 하나로 끝낸다 — 담아둔 후보도, 웨딩픽 추천도,
# 반복되는 세션 조회도 아예 타지 않는다. 무거운 쪽은 로그인한 사람이 받는 경로다.
#
# 값은 어디에도 찍지 않는다. curl 인자로만 넘기고 출력에 담지 않는다.
TOKEN = os.environ.get("API_TOKEN", "").strip()

if not API:
    print("::error::API 환경변수가 비어 있다.", file=sys.stderr)
    sys.exit(1)

# curl이 찍어 줄 값. 단위는 초다.
FIELDS = [
    "http_code",
    "time_namelookup",
    "time_connect",
    "time_appconnect",
    "time_starttransfer",
    "time_total",
    "size_download",
]
WRITE_OUT = "".join(f"%{{{name}}}\t" for name in FIELDS) + "\n"


def run_curl(urls: list[str], reuse: bool, token: str = "") -> list[dict[str, float]]:
    """curl을 한 번 돌려 URL마다 한 줄씩 받는다.

    `reuse=True`면 URL을 한 프로세스에 몰아 줘 연결을 이어 쓴다. `False`면
    URL 하나마다 프로세스를 새로 띄워 매번 DNS·TCP·TLS를 다시 치른다.
    """
    rows: list[dict[str, float]] = []
    batches = [urls] if reuse else [[u] for u in urls]

    for batch in batches:
        command = ["curl", "-sS", "--max-time", "120", "-w", WRITE_OUT]
        if token:
            # 인자로만 넘긴다 — 출력에도 로그에도 담기지 않는다.
            command += ["-H", f"Authorization: Bearer {token}"]
        for url in batch:
            # `-o`는 URL마다 하나씩 있어야 한다. 하나만 주면 첫 응답만 버려지고
            # 나머지 본문이 stdout으로 나와 측정값과 섞인다.
            command += ["-o", "/dev/null", url]

        try:
            out = subprocess.run(command, capture_output=True, text=True, timeout=180).stdout
        except subprocess.TimeoutExpired:
            continue

        for line in out.strip().splitlines():
            parts = line.split("\t")
            if len(parts) < len(FIELDS):
                continue
            rows.append({name: float(parts[i]) for i, name in enumerate(FIELDS)})

    return rows


def ms(seconds: float) -> float:
    return round(seconds * 1000, 1)


def percentile(values: list[float], fraction: float) -> float:
    """작은 표본에서도 흔들리지 않게 «그 자리의 실제 값»을 고른다(보간 없음)."""
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(fraction * (len(ordered) - 1))))
    return ordered[index]


def summarize(label: str, rows: list[dict[str, float]]) -> dict[str, object] | None:
    ok = [r for r in rows if r["http_code"] == 200]
    if not ok:
        codes = sorted({int(r["http_code"]) for r in rows}) or ["요청 실패"]
        print(f"  {label:34} 200을 받지 못했다 (코드 {codes})")
        return None

    ttfb = [r["time_starttransfer"] for r in ok]
    total = [r["time_total"] for r in ok]
    # 연결이 이어 쓰인 요청은 appconnect가 0으로 찍힌다 — 그걸 핸드셰이크 0ms로 읽지 않는다.
    tls = [r["time_appconnect"] for r in ok if r["time_appconnect"] > 0]

    summary = {
        "label": label,
        "n": len(ok),
        "ttfb_p50": ms(percentile(ttfb, 0.5)),
        "ttfb_p95": ms(percentile(ttfb, 0.95)),
        "ttfb_max": ms(max(ttfb)),
        "total_p50": ms(percentile(total, 0.5)),
        "total_p95": ms(percentile(total, 0.95)),
        "tls_p50": ms(percentile(tls, 0.5)) if tls else None,
        "bytes_p50": int(percentile([r["size_download"] for r in ok], 0.5)),
    }

    tls_text = f"{summary['tls_p50']:>7}" if summary["tls_p50"] is not None else "      -"
    print(
        f"  {label:34} n={summary['n']:<3} "
        f"TTFB p50={summary['ttfb_p50']:>7} p95={summary['ttfb_p95']:>7} max={summary['ttfb_max']:>7}  "
        f"total p50={summary['total_p50']:>7}  TLS={tls_text}  {summary['bytes_p50']}B"
    )
    return summary


def wake() -> None:
    """자고 있으면 첫 요청이 30~60초 걸린다. 그 값을 «응답시간»으로 섞지 않는다."""
    print("깨우는 중 (이 시간은 측정에 넣지 않는다)")
    for attempt in range(1, 6):
        rows = run_curl([f"{API}/health"], reuse=False)
        code = int(rows[0]["http_code"]) if rows else 0
        took = ms(rows[0]["time_total"]) if rows else 0
        print(f"  시도 {attempt}: HTTP {code} ({took}ms)")
        if code == 200:
            return
    print("::warning::API가 깨어나지 않았다. 아래 값은 믿을 수 없다.")


def first_vendor_id() -> str | None:
    """업체 상세를 재려면 실제 id가 필요하다. 목록에서 하나 집는다."""
    try:
        out = subprocess.run(
            ["curl", "-sS", "--max-time", "120", f"{API}/v1/vendors?limit=1"],
            capture_output=True,
            text=True,
            timeout=180,
        ).stdout
        vendors = json.loads(out).get("vendors") or []
        return str(vendors[0]["id"]) if vendors else None
    except Exception:
        return None


def main() -> int:
    print(f"대상: {API}")
    print(f"표본: 엔드포인트당 {SAMPLES}회\n")
    wake()

    vendor_id = first_vendor_id()
    quoted = urllib.parse.quote("스튜디오")

    # `/`와 `/health`가 맨 앞이다 — 둘의 차이가 DB 왕복 시간이라 나머지를 읽는 기준이 된다.
    targets: list[tuple[str, str]] = [
        ("/ (DB 안 봄)", "/"),
        ("/health (DB 왕복 2회)", "/health"),
        ("홈 · 많이 확인된 곳", "/v1/vendors?sort=data&limit=4"),
        ("홈 전체 (비회원 bootstrap)", "/v1/app/bootstrap"),
        ("검색 (질의 있음)", f"/v1/vendors?q={quoted}&limit=20"),
    ]
    if vendor_id:
        targets.append(("업체 상세", f"/v1/vendors/{vendor_id}"))
    else:
        print("\n::warning::업체 id를 못 구해 상세는 재지 않았다.")

    report: dict[str, object] = {"api": API, "samples": SAMPLES, "modes": {}}

    for reuse in (False, True):
        mode = "연결 이어 쓰기 (서버가 일한 시간에 가까움)" if reuse else "매번 새 연결 (앱이 처음 열 때)"
        print(f"\n── {mode} ─────────────────────────────")
        collected = []
        for label, path in targets:
            rows = run_curl([f"{API}{path}"] * SAMPLES, reuse=reuse)
            summary = summarize(label, rows)
            if summary:
                collected.append(summary)
        report["modes"]["reuse" if reuse else "fresh"] = collected

    # 로그인 경로. bootstrap의 무거운 쪽은 여기서만 열린다.
    print("\n── 로그인 사용자 ─────────────────────────────")
    if TOKEN:
        authed = [
            ("홈 전체 (로그인 bootstrap)", "/v1/app/bootstrap"),
            ("회원 정보 /v1/me", "/v1/me"),
        ]
        collected = []
        for label, path in authed:
            rows = run_curl([f"{API}{path}"] * SAMPLES, reuse=True, token=TOKEN)
            summary = summarize(label, rows)
            if summary:
                collected.append(summary)
        report["modes"]["authed"] = collected

        boot = next((s for s in collected if s["label"].startswith("홈 전체")), None)
        anon = next(
            (s for s in report["modes"].get("reuse", []) if s["label"].startswith("홈 전체")), None
        )
        if boot and anon:
            print(
                f"  비회원 {anon['ttfb_p50']}ms → 로그인 {boot['ttfb_p50']}ms "
                f"(차이 {round(float(boot['ttfb_p50']) - float(anon['ttfb_p50']), 1)}ms)"
            )
            print("  비회원 경로는 첫 묶음에서 끝난다. 차이가 담아둔 후보·추천·반복 세션 조회의 값이다.")
    else:
        report["modes"]["authed"] = None
        print("  ::warning::API_TOKEN이 없어 로그인 경로를 재지 못했다.")
        print("  토큰 없이 부른 bootstrap은 member가 null이라 첫 묶음에서 끝난다 —")
        print("  위 «비회원 bootstrap» 값을 홈의 값으로 읽으면 안 된다.")

    # 본론 — API에서 DB까지 얼마나 먼가.
    warm = {s["label"]: s for s in report["modes"].get("reuse", [])}
    root = warm.get("/ (DB 안 봄)")
    health = warm.get("/health (DB 왕복 2회)")

    print("\n── API ↔ DB 거리 ─────────────────────────────")
    if root and health:
        gap = float(health["ttfb_p50"]) - float(root["ttfb_p50"])
        per_trip = round(gap / 2, 1)
        report["db_round_trip_ms"] = per_trip
        print(f"  /health p50 {health['ttfb_p50']}ms − / p50 {root['ttfb_p50']}ms = {round(gap, 1)}ms (DB 왕복 2회)")
        print(f"  DB 왕복 1회 ≈ {per_trip}ms")
        # 이사(승인 B) 뒤에는 이 값만 본다. 러너가 미국에 있어 절대 시간은 API가
        # 싱가포르로 가면 오히려 오른다 — 러너가 멀어져서다. 국내 사용자는 반대다.
        # `/`와 `/health`는 같은 서버가 같은 네트워크로 처리하므로 이 차이에는
        # 러너 위치가 들어가지 않는다. 자세한 것은 docs/perf/region-move-plan.md.
        if per_trip >= 20:
            print(f"  ::warning::DB 왕복 1회가 {per_trip}ms다. API와 DB가 가까이 있지 않다.")
            print("  쿼리 하나를 줄일 때마다 이만큼이 줄어든다는 뜻이다.")
        else:
            print("  같은 지역으로 볼 수 있는 값이다. 병목은 왕복 거리가 아니라 다른 곳에 있다.")
    else:
        report["db_round_trip_ms"] = None
        print("  잴 수 없었다 (둘 중 하나가 200을 주지 않았다).")

    with open(os.environ.get("OUT", "perf-probe.json"), "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)

    return 0


if __name__ == "__main__":
    sys.exit(main())
