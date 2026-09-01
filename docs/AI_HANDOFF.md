# WeddingPick AI HANDOFF

## 기준
- updated_at: 2026-09-02
- author_ai: Claude Sonnet 5 (Claude Code)
- repository: WeddingPickl
- branch: main
- base_commit: f22a512 (이번 세션 작업 시작 시점 HEAD)
- last_verified_commit: cf07b15 (push 완료, origin/main과 일치)
- policy_version: v3.13

## 이번 작업 범위
- work_scope: SEED 디자인 핸드오프 정식 반영, 색·Radius 토큰 정합화, 앱 전체 UX 라이팅을 토스식 해요체로 통일, 화면마다 반복되던 로딩·오류 프레임을 공용 컴포넌트로 정리, 회원탈퇴 화면(안전 버전) 신규, 구글 로그인 제공자 추가. **화면 격차(176개 중 미구현분) 자체는 아직 손 안 댐** — 이번 세션은 디자인/문구 기반을 다지는 데 씀.

## 완료
- completed:
  - `docs/design-handoff/seed/`에 SEED 핸드오프(Claude Design, 코랄, 176화면) 정식 반영. 예전 Toss/blue v7 핸드오프는 `docs/design-handoff/archive-toss-v7-README.md`로 분리(참고용, 원본 `.dc.html`은 없음).
  - `packages/ui/src/theme.ts`의 색·Radius 토큰을 SEED 컴포넌트 시트(`웨딩픽 컴포넌트 시트.dc.html`)의 실제 hex/px 값으로 재정합. **Spacing(간격 스케일)은 아직 확인 안 함.**
  - `apps/mobile`·`packages/domain`의 사용자 노출 문구를 `~습니다/~합니다/~됩니다/~입니다` → `~해요`체로 전수 교체(주석·테스트·placeholder 예시는 제외). 관리자·백엔드 전용 파일(`retention-alert.ts`, `pii-admin.ts` 등)은 대상 아님.
  - `packages/ui/src/status-view.tsx`(`LoadingView`/`ErrorView`/`EmptyView`) 신설. capture·my·search·wedding 대부분 화면이 로컬 `Frame` 헬퍼 대신 이걸 쓰도록 교체.
  - `apps/mobile/src/app/(tabs)/my/withdraw.tsx` 신규 — 회원탈퇴 화면이지만 자동 삭제는 안 함(아래 "변경 금지" 참조), 문의 채널로만 연결.
  - Google Sign-In(OIDC) provider 추가(`apps/api/src/auth/identity-provider.ts` 등). 네이버는 스키마 enum에만 추가, 실제 노출은 아직 안 함.
  - 부수 발견한 기존 버그 2건 수정: `wedding-plan.test.ts`(시간대 의존 테스트), `data-sources.test.ts`(stale 기대값).

## 변경 파일
- changed_files: 커밋 4개로 나눠 push함
  - `f22a512` — packages/domain 문구 (18 files)
  - `bba48ed` — SEED 핸드오프 문서 + UI 토큰 + status-view (33 files)
  - `10ce66a` — 모바일 화면 문구 + status-view 적용 + withdraw.tsx (33 files)
  - `cf07b15` — Google 로그인 provider (8 files)
  - 상세는 각 커밋 메시지와 `git show --stat <hash>` 참조.

## DB / Migration 변경
- schema_or_migration_changes: `packages/db/migrations/0002_api.sql`의 `identity_provider` enum에 `google`, `naver` 추가(값만 추가, 파괴적 변경 없음). 그 외 이번 세션에서 만든 마이그레이션 없음.

## 테스트
- tests_run: `npm run typecheck --workspaces --if-present`(7개 워크스페이스), `npm run test --workspace @weddingpick/domain`, `npm run test --workspace @weddingpick/mobile`, `npm run lint --workspaces --if-present`
- test_results: 전부 통과. domain 792 tests, mobile 46 tests. cf07b15 이후 재실행 확인함.

## 알려진 이슈
- known_issues:
  - `.npm-cache/`가 git에 커밋되어 있음(캐시 blob 수천 개, `.gitignore`에도 없음) — 건드리지 않고 그대로 둠. 정리 필요하면 별도로 다룰 것.
  - `apps/web`은 정적 랜딩페이지 생성기 수준(`page.ts`/`content.ts`/`styles.ts` 7개 파일)이지 실제 웹앱이 아님 — 관리자 콘솔을 웹으로 만들려면 사실상 새로 시작.
  - `apps/api/src/*-admin.ts`(ad-admin, ai-cost-admin, decisions-admin, inquiry-admin, pii-admin, rebuttal-admin, retention-admin, reward-admin, vendor-claim-admin, verification-admin) 10개 파일은 Fastify HTTP 라우트로 등록돼 있지 않다 — CLI/유틸 함수 모음에 가깝다(`pii-admin.ts`는 실제로 `--by <user-id>` CLI 도구). "관리자 콘솔"을 만들려면 이 함수들을 HTTP 라우트로 감싸는 작업부터 필요할 수 있다 — 다음 세션에서 각 파일을 열어 실제 형태(HTTP 라우트인지 CLI인지)를 먼저 확인할 것.

