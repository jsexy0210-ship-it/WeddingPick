# 로딩 성능 측정

잰 시각: 2026-09-11 16:12 KST
잰 커밋: 30b029bf

```
WeddingPick-운영 API 서버
  type=web_service suspended=not_suspended
  branch=main autoDeploy=yes
  plan=free
  region=ohio
  numInstances=1
weddingpick-api
  type=web_service suspended=not_suspended
  branch=claude/weddingpick-master-bootstrap-6j1c7o autoDeploy=no
  plan=free
  region=oregon
  numInstances=1
DB 제공자: (읽을 수 없음)
DB 리전: (호스트명에 없음)
  리전이 호스트명에 없다. 아래 왕복 시간으로만 거리를 판단한다.
대상: https://weddingpickl.onrender.com  [Ohio (지금 운영)]
표본: 엔드포인트당 12회

깨우는 중 (이 시간은 측정에 넣지 않는다)
  시도 1: HTTP 200 (712.1ms)

── 매번 새 연결 (앱이 처음 열 때) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=  121.0 p95=  203.2 max=  224.3  total p50=  121.1  TLS=   26.5  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  555.0 p95=  630.6 max=  685.7  total p50=  555.1  TLS=   25.7  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  632.0 p95=  661.9 max= 1108.3  total p50=  632.0  TLS=   25.7  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  564.3 p95=  689.9 max=  719.5  total p50=  564.5  TLS=   26.2  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  533.7 p95=  558.1 max=  721.4  total p50=  533.7  TLS=   26.0  14894B
  업체 상세                              n=12  TTFB p50= 1161.4 p95= 1179.0 max= 1188.8  total p50= 1161.5  TLS=   26.7  1356B

── 연결 이어 쓰기 (서버가 일한 시간에 가까움) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=   78.1 p95=   82.0 max=  104.7  total p50=   78.2  TLS=   25.8  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  500.3 p95=  527.9 max=  614.2  total p50=  500.4  TLS=   26.2  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  502.3 p95=  508.6 max=  525.9  total p50=  502.3  TLS=   25.5  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  527.0 p95=  598.0 max=  605.9  total p50=  527.1  TLS=   34.6  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  498.1 p95=  555.4 max=  633.3  total p50=  498.2  TLS=   25.3  14894B
  업체 상세                              n=12  TTFB p50= 1101.7 p95= 1111.1 max= 1131.3  total p50= 1101.7  TLS=   38.0  1356B

── 로그인 사용자 ─────────────────────────────
  ::warning::API_TOKEN이 없어 로그인 경로를 재지 못했다.
  토큰 없이 부른 bootstrap은 member가 null이라 첫 묶음에서 끝난다 —
  위 «비회원 bootstrap» 값을 홈의 값으로 읽으면 안 된다.

── API ↔ DB 거리 ─────────────────────────────
  /health p50 500.3ms − / p50 78.1ms = 422.2ms (DB 왕복 2회)
  DB 왕복 1회 ≈ 211.1ms
  ::warning::DB 왕복 1회가 211.1ms다. API와 DB가 가까이 있지 않다.
  쿼리 하나를 줄일 때마다 이만큼이 줄어든다는 뜻이다.
대상: https://weddingpickl-sg.onrender.com  [Singapore (새 서비스)]
표본: 엔드포인트당 12회

깨우는 중 (이 시간은 측정에 넣지 않는다)
  시도 1: HTTP 200 (252.7ms)

── 매번 새 연결 (앱이 처음 열 때) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=  237.7 p95=  553.3 max=  578.5  total p50=  237.7  TLS=   26.1  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  235.0 p95=  585.8 max=  634.6  total p50=  235.1  TLS=   26.1  209B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  252.8 p95=  265.9 max=  604.3  total p50=  253.0  TLS=   25.7  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  264.7 p95=  396.7 max=  645.2  total p50=  264.7  TLS=   26.0  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  234.5 p95=  238.8 max=  239.6  total p50=  234.6  TLS=   26.0  14894B
  업체 상세                              n=12  TTFB p50=  244.7 p95=  718.8 max=  863.9  total p50=  244.7  TLS=   25.7  1356B

── 연결 이어 쓰기 (서버가 일한 시간에 가까움) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=  199.5 p95=  201.8 max=  221.3  total p50=  199.6  TLS=   26.7  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  205.9 p95=  211.1 max=  226.0  total p50=  205.9  TLS=   26.2  209B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  226.9 p95=  267.7 max=  418.8  total p50=  226.9  TLS=   25.6  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  230.7 p95=  238.8 max=  342.3  total p50=  230.8  TLS=   28.0  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  213.4 p95=  216.8 max=  240.4  total p50=  213.5  TLS=   25.6  14894B
  업체 상세                              n=12  TTFB p50=  213.2 p95=  219.0 max=  238.8  total p50=  213.3  TLS=   25.7  1356B

── 로그인 사용자 ─────────────────────────────
  ::warning::API_TOKEN이 없어 로그인 경로를 재지 못했다.
  토큰 없이 부른 bootstrap은 member가 null이라 첫 묶음에서 끝난다 —
  위 «비회원 bootstrap» 값을 홈의 값으로 읽으면 안 된다.

── API ↔ DB 거리 ─────────────────────────────
  /health p50 205.9ms − / p50 199.5ms = 6.4ms (DB 왕복 2회)
  DB 왕복 1회 ≈ 3.2ms
  같은 지역으로 볼 수 있는 값이다. 병목은 왕복 거리가 아니라 다른 곳에 있다.

══ 두 리전 나란히 (같은 러너 · 같은 실행) ══════════════

                                             Ohio    Singapore
  DB 왕복 1회  ← 판정 기준                       211.1ms        3.2ms
  / (DB 안 봄)                               78.1ms      199.5ms
  /health (DB 왕복 2회)                      500.3ms      205.9ms
  홈 · 많이 확인된 곳                            502.3ms      226.9ms
  홈 전체 (비회원 bootstrap)                    527.0ms      230.7ms
  검색 (질의 있음)                              498.1ms      213.4ms
  업체 상세                                  1101.7ms      213.2ms

  DB 왕복이 211.1ms → 3.2ms. 같은 리전에 붙었다.

  절대 시간은 러너(미국) 기준이라 싱가포르 쪽이 높게 나오는 것이 정상이다.
  국내 사용자는 반대 방향으로 움직인다 — 그 값은 여기서 잴 수 없다.

── 유휴 뒤 첫 요청 ─────────────────────────────
  25초 쉬고: 575.3ms  →  바로 다시: 564.7ms
  25초 쉬고: 518.4ms  →  바로 다시: 523.7ms
  25초 쉬고: 567.5ms  →  바로 다시: 521.6ms
  앞이 크게 높으면 풀이 연결을 닫았다가 다시 맺고 있다는 뜻이다.
```
