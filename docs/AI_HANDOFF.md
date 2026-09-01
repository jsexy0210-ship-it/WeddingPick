# WeddingPick AI HANDOFF

## 기준
- updated_at: 2026-09-01T00:15Z
- author_ai: Claude Opus 5 — 세션 «프론트엔드» (`session_01HTGSU2B4vFjePXFS2ajKBY`)
- repository: WeddingPickl
- branch: `claude/home-c1`
- base_commit: `9b4db6d` (분기 시점의 main · claude/session-a4bq31)
- last_verified_commit: `6bf0abd` (origin/main `fc6c199` 병합 후, 타입체크·테스트 통과)
- policy_version: v3.10 (`docs/통합정책 v3.10`)

## 이번 작업 범위
- work_scope: Claude Design 핸드오프 `웨딩픽 홈 C-1 상태.dc.html`을 실제 앱으로 구현.
  홈 화면 재작성 + 디자인 토큰을 TDS에서 SEED로 이관.
  사용자가 넷 다 «추천» 선택지로 확정: ① weddingpickl 앱에 구현 ② 기존 API로 최대한 연결
  ③ 홈 편집을 C-1 고정 순서로 대체 ④ theme.ts를 SEED로 교체.

## 완료
- completed:
  - **홈 C-1 6상태.** 시안 여섯 장을 레이아웃 다섯(`guest`·`taste`·`empty`·`picking`·`decided`)과
    `comparable` 한 값으로 되살림. 대응표는 `apps/mobile/src/features/home/state.ts` 상단 주석에 표로 있음.
  - **토큰 SEED 이관.** gray 램프·의미색·타이포 래더(32/26/20/18/16/14, 135%/150%, 자간 0)·
    라디우스(버튼 6 · 카드 10 · 시트 20). **semibold 삭제** — SEED는 400/700뿐이라 t5의 600이 700으로 올라감.
    어두운 모드도 SEED가 정한 dark 램프로 교체(이전에는 우리가 지어낸 값이었음).
  - **ActionButton 확장.** `variant: 'ghost'`와 `size: 'auto'|'medium'|'large'|'xlarge'` 추가.
    기본값 `auto`는 기존 동작 그대로라 34곳의 기존 호출부는 바뀌지 않음.
  - **홈 편집 진입점 제거.** `home-edit.tsx` 파일과 `_layout.tsx` 등록은 남기고 홈에서 가는 길만 없앰.
  - **HomeSkeleton 재작성.** 옛 홈 골격(금액·분포바·범례)을 그리고 있어서 C-1 골격으로 맞춤.
  - **용어 오류 1건 수정.** `NOT_ENOUGH_DATA`가 `아직 데이터가 적어요`였음.
    v3.3이 사용자 화면에서 «데이터»를 걷어냈는데 이 문구만 남아 있었고 홈이 그것을 그림 → `아직 정보가 적어요`.

## 변경 파일
- changed_files:
  - `apps/mobile/src/app/(tabs)/index.tsx` — 전면 재작성
  - `apps/mobile/src/features/home/` — 신규 9개: `state.ts` `state.test.ts` `taste.ts` `taste.test.ts`
    `board.tsx` `todays-pick.tsx` `vendor-list.tsx` `taste-picker.tsx` `category-image.tsx`
    `content.ts` `wedding-content.tsx` / 수정: `home-skeleton.tsx`
  - `packages/ui/src/theme.ts` `themed-text.tsx` `action-button.tsx`
  - `packages/domain/src/terms.ts` + 문자열을 단언하던 테스트 3개
    (`disclosure.test.ts` `nudge.test.ts` `apps/api/src/test/vendors.test.ts`)

## DB / Migration 변경
- schema_or_migration_changes: 없음. 마이그레이션·계약(`api-contract`)·API 라우트를 하나도 건드리지 않음.

## 테스트
- tests_run: `npm run typecheck` · `npm test` · `npm run lint` · `npx expo export --platform web`
- test_results: 타입체크 6개 워크스페이스 전부 통과 / 도메인 401 · 모바일 45 · 계약 17 · 웹 13 통과 /
  린트 0 / 웹 번들 빌드 성공.
  **API 406건과 DB 65건은 `DATABASE_URL`이 없어 건너뜀 — 이 환경에서는 검증 전.**

