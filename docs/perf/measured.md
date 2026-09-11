# 로딩 성능 측정

잰 시각: 2026-09-11 13:43 KST
잰 커밋: dadfa279

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
  시도 1: HTTP 200 (569.9ms)

── 매번 새 연결 (앱이 처음 열 때) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=   86.7 p95=   96.5 max=  104.9  total p50=   86.8  TLS=   25.9  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  471.3 p95=  506.1 max=  511.9  total p50=  471.3  TLS=   25.8  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  497.8 p95=  533.1 max=  539.1  total p50=  497.9  TLS=   25.9  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  505.4 p95=  529.3 max=  535.8  total p50=  505.4  TLS=   26.0  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  500.1 p95=  538.0 max=  760.6  total p50=  500.1  TLS=   25.6  14894B
  업체 상세                              n=12  TTFB p50= 1080.2 p95= 1128.8 max= 1823.7  total p50= 1080.2  TLS=   25.7  1356B

── 연결 이어 쓰기 (서버가 일한 시간에 가까움) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=   27.3 p95=   58.3 max=   64.4  total p50=   27.3  TLS=   26.9  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  443.9 p95=  444.9 max=  473.4  total p50=  444.0  TLS=   28.4  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  455.7 p95=  483.5 max=  507.9  total p50=  455.8  TLS=   25.6  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  464.7 p95=  487.2 max=  704.4  total p50=  464.8  TLS=   26.1  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  447.7 p95=  452.9 max=  475.1  total p50=  447.7  TLS=   25.8  14894B
  업체 상세                              n=12  TTFB p50= 1069.6 p95= 1077.2 max= 1111.9  total p50= 1069.7  TLS=   25.8  1356B

── 로그인 사용자 ─────────────────────────────
  ::warning::API_TOKEN이 없어 로그인 경로를 재지 못했다.
  토큰 없이 부른 bootstrap은 member가 null이라 첫 묶음에서 끝난다 —
  위 «비회원 bootstrap» 값을 홈의 값으로 읽으면 안 된다.

── API ↔ DB 거리 ─────────────────────────────
  /health p50 443.9ms − / p50 27.3ms = 416.6ms (DB 왕복 2회)
  DB 왕복 1회 ≈ 208.3ms
  ::warning::DB 왕복 1회가 208.3ms다. API와 DB가 가까이 있지 않다.
  쿼리 하나를 줄일 때마다 이만큼이 줄어든다는 뜻이다.

── 유휴 뒤 첫 요청 ─────────────────────────────
  25초 쉬고: 473.1ms  →  바로 다시: 507.6ms
  25초 쉬고: 483.1ms  →  바로 다시: 517.2ms
  25초 쉬고: 502.3ms  →  바로 다시: 511.3ms
  앞이 크게 높으면 풀이 연결을 닫았다가 다시 맺고 있다는 뜻이다.
```
