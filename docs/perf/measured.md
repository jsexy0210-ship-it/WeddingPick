# 로딩 성능 측정

잰 시각: 2026-09-11 12:30 KST
잰 커밋: ff3e5db8

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
DB가 Neon 호스트 꼴이 아니다. 리전을 이름에서 읽을 수 없다.
대상: https://weddingpickl.onrender.com
표본: 엔드포인트당 12회

깨우는 중 (이 시간은 측정에 넣지 않는다)
  시도 1: HTTP 200 (736.1ms)

── 매번 새 연결 (앱이 처음 열 때) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=  144.0 p95=  546.9 max=  799.5  total p50=  144.0  TLS=   25.7  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  626.7 p95=  882.5 max= 1005.1  total p50=  626.8  TLS=   25.6  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  686.0 p95=  989.9 max= 1070.3  total p50=  686.0  TLS=   25.4  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  657.3 p95=  947.9 max= 1855.1  total p50=  657.3  TLS=   25.3  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  558.7 p95=  758.6 max= 1943.5  total p50=  558.7  TLS=   25.6  14894B
  업체 상세                              n=12  TTFB p50= 1192.5 p95= 1690.3 max= 1772.9  total p50= 1192.7  TLS=   25.6  1356B

── 연결 이어 쓰기 (서버가 일한 시간에 가까움) ─────────────────────────────
  / (DB 안 봄)                         n=12  TTFB p50=   89.9 p95=  229.3 max=  522.5  total p50=   89.9  TLS=   26.2  60B
  /health (DB 왕복 2회)                 n=12  TTFB p50=  614.4 p95=  888.5 max= 1584.6  total p50=  614.5  TLS=   25.9  162B
  홈 · 많이 확인된 곳                       n=12  TTFB p50=  557.5 p95=  890.2 max=  950.2  total p50=  557.5  TLS=   25.9  3267B
  홈 전체 (비회원 bootstrap)               n=12  TTFB p50=  511.6 p95= 1146.5 max= 1701.4  total p50=  511.7  TLS=   25.1  3208B
  검색 (질의 있음)                         n=12  TTFB p50=  677.3 p95= 1414.1 max= 6459.7  total p50=  677.4  TLS=   25.1  14894B
  업체 상세                              n=12  TTFB p50= 1128.9 p95= 1595.2 max= 2854.3  total p50= 1128.9  TLS=   45.3  1356B

── API ↔ DB 거리 ─────────────────────────────
  /health p50 614.4ms − / p50 89.9ms = 524.5ms (DB 왕복 2회)
  DB 왕복 1회 ≈ 262.2ms
  ::warning::DB 왕복 1회가 262.2ms다. API와 DB가 가까이 있지 않다.
  쿼리 하나를 줄일 때마다 이만큼이 줄어든다는 뜻이다.
```