## 알려진 이슈
- known_issues:
  - **토큰 교체의 파급.** theme.ts·themed-text.tsx는 앱 전체가 쓴다. 기존 40여 화면의 글자 크기와
    굵기가 같이 바뀐다(15→16, 17→18, 13→14, semibold→bold). 의도된 이관이지만
    **홈 외의 화면은 눈으로 확인하지 않았다.** 시각 회귀 점검이 필요하다.
  - `Radius.medium` 16→10, `Radius.card` 20→10으로 내려갔다. 카드가 눈에 띄게 각져진다.
  - 글꼴은 **Pretendard를 유지**했다. 핸드오프의 «시스템 서체»는 TDS 라이선스 때문에 나온 말이고
    Pretendard에는 그 문제가 없다. CLAUDE.md의 «Pretendard 미적용»과 어긋나는 유일한 지점이고,
    되돌리려면 `packages/ui/src/theme.ts`의 `SANS_STACK` 한 줄만 고치면 된다.

## 미완료
- incomplete_tasks:
  - **취향(taste)이 기기 저장이다.** 계약에도 도메인에도 취향 개념이 없어 AsyncStorage에 둔다.
    새 기기에서는 다시 묻는다. 서버에 자리가 생기면 `features/home/taste.ts`의
    `loadTaste`/`saveTaste` 두 함수만 API 호출로 바꾸면 화면은 그대로다.
  - **웨딩 정보 콘텐츠 API가 없다.** `features/home/content.ts`의 `listWeddingContent()`가
    빈 배열을 돌려주고 홈이 섹션째 접는다. 컴포넌트(`wedding-content.tsx`)는 시안대로 다 그려져 있다.
    시안의 제목을 하드코딩하지 않은 이유: 앱에서는 그것이 눌러도 아무것도 없는 «읽을 수 있는 글»로 보인다.
  - **업체 사진 필드가 계약에 없다.** `vendorSummarySchema`에 이미지 URL이 없어
    `category-image.tsx`가 늘 조용한 면을 그린다. 빈 상자나 «사진 준비 중»은 노출하지 않는다(시안 규칙).
    필드가 생기면 `uri`만 넘기면 된다.
  - **비회원 홈의 업종별 «확인된 정보 N건»을 적지 않았다.** 그 숫자를 낼 API가 없다.
    근거 없는 숫자를 화면에 올리지 않는다(`conventions.md`).
  - **오늘의 Pick의 개인화 추천 이유 한 줄**(시안: «고른 사진 톤에 가깝고 5월 주말이 열려 있어요»)을
    적지 않았다. 계산할 근거가 없다.

## 다음 우선순위
- next_priority:
  1. 이 브랜치를 `claude/session-a4bq31`에 병합할지 결정. 병합하면 앱 전체 타이포가 SEED로 바뀐다.
  2. 토큰 이관 후 **홈 외 화면 시각 회귀 점검** — 가장 큰 위험이 여기 있다.
  3. 검색 · Pick · 업체상세 — 시안은 다 나왔고 라우트가 얕다. 홈에서 이어지는 핵심 루프다.
  4. 관리자 콘솔 웹 UI — IA 24화면이 통째로 비어 있고 지금은 CLI 스크립트 10개로만 돈다.

## 변경 금지 / 주의
- do_not_change:
  - **Pick 심볼**(하트 안 체크). CLAUDE.md가 두 path를 고정값으로 박아뒀고,
    백엔드 세션이 `fc6c199`에서 앱 아이콘 5종·스플래시까지 적용을 끝냈다.
  - **키 컬러 코랄 `#ff6f61`과 거터 24px.** SEED와 다른 채로 두는 것이 확정이다. 이탈은 이 둘뿐이다.
  - **사용자 화면 금칙어**: `AI` · `데이터` · 애매모호 표현(`거의`·`대략`·`어느 정도` 등).
    `packages/domain/src/copy-rules.ts`와 `terms.ts`가 대체어를 들고 있다.
  - **가격 공개 4단계 사다리**(`disclosure.ts`)가 금액을 공개하는 유일한 기준이다.
    화면마다 «몇 건부터 보여줄까»를 다시 정하지 않는다.

