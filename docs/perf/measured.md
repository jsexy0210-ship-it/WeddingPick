# 로딩 성능 측정

잰 시각: 2026-09-11 12:54 KST
잰 커밋: 250b3c99

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
  시도 1: HTTP 200 (523.0ms)

── 매번 새 연결 (앱이 처음 열 때) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=   77.7 p95=   87.3 max=   88.3  total p50=   77.7  TLS=   26.4  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  491.7 p95=  496.1 max=  542.5  total p50=  491.7  TLS=   26.2  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  515.8 p95=  523.7 max=  526.8  total p50=  515.9  TLS=   26.2  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  520.5 p95=  558.8 max=  605.6  total p50=  520.5  TLS=   26.2  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  488.0 p95=  495.8 max=  510.2  total p50=  488.1  TLS=   26.2  14894B
  업체 상세                              n=12  TTFB p50= 1088.9 p95= 1214.2 max= 1301.3  total p50= 1089.0  TLS=   26.3  1356B

── 연결 이어 쓰기 (서버가 일한 시간에 가까움) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=   37.2 p95=   42.8 max=   54.1  total p50=   37.3  TLS=   26.6  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  435.5 p95=  448.7 max=  467.8  total p50=  435.6  TLS=   26.2  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  467.6 p95=  475.1 max=  498.6  total p50=  467.6  TLS=   26.1  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  465.3 p95=  494.9 max=  612.1  total p50=  465.3  TLS=   26.2  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  444.4 p95=  456.9 max=  463.7  total p50=  444.5  TLS=   26.6  14894B
  업체 상세                              n=12  TTFB p50= 1048.8 p95= 1075.2 max= 1094.7  total p50= 1048.8  TLS=   26.1  1356B

── API ↔ DB 거리 ─────────────────────────────
  /health p50 435.5ms − / p50 37.2ms = 398.3ms (DB 왕복 2회)
  DB 왕복 1회 ≈ 199.2ms
  ::warning::DB 왕복 1회가 199.2ms다. API와 DB가 가까이 있지 않다.
  쿼리 하나를 줄일 때마다 이만큼이 줄어든다는 뜻이다.

── 유휴 뒤 첫 요청 ─────────────────────────────
  25초 쉬고: 475.6ms  →  바로 다시: 477.5ms
  25초 쉬고: 459.3ms  →  바로 다시: 457.7ms
  25초 쉬고: 488.5ms  →  바로 다시: 1865.5ms
  앞이 크게 높으면 풀이 연결을 닫았다가 다시 맺고 있다는 뜻이다.
```
