# 로딩 성능 측정

잰 시각: 2026-09-11 14:40 KST
잰 커밋: 18954700

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
  시도 1: HTTP 200 (64640.7ms)

── 매번 새 연결 (앱이 처음 열 때) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=   98.9 p95=  106.9 max=  118.3  total p50=   99.0  TLS=   36.6  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  511.9 p95=  521.7 max=  523.5  total p50=  513.1  TLS=   34.0  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  522.3 p95=  543.2 max= 1871.9  total p50=  522.4  TLS=   35.5  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  543.4 p95=  564.4 max=  609.8  total p50=  543.4  TLS=   37.7  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  508.3 p95=  583.3 max=  943.5  total p50=  508.6  TLS=   36.5  14894B
  업체 상세                              n=12  TTFB p50= 1145.1 p95= 1198.8 max= 1377.0  total p50= 1145.1  TLS=   36.4  1356B

── 연결 이어 쓰기 (서버가 일한 시간에 가까움) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=   45.4 p95=   58.5 max=   70.6  total p50=   45.5  TLS=   30.0  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  458.2 p95=  470.4 max=  498.2  total p50=  458.3  TLS=   38.3  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  483.8 p95=  529.3 max=  573.3  total p50=  483.8  TLS=   44.4  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  517.1 p95=  531.6 max=  554.4  total p50=  517.2  TLS=   32.1  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  483.7 p95=  493.2 max=  524.8  total p50=  484.5  TLS=   40.0  14894B
  업체 상세                              n=12  TTFB p50= 1133.4 p95= 1141.9 max= 1179.1  total p50= 1133.6  TLS=   35.8  1356B

── 로그인 사용자 ─────────────────────────────
  ::warning::API_TOKEN이 없어 로그인 경로를 재지 못했다.
  토큰 없이 부른 bootstrap은 member가 null이라 첫 묶음에서 끝난다 —
  위 «비회원 bootstrap» 값을 홈의 값으로 읽으면 안 된다.

── API ↔ DB 거리 ─────────────────────────────
  /health p50 458.2ms − / p50 45.4ms = 412.8ms (DB 왕복 2회)
  DB 왕복 1회 ≈ 206.4ms
  ::warning::DB 왕복 1회가 206.4ms다. API와 DB가 가까이 있지 않다.
  쿼리 하나를 줄일 때마다 이만큼이 줄어든다는 뜻이다.

── 유휴 뒤 첫 요청 ─────────────────────────────
  25초 쉬고: 496.9ms  →  바로 다시: 531.3ms
  25초 쉬고: 527.6ms  →  바로 다시: 532.6ms
  25초 쉬고: 489.4ms  →  바로 다시: 492.6ms
  앞이 크게 높으면 풀이 연결을 닫았다가 다시 맺고 있다는 뜻이다.
```
