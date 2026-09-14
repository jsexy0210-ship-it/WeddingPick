# 네이버·구글 신원 파기 — 1단계 보고

작성: 2026-09-14 (KST) · 브랜치 `claude/identity-purge`

## 결론부터

**숫자를 내지 못했습니다.** 이 세션에 운영 DB 접근 수단이 없습니다.
아무것도 지우지 않았고, 코드도 바꾸지 않았습니다.

## 왜 못 셌나

- `DATABASE_URL` 이 세션 환경에 없음
- `render.yaml:115` 에서 `sync: false` — Render 대시보드에서 수동 주입하는 값이라
  저장소에도 세션에도 들어오지 않음
- Render API 자격증명도 없음. `.env` 파일 없음 (`apps/api/.env.example` 뿐)

필요한 것: 읽기 전용 `DATABASE_URL`, 또는 접근 권한이 있는 쪽에서
`scripts/identity-purge-count.sql` 을 돌린 출력.

## 계수 스크립트

`scripts/identity-purge-count.sql` — SELECT만 들어 있습니다.
DELETE·DROP·UPDATE·ALTER·INSERT 0줄.

로컬 PostgreSQL 16.13에 마이그레이션 92개를 전부 적용한 뒤, 픽스처 5명
(네이버단독 · 구글단독 · 구글+카카오 · 네이버+이메일 · 카카오)으로 분류
로직을 확인했습니다. 쿼리 7개 전부 기대값과 일치했습니다.

```
psql "$DATABASE_URL" -f scripts/identity-purge-count.sql
```

## 브리프 정정 4건

### 1. enum 값은 4개가 아니라 5개다

`0075_identity_provider_email.sql:7` 이 `'email'` 을 추가했습니다.
현재: `apple, kakao, google, naver, email`.

### 2. 이메일 로그인이 살아있는 경로다 — 계수 정의가 달라진다

`identity.email_credentials` 는 `identity.identities(id)` 를 PK-FK로 물고
있습니다 (`0076_email_login.sql:8-9`). 이메일 로그인도 `provider='email'` 인
identity 행입니다.

따라서 "잠기는 사용자" 판정의 잔여 수단은 **카카오·애플·이메일** 3개 기준이어야
합니다. 카카오·애플 2개로만 세면 잠기는 사람 수가 실제보다 부풀려집니다.
스크립트는 3개 기준이고, 쿼리 `[4]`가 잔여 수단 내역을 따로 뽑습니다.

### 3. 마이그레이션 번호 0250 — 근거를 확인하지 못했다

저장소 최고 번호는 **0091a** 입니다. 0210·0230·0240 파일이 저장소에 없습니다.
0250을 쓰면 약 158개 구간이 빕니다. 확인 전까지 번호를 잡지 않았습니다.

### 4. `migrate.ts` 키는 파일명 전체가 아니라 `.sql` 뗀 이름이다

`packages/db/src/migrate.ts:29` — `file.replace(/\.sql$/, '')`.
이름을 바꾸지 말라는 결론 자체는 그대로 유효합니다.

## 브리프에 없던 위험 — 이게 제일 크다

`structured.weddings.owner_user_id` 가 **`ON DELETE CASCADE`** 입니다
(`0001_init.sql:93`).

사용자 행을 지우면 그 사람 웨딩이 통째로 날아가고, 거기에 딸린
`vendor_candidates`(Pick) · `wedding_events` · `wedding_tasks` · `expenses` 가
전부 CASCADE로 함께 사라집니다.

더 나쁜 것은, **파기 대상이 아닌 배우자까지 웨딩을 잃습니다.** 네이버 단독
사용자가 owner이고 배우자가 카카오라면, 배우자는 지우지 않았는데도 공유 웨딩이
사라집니다. 픽스처로 재현했고, 쿼리 `[6]`이 이 인원을 셉니다.

### 권고

사용자 행은 건드리지 말고 **`identity.identities` 행만 삭제**로 한정하십시오.

identity 행 삭제는 사용자·웨딩·데이터를 전혀 건드리지 않습니다 (FK 방향이
identity → user라 역방향 CASCADE가 없습니다). 로그인 경로만 사라집니다.
되돌릴 때도 identity 행만 복원하면 됩니다.

## 2단계에 도움되는 사전 조사

`identity_provider` 타입 의존성은 **단 하나**입니다:

- `identity.identities.provider` 컬럼
- `identities_provider_subject_key` 유니크 인덱스

참조하는 뷰·함수·CHECK 제약·기본값이 **없습니다** (로컬 카탈로그 조회로 확인).
타입 교체(신규 타입 생성 → 컬럼 이관 → 구 타입 삭제) 절차가 예상보다 단순하고,
브리프가 걱정한 "뷰·함수가 걸리는" 상황은 발생하지 않습니다.

## 이 단계에서 하지 않은 것

- 코드 변경 0건 — 인증 경로 · `config.ts` · 모바일 빌드 설정 전부 그대로
- `apps/mobile/src/features/auth/**` 미접촉 (`claude/rn-nav-auth` 세션과 겹치는 영역)
- 마이그레이션 파일 생성하지 않음
- PR 생성하지 않음
