# 로딩 성능 측정

잰 시각: 2026-09-11 12:40 KST
잰 커밋: 3940976f

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
  시도 1: HTTP 200 (556.9ms)

── 매번 새 연결 (앱이 처음 열 때) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=   99.6 p95=  136.9 max=  140.2  total p50=   99.6  TLS=   40.1  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  512.0 p95=  548.0 max=  550.1  total p50=  512.1  TLS=   41.6  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  529.6 p95=  544.0 max=  567.4  total p50=  529.7  TLS=   37.7  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  524.1 p95=  538.2 max=  581.2  total p50=  524.1  TLS=   38.3  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  492.0 p95=  502.4 max=  516.4  total p50=  492.1  TLS=   35.4  14894B
  업체 상세                              n=12  TTFB p50= 1096.3 p95= 1121.4 max= 1284.8  total p50= 1096.3  TLS=   36.2  1356B

── 연결 이어 쓰기 (서버가 일한 시간에 가까움) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=   51.9 p95=   56.9 max=   81.6  total p50=   51.9  TLS=   38.9  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  470.0 p95=  490.8 max=  500.2  total p50=  470.0  TLS=   31.9  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  485.2 p95=  490.0 max=  529.7  total p50=  485.2  TLS=   41.8  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  500.3 p95=  508.6 max=  526.6  total p50=  500.3  TLS=   32.4  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  475.1 p95=  533.8 max=  592.7  total p50=  475.4  TLS=   31.2  14894B
  업체 상세                              n=12  TTFB p50= 1047.4 p95= 1067.2 max= 1085.5  total p50= 1047.4  TLS=   36.4  1356B

── API ↔ DB 거리 ─────────────────────────────
  /health p50 470.0ms − / p50 51.9ms = 418.1ms (DB 왕복 2회)
  DB 왕복 1회 ≈ 209.1ms
  ::warning::DB 왕복 1회가 209.1ms다. API와 DB가 가까이 있지 않다.
  쿼리 하나를 줄일 때마다 이만큼이 줄어든다는 뜻이다.

── 유휴 뒤 첫 요청 ─────────────────────────────
  25초 쉬고: 495.9ms  →  바로 다시: 501.0ms
  25초 쉬고: 487.4ms  →  바로 다시: 485.7ms
  25초 쉬고: 531.2ms  →  바로 다시: 528.9ms
  앞이 크게 높으면 풀이 연결을 닫았다가 다시 맺고 있다는 뜻이다.
```