## 롤백
- rollback_note:
  `git revert 6ed3106` 하나면 홈과 토큰이 함께 되돌아간다(병합 커밋 `6bf0abd`는 백엔드 작업이라 남긴다).
  토큰만 되돌리려면 `packages/ui/src/theme.ts`·`themed-text.tsx`·`action-button.tsx` 세 파일만
  `9b4db6d` 시점으로 체크아웃하면 되지만, 그러면 홈이 TDS 값으로 그려져 C-1과 어긋난다.

---

## 세션 분담 (2026-09-01 기준)

한 사람이 세션 셋을 동시에 돌리고 있어 무엇을 누가 들고 있는지 여기 적어 둔다.

| 세션 | ID | 소유 영역 | 브랜치 |
|---|---|---|---|
| **백엔드** | `session_01SLgCn4pWaQCTyYPzVLcbQr` | 레포 전체 · API · 심볼/아이콘 · 다음은 지연 로그인+최소 온보딩 | `claude/session-a4bq31` |
| 프론트엔드 | `session_01HTGSU2B4vFjePXFS2ajKBY` | 홈 C-1 · 디자인 토큰 (이 문서의 작성자) | `claude/home-c1` |
| 일일 공정률 브리핑 | `session_01GcqCiteAfxQ5X6SaHDhbDq` | 공정률 정의·계산 + 회원탈퇴·운영자 심사권한 등 백엔드 항목 다수. **PR #10 열림, 충돌 미해결.** 아래 항목 참고 | `claude/daily-progress-briefing-3k7lez` |

**공정률 숫자는 브리핑 세션이 낸 것만 쓴다.** 프론트엔드 세션이 2026-09-01에 종합 58%
(앱 0.45 / 백엔드 0.3 / 관리자 0.15 / 디자인 0.1 가중)를 낸 적이 있으나, 그 가중치는
근거 없이 정한 값이라 **폐기한다.** 두 곳에서 숫자가 나오면 어느 쪽이 우리 숫자인지 알 수 없게 된다.

그때 함께 잰 **측정값**은 근거가 있으므로 브리핑 세션이 참고해도 된다
(`9b4db6d` 기준, `fc6c199` 미반영):
디자인 파일 18 · IA 고유 화면 ID 177 · 모바일 라우트 41 · API 핸들러 81(계약 76) ·
DB 마이그레이션 44 · 도메인 모듈 47/테스트 35 · UI 컴포넌트 14 ·
관리자 웹 UI 0(CLI 스크립트 10) · 박람회 코드 0.

---

## 세션 기록 — 일일 공정률 브리핑 세션 (2026-09-01)

### 기준
- updated_at: 2026-09-01T15:55Z
- author_ai: Claude Sonnet 5 — 세션 «일일 공정률 브리핑» (`session_01GcqCiteAfxQ5X6SaHDhbDq`)
- branch: `claude/daily-progress-briefing-3k7lez`
- **PR #10 (main ← 이 브랜치)이 열려 있음, 사용자 지시로 충돌을 그대로 둔 채 오픈.**
  다음 세션이 이 PR을 머지하려면 아래 «충돌·주의» 항목부터 처리해야 함.

### 이번 작업 범위
원래 요청은 «매일 오전 전체 공정률 보고 브리핑»(Routine, 매일 09:00 KST)이었고,
그 도구(`scripts/progress.mjs`)를 만드는 과정에서 공정률 계산이 걸려 있던 실제 결함들을
사용자 지시("잔여 계속 진행 묻지 말고 끝까지 계속해")에 따라 자율적으로 이어서 고침.

### 완료
- **공정률 산출 도구**: `scripts/progress.mjs` + `scripts/progress.config.json`.
  숫자를 지어내지 않는다 — 측정 불가 항목은 "미측정"으로 분모에서 빠짐.
  `docs/design-handoff/screens.md`(디자인 화면 ID 184개 대장, 앱 158 + 관리자 `WP-ADM-*` 26)를
  분모로 씀. `--compare "<git 시점>"`으로 과거 대비 diff 가능.
