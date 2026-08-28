# @weddingpick/api

앱이 부르는 서버. [`packages/api-contract`](../../packages/api-contract)를 그대로 구현한다.

상시 구동 Node 서버(Fastify) + PostgreSQL.

## 실행

```bash
cp apps/api/.env.example apps/api/.env   # 값을 채운다
npm run migrate --workspace @weddingpick/db
npm run dev --workspace @weddingpick/api
```

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
```

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

- **AI 분석 워커** — `POST /v1/documents/{id}/complete`가 분석 작업을 `pending`으로 만들지만,
  집어가는 쪽이 없다. 다음 작업이다
- **Apple·Kakao 실제 검증** — OIDC 검증 코드는 있지만 실제 제공자 토큰으로 확인하지 못했다.
  클라이언트 ID를 발급받아 실기기에서 한 번 확인해야 한다
- 업체·플래너 검색(A-16), 배우자 연결 — Phase 2·3
