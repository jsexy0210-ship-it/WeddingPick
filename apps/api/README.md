# @weddingpick/api

앱이 부르는 서버. [`packages/api-contract`](../../packages/api-contract)를 그대로 구현한다.

상시 구동 Node 서버(Fastify) + PostgreSQL.

## 실행

```bash
cp apps/api/.env.example apps/api/.env   # 값을 채운다
npm run migrate --workspace @weddingpick/db
npm run dev --workspace @weddingpick/api      # API 서버
npm run worker --workspace @weddingpick/api   # 분석 워커 (별도 프로세스)
```

워커는 API와 따로 돈다. 문서 하나를 읽는 데 시간이 걸리므로 요청 처리와 섞지 않는다.

테스트는 실제 PostgreSQL이 필요하다. `DATABASE_URL`이 없으면 건너뛴다.

```bash
DATABASE_URL=postgres://... npm test --workspace @weddingpick/api
```

## 구조

```
src/
  config.ts       환경변수 파싱. 빠진 값은 켜질 때 걸린다
  db.ts           연결 풀과 트랜잭션
  errors.ts       계약이 정한 오류 모양
  access.ts       내 웨딩·내 문서인지 확인
  auth/           OIDC 검증, 세션 발급
  storage/        원본 저장소 포트 + S3 어댑터
  routes/         계약의 각 경로
  quote-view.ts   문서 하나를 계약 모양으로 읽기
  analysis/       AI 문서 분석 — 스키마, 분석기, 저장, 워커
  worker.ts       워커 진입점
```

## 분석 워커

```
대기 중인 분석을 하나 잡는다 (FOR UPDATE SKIP LOCKED)
  → 장별 원본을 저장소에서 읽는다
  → Claude가 문서를 읽고 스키마대로 채운다
  → 견적·항목·조건·추출필드를 한 트랜잭션으로 저장
  → 성공/실패를 남기고 토큰 사용량을 기록
```

**AI가 할 수 없는 것이 스키마로 막혀 있다.** 추출 스키마에는 시장가격·중앙값·적정성 판단이
들어갈 자리가 없다. 문서에 적힌 것만 나온다 (사업계획서 27번).

- 값마다 `confidence`가 붙는다. 낮은 값을 "확인 필요"로 드러내려면 화면이 알아야 한다
- 개인정보는 **종류만** 기록하고 값은 옮기지 않는다 (`personal_info_kinds`)
- 저장 직후 등급은 L0, `confirmed_at`은 비어 있다. 분석만으로는 어떤 계산에도 들어가지 않는다
- 업체는 이름만 읽고 연결하지 않는다. 어느 업체인지 확정하는 매칭은 서버 몫인데 아직 업체
  데이터가 없다. 그래서 지금은 가격 비교가 `vendor_unknown`을 돌려준다 — 없는 가격을
  만들지 않는다
- 워커를 여러 개 띄워도 같은 문서를 두 번 분석하지 않는다. AI 호출은 비용이다

## 지켜지는 것

- **계산은 서버가 한다** — 중앙값·분위수·가격 판단은 `@weddingpick/domain`이 계산한다.
  AI가 만든 값이 통계로 흘러들지 않는다 (사업계획서 27번)
- **집계는 `comparable_quotes` 뷰만 본다** — L2 이상, 사용자 확인 완료라는 조건이 뷰 안에 있다
- **표본이 모자라면 값을 지어내지 않는다** — `available: false`와 이유를 돌려준다
- **인증 신청은 접수만 한다** — 이 경로는 `verification_level`을 건드리지 않는다.
  승인에는 심사자가 남아야 한다는 것을 DB가 막는다 (서비스정책서 7번)
- **원본 파일은 서버를 거치지 않는다** — 서명된 URL로 앱이 스토리지에 바로 올린다.
  계약서 원본이 지나는 경로가 하나 줄어든다
- **세션 토큰 원문을 저장하지 않는다** — SHA-256만 남긴다
- **배우자의 개인정보를 내려보내지 않는다** — 웨딩 응답은 역할과 참여 시각만 담는다

## 아직 없는 것

- **업체 매칭** — AI가 읽은 업체 이름을 실제 업체로 연결하는 단계. 이게 없으면 가격 비교가
  시작되지 않는다. 업체 데이터를 어떻게 모을지가 먼저다
- **실제 견적서로 확인** — 워커 테스트는 분석기를 가짜로 바꿔치기해 그 앞뒤(대기열, 저장,
  실패 처리)만 검증한다. 프롬프트와 스키마가 실제 견적서에서 얼마나 정확한지는 확인하지 못했다
- **Apple·Kakao 실제 검증** — OIDC 검증 코드는 있지만 실제 제공자 토큰으로 확인하지 못했다.
  클라이언트 ID를 발급받아 실기기에서 한 번 확인해야 한다
- **원본 자동삭제 작업** — `originals.expired_documents` 뷰는 있지만 집어가는 쪽이 없다.
  보관 기간이 확정돼야 의미가 생긴다
- 업체·플래너 검색(A-16), 배우자 연결 — Phase 2·3
