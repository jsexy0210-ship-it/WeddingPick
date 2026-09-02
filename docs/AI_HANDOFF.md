# WeddingPickl AI 인수인계서

> 이 파일은 모든 Claude 세션이 읽는 **단일 진실 소스**다.
> 새 세션이 시작되면 이 파일을 먼저 읽어라. 작업이 끝나면 이 파일을 업데이트하고 커밋해라.

---

## 메타

- `updated_at`: 2026-09-02
- `repository`: jsexy0210-ship-it/WeddingPickl
- `branch (main)`: 4bae250
- `policy_version`: 통합정책 v3.13
- `dashboard`: https://claude.ai/code/artifact/a1307c11-f282-4cf2-a26d-e44bd083d7a9
- `ios_handoff_artifact`: https://claude.ai/code/artifact/b8792fcd-fefe-4386-b24e-41d122e90a87
- `screen_status_artifact`: https://claude.ai/code/artifact/b99277b7-3bdc-45dc-9614-a1310507df53

---

## 인프라 현황

### 서버
- **API 서버**: Fly.io — `weddingpickl.fly.dev`
- **DB**: Neon PostgreSQL (production)
- **스토리지**: Backblaze B2 (S3 호환)
- **모바일 빌드**: EAS (Expo Application Services) + GitHub Actions

### GitHub Actions 워크플로
| 파일 | 역할 |
|---|---|
| `main.yml` | PR 검증 · 테스트 |
| `release.yml` | iOS EAS 빌드 배포 |
| `db-migrate.yml` | Neon DB 마이그레이션 적용 |
| `fly-init.yml` | Fly.io 초기화 |
| `eas-init.yml` | EAS 프로젝트 초기화 |
| `storage-test.yml` | B2 스토리지 연결 테스트 |
| `android-apk.yml` | Android APK 빌드 |

---

## 🚨 사용자 직접 조치 필요 (Claude 불가)

### 0. 회원탈퇴 정책 — 최종 확정: 자동삭제 + 운영자 개입 (2026-09-02, 사용자 결정)
**상태**: 해결됨. main의 `release-gate.ts`/`withdrawalReady()` 게이트 방식은 채택하지
않는다.

사용자가 두 세션의 다른 구현(main의 정책 확정 전 기능 잠금 vs PR #10의 자동파기+
운영자 개입)을 확인한 뒤 직접 결정했다 — *"회원탈퇴 정책, 자동삭제+운영자개입 쪽으로
최종 확정할게."*