## 미완료
- incomplete_tasks:
  - Spacing(간격) 토큰이 SEED 값과 정합화 안 됨.
  - SEED IA 176화면 중 다수 미구현. 단, **핸드오프를 기계적으로 따라가며 채우지 말 것** — `docs/design-handoff/seed/`가 176화면을 정의하지만, 실제 앱 구조(5탭 Root Nav, Pick 중심)와 통합정책(v3.13)이 이미 다르게 정한 부분이 여럿 있다(예: TOP3는 홈이 아니라 검색 탭, 취향 이미지 선택은 통합정책 v3.10 §3이 온보딩에서 뺌). **화면 하나 만들기 전에 관련 도메인 로직·코드 주석·통합정책부터 확인.**
  - 관리자 콘솔(WP-ADM, 19개 화면 스펙 — `docs/design-handoff/seed/웨딩픽 관리자.dc.html`) UI가 전혀 없음. 백엔드 쪽도 위 "알려진 이슈"처럼 HTTP 라우트 여부부터 확인 필요.
  - 박람회(WP-EXPO)·월간 웨딩지원금/NPay(WP-EVT 일부): 백엔드 데이터 모델 자체가 없거나(박람회) 정책상 명시적으로 보류 중(NPay — `통합정책 v3.13`이 "이벤트 구현 전에 개인정보 처리방침과 같이 정리해야 한다"고 명시). **만들지 말 것.**

## 다음 우선순위
- next_priority: **백엔드 관리(관리자) 작업.** 사용자가 2026-09-02에 이걸 다음 순서로 명시적으로 지정함.
  1. 먼저 `apps/api/src/*-admin.ts` 10개 파일을 각각 열어 실제 형태(HTTP 라우트인지 CLI 유틸인지)와 이미 있는 기능 범위를 파악한다.
  2. `docs/design-handoff/seed/웨딩픽 전체 IA.dc.html`의 JS 배열 `G`에서 `no: '18'`(관리자) 섹션, 그리고 `웨딩픽 관리자.dc.html`로 목표 화면 스펙을 확인한다(관리자 홈·데이터 큐·사용자·성장·운영·시스템 6개 그룹, 19개 화면).
  3. 시작 전 사용자에게 확인할 것: (a) 관리자 콘솔을 `apps/web`에 새로 만들지, 별도 앱으로 뺄지 (b) 우선 만들 화면 그룹(데이터 처리 현황·사용자 관리 등 중 어디부터) (c) 인증 방식(관리자 로그인은 일반 사용자 인증과 분리해야 하는지).
  4. 위 확인 없이 기계적으로 19개 화면을 다 만들지 말 것 — 이번 세션에서 반복해서 배운 교훈(미완료 항목 참조)과 같은 이유.

## 변경 금지 / 주의
- do_not_change:
  - **회원탈퇴 자동 삭제 백엔드를 만들지 말 것.** `packages/domain/src/withdrawal.ts`의 `WITHDRAWAL_NOTICE`가 개인정보처리방침 확정 전까지 `null`인 명시적 게이트다. 스키마상 `structured.users` 하드 삭제는 FK CASCADE로 확인된 정보(quotes)까지 지운다 — 위험. `payment_proofs`/`price_reports`를 "통계 제외"할지 "익명화 유지"할지도 정책 §46이 명확히 안 정했다. 이 정책들이 정해지기 전엔 손대지 말 것.
  - NPay·월간 웨딩지원금 기능을 만들지 말 것(위 미완료 항목 참조, 개인정보 처리방침과 함께 정리해야 함).
  - 소셜 로그인 관련 파일(`identity-provider.ts`, `config.ts`, `client.ts` 등)은 이번 세션에서 커밋됐지만, **네이버는 아직 실제 제공자 목록에 노출 안 함** — 서버 콜백·토큰 교환 API가 따로 필요하다(`docs/social-login-handoff.md` 참조). 임의로 노출시키지 말 것.
  - `docs/design-handoff/seed/`는 원본 그대로 유지 — 화면 구현할 때 이 폴더 안의 `.dc.html` 파일을 직접 고치지 않는다(참고용 원본).

## 롤백
- rollback_note: 커밋 4개(`f22a512`, `bba48ed`, `10ce66a`, `cf07b15`)는 서로 기능적으로 독립적이라 필요하면 개별 `git revert <hash>`로 되돌릴 수 있다. 순서상 뒤 커밋이 앞 커밋의 파일을 다시 건드리지 않으므로 역순 revert도 안전하다. 전부 origin/main에 push 완료 — 로컬에만 있는 미커밋 변경 없음(`.npm-cache/` 잡음 제외).