- **회원탈퇴 (WP-MY-008)**: `packages/domain/src/withdrawal.ts` 전체 신규 —
  사용자가 올린 정확한 디자인 목업 문구 그대로 구현(지워지는 것 / 작성자 정보와 분리되는 것
  두 묶음, 배우자 유무·후기/인증 건수별 분기, 일수·날짜 약속 금지). 풀스택:
  `apps/api/src/withdrawal.ts`, `apps/api/src/routes/withdrawal.ts`,
  `packages/api-contract/src/withdrawal.ts`, `apps/mobile/src/app/(tabs)/my/withdrawal.tsx`.
  **⚠️ main에 동명의 완전히 다른 구현이 있음 — 아래 «충돌» 참고.**
- **AI 라우터 사용량 게이트**: `packages/domain/src/ai-router.ts`(순수함수) +
  `apps/api/src/analysis/pipeline.ts`(`extractDocument` 게이트). 이전에는 문서 추출 AI
  호출이 실제로 기록되지 않아 예산·일일 호출 한도가 있으나마나였음. 기본 한도값을 지어내지
  않음(`AI_DAILY_CALL_LIMIT`에 기본값 없음). 마이그레이션 `0049_ai_router.sql`
  (`structured.ai_usage.user_id` 추가).
- **이의제기 30일 자동 만료**: `structured.review_visibility` 계산 뷰로 대체
  (마이그레이션 `0050_objection_expiry.sql`). 이전에는 백그라운드 잡이 없어 이의 보류가
  사실상 무기한이었음. `apps/api/src/objection-decide.ts`, `objection-admin.ts` 신규.
- **반론(rebuttal) 게시 전 근거 확인**: `apps/api/src/rebuttal-decide.ts` — 연결된
  `approved_vendor_claims` 없이는 게시 불가(`--without-claim`으로 예외 처리 가능).
- **운영자 심사 권한 게이트**: `apps/api/src/decisions.ts`에 `requireOperator`/`NotAnOperator`
  공유 함수 추가, 결정 도구 6곳(`verification-admin.ts` `vendor-claim-admin.ts`
  `pii-admin.ts` `inquiry-admin.ts` `objection-decide.ts` `rebuttal-decide.ts`)에
  맨 앞 단계로 적용. 이전에는 `is_operator` 컬럼이 있어도 어느 CLI도 확인하지 않았음 —
  서버에 접근 가능한 사람이면 누구나 승인/반려를 낼 수 있었음. 테스트:
  `apps/api/src/test/operator-authority.test.ts`(대상이 존재하지 않아도 권한부터 봄을 검증).
- **결제인증 수동 연결**: `apps/api/src/payment-proof-admin.ts` 신규 — 가맹점명이 여러
  업체에 겹칠 때 `vendor_id`가 영구히 NULL로 남는 문제를 사람이 잇는 CLI. 별칭으로 남기지
  않음(건마다 다시 판단). 테스트: `apps/api/src/test/payment-proof-admin.test.ts`.
- **패키지 형제 업체 후기 이어쓰기**: 후기 작성 완료 화면에서 같은 패키지의 아직 안 쓴
  다른 업체(`packageSiblings`)로 자연스럽게 이어지는 CTA. `packages/api-contract/src/reviews.ts`
  `apps/api/src/routes/reviews.ts` `packages/domain/src/vendor.ts`
  `apps/mobile/.../write-review.tsx` 관련.
- **v3.3 문구 확정 반영**: `copy-rules.ts`에서 `데이터`를 BANNED로, `확인된 정보`로 대체
  (`EXEMPT_PHRASES=['공공데이터']`로 고유명사만 예외). 사용자 화면 8개 파일 일괄 수정.
  사용자가 "3.3이 맞아"로 명시 확정.