**확정된 구현**(PR #10, `claude/daily-progress-briefing-3k7lez`): 자동파기 유지 +
운영자 조회·HOLD·RESUME·RETRY·감사로그(`packages/domain/src/withdrawal.ts`,
`apps/api/src/withdrawal-admin.ts`, 마이그레이션 0055·0058).

**PR #10을 병합하는 세션이 할 일**:
- main의 `packages/domain/src/withdrawal.ts`(release-gate 버전)와
  `packages/domain/src/release-gate.ts`의 `withdrawalReady()` 의존을 걷어내고
  PR #10의 구현으로 교체(PR #10 자체는 이미 이렇게 병합해뒀다).
- `WITHDRAWAL_NOTICE`(§J-3)로 확정한 문구가 있다면 PR #10의 실제 탈퇴 화면 문구와
  맞는지 확인 — 서로 다른 문구가 화면에 남지 않게.
- `docs/통합정책 v3.13`에 이 결정(자동삭제 유지, release-gate 폐기)을 반영할지 확인.

### 1. iOS EAS 빌드 수정 — 최우선
**상태**: Release #1 ~ #10 전부 실패  
**근본 원인**: ASC API Key `62U8N2ZWJR`가 expo.dev에 미등록

**조치 방법**:
1. expo.dev → Account → Credentials → App Store Connect API Keys
2. Add New Key:
   - Key ID: `62U8N2ZWJR`
   - Issuer ID: `a7e4029d-6abf-4811-80a7-9cc47c1d1e21`
   - .p8 파일: `AuthKey_62U8N2ZWJR.p8` 업로드 (로컬에 보관 중)
3. 등록 완료 후 GitHub Actions → Release → Run workflow 실행

**참고**: 현재 expo.dev에는 `NPCMZ655GG`만 있으나 Team/Roles: None → 비활성 상태. `release.yml`은 `--clear-credentials` 제거 완료, 정상 상태.

### 2. Fly.io 환경변수 추가
```
flyctl secrets set OPERATOR_SESSION_TTL_DAYS=365 --app weddingpickl
```
(또는 Fly.io 대시보드 → weddingpickl → Secrets)

### 3. Production DB 마이그레이션 적용
```
# GitHub Actions → db-migrate.yml → Run workflow
# 또는 직접:
DATABASE_URL=<neon-connection-string> pnpm db:migrate
```
적용 대상: `0052_mission_draw.sql` (미션 완료 추적 + 월간 웨딩지원금 추첨 스키마)

**⚠️ 이 파일 그대로는 실행이 안 된다.** `ALTER TYPE reward_kind ADD VALUE 'monthly_draw'`를
같은 트랜잭션 안에서 바로 쓰는 CHECK 제약(`grant_source_matches_kind`)이 있어
Postgres가 "unsafe use of new value of enum type"으로 매번 실패한다(빈 DB에서
직접 재현·확인함). PR #10 브랜치에서 0052를 두 부분으로 나누고, 값을 더하는 것과
쓰는 것을 각각 새 마이그레이션(`0053_reward_kind_monthly_draw.sql`,
`0054_grant_source_matches_kind.sql`)으로 분리해 고쳤다 — main에 병합되지 않은
채로는 그대로 적용해도 실패한다.

### 4. 앱스토어 출시 블로커 — terms.url / privacy.url
`assertReleasable('production')`이 `terms.url` · `privacy.url` 미설정 시 throw → 앱스토어 출시 불가.  
URL 확정 후 도메인 상수(`packages/domain/src/constants/policy.ts` 또는 유사 위치) 업데이트 필요.  
`privacy.url`이 설정되면 `withdrawalReady() = true`로 릴리즈 게이트 자동 통과. 별도 코드 수정 불필요.

### 5. Gmail 커넥터 연결
Google 개발자 콘솔 알림 자동화 세션이 Gmail 미연결로 차단됨.  
claude.ai Settings → Connectors → Gmail 연결 필요.

### 6. 네이버 로그인 환경변수 (2026-09-02, 이 세션에서 서버 구현 완료)
서버 코드(`createNaverProvider`)는 끝났다 — 아래 두 값만 넣으면 네이버가
로그인 제공자 목록에 자동으로 나온다.
```
flyctl secrets set NAVER_CLIENT_ID=<네이버 개발자센터 발급값> --app weddingpickl
flyctl secrets set NAVER_CLIENT_SECRET=<네이버 개발자센터 발급값> --app weddingpickl
```
네이버 개발자센터(developers.naver.com)에서 애플리케이션을 등록하고 서비스
URL·Callback URL(`weddingpick://` 커스텀 스킴)을 설정해야 값이 나온다.
자세한 내용은 `docs/social-login-handoff.md`.

---

## 세션별 작업 완료 현황

### 웨딩픽 통합 운영/관리 (session_01SLgCn4pWaQCTyYJaRa) — 아이들
**완료:**
- ✅ 월간 웨딩지원금 (§I-4) API + 모바일 화면 구현 → 원격 브랜치 푸시 완료
- ✅ 탈퇴 안내 문구 `WITHDRAWAL_NOTICE` 확정 (§J-3)
- ✅ `OPERATOR_SESSION_TTL_DAYS` 도메인 상수 추가 (코드에 추가됨, Fly.io 환경변수는 별도 조치 필요)
- ✅ `release.yml`에서 `--clear-credentials` 플래그 제거

### 정책 관리 (session_017L61fF1Tqbugm8WNCH6QG6, 이 세션) — 실행 중
**완료:**
- ✅ PR #9 머지: `0052_mission_draw.sql` — 미션 완료 추적 + 월간 웨딩지원금 추첨 스키마
- ✅ UX 정책 업데이트: J-3 탈퇴 화면, I-4 월간 웨딩지원금 (PR #8 포함)
- ✅ 개발 현황 대시보드 생성 (artifact a1307c11)

### 백엔드 관리 (session_01GcqCiteAfxQ5X6SaHDhbDq) — PR #10 병합 대기 (Sonnet 5)
**완료:**
- ✅ 최신 main(이 커밋 포함)을 브랜치에 병합, 충돌 21개 전부 해소
- ✅ 회원탈퇴 운영자 개입(조회·HOLD·RESUME·RETRY, `withdrawal-admin.ts`) +
  삭제 워커 트랜잭션 안전성(`FOR UPDATE`, 멱등) — 사용자 지시로 자동파기 유지 결정,
  아래 «회원탈퇴 정책 충돌» 참고
- ✅ 마이그레이션 0055~0058(회원탈퇴/AI라우터/이의만료/탈퇴관리자) — main의
  0052_mission_draw.sql 뒤로 재번호
- ✅ typecheck 7개 워크스페이스·lint 0 error·test 543개(API 기준, 전체 1537개) 전부 통과
  — CI와 동일한 명령(typecheck/lint/test/export:web/build)을 로컬에서 재현해 확인함
  (이 PR에서 GitHub Actions check-run이 뜨지 않아 — 원인 미확인 — 실제 워크플로 실행
  결과는 **미검증**)

**브랜치**: `claude/daily-progress-briefing-3k7lez` · **PR**: #10 (main ← 이 브랜치)
**미검증**: 실제 배포·health check(Fly.io 크리덴셜 필요, PR 단계에서는 원래도 실행 안 됨),
GitHub Actions 실제 실행 결과, production DB 적용.

### 프론트엔드 (session_01HTGSU2B4vFjePXFS2ajKBY) — 아카이브
**완료**: 모바일 앱 핵심 화면 구현, 42개 라우터 파일 생성

### 백엔드 갭 조사 (이 세션, `claude/backend-gaps-9xrh1d`) — 실행 중
**상황**: 세션 시작 시 원래 이 이름의 브랜치가 이미 PR #10으로 병합·삭제된 상태였다
(main = eb3fc3d). main 최신 기준으로 브랜치를 다시 만들어 이어감(별도 안내 없이
"merged PR, restart from main" 절차를 따름).

**조사 결과 — 백엔드 미비 우선순위**(자세한 근거는 이 커밋의 diff와 코드 참고):
1. **관리자 HTTP API 전무** — `apps/api/src/*-admin.ts` 13개 파일에 심사·운영
   로직이 다 있는데 `server.ts`에 라우트로 등록된 게 하나도 없어서 (CLI로만
   실행됨) 관리자 화면 25개(WP-ADM-*)가 붙을 API가 없었다.
2. 네이버 로그인 서버 미구현(타입·config만 존재, 콜백/토큰교환 라우트 없음).
3. ~~`terms.url`/`privacy.url` 미게시 — `assertReleasable`가 이 필드를 체크 안
   해서 릴리즈 게이트를 뚫고 나갈 위험.~~ **오판이었다** — 다시 확인하니
   `release-gate.ts`의 `checkRelease()`가 `POLICY_DOCUMENTS`의 `url` 필드를
   이미 보고 있고(`analysis-notice` 제외), 실제로 문서가 미게시면
   `assertReleasable('production', ...)`이 "확정되지 않은 문서"로 막는다는
   테스트(`release-gate.test.ts`)까지 있었다. 코드 수정 없음 — 실제 남은 일은
   법률 문서 자체를 완성해 `url`을 채우는 것뿐(사용자/법무 영역).
4. 월간 웨딩지원금(NPay) — 0052~0054 마이그레이션 스키마만 있고 앱 코드 0건.
   (다른 브랜치 `origin/claude/session-a4bq31`에 옛 시도가 있으나 테이블명이
   `monthly_draw_entries`로 현재 스키마의 `draw_entries`와 달라 재사용 불가 —
   폐기된 코드로 보임. 실제 금전 지급이 걸려 있어 이번 세션은 손대지 않음.)

**이번 세션에서 한 것 — 1번 중 첫 조각**:
- `apps/api/src/auth/plugin.ts`에 `requireOperator(context)` preHandler 추가.
  `decisions.ts`의 `requireOperator(db, userId)`(운영자 여부 DB 확인)를 그대로
  쓰고, 세션 없음(401)과 운영자 아님(403)을 구분해서 던진다.
- `apps/api/src/routes/admin-withdrawals.ts` 신설 — 이미 있던
  `withdrawal-admin.ts`의 `list`/`hold`/`resume`/`retry`를 그대로 HTTP로 열었다.
  새 라우트: `GET/POST /v1/admin/withdrawals[/:userId/hold|resume|retry]`.
  도메인 함수가 던지는 평범한 `Error`(상태 규칙 위반)는 400으로, `NotAnOperator`는
  403으로 변환한다.
- `server.ts`에 등록, 테스트(`src/test/admin-withdrawals.test.ts`) 추가 —
  로컬에 Postgres 16을 띄워 실제 DB로 typecheck + 전체 jest 재실행해서 확인함
  (샌드박스엔 `DATABASE_URL`이 기본으로 없다 — CI 실행 전엔 대부분 테스트가
  조용히 skip되니, 리뷰할 때 실제로 DB를 붙여 돌렸는지 확인할 것).

**업데이트(같은 세션, 두 번째 조각)**: `vendor-claim-admin.ts`도 같은 패턴으로
끝냈다 — `--list`/`--show`에 인라인돼 있던 SQL을 `listPendingClaims()`/
`getClaim()`으로 뽑아 `main()`이 그걸 다시 부르게 고치고, `/v1/admin/vendor-claims`
(목록·상세·승인·거절)를 열었다. 테스트(`admin-vendor-claims.test.ts`) 포함, 기존
`vendor-claims.test.ts`(CLI 단) 15개까지 실제 Postgres로 재확인함 — 리팩터링이
CLI 동작을 안 바꿨다.

**업데이트(같은 세션, 세 번째 조각)**: `verification-admin.ts`도 끝냈다 —
`--list`/`--backlog`/`--show`에 인라인이던 SQL을 `listPending()`/`listBacklog()`/
`getVerification()`으로 뽑고, 원래 export 안 됐던 `startReview`도 export했다.
`/v1/admin/verifications`(목록·밀린 목록·상세·심사시작·승인·거절)를 열었다.
테스트(`admin-verifications.test.ts` 4개) + 기존 `verification-review.test.ts`·
`verification-backlog.test.ts`(19개) 실 Postgres로 재확인.
**주의**: `startReview`는 원래 코드에도 `requireOperator` 호출이 없었다(다른
동작들과 다르게) — CLI에서도 있던 기존 갭이라 이번 세션에서 고치지 않았다.
HTTP에서는 `requireOperator(context)` preHandler가 관문 역할을 하니 문제
없지만, CLI(`npm run verifications -- --review`)는 여전히 운영자 여부를
안 본다는 점은 남아 있다.

**업데이트(같은 세션, 네 번째 조각)**: `pii-admin.ts`도 끝냈다 — `--list`/
`--show`에 인라인이던 SQL을 `listPendingPiiReviews()`/`getPiiReview()`로 뽑았다.
`/v1/admin/pii-reviews`(목록·상세·클린 확인·지운 값 기록)를 열었다. 테스트
(`admin-pii.test.ts` 5개) + 기존 `pii-review.test.ts`·`pii-admin.test.ts`
(13개) 실 Postgres로 재확인.
**주의(테스트 인프라, 코드 아님)**: 같은 `DATABASE_URL`을 가리키는 jest를
두 개 동시에 돌리면 `resetSchema`가 서로의 스키마를 지우면서 `schema
"originals" does not exist` 같은 원인 불명 실패가 난다 — 실제 버그가 아니라
동시 리셋 경합이다. 이 세션은 전체 스위트 확인용 DB(`weddingpickl_test`)와
조각별 확인용 DB(`weddingpickl_test2`)를 나눠 썼다. 다음 세션도 병렬로 돌릴
땐 DB를 나눌 것.

**업데이트(같은 세션, 다섯 번째 조각)**: `inquiry-admin.ts`도 끝냈다 —
`--list`/`--show`에 인라인이던 SQL을 `listPendingInquiries()`/`getInquiry()`로
뽑았다. `/v1/admin/inquiries`(목록·상세·심사시작·답변, 플래너 노출중단/등록
포함)를 열었다. `moveStatus`는 이전엔 직접 단위테스트가 없었는데, 이번에
추가한 HTTP 테스트(`admin-inquiries.test.ts` 4개)가 사실상 첫 커버리지다.
기존 `inquiries.test.ts`(15개, 문의 접수 경로) 실 Postgres로 재확인.

**업데이트(같은 세션, 여섯 번째 조각 — «함수 추출 불필요» 그룹 완료)**:
`payment-proof-admin.ts`도 끝냈다 — `--list`/`--show`에 인라인이던 SQL을
`listUnlinkedProofs()`/`getPaymentProof()`로 뽑았다. `/v1/admin/payment-proofs`
(미연결 목록·상세+후보·잇기)를 열었다.
**주의(발견한 기존 버그, 이번에 같이 고침)**: `list()`의 `candidates: number`
타입 선언은 거짓말이었다 — Postgres `count(*)`는 pg 드라이버가 문자열로
돌려준다. 원래 코드는 템플릿 문자열에 넣기만 해서 안 드러났지만
(`row.candidates === 0` 비교는 사실 `"0" === 0`이라 **항상 false** — "후보
0곳" 문구가 실제로는 한 번도 안 찍혔을 것), API 응답 JSON에서는 숫자 대신
문자열이 나가는 게 테스트로 바로 드러났다. `Number(row.candidates)`로
변환해서 고쳤다 — CLI 쪽도 이제 0건 문구가 제대로 나온다.
테스트(`admin-payment-proofs.test.ts` 4개) + 기존 `payment-proof-admin.test.ts`·
`payment-proofs.test.ts`(25개) 실 Postgres로 재확인.

이걸로 «함수 추출 없이 바로 라우트만 추가» 그룹 5개(withdrawal·vendor-claim·
verification·pii·inquiry·payment-proof — 실제로는 6개, 처음 분류가 하나
빠졌었다) 전부 끝났다.

**업데이트(같은 세션, 일곱 번째 조각 — 리팩터링 필요 그룹 1/7)**: `ad-admin.ts`
끝냈다. `listPlacements()`/`addPlacement()`/`removePlacement()`로 뽑았다.
`/v1/admin/ads`(지면 방화벽 안내·목록·잡기·내리기)를 열었다.
**주의(발견한 기존 버그 둘, 이번에 같이 고침)**:
1. 이 파일엔 `require.main === module` 관문이 아예 없었다 — 다른 admin
   파일과 달리 모듈 최상단에서 `void main()`을 무조건 실행했다. 그냥
   `import`만 해도(테스트나 라우트에서) 실제 `process.argv`로 CLI가 돌며
   `exitCode`가 오염됐을 것이다. 관문을 추가했다.
2. `addPlacement`/`removePlacement`에 `requireOperator` 확인이 아예 없었다
   — CLI에 `--by`조차 없었다. 이번에 넣었다(CLI도 이제 `--by` 필수).
**같은 문제가 남은 6개에도 있다** — `require.main === module` 관문이
없는 파일: `ai-cost-admin.ts`, `decisions-admin.ts`, `objection-admin.ts`,
`rebuttal-admin.ts`, `retention-admin.ts`, `reward-admin.ts` (전부 확인함,
전부 없음). 각각 라우트로 열기 전에 반드시 이 관문부터 추가할 것 — 안
그러면 라우트 파일이 그 모듈을 `import`하는 순간 서버 기동 시 CLI가 돈다.
이 6개 중 `requireOperator` 호출 유무는 개별 확인 필요(아직 안 봄).
`ad-admin.test.ts`는 원래 없었다 — 이번 HTTP 테스트(`admin-ads.test.ts`
4개)가 첫 커버리지다(테스트가 없었던 이유도 아마 이 관문 부재 때문일
가능성이 높다 — import하면 터지니 테스트를 못 붙였을 것).

**업데이트(같은 세션, 여덟 번째 조각 — 리팩터링 필요 그룹 2/7)**:
`ai-cost-admin.ts`도 끝냈다. `getBudgetStatus()`/`getUsage()`/`setBudget()`/
`clearBudget()`로 뽑았다. `/v1/admin/ai-cost`(이번 달 상태·사용량·한도
설정/해제)를 열었다.
**주의(발견한 기존 버그 둘, 이번에 같이 고침 — ad-admin과 같은 유형)**:
1. `require.main === module` 관문이 없었다(추가함).
2. `setBudget`(한도 설정)과 `--clear-budget`(한도 해제, 원래 `main()`에
   인라인)에 `requireOperator` 확인이 아예 없었다 — `--clear-budget`은
   `--by`조차 받지 않았다. 둘 다 이번에 넣었다(CLI `--clear-budget`도 이제
   `--by` 필수).
테스트(`admin-ai-cost.test.ts` 3개, 첫 커버리지) + 전체 스위트 실 Postgres로
재확인 중(이 문서를 쓰는 시점엔 아직 실행 중 — 다음 커밋 메시지에 결과 남김).

**업데이트(같은 세션, 아홉 번째 조각 — 리팩터링 필요 그룹 3/7)**:
`decisions-admin.ts`도 끝냈다. `getEventDecisions()`/`listOpenDecisions()`/
`getBriefing()`으로 뽑았다. `/v1/admin/decisions`(브리핑·미해결 목록·사건
상세)를 열었다. 이 도구는 **읽기 전용**이라(H장 — 처리는 각 도구가 하고
이건 "어디를 봐야 하는지"만 말함) `requireOperator` 내부 호출 자체가
필요 없다 — HTTP `requireOperator` preHandler만으로 충분. `require.main
=== module` 관문은 여기도 없어서 추가했다(같은 유형의 기존 버그).
테스트(`admin-decisions.test.ts` 4개, 첫 커버리지) 확인.

**업데이트(같은 세션, 열 번째 조각 — 리팩터링 필요 그룹 4/7)**:
`objection-admin.ts`도 끝냈다. 여기는 조금 달랐다 — `holdReview`/
`resolveObjection`은 이미 별도 파일(`objection-decide.ts`)에 export돼
있고 `requireOperator`도 이미 호출한다(이 도구가 CLI 인자만 받아 그
파일의 함수로 넘기는 얇은 wrapper였기 때문). 실제로 뽑은 건 `--list`
인라인 SQL뿐 — `listUnderObjection()`으로 뺐다. `/v1/admin/objections`
(목록·내려두기·결론)를 열었다. `require.main === module` 관문은 여기도
없어서 추가했다(같은 유형의 기존 버그, 하지만 이번엔 `requireOperator`
쪽은 원래부터 안전했다 — 매번 다를 수 있으니 계속 개별 확인 필요하다는
근거이기도 하다). 테스트(`admin-objections.test.ts` 3개) + 기존
`objections.test.ts` 그룹 실 Postgres로 재확인. 전체 스위트 575개도 이
시점까지(ai-cost 포함, objection 제외) 재확인 완료.

**업데이트(같은 세션, 열한 번째 조각 — 리팩터링 필요 그룹 5/7)**:
`rebuttal-admin.ts`도 끝냈다. `objection-admin.ts`와 같은 모양 —
`decideRebuttal`은 이미 별도 파일(`rebuttal-decide.ts`)에 export돼 있고
`requireOperator`도 이미 호출한다. 뽑은 건 `--list`/`--show` 인라인 SQL
(`listPendingRebuttals()`/`getRebuttal()`). `/v1/admin/rebuttals`(목록·
상세·게시·거절)를 열었다. `require.main === module` 관문은 여기도 없어서
추가했다(같은 유형의 기존 버그). 테스트(`admin-rebuttals.test.ts` 4개) +
기존 `rebuttals.test.ts`(22개) 실 Postgres로 재확인.

**업데이트(같은 세션, 열두 번째 조각 — 리팩터링 필요 그룹 6/7)**:
`retention-admin.ts`도 끝냈다. 실제 로직은 이미 `retention/worker.ts`에
다 있어서(CLI는 그 함수들을 잇는 얇은 층) 뽑을 게 없었다 — `require.main
=== module` 관문만 추가했다(같은 유형의 기존 버그).
`/v1/admin/retention`(파기 예정 목록·손이 필요한 목록·개별 삭제·자동 청소·
집어가지 못한 문서 수거)를 열었다. **`--operator`(운영자 지정/해제)는
의도적으로 라우트를 만들지 않았다** — 코드 주석이 "앱에도 API에도 이 값을
바꾸는 길이 없다"고 명시적으로 설계해둔 것(자기 자신을 운영자로 못 올리게
하는 방어). 이건 API가 없는 게 아니라 API가 없어야 하는 경우라 그대로 뒀다.

**주의(발견한 실제 버그, 이번에 같이 고침 — 지금까지와 다른 종류)**:
`retention/worker.ts`의 `deleteDocument()`가 `originals.raw_documents`
테이블에서 `retention_until` 컬럼을 직접 골랐는데, 그 컬럼은 마이그레이션
0018에서 이미 삭제됐다(`ALTER TABLE ... DROP COLUMN retention_until`,
이후 `document_retention_schedule` 뷰가 검증 완료 시각으로부터 계산해서
낸다). **즉 개별 문서 수동 삭제(`--delete <id>`)가 호출될 때마다 100%
"column does not exist"로 죽고 있었다** — 이번에 HTTP로 열면서 실제로
호출해보고서야 드러났다(기존 CLI 사용 기록이 있었는지는 확인 불가, 기존
테스트는 이 경로를 직접 부르지 않았다). `FROM originals.raw_documents d`를
`FROM originals.document_retention_schedule d`로 고쳐 해결. `sweepExpiredDocuments`
(자동 청소)는 애초에 다른 뷰(`expired_documents`)를 써서 이 버그가 없었다
— 그래서 자동 파기는 정상 동작 중이었고, 사람이 수동으로 개별 삭제할 때만
막혀 있었다.

테스트(`admin-retention.test.ts` 5개, 이 버그를 직접 잡아낸 테스트 포함) +
기존 retention 관련 4개 스위트(35개) 실 Postgres로 재확인.

**업데이트(같은 세션, 열세 번째 조각 — 마지막 admin 도메인, 13/13 완료)**:
`reward-admin.ts`도 끝냈다. `decide()`(지급/차단)에 `requireOperator` 확인이
아예 없었다(**돈이 오가는 결정인데도** — 이번 세션에서 본 것 중 가장 위험한
누락) — `decideReward()`로 이름 붙여 export하며 추가했다. `--list`/`--held`
인라인 SQL도 `listRewardGrants()`로 뽑았다. `/v1/admin/rewards`(지급 대기·
확인 대기 목록, 지급·차단)를 열었다. `require.main === module` 관문도
여기 없어서 추가(같은 유형의 마지막 기존 버그). 테스트(`admin-rewards.test.ts`
4개) + 기존 `rewards.test.ts`(18개) 실 Postgres로 재확인.

### 관리자 HTTP API 배선 — 13개 도메인 전부 완료

이 세션에서 `apps/api/src/*-admin.ts` 13개 전부를 `/v1/admin/*` 라우트로
열었다: withdrawal, vendor-claim, verification, pii, inquiry, payment-proof,
ad, ai-cost, decisions, objection, rebuttal, retention, reward. 관리자
화면(WP-ADM-* 25개)이 이제 실제로 붙을 수 있는 API 표면이 생겼다.

**세션 전체에서 발견·수정한 기존 버그 요약**(전부 이번에 실제로 HTTP로
호출해보고서야 드러남 — 타입체크만으로는 하나도 안 잡혔다):
1. `ad-admin.ts`·`ai-cost-admin.ts`·`decisions-admin.ts`·`objection-admin.ts`·
   `rebuttal-admin.ts`·`retention-admin.ts`·`reward-admin.ts` **7개 전부**
   `require.main === module` 관문이 없었다 — import만 해도 실제
   `process.argv`로 CLI가 돌며 `exitCode`가 오염됐을 것이다. 이게 아마
   이 7개에 admin 파일 테스트가 원래 하나도 없었던 이유다.
2. `ad-admin.ts`의 `addPlacement`/`removePlacement`, `ai-cost-admin.ts`의
   `setBudget`/`clearBudget`, `reward-admin.ts`의 `decideReward` —
   `requireOperator` 확인이 아예 없었다. 특히 마지막 건은 **돈이 오가는
   결정**이었다.
3. `payment-proof-admin.ts`의 count 집계를 `number`로 잘못 타입 선언해서
   `candidates === 0` 비교가 항상 false였다(pg가 count를 문자열로 반환).
4. **`retention/worker.ts`의 `deleteDocument()`가 마이그레이션 0018에서
   이미 삭제된 컬럼(`raw_documents.retention_until`)을 직접 조회하고
   있었다** — 개별 문서 수동 삭제가 호출될 때마다 100% 실패하던 상태.
   이 세션에서 찾은 것 중 가장 심각한 버그다(자동 파기는 다른 경로라
   영향 없었지만, 사람이 개입해야 하는 예외 상황에서 정작 수동 삭제
   도구가 작동하지 않았다).

**다음 세션이 할 일**: 관리자 화면(WP-ADM-*) 프론트엔드를 이 API들에
붙이는 것. 각 라우트 파일(`apps/api/src/routes/admin-*.ts`)이 있는 엔드포인트
전부를 보여준다. 인증은 전부 `requireOperator`(Bearer 세션 토큰 + 서버가
`is_operator` 확인) — 관리자 화면도 일반 앱과 같은 로그인 흐름을 쓰고,
운영자 계정만 이 API들을 통과한다.

**세션 종료 시점 최종 검증**(전부 로컬 Postgres 16으로 실제 재현 — 샌드박스엔
`DATABASE_URL` 기본 없어 CI와 동일한 조건을 직접 만들어 확인함):
- `npm run typecheck` — 7개 워크스페이스(api·mobile·web·api-contract·db·
  domain·ui) 전부 통과.
- `apps/api` 전체 jest, 실 DB 연결: **58개 스위트 · 595개 테스트 전부 통과**
  (13개 admin 커밋으로 늘어난 새 테스트 46개 포함, 회귀 0건).
- lint는 `apps/api`에 스크립트가 없어(다른 워크스페이스만 해당) 대상 아님.
- **미검증**: GitHub Actions 실제 실행 결과, production 배포·health check
  (Fly.io 크리덴셜이 이 세션에 없음 — 항상 그래왔듯 사용자 쪽에서 확인 필요).

### 네이버 로그인 서버 구현 완료 (같은 세션)

관리자 API 13개를 끝낸 뒤, «백엔드 갭 조사»의 2번 항목(네이버 로그인 서버
미구현)을 마저 처리했다.

**한 일**:
- `apps/api/src/auth/identity-provider.ts`에 `createNaverProvider(clientId,
  clientSecret, fetchImpl?)` 추가 — 네이버는 OIDC가 아니라 authorization
  code 교환 방식이라 다른 세 제공자와 다르게 client secret이 필요하고, 서버가
  직접 `https://nid.naver.com/oauth2.0/token`에서 토큰을 받은 뒤
  `https://openapi.naver.com/v1/nid/me`로 프로필을 조회한다.
- `IdentityProvider.verify`의 시그니처를 `(token, extra?: { state?: string
  })`로 확장했다 — 네이버 토큰 교환에는 CSRF 방지용 `state`가 필수라
  기존 `verify(idToken)` 하나로는 못 담았다. 다른 세 제공자는 `extra`를
  무시하므로 영향 없음.
- `packages/api-contract/src/auth.ts`의 `createSessionRequestSchema`에
  `state?: string` 추가. 네이버는 `idToken` 자리에 authorization code를
  넣어 보낸다(필드 이름은 그대로 재사용 — 계약을 안 바꾸려고 의도적으로
  그렇게 함, 대신 스키마 주석에 설명 남김).
- `config.ts`에 `naverClientSecret`(`NAVER_CLIENT_SECRET`) 추가,
  `index.ts`는 `NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`이 **둘 다** 있을
  때만 naver 제공자를 등록한다 — 운영 환경변수를 아직 안 넣었으니 지금은
  그대로 노출 안 됨(이전 세션이 남긴 "임의로 노출시키지 말 것" 경고와
  결과적으로 같은 상태 유지).
- `docs/social-login-handoff.md` 갱신 — 다음 사람이 필요한 게 서버 구현이
  아니라 운영 환경변수 설정 + 모바일 쪽 네이버 로그인 버튼(authorization
  code 받아오기, `weddingpick://` Redirect URI 등록)이라는 걸 명확히 함.

**테스트**: `apps/api/src/auth/identity-provider.test.ts`(신설, `fetchImpl`을
가짜로 끼워 실제 네이버 서버 없이 code↔토큰 교환·프로필 조회·에러 케이스
5개 검증) + `apps/api/src/test/naver-login.test.ts`(신설, 라우트가 `state`를
제공자에게 그대로 넘기고 세션을 만드는지 3개) — 둘 다 통과. 기존
`api.test.ts`(세션 관련 13개) 회귀 없음. 전체 워크스페이스 typecheck 재확인
통과.

**다음 사람이 할 일**: 이건 코드가 아니라 운영/모바일 작업이다.
1. **[사용자]** 네이버 개발자센터에서 애플리케이션 등록 → `NAVER_CLIENT_ID`·
   `NAVER_CLIENT_SECRET`을 Fly.io 환경변수로 설정.
2. **[AI/사용자]** 모바일 앱에 네이버 로그인 버튼 연결 — authorization code를
   받아 `POST /v1/auth/sessions`(`provider: 'naver'`, `idToken`에 code,
   `state`에 인가 요청 때 쓴 state)로 보내는 흐름 추가.

---

## 프론트엔드 화면 현황

### 기준: 핸드오프 전체 IA (176개 화면 코드)

| 상태 | 수 | 비율 |
|---|---|---|
| 구현됨 | 34 | 19% |
| 부분 구현 | 58 | 33% |
| 미구현 | 49 | 28% |
| 확인 필요 (Bottom Sheet·공통 상태) | 35 | 20% |

**라우터 파일**: `apps/mobile/src/app/` 42개 — 핵심 화면 커버

### 미구현 주요 영역

| 영역 | 미구현 수 | 비고 |
|---|---|---|
| 관리자 화면 (WP-ADM-*) | 25개 | 전부 미구현 |
| 박람회·웨딩 정보 (WP-EXPO-*) | 5개 | 전부 미구현 |
| 공통 Bottom Sheet (WP-SHT-*) | 16개 | 인라인 처리 여부 확인 필요 |
| 공통 상태 (WP-ST-*) | 14개 | 로딩/에러/빈 상태 확인 필요 |
| B2B 문의 (WP-BIZ-*) | 5개 | 소속확인·자료제공·혜택등록·광고·웹Footer |
| 커플 연결 (WP-CPL-*) | 2개 | 공동 편집 충돌, 변경 내역 |
| 우리웨딩 (WP-OUR-*) | 3개 | 일정 추가, 준비 타임라인, 예식 완료 |
| MY (WP-MY-*) | 2개 | 취향 다시 고르기, 회원탈퇴 |
| 홈 (WP-HOME-*) | 2개 | TOP3 전체보기, 개인화 웨딩피드 |
| 기타 | ~5개 | 지도 보기, 재실행·세션 복원, 진입 예외 등 |

상세 목록: https://claude.ai/code/artifact/b99277b7-3bdc-45dc-9614-a1310507df53

---

## DB 스키마 현황

### 마이그레이션 이력 (0001 ~ 0052, 전체 완료)

| 범위 | 내용 |
|---|---|
| 0001 ~ 0010 | 기반 인프라 (users, vendors, API keys 등) |
| 0011 ~ 0020 | 검색·매칭·견적 |
| 0021 ~ 0030 | 소셜·리뷰·알림 |
| 0031 ~ 0038 | Pick·비교·결제·광고 |
| 0039 ~ 0046 | 보상·제보·광고·결혼 지역 |
| 0047 ~ 0051 | 데이터 수집 파이프라인 (vendor_data_quality, change_log, import_run_log, vendor_images, corrections) |
| **0052** | **미션 완료 추적 + 월간 웨딩지원금 추첨** (미션 4종 + monthly_draws + draw_entries + draw_results + reward_grants 확장 + npay_deliveries) |

### ⚠️ 프로덕션 미적용
`0052_mission_draw.sql`은 코드 리포에 머지됐으나 Neon production DB에는 아직 미적용.  
`db-migrate.yml` 워크플로 실행 필요.

---

## 백엔드 API 현황

- **테스트**: 이 세션 종료 시점 기준 600개 안팎 통과(정확한 숫자는 이 문서
  하단 «백엔드 갭 조사» 세션의 마지막 커밋 로그 참고 — 실 Postgres 16으로
  로컬에서 직접 재현·재확인함, 샌드박스엔 `DATABASE_URL` 기본 없음)
- **관리자 API**: `/v1/admin/*` 13개 도메인 전부 배선 완료(이 세션) — 위
  «관리자 HTTP API 배선 — 13개 도메인 전부 완료» 참고
- **서버**: `weddingpickl.fly.dev` (Fly.io)
- **미확인**: 프로덕션 환경 전체 API 엔드포인트 수, 커버리지 %, 이번
  세션 변경분의 실제 프로덕션 배포·health check(이 세션은 Fly.io 크리덴셜
  없음)

---

## 코드 구조 주요 경로

```
WeddingPickl/
├── apps/
│   ├── mobile/              # Expo Router 모바일 앱
│   │   └── src/app/         # 42개 라우터 파일 (화면)
│   └── api/                 # Hono API 서버 (Fly.io 배포)
├── packages/
│   ├── db/
│   │   └── migrations/      # 0001 ~ 0052 SQL 파일
│   ├── domain/              # 도메인 상수·정책 (terms.url, privacy.url 여기)
│   └── ...
├── docs/
│   ├── 통합정책 v3.13/      # 현재 확정 기준 정책
│   ├── design-handoff/      # 디자인 핸드오프 (IA 176화면)
│   ├── AI_HANDOFF.md        # 이 파일
│   └── 05-product-spec.md   # Phase 1 제품 스펙 (A-01~A-18)
└── .github/workflows/       # CI/CD 워크플로
```

---

## 정책 문서 참조

기준: `docs/통합정책 v3.13/`  
코드와 정책이 충돌하면 **정책이 맞다.** 코드를 고친다.

주요 섹션:
- `§I-4` — 월간 웨딩지원금 추첨 (4개 미션 완료 조건, NPay 5만원×2명)
- `§J-3` — 탈퇴 화면 UX 문구
- `§A~§H` — 업체·검색·Pick·비교 핵심 정책

---

## 다음 작업 우선순위

1. **[사용자]** expo.dev에 ASC API Key 62U8N2ZWJR 등록 → iOS 빌드 재시작
2. **[사용자]** Fly.io: `OPERATOR_SESSION_TTL_DAYS=365` 추가
3. **[사용자]** Neon DB: `db-migrate.yml` 실행 → 0052 적용
4. **[사용자]** terms.url · privacy.url 확정 → 법률 문서 자체를 완성해 URL을
   채운다(코드가 아니라 문서 작업 — `assertReleasable`은 이미 정상 작동함,
   위 «백엔드 갭 조사» 3번 참고)
5. ~~**[AI]** 관리자 HTTP API 배선~~ — **완료**(이 세션, 13개 도메인 전부:
   withdrawal·vendor-claim·verification·pii·inquiry·payment-proof·ad·
   ai-cost·decisions·objection·rebuttal·retention·reward). 자세한 내용은
   위 «관리자 HTTP API 배선 — 13개 도메인 전부 완료» 참고.
6. **[사용자]** 네이버 개발자센터 애플리케이션 등록 → `NAVER_CLIENT_ID`·
   `NAVER_CLIENT_SECRET`을 Fly.io 환경변수로 설정(서버 구현은 이 세션에서
   완료됨, 위 «네이버 로그인 서버 구현 완료» 참고)
7. **[AI]** 관리자 화면(WP-ADM-*) 프론트엔드 설계 및 구현 — API는 이제 다
   있다(`/v1/admin/*`, `requireOperator`로 보호). 각 `routes/admin-*.ts`
   파일이 엔드포인트 전체를 보여준다.
8. **[AI]** 모바일에 네이버 로그인 버튼 연결(authorization code 받아오기,
   `weddingpick://` Redirect URI 등록) — 서버는 준비됨
9. **[AI]** 프론트엔드 미구현 화면 구현 — 우선순위: 회원탈퇴 > 일정 추가 > 지도 보기 > 취향 재선택
10. **[AI]** 공통 Bottom Sheet 16종 인라인 처리 여부 확인

---

## 변경 금지 / 주의

- `--no-verify` 사용 금지
- 마이그레이션 파일 번호 순서 역행 금지 (0052 다음은 0053)
- `main` 브랜치 직접 푸시 금지 — 항상 PR 경유
- `assertReleasable('production')` 우회 금지 — terms.url/privacy.url 설정이 올바른 해결책
- expo.dev 크리덴셜은 Claude가 접근 불가 — 사용자 직접 처리

---

## 롤백

| 항목 | 롤백 방법 |
|---|---|
| DB 마이그레이션 0052 | `0052_mission_draw.sql` DROP 구문 없음 — 수동 롤백 필요 |
| release.yml | git revert로 이전 커밋 복원 |
| Fly.io 환경변수 | `flyctl secrets unset OPERATOR_SESSION_TTL_DAYS` |

---

## 프론트엔드 화면별 상세 갭 분석 (디자인 핸드오프 21개 화면 기준)

> 아래는 `docs/design-handoff/README.md` 기준 21개 화면을 코드와 1:1 대조한 결과다.
> 참고: `docs/design-handoff/웨딩픽 앱 v7.dc.html`은 레포에 없어 README 기준으로 분석.

### 우선순위별 핵심 갭

**높음 — 사용자가 바로 체감:**
1. **인증후기 섹션 완전 누락** — `apps/mobile/src/app/(tabs)/search/[vendorId]/index.tsx` 업체 상세에서 후기를 직접 볼 수 없음, 별도 탭으로만 이동
2. **카메라 가이드 없음** — `capture/camera.tsx`: 3:4 프레임 없음, 밝기·흔들림·잘림 품질 피드백 없음
3. **동의 체크박스 없음** — `capture/payment/consent.tsx`: 전체 동의 Checkbox 미구현, 동의 전 CTA 비활성 로직 없음

**중간 — 정책·UX 이슈:**
4. **파괴적 동작 컨펌 없음** — `tasks.tsx`(체크리스트 삭제), `visit-notes.tsx`(방문노트 삭제) — 다이얼로그 없이 직접 삭제
5. **홈 다음 일정 섹션 대체** — 디자인의 "다음 일정" 고정 섹션이 Priority Engine 카드로 교체됨
6. **홈 편집 드래그 없음** — `home-edit.tsx` 주석에 인지됨, 위/아래 버튼으로 대체

**낮음 — 비주얼 세부:**
7. 스플래시 심볼 88px (디자인 64px) — `features/splash/splash-view.tsx`
8. 미션 완료 모달 바운스 애니메이션 없음 — `(tabs)/my/index.tsx`
9. 검색 자동완성 드롭다운 없음 — `(tabs)/search/index.tsx`
10. 지출 현황 ⓘ 툴팁 없음 — `(tabs)/index.tsx`

### 화면별 상태 요약

| # | 화면 | 상태 | 핵심 누락 |
|---|---|---|---|
| 0 | 스플래시 | ⚠️ | 심볼 88px (설계 64px) |
| 1 | 온보딩 | ✅ | 경미한 레이아웃 차이만 |
| 2 | 이름·예식일 등록 | ⚠️ | 이름 필드 없음, 지역·예산 추가 (정책 변경) |
| 3 | 예식일 캘린더 | ✅ | WeddingCalendar 컴포넌트로 정상 구현 |
| 4 | 로딩 스켈레톤 | ⚠️ | 탭바 숨김 여부, 1.6초 고정 여부 미확인 |
| 5 | 홈 | ⚠️ | 다음 일정→Priority Engine, 지출 툴팁 없음 |
| 6 | 홈 편집 | ⚠️ | 드래그 없음 (버튼 대체, 주석에 인지됨) |
| 7 | 검색 | ⚠️ | 자동완성 없음, 정렬 드롭다운→칩 |
| 8 | 업체 상세 | ⚠️ | **인증후기 섹션 없음**, 상담연결·영업상태 없음 |
| 9 | 비교함 | ⚠️ | "순위 안 매김" 문구, "의견 공유하기" 확인 필요 |
| 10 | 결제내역 등록 동의 | ⚠️ | **전체 동의 Checkbox 없음** |
| 11 | 촬영 | ⚠️ | **3:4 가이드 프레임 없음**, **품질 피드백 없음** |
| 12 | 읽은 내용 확인 | ⚠️ | A-05~A-10 분리 구현, 상세 확인 필요 |
| 13 | 등록 완료 | ⚠️ | 파일 존재, 내용 확인 안 됨 |
| 14 | 지출내역 | ⚠️ | 삭제 컨펌 없음 |
| 15 | 웨딩 스케줄 | ⚠️ | "직접 지정" 표기, 삭제 컨펌 확인 필요 |
| 16 | 방문노트 | ⚠️ | 삭제 컨펌 없음 |
| 17 | MY | ⚠️ | 메뉴 구조 다름, 추가 항목 있음 |
| 18 | 미션 완료 모달 | ⚠️ | **바운스 애니메이션 없음** |
| 19 | 설정 | ⚠️ | 가격 변동 알림 Switch 확인 필요 |
| 20-알림 | 알림 | ✅ | 정상 구현 |
| 20-배우자 | 배우자 연결 | ✅ | 정상 구현 |
| 20-제보 | 내 제보 내역 | ✅ | 정상 구현 |
| 20-반론 | 업체 반론 등록 | ✅ | 정상 구현 |
| 20-문의 | 문의하기 | ✅ | 정상 구현 |
| 20-약관 | 약관·정책 | ✅ | 정상 구현 |

### 공통 횡단 갭

**파괴적 동작 컨펌 다이얼로그 누락:**
| 대상 | 파일 | 상태 |
|---|---|---|
| 체크리스트 삭제 | `(tabs)/wedding/[id]/tasks.tsx` | ❌ 직접 삭제 |
| 방문노트 삭제 | `(tabs)/wedding/[id]/visit-notes.tsx` | ❌ 직접 삭제 |
| 비용 항목 삭제 | `(tabs)/wedding/[id]/expenses.tsx` | ❌ 직접 삭제 |
| 배우자 연결 해제 | `(tabs)/wedding/partner.tsx` | ✅ 2단계 구현 |
| 로그아웃 | `(tabs)/my/settings.tsx` | ✅ Alert 사용 |

### 정책 변경으로 의도적 차이 (버그 아님)
- 이름 필드 제거: v3.10 §3
- "배우자와 실시간 공유" Switch 제거: v2.0 원문 30번 폐기
- 상담연결 CTA 없음: 앱이 중개하지 않는 원칙
- 잠금 카드 대신 stage 기반: v2.0 K-6 잠금 폐기

### 디자인에 없지만 추가 구현된 화면
업체 관계자 인증(`my/vendor-claims/`), 친구초대·홍보인증(`my/rewards.tsx`), 촬영 안내(`my/guide.tsx`), 플래너 상세(`search/planner/[plannerId].tsx`), 샘플 미리보기(`capture/sample.tsx`) 등

---

## 이전 세션(디자인·인프라) 추가 노트

## 변경 금지 / 주의
- do_not_change:
  - **회원탈퇴 자동 삭제 백엔드를 만들지 말 것.** `packages/domain/src/withdrawal.ts`의 `WITHDRAWAL_NOTICE`가 개인정보처리방침 확정 전까지 `null`인 명시적 게이트다. 스키마상 `structured.users` 하드 삭제는 FK CASCADE로 확인된 정보(quotes)까지 지운다 — 위험. `payment_proofs`/`price_reports`를 "통계 제외"할지 "익명화 유지"할지도 정책 §46이 명확히 안 정했다. 이 정책들이 정해지기 전엔 손대지 말 것.
  - NPay·월간 웨딩지원금 기능을 만들지 말 것(위 미완료 항목 참조, 개인정보 처리방침과 함께 정리해야 함).
  - ~~소셜 로그인 관련 파일은... 네이버는 아직 실제 제공자 목록에 노출 안 함 —
    서버 콜백·토큰 교환 API가 따로 필요하다.~~ **오래된 노트.** 서버 구현은
    위 «네이버 로그인 서버 구현 완료» 섹션에서 끝났다. 지금도 노출 안 되는
    이유는 코드가 없어서가 아니라 `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`
    운영 환경변수를 아직 안 넣어서다 — 넣는 순간 자동으로 노출된다(의도된
    동작). `docs/social-login-handoff.md` 참고.
  - `docs/design-handoff/seed/`는 원본 그대로 유지 — 화면 구현할 때 이 폴더 안의 `.dc.html` 파일을 직접 고치지 않는다(참고용 원본).

## 롤백
- rollback_note: 커밋 4개(`f22a512`, `bba48ed`, `10ce66a`, `cf07b15`)는 서로 기능적으로 독립적이라 필요하면 개별 `git revert <hash>`로 되돌릴 수 있다. 순서상 뒤 커밋이 앞 커밋의 파일을 다시 건드리지 않으므로 역순 revert도 안전하다. 전부 origin/main에 push 완료 — 로컬에만 있는 미커밋 변경 없음(`.npm-cache/` 잡음 제외).
