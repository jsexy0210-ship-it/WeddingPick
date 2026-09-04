# 웨딩픽 마케팅 파이프라인

> 출시 후 홍보 자동화를 위한 개발·검증 파이프라인 안내.
> **현재는 dry_run(모의) 모드만 허용한다. 실제 외부 게시는 실행하지 않는다.**

## 개요

```
소재 등록 → 콘텐츠 생성 → 예약 → 모의 실행 → 이벤트 기록
```

- 채널: `blog` | `instagram` | `shortform` | `community`
- 포맷: `product` | `feature` | `checklist` | `data`
- 상태: `queued` → `simulated` | `failed`
- AI가 자유롭게 만든 본문을 그대로 사용하지 않는다. 검토된 사실 ID만 선택하고 서버가 문장을 구성한다.

## 실행 방법

### 개발 예제 생성 (DB 불필요)

```bash
npm run marketing --workspace @weddingpick/api -- demo .marketing-preview
# 결과: .marketing-preview/index.md (4채널 × 4포맷 = 16개 예제)
```

### 소재 파일로 미리보기

```bash
# source.json
{
  "id": "my-source-01",
  "factIds": ["pick", "compare", "together"],
  "reviewed": true,
  "reviewedAt": "2026-09-04T00:00:00Z",
  "expiresAt": null,
  "nextVerifyAt": null,
  "active": true
}

# input.json
{ "channel": "instagram", "format": "feature" }

npm run marketing --workspace @weddingpick/api -- preview source.json input.json .marketing-preview/custom
```

### 검토된 사실 ID 목록 확인

```bash
npm run marketing --workspace @weddingpick/api -- facts
```

### DB 예약 작업 모의 처리 (DATABASE_URL 필요)

```bash
DATABASE_URL=postgres://... npm run marketing --workspace @weddingpick/api -- simulate
```

## 관리자 API

모두 `requireOperatorUser` 인증 필요.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/v1/admin/marketing` | 작업 목록 + 요약 |
| POST | `/v1/admin/marketing/sources` | 소재 등록 |
| DELETE | `/v1/admin/marketing/sources/:sourceId` | 소재 비활성화 |
| POST | `/v1/admin/marketing/generate` | 콘텐츠 생성·예약 |
| GET | `/v1/admin/marketing/plan-prompt` | 계획 프롬프트 조회 |
| POST | `/v1/admin/marketing/:jobId/simulate` | 모의 실행 |
| POST | `/v1/admin/marketing/:jobId/retry` | 실패 재시도 |
| GET | `/v1/admin/marketing/:jobId/events` | 이벤트 이력 |

### 소재 등록 예시

```json
POST /v1/admin/marketing/sources
{
  "id": "launch-source-01",
  "factIds": ["pick", "compare", "together"],
  "reviewed": true,
  "expiresAt": "2027-01-01T00:00:00Z"
}
```

### 콘텐츠 생성 예시

```json
POST /v1/admin/marketing/generate
{
  "sourceId": "launch-source-01",
  "channel": "instagram",
  "format": "feature",
  "scheduledAt": "2026-10-01T09:00:00Z"
}
```

## 검토된 사실 ID

`apps/api/src/marketing/content.ts`의 `VERIFIED_FACTS`가 원본이다.

| ID | 문장 |
|----|------|
| pick | 웨딩픽은 웨딩업체를 먼저 골라주고 사용자는 비교해서 Pick하는 서비스예요. |
| compare | 확인된 결제 금액 정보를 바탕으로 업체를 비교할 수 있어요. |
| together | 배우자와 함께 업체 후보를 보고 함께 결정할 수 있어요. |
| schedule | 결혼 준비 일정과 지출을 한곳에서 관리할 수 있어요. |
| data | 실제 결제 금액 정보를 기반으로 구간과 기준금액을 안내해요. |
| proof | 확인된 결제 정보만 비교에 반영해요. |
| free | 앱 다운로드와 기본 비교 기능은 무료예요. |
| category | 웨딩홀, 스튜디오, 드레스, 결정사 등 카테고리별로 비교할 수 있어요. |

사실 ID를 추가하려면 `VERIFIED_FACTS`에 운영자가 원문을 검토한 뒤 추가한다.

## AI 연동 (현재 미구현)

공통 계획 프롬프트와 출력 계약만 준비돼 있다. 실제 API 호출 없음.

```json
// AI 출력 계약 (factIds만 선택, 본문 자유 생성 금지)
{
  "channel": "instagram",
  "format": "feature",
  "factIds": ["pick", "together"]
}
```

## DB 스키마

마이그레이션: `packages/db/migrations/0072_marketing_pipeline.sql`

- `marketing_sources` — 운영자 등록 소재, `fact_ids TEXT[]`
- `marketing_jobs` — 콘텐츠 작업, `(source_id, channel, format, 날짜)` UNIQUE
- `marketing_events` — 상태 변경 감사 로그

## 현재 한계

- 실제 SNS 게시 어댑터 미구현
- AI API 자동 호출 미구현
- 카드뉴스 이미지·영상 제작 미구현
- 유입·전환 성과 수집 미구현
- 상시 예약 실행 미구현
- 실게시 활성화 조건 미설계

출시 전까지 기본값은 dry_run이며, 환경변수 하나로 실게시가 가능한 완성 시스템이 아니다.

## 주의

- `resetDatabase`/`resetSchema`는 스키마를 삭제한다. 격리된 테스트 DB에서만 실행.
- 운영 DB에 마이그레이션 0072 적용 전 `db-migrate.yml` 워크플로를 실행한다.
- 실제 채널 게시에는 계정 권한, API 키, 이용약관 확인이 필요하다.