- **home-c1 병합 확인**: 프론트엔드 세션의 홈 C-1(코랄 브랜딩·Pick 하트체크·SEED 타이포)이
  실제로 반영돼 있음을 Playwright 스크린샷으로 확인(스플래시만 보고 "디자인이 안 입혀졌다"고
  느낀 건 오탐이었음).
- **명세 정합화**: `docs/05-product-spec.md` 14·19·20·21·26·35번 항목의 "아직 없는 것"을
  실제 구현에 맞게 닫음. 24번(C-1 홈)을 옛 8슬롯 서술에서 실제 구조로 전면 재작성,
  D-Day/다음일정 배치 및 `sections.ts`/`home-edit.tsx` 고아 파일 처리를 열린 질문으로 추가.

### 변경 파일
scripts/progress.mjs, scripts/progress.config.json, docs/design-handoff/screens.md,
packages/db/migrations/0048_account_deletion.sql, 0049_ai_router.sql, 0050_objection_expiry.sql,
packages/domain/src/withdrawal.ts(+test), ai-router.ts, terms.ts, copy-rules.ts, vendor.ts,
apps/api/src/withdrawal.ts, routes/withdrawal.ts, analysis/pipeline.ts, objection-decide.ts,
objection-admin.ts, rebuttal-decide.ts, decisions.ts, verification-admin.ts, vendor-claim-admin.ts,
pii-admin.ts, inquiry-admin.ts, payment-proof-admin.ts(+test), routes/reviews.ts,
test/operator-authority.test.ts, packages/api-contract/src/withdrawal.ts, reviews.ts,
apps/mobile/.../my/withdrawal.tsx, .../write-review.tsx, 그 외 v3.3 문구 수정 8개 파일,
docs/05-product-spec.md.

### DB / Migration 변경
- `0048_account_deletion.sql`(옛 0045): reviews/price_reports/payment_proofs의
  author/reporter FK를 CASCADE→SET NULL, `deletable_accounts` 뷰,
  `document_retention_schedule`이 `users.deleted_at` 발생 시 원본을 강제 만료하도록 수정.
- `0049_ai_router.sql`(옛 0046): `structured.ai_usage.user_id` 추가.
- `0050_objection_expiry.sql`(옛 0047): `structured.review_visibility` 계산 뷰.
- **번호가 이미 한 번 밀렸음**: 원래 0045/0046/0047이었으나 home-c1 브랜치의
  `0045_wedding_region.sql`과 겹쳐 0048/0049/0050으로 밀어 코드·문서의 참조를 모두 고쳤음
  (grep으로 잔여 "0045/0046/0047" 자기참조 없음 확인).
  **그런데 main이 이후 독자적으로 자기 `0046_signup_consent.sql`~`0051_vendor_corrections.sql`을
  만들어(커밋 `cfcb81a`) 지금의 0048/0049/0050과 다시 겹침 — 아래 «충돌» 참고.**

### 테스트
`npm run typecheck` · `npm run lint` · `npm test` 전부 통과(최종 확인 시 1060개 테스트 통과,
DB 픽스처 재구성 후 재실행 포함). 신규 테스트: `withdrawal.test.ts`,
`operator-authority.test.ts`, `payment-proof-admin.test.ts` 등.

### 알려진 이슈 / 충돌 (PR #10, main과 충돌 미해결 상태로 오픈)
사용자가 명시적으로 **"충돌 그대로 PR만 열기"**를 선택함 — 병합 시도 중 발견한 진짜
전략 충돌을 이 세션이 임의로 해결하지 않고 그대로 남겼음. 다음 세션/리뷰어가 처리할 것:

1. **`packages/domain/src/withdrawal.ts` 이중 구현 (add/add 충돌, 사람 판단 필요)** —
   이 세션: 디자인 목업(WP-MY-008)을 그대로 구현한 완성형 UI 문구/함수.
   main: `WITHDRAWAL_NOTICE: string | null = null` · `privacyPolicyConfirmed()` ·
   `withdrawalReady()` 같은 **출시-게이트(release-gate) 접근** — 아직 정책이 확정 전이라
   기능 자체를 잠가두는 설계로 보임. **둘 중 하나를 버리는 게 아니라, main의 게이트 설계
   의도(정책 미확정 시 기능 잠금)와 이 세션의 완성된 문구를 합쳐야 할 가능성이 높음.**
   `withdrawal.test.ts`도 동일하게 add/add 충돌.
