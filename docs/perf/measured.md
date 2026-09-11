# 로딩 성능 측정

잰 시각: 2026-09-11 12:34 KST
잰 커밋: 4f5076d4

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
대상: https://weddingpickl.onrender.com
표본: 엔드포인트당 12회

깨우는 중 (이 시간은 측정에 넣지 않는다)
  시도 1: HTTP 200 (717.9ms)

── 매번 새 연결 (앱이 처음 열 때) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=  123.6 p95=  171.0 max=  410.0  total p50=  123.7  TLS=   28.9  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  557.0 p95=  575.7 max=  696.9  total p50=  557.1  TLS=   29.5  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  565.7 p95=  576.2 max=  580.5  total p50=  565.8  TLS=   30.3  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  573.8 p95=  598.3 max=  705.8  total p50=  573.8  TLS=   30.2  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  548.4 p95=  682.5 max=  688.8  total p50=  548.6  TLS=   28.6  14894B
  업체 상세                              n=12  TTFB p50= 1151.3 p95= 1182.7 max= 1274.2  total p50= 1151.3  TLS=   28.1  1356B

── 연결 이어 쓰기 (서버가 일한 시간에 가까움) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=   87.4 p95=  102.5 max=  114.9  total p50=   87.4  TLS=   27.4  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  513.4 p95=  528.3 max=  536.6  total p50=  513.5  TLS=   30.6  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  537.3 p95=  548.8 max=  576.6  total p50=  537.4  TLS=   30.6  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  527.7 p95=  568.2 max=  827.8  total p50=  527.8  TLS=   35.6  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  515.2 p95=  522.0 max=  544.8  total p50=  515.5  TLS=   26.8  14894B
  업체 상세                              n=12  TTFB p50= 1119.0 p95= 1172.1 max= 1217.5  total p50= 1119.1  TLS=   28.5  1356B

── API ↔ DB 거리 ─────────────────────────────
  /health p50 513.4ms − / p50 87.4ms = 426.0ms (DB 왕복 2회)
  DB 왕복 1회 ≈ 213.0ms
  ::warning::DB 왕복 1회가 213.0ms다. API와 DB가 가까이 있지 않다.
  쿼리 하나를 줄일 때마다 이만큼이 줄어든다는 뜻이다.

── 유휴 뒤 첫 요청 ─────────────────────────────
  25초 쉬고: 579.4ms  →  바로 다시: 538.8ms
  25초 쉬고: 545.3ms  →  바로 다시: 700.3ms
  25초 쉬고: 542.2ms  →  바로 다시: 537.3ms
  앞이 크게 높으면 풀이 연결을 닫았다가 다시 맺고 있다는 뜻이다.
```