2. **마이그레이션 번호 재충돌**: 이 브랜치의 0048/0049/0050이 main의 자체
   0046~0051 배치와 겹침. main과 합칠 때 이 브랜치의 세 파일을 0052~0054(또는 그 이후
   빈 번호)로 다시 밀어야 함 — `git log --format="%ai %h %s" -- <path>`로 먼저 만들어진
   쪽을 남기고 나중 쪽을 미는 원칙 그대로 적용.
3. **그 외 파일 충돌(8곳 이상)**: 홈 화면들, `copy-rules.ts`, `terms.ts`,
   `disclosure.test.ts`, `packages/api-contract/src/index.ts`, `themed-text.tsx`,
   그리고 **이 문서(`docs/AI_HANDOFF.md`) 자체**도 main 쪽 버전(정책 v3.13, 빈 템플릿)과
   충돌 대상임 — 병합 시 이 세션 기록 섹션을 지우지 말고 main 쪽 최신 내용 아래에 이어붙일 것.

### 미완료
- PR #10 자체가 미완료 상태(충돌 미해결). 병합 전 위 충돌 3항목 처리 필요.
- `docs/design-handoff/README.md`에 반영한 회원탈퇴 최신 문구 규칙("남는 것" 대신
  "작성자 정보와 분리되는 정보")이 실제 반영된 곳은 이 세션의 `withdrawal.ts`뿐 —
  main 쪽 구현이 채택되면 그 문구 규칙도 다시 옮겨야 함.

### 다음 우선순위
1. PR #10의 `withdrawal.ts` 충돌부터 사람이 결정(정책 미확정 잠금 vs 완성 UI, 또는 병행).
2. 마이그레이션 0048/0049/0050 → main 기준으로 재번호.
3. 그 외 충돌 파일 병합, `npm run typecheck && npm test && npm run lint` 재확인 후 머지.
4. 사용자가 예고한 다음 세션 작업: **백엔드 관리자 — `apps/api/src/*-admin.ts` 10개 파일**을
   웹 UI 관리자 콘솔로 전환(현재 전부 CLI). 이번 세션에서 `operator-authority.test.ts`로
   권한 게이트를 먼저 굳혀뒀으므로 그 위에서 진행하면 됨.

### 변경 금지 / 주의 (이 세션 추가분)
- **회원탈퇴 자동삭제 로직**(`deletable_accounts` 뷰, `document_retention_schedule`의
  강제 만료)은 실제 개인정보 삭제 의무와 맞물려 있음 — 임의로 되돌리거나 조건을 완화하지 말 것.
- **NPay·네이버 로그인 노출**: 이 세션에서는 건드리지 않았음(정책 미확정 항목으로 추정,
  사용자가 다른 세션에 이 지침을 별도 전달할 예정이라 언급함 — 이 문서에는 아직 구체적
  범위가 없어 "손대지 말 것"만 남겨둠).
- **운영자 권한 게이트(`requireOperator`)를 우회하는 새 결정 도구를 추가하지 말 것** —
  6곳에 이미 적용됐고 패턴이 굳어짐(맨 앞에서 사람부터 확인, 대상 조회보다 먼저).
- PR #10을 머지하기 전에는 **이 브랜치의 마이그레이션 번호가 main과 겹친 상태**이므로,
  이 브랜치에서 새 마이그레이션을 추가로 만들 때도 번호 재확인이 필요함.

### 롤백
PR #10 전체를 되돌리려면 머지 커밋 하나를 revert. 부분 롤백이 필요하면 위 «완료» 목록의
각 항목이 서로 독립적인 커밋들로 나뉘어 있으므로 `git log --oneline`으로 개별 커밋 단위
revert 가능(회원탈퇴만 되돌리는 것은 권장하지 않음 — main의 게이트 구현과 합쳐질 예정이므로
먼저 위 충돌 해결 논의를 거칠 것).
