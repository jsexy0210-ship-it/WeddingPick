# WeddingPickl AI 인수인계서

> 이 파일은 모든 Claude 세션이 읽는 **단일 진실 소스**다.
> 새 세션이 시작되면 이 파일을 먼저 읽어라. 작업이 끝나면 이 파일을 업데이트하고 커밋해라.

---

## 메타

- `updated_at`: 2026-09-02 (프론트엔드 착수 세션 갱신)
- `repository`: jsexy0210-ship-it/WeddingPickl
- `branch (main)`: d1915fd
- `policy_version`: 통합정책 v3.14
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
- `docs/통합정책 v3.14`와 실제 탈퇴 구현의 정합성을 확인.

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
적용 대상: `0001_init.sql` ~ `0061_wedding_expos_guide.sql` (미션 완료 추적·월간 웨딩지원금 추첨, 회원탈퇴, AI 라우터, 취향, 박람회·웨딩 정보 등)

**✅ 트랜잭션 버그도, 그 뒤에 생긴 스키마 중복도 고쳐져 main에 있다.** 두 단계로 있었던 문제:
1. 원래 `0052_mission_draw.sql`이 `ALTER TYPE reward_kind ADD VALUE 'monthly_draw'`를 같은
   트랜잭션 안에서 바로 쓰는 CHECK 제약에 써서 "unsafe use of new value of enum type"으로
   매번 실패했었다.
2. 그 뒤 같은 정책(§31 월간 웨딩지원금)을 다른 세션이 `0047_monthly_draw.sql`로 독자적으로
   다시 구현하면서, 옛 0052 스키마(`mission_completions`·`monthly_draws`·`draw_entries`
   등)와 새 0047 스키마(`monthly_draw_entries`)가 둘 다 `reward_grants.draw_entry_id`
   컬럼을 만들려고 해 "column already exists"로 막혔다(PR #27로 해소 — 0052는 어차피 코드
   어디에서도 참조되지 않던 죽은 스키마였음이 확인돼 완전히 제거, 0047이 유일한 구현으로 남음).

`front-dev-start-nrr0jh` 세션이 두 문제를 각각 main에서 직접 재현·확인한 뒤(로컬 Postgres 16에
실제 파일을 우회 없이 적용) main을 두 차례 병합해 반영, 최종적으로 0001~0061 전체가 새 DB에
그대로 적용됨을 재확인했다. 그대로 `db-migrate.yml` 실행하면 된다.

### 4. 앱스토어 출시 블로커 — terms.url / privacy.url
`assertReleasable('production')`이 `terms.url` · `privacy.url` 미설정 시 throw → 앱스토어 출시 불가.  
URL 확정 후 도메인 상수(`packages/domain/src/constants/policy.ts` 또는 유사 위치) 업데이트 필요.  
`privacy.url`이 설정되면 `withdrawalReady() = true`로 릴리즈 게이트 자동 통과. 별도 코드 수정 불필요.

### 5. Gmail 커넥터 연결
Google 개발자 콘솔 알림 자동화 세션이 Gmail 미연결로 차단됨.  
claude.ai Settings → Connectors → Gmail 연결 필요.

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

### 프론트엔드 착수 (session_01Xes21U5Fgf21B7PunjSyeJ) — 실행 중 (Sonnet 5)
**브랜치**: `claude/front-dev-start-nrr0jh`  
**완료:**
- ✅ 스플래시 심볼 88px → 64px 수정 (`features/splash/splash-view.tsx`)
- ✅ 화면별 상태 표 재검증: #13 등록 완료, #19 설정 가격변동 알림 Switch — 이미 정상 구현 확인, ✅로 갱신
- ✅ #9 비교함의 "순위 안 매김"·"의견 공유하기"는 SEED 핸드오프 어디에도 근거 없음 확인 — 폐기된 Toss v7 참고였을 가능성, 재확인 불필요로 정리
- ✅ AI 우선순위 5번(회원탈퇴·일정 추가·지도 보기·취향 재선택) 각각 착수 가능 여부 실사 — 4개 전부 순수 프론트엔드로 못 끝냄(정책 게이트·API 부재·데이터 모델 부재), 사유를 우선순위 섹션에 기록
- ✅ 공통 Bottom Sheet(WP-SHT-*) 16종 + 공통 상태(WP-ST-*) 14종 전수 조사(Explore 서브에이전트) 후 순수 프론트엔드로 가능한 것부터 구현:
  - 신규: `packages/ui/src/bottom-sheet.tsx`(`BottomSheet` 껍데기), `packages/ui/src/info-sheet.tsx`(`InfoSheet`·`InfoButton`), `packages/domain/src/share.ts`(공유 문구·앱스킴 링크, 테스트 포함)
  - WP-SHT-002 Pick 완료: `search/[vendorId]/index.tsx`에 시트 추가(Pick 목록 보기·계속 둘러보기), 로그인 경유 완료 시에도 동일하게 뜸
  - WP-SHT-003 Pick 해제 확인: 기존 `Alert.alert` 유지(이미 컨펌 있음) + `pick/index.tsx`에서 배우자 연결 상태(`getWedding`) 조회해 "배우자도 함께 보던 곳" 안내 추가
  - WP-SHT-005 최종 결정 확인: `pick/index.tsx`에 `Alert.alert` 컨펌 추가("나중에 결정 되돌리기로 다시 바꿀 수 있어요") — 기존 화면들이 이미 Alert로 파괴적 동작을 확인받는 관례를 그대로 따름, 새 컴포넌트 안 만듦
  - WP-SHT-011 공유: 업체상세·비교 화면에 "공유하기" 버튼 추가, `Share.share()`(OS 공유 시트)로 처리 — 카카오톡 SDK나 클립보드 패키지가 없어 OS 시트가 그 역할을 대신함(iOS는 복사도 그 안에 있음), 커스텀 시트는 중복이라 안 만듦
  - WP-SHT-014·015 데이터·기준금액 설명: 업체상세 "확인된 정보"·"기준금액" 옆에 ⓘ 추가, `InfoSheet`로 설명. `BASE_AMOUNT_HELP`(기존 상수, 그동안 미사용)를 처음 연결. `VERIFIED_DATA_HELP` 신규 추가(`terms.ts`)
  - WP-SHT-016 권한 요청 설명: `capture/camera.tsx`에서 `canAskAgain`으로 "아직 안 물어봄"과 "이미 거부당함"을 분리 — 전자는 허용/나중에, 후자는 WP-ST-011대로 설정으로 이동
  - WP-ST-011 권한 거부: `Linking.openSettings()`를 `capture/camera.tsx`·`capture/index.tsx`·`capture/payment/register.tsx`에 연결(이전에는 "설정에서 켜주세요" 문구만 있고 이동 버튼이 없었음)
  - WP-ST-013 긴 콘텐츠: `search/index.tsx`(자동완성·TOP3·광고·업체·플래너 카드)·`pick/index.tsx`·`search/compare.tsx`의 업체명에 `numberOfLines`+`ellipsizeMode="tail"` 추가
  - 손대지 않고 넘긴 것(이유 있음): WP-SHT-004(비교 후보 선택)·WP-SHT-013(신고)은 기존 인라인 구현으로 스펙 충족 판단, 새 시트로 안 바꿈 / WP-SHT-006~008(예식일·지역·예산 입력 고도화, 시군구·GPS·구간칩)은 `setup.tsx`의 `weddingDate: string`(nullable 아님) 데이터 모델을 건드려야 해서 보류 / WP-ST-007(로딩)·WP-ST-008(Empty)·WP-ST-009(오류)·WP-ST-002(커플상태)·WP-ST-003(Pick상태)은 이미 잘 구현되어 있음을 확인만 함 / WP-ST-005(데이터 상태 단계)는 `NOT_ENOUGH_DATA` 등 미사용 상수와 별개로 `vendor.prices.paidPrice.stage`(collecting/detailed)로 이미 실질 구현되어 있음을 확인
  - 차단(백엔드·정책·미설계 데이터모델, 이번 세션에서 시도 안 함): WP-SHT-009(취향 이미지 Pick, 취향수집 시스템 자체 없음) · ~~WP-SHT-012(캘린더 등록)~~ 아래 박람회 작업에서 해소 · WP-ST-006(혜택 상태, `priority.ts` 주석에 "없는 혜택을 말할 수 없다"로 명시) · WP-ST-010(네트워크 오류, `NetInfo` 등 새 의존성 필요 — 이번 세션은 새 패키지 설치 없이 진행) · WP-ST-014(점검·강제업데이트, 백엔드 API 필요) · WP-ST-004(이미지 상태, 이미지 자체가 없는 텍스트 전용 설계라 해당 없음)
  - 검증: `apps/mobile`·`packages/domain`·`packages/ui` 전부 `tsc --noEmit` 통과, `apps/mobile`(46개)·`packages/domain`(797개, 신규 5개 포함) 테스트 전부 통과, 변경 파일 eslint 통과
- ✅ 박람회·웨딩 정보(WP-EXPO-001~004) 풀스택 구현 — 순수 프론트엔드가 아니라 DB·API부터 새로 만든 유일한 화면군이다. 콘텐츠는 운영이 올리는 공개 정보(업체·플래너와 같은 자리)라 사용자별 소유자가 없다.
  - DB: `packages/db/migrations/0061_wedding_expos_guide.sql`(2026-09-02 main 병합 때 `0053_wedding_expos_guide.sql`→`0060`, 그다음 두 번째 병합 때 다시 `0061`로 재번호 — 아래 "main 병합·재번호" 항목 참조) — `structured.wedding_expos`(박람회), `structured.wedding_guide_articles`(웨딩 정보, `stage`는 `LIFECYCLE_STAGES`와 값을 맞춤). 로컬 Postgres 16에 (당시 있던 0052 버그를 우회한 임시 스플릿 마이그레이션으로) 직접 적용해 스키마·인덱스·제약을 확인했었고, 병합 후 0001~0061 전체를 우회 없이 그대로 적용해 재확인함.
  - API 계약: `packages/api-contract/src/expos.ts`, `guide-articles.ts` — `planners.ts`와 같은 모양(값마다 source·lastVerifiedAt)
  - API: `apps/api/src/routes/expos.ts`, `guide-articles.ts` — `planners.ts`의 커서 페이지네이션 패턴을 그대로 따름. 로그인 없이 접근 가능(Level 1). `server.ts`에 등록 완료. 커밋된 jest 테스트(`apps/api/src/test/expos.test.ts`, `guide-articles.test.ts`)는 다른 DB 연동 테스트와 같은 조건(`DATABASE_URL`)에서만 돈다 — 작성 당시엔 0052 버그로 `resetDatabase()`가 막혀 스크래치 하네스로만 확인했었고, 이제 0052가 고쳐져 커밋된 jest 그대로 돈다.
  - 도메인: `packages/domain/src/calendar-links.ts`(Google·Outlook 캘린더 등록 링크 — Apple은 `.ics` 생성이 필요해 이번 범위 밖, 테스트 포함)
  - 모바일: `search/expos/index.tsx`(목록, 지역 필터·기본 지난 일정 제외)·`search/expos/[expoId].tsx`(상세, WP-SHT-012 캘린더 등록 시트·기기 로컬 알림 포함)·`search/guide/index.tsx`(목록, 준비단계·카테고리 필터)·`search/guide/[articleId].tsx`(상세, 카테고리 있으면 검색으로 연결). `search/index.tsx`에 진입 버튼("박람회"·"웨딩 정보") 추가
  - 로컬 알림: `features/expos/expo-reminder.ts` — 박람회 시작 하루 전 기기 로컬 알림(서버 푸시 아님, `expo-notifications`의 `scheduleNotificationAsync`+`SchedulableTriggerInputTypes.DATE` 사용 — v57 API라 `AGENTS.md` 경고대로 타입 정의를 직접 확인하고 씀)
  - "관련 체크리스트"(WP-EXPO-004)는 구현 안 함 — 준비단계 태그와 웨딩 체크리스트 항목을 잇는 매핑이 없어 억지로 이으면 근거 없는 연결이 됨. "Pick 연결"은 관련 카테고리로 검색 결과를 좁혀 보내는 것으로 대신함(특정 업체를 짚어 보내면 과장)
- 🐛 **발견 당시엔 고치지 않음, 이후 해소됨: `packages/db/migrations/0052_mission_draw.sql`이 원래 실제로 실행하면 실패했다.** `ALTER TYPE reward_kind ADD VALUE 'monthly_draw'` 뒤, 같은 파일(=같은 트랜잭션) 안에서 그 값을 CHECK 제약(`grant_source_matches_kind`)에 바로 써서 PostgreSQL이 "unsafe use of new value of enum type"으로 막았다(빈 DB에서 직접 재현). 발견 당시엔 다른 세션이 소유한 진행 중 기능이라 손대지 않고 문서만 남겼는데, 백엔드 세션(`daily-progress-briefing-3k7lez` 브랜치, PR #10)이 독립적으로 같은 버그를 발견해 0052를 트리밍하고 `0053_reward_kind_monthly_draw.sql`(enum 값 추가)·`0054_grant_source_matches_kind.sql`(그 값을 쓰는 제약)로 분리해 고쳤고, main에 병합됐다.
  - **후속 발견(2026-09-02, 아래 "main 병합·재번호" 항목 참조): 그 직후 또 다른 세션이 같은 정책(§31 월간 웨딩지원금)을 `0047_monthly_draw.sql`로 독자적으로 다시 구현하면서, 옛 0052 스키마와 새 0047 스키마가 둘 다 `reward_grants.draw_entry_id` 컬럼을 만들려 해 "column already exists"로 또 막혔다.** 이번에도 빈 DB에서 직접 재현·확인 후 컨트롤 타워 세션에 알렸고, PR #27로 해소됨 — 0052 쪽(mission_completions·monthly_draws·draw_entries·draw_results·npay_deliveries)이 코드 어디에서도 참조되지 않는 죽은 스키마였음이 확인돼 완전히 삭제되고, 0047(`monthly_draw_entries`)이 유일한 구현으로 남았다.
  - **2026-09-02 이 세션이 main을 두 차례 병합**하며 매번 로컬 Postgres 16에 실제 마이그레이션 디렉터리를 우회 없이 그대로 적용해 재확인함 — 최종적으로 0001~0061 전부 성공, 더 이상 버그 아님. 스키마가 바뀌면서 이 세션이 만든 `apps/web/src/admin/pages/rewards.ts`(0052 스키마를 읽고 있었음)도 0047 스키마로 다시 씀 — 아래 참조.
- ✅ 관리자 화면(WP-ADM-*) 착수 — 사용자에게 범위·플랫폼 먼저 확인받음(25개 전부·위험한 동작까지 한 번에 자동 구현하는 대신 **읽기 전용 화면부터**, **`apps/web`에 관리자 웹**으로). 착수 전 확인한 것: 지금 "관리자"는 화면이 아예 없고, `is_operator` DB 컬럼과 CLI 스크립트(`apps/api/src/decisions-admin.ts` 등, `DATABASE_URL`을 쥔 사람이 직접 돌림)뿐이었다. `apps/web`은 정적 HTML 한 장(자바스크립트·서버 없음)이라 그 모양 그대로는 인증된 동적 대시보드를 못 담아 — 같은 워크스페이스 안에 `apps/api`와 같은 자리(Fastify)의 **별도 서버**를 새로 뒀다(`apps/web/src/admin/`, 랜딩의 `build.ts`/`page.ts`는 안 건드림).
  - 인증: HTTP Basic Auth 하나(`admin`/`ADMIN_PASSWORD`, 상수시간 비교) — 소셜 로그인 재구현 대신. 지금 운영의 CLI 직접 접근보다 이미 더 좁힌 것이라 판단.
  - 구현한 5개: WP-ADM-001(관리자 홈)·002(일일 브리핑)·040(자동화 상태)·052(감사 로그, 사건 id 검색 포함)·020(사용자 계정). 전부 이미 있는 표·뷰(`structured.decisions`·`open_decisions`·`active_users`)를 그대로 읽음 — 새 마이그레이션 없음. 브리핑·자동화 상태 쿼리는 `decisions-admin.ts`의 `--briefing`·`--open`과 동일.
  - 명시적으로 안 만든 것: Kill Switch(041)·Policy Engine 편집(051)·롤백(042)·광고 실운영 전환(034)·광고 집행 관리(033) — 전부 실제 돈·운영에 영향 주는 파괴적 동작이라, 계정 하나짜리 공유 비밀번호로 지킬 계층이 아니라고 판단해 이번 범위에서 제외. 나머지 읽기 전용 화면(WP-ADM-010/011/012/013/014/015/016/021/022/023/030/031/032/050, 약 14개)은 시간 관계상 다음 세션으로.
  - 검증: `server.test.ts` 11개 — 로컬 Postgres에 직접 붙여 인증 거부/통과, XSS 이스케이프(감사 로그 검색창에 `<script>` 넣어 확인), 데이터 집계까지 실행해서 통과 확인. **0052 버그 영향 없음** — `resetSchema()`(→`migrate()`)를 쓰지 않고 이 파일이 쓰는 표만 TRUNCATE하는 자체 리셋을 씀.
  - 배포: `fly.admin.toml` 추가(앱 `weddingpick-admin`, 포트 3100). **`fly apps create weddingpick-admin` 및 시크릿 설정은 사용자 조치 필요** — 아래 우선순위 참조.
  - 문서: `apps/web/README.md`에 "관리자 웹" 절 추가.
- ✅ 관리자 화면 나머지 읽기 전용 착수 계속 진행(사용자가 "나머지 14개도 이어서 진행해" 지시) — DB 스키마 조사(Explore 서브에이전트)로 14개 각각의 실제 백엔드 데이터 유무를 확인한 뒤, 데이터가 실제로 있는 9개만 구현하고 5개는 명시적으로 건너뜀.
  - 구현한 9개: WP-ADM-010(데이터 처리 현황, `import_runs`·`import_errors`·`import_switches`)·012(가격통계, `stats.price_stats`)·014(업체 관리, 영업상태 + `vendor_change_log`)·015(이미지 자동수급, `vendor_images`)·021(VOC, `inquiries`)·022(후기·반론, `review_reports` + `review_rebuttals`)·023(업체 문의 큐, `vendor_claims` + `vendor_corrections`)·031(캠페인·보상, `reward_grants` + 미션 + 월간 추첨)·050(AI 사용량·비용, `ai_usage_monthly`/`ai_budget_status` — `ai-cost-admin.ts`와 완전히 같은 쿼리). 총 14/25 완료.
  - 건너뛴 5개(WP-ADM-011·013·016·030·032) — **DB에 백엔드 데이터 자체가 없음을 확인**하고 건너뜀, 빈 화면이나 지어낸 숫자로 채우지 않음:
    - 011 확인 필요 큐: 자동 교차검증 신뢰도 점수를 매기는 표가 없음(`vendor_corrections`는 있지만 confidence 컬럼 없음)
    - 013 이상치·조작 탐지: 계정 군집·이미지 반복·금액 군집 탐지 표가 전혀 없음(`draw_entries.abuse_status`만 있고 월간 추첨 응모에만 좁게 적용됨)
    - 016 이메일 회신 자동매칭: 인바운드 이메일 파싱·매칭 표가 전혀 없음
    - 030 마케팅 자동화: 소재 생성·채널 게시 표가 전혀 없음
    - 032 Revenue: 획득비용·리드·기여이익 퍼널 표가 전혀 없음(`ads.launch_reports`는 광고 실운영 전환 판단이지 매출 집계가 아님)
  - `structured.monthly_draws` 등(0052) 관련 화면(캠페인·보상)은 그 표가 production에 아직 없을 수 있음을 감안해 `to_regclass()`로 존재 확인 후 없으면 안내 문구만 보여주도록 방어적으로 짬 — 0052 버그가 고쳐지기 전에도 이 화면 자체는 깨지지 않음.
  - 검증: `server.test.ts` 총 20개(기존 11 + 신규 9) — 로컬 Postgres로 전부 통과. `copy-rules.test.ts`가 새 페이지의 "표본" 사용을 잡아내 "데이터"로 고침(내부 관리자 도구라도 카피 규칙은 앱 전체에 적용됨을 확인).
  - nav·홈 바로가기 목록에 9개 추가. `apps/web/README.md` 갱신.
  - 2026-09-02 실제로 서버를 띄워 재검증: 로컬 Postgres에 이 브랜치의 마이그레이션(0001~0060)을 적용한 뒤 `admin:start`로 실행, 14개 페이지 전부 인증 통과 시 200·실제 콘텐츠 렌더 확인(그동안은 jest만으로 검증했었음).
- ✅ 남은 미구현 화면 카테고리(B2B 문의·커플 연결·우리웨딩·홈·기타) 재조사(Explore 서브에이전트) 후 실제로 가능한 것부터 구현:
  - **WP-OUR-013 예식 완료**: 이미 다 있었다 — `packages/domain/src/wedding-phase.ts`의 `COMPLETED_ACTIONS`(후기·미제보 결제내역·총지출 정리 문구)와 홈 화면의 `!showsPreparationFirst(stage.stage)` 분기가 예식 뒤 홈에 이미 뜨고 있었는데, 그 세 줄이 눌러도 아무 데도 안 가는 텍스트였다. `app/(tabs)/index.tsx`에 `goToCompletedAction()` 추가해 각각 `/pick`(후기 대상 고르기)·`/capture/payment/consent`(결제내역 등록)·지출내역 화면으로 연결. 새 화면도 새 API도 필요 없었다. **⚠️ 2026-09-02 main 병합 때 이 배선이 사라짐** — 다른 세션이 홈 화면 전체를 `디자인 확정본 웨딩픽 홈 C-1 상태`로 새로 설계(`features/home/state.ts`의 `homeView()`, `GuestHome`/`MemberHome` 분리)하면서 갈아엎었는데, 그 확정본의 5개 상태(`guest`/`taste`/`empty`/`picking`/`decided`)에는 예식 완료(post-wedding) 상태가 아예 없다. 병합 충돌에서 이 세션의 옛 코드 대신 새 확정본을 그대로 채택했다(도메인 레이어의 `COMPLETED_ACTIONS`는 그대로 남아 있고 테스트도 통과 — 화면에서만 안 씀). **판단 근거를 지어내지 않기 위해 다시 배선하지 않았다** — 이 확정본이 post-wedding을 의도적으로 뺀 건지 다음 단계로 미룬 건지 이 세션은 알 수 없다. 다음 세션이 홈 설계 담당자에게 확인 필요.
  - **WP-OUR-012 준비 타임라인**: 핸드오프 원문 "Pick·최종결정·일정·지출·완료 기록을 시간순으로"는 `tasks.tsx`에 이미 있던 7단계 진행률 점(라이프사이클 stage 표시)과 다른 것이었다 — 그건 "지금 어느 단계인지"고, 이건 "그동안 뭘 했는지"의 시간순 기록. 새 DB 없이 기존 네 표(`vendor_candidates`·`category_decisions`·`expenses`·`wedding_tasks`)에서 시간과 함께 저장된 값만 모으는 새 집계 API를 만듦:
    - API: `apps/api/src/routes/wedding-timeline.ts` `GET /v1/weddings/:weddingId/timeline` — 네 표를 병렬 조회 후 시간순 병합. 기본 열넷(preset_key 있는 task)은 사용자 행동이 아니라 자동 시딩이라 제외. **"완료 기록"은 못 낸다** — `wedding_tasks`가 완료 시각을 저장하지 않아 지어낼 수 없어서 뺐다(코드 주석에 명시).
    - 계약: `packages/api-contract/src/wedding-timeline.ts` — kind별 discriminated union.
    - 모바일: `wedding/[id]/timeline.tsx` 신규 화면 + `tasks.tsx`의 라이프사이클 카드에 "지금까지 한 일 보기" 링크 추가.
    - 검증: `apps/api/src/test/wedding-timeline.test.ts`(로그인 필요·빈 상태·시간순 병합·기본 열넷 제외·타인 접근 403) — 작성 당시엔 0052 버그로 `resetDatabase()`가 막혀 스크래치 하네스로만 확인했었고, 0052가 고쳐진 뒤 커밋된 jest로 재확인 통과.
  - **WP-HOME-004 TOP3 전체보기**: 미구현이 아니라 **해당 없음**으로 확인 — `index.tsx`에 "TOP3 성격의 탐색은 검색 탭에 있다(홈 C-1)"는 명시적 코드 주석이 있다. 홈에 TOP3 섹션 자체를 안 두기로 한 의도된 결정. 손대지 않음.
  - 손대지 않고 넘긴 것(정책·백엔드 필요): WP-BIZ-005(자료 제공)·006(혜택 등록)·007(광고·제휴) — DB·API·화면 전부 없음, 특히 006·007은 실제 돈이 오가는 B2B 계약 조건이라 스키마부터 임의로 설계하지 않음 / WP-CPL 공동편집충돌·변경내역 — `wedding_plan` 관련 표에 버전/이력 컬럼이 아예 없고, "충돌"이 뜻하는 바 자체가 정책 결정 필요 / WP-HOME-006 개인화 웨딩피드 — `wedding_expos`·`wedding_guide_articles`(오늘 앞서 만듦)로 콘텐츠는 채울 수 있지만 "개인화" 랭킹 로직은 제품 결정이 필요해 손대지 않음
  - 부수 발견: `packages/domain/src/terms.ts`의 `VERIFIED_DATA_HELP`(이전 세션에 추가)가 "결제하신 분들이..." 문구를 써서 `apps/api/src/test/pick-language.test.ts`(v3.13 §O-1, 사용자 앱에서 `결제` 금지)를 어기고 있었다 — 오늘 처음 전체 `apps/api` 테스트를 돌려보고서야 걸림. "낸 금액을..."로 고침. **교훈: 새 사용자 노출 문구를 추가할 때마다 `pick-language.test.ts`와 `copy-rules.test.ts`를 반드시 함께 돌려야 한다** — 하나(카피 금지어)만 확인하고 다른 하나(결제 금지어)를 놓쳤다.
  - 검증: `apps/mobile`·`packages/domain`·`packages/api-contract`·`apps/api` 전부 `tsc --noEmit` 통과. `apps/mobile`(46)·`packages/domain`(801) 테스트 통과. `apps/api`는 `DATABASE_URL` 없이 돌려 새 테스트가 정상적으로 skip되는 것과 기존 실패 2건(사전부터 있던 것, 무관)만 남는 것을 확인.
- ✅ **사용자 지시 "0052 마이그레이션 버그 고쳐줘"에 착수했다가, main에 이미 같은 수정이 병합돼 있음을 발견해 main 병합으로 방향 전환** — 사용자에게 진행 방식을 확인받고("main 병합 후 번호 재정렬") 진행:
  - 처음엔 이 세션이 직접 0052를 트리밍하고 0054/0055로 분리하는 수정을 만들었으나, 커밋 전에 `origin/main`을 다시 확인해보니 백엔드 세션(PR #10)이 독립적으로 같은 버그를 찾아 이미 고쳐 병합해둔 상태였다(0052 트리밍 + `0053_reward_kind_monthly_draw.sql`·`0054_grant_source_matches_kind.sql`) — 직접 만든 수정은 버리고 main 것을 채택.
  - 이 브랜치(`claude/front-dev-start-nrr0jh`)가 main보다 165 커밋 뒤처져 있었고, main이 0053~0059를 이미 다른 기능(reward_kind 수정·회원탈퇴·AI 라우터·이의제기·탈퇴 관리자·소셜 프로필)에 쓰고 있어 이 세션이 만든 `0053_wedding_expos_guide.sql`과 번호가 충돌 — `origin/main`을 이 브랜치에 merge하고, 충돌 3건(`packages/domain/src/terms.ts`, `app/(tabs)/index.tsx`, `search/[vendorId]/index.tsx` — 전부 import 목록·카피 정책(v3.3 `데이터`→`정보`) 수준, 로직 충돌 아님) 해소, `0053_wedding_expos_guide.sql`→`0060_wedding_expos_guide.sql`로 재번호.
  - `app/(tabs)/index.tsx` 충돌에서 이 세션이 만든 WP-OUR-013 배선(`goToCompletedAction`)은 다른 세션의 홈 화면 재설계(확정본)에 밀려 버렸다 — 위 WP-OUR-013 항목의 ⚠️ 참조.
  - 검증(1차, 병합 직후 재사용 DB에서): 로컬 Postgres 16에 실제 마이그레이션 디렉터리(우회 없이)를 0001~0060 전체 적용 — 전부 성공. `packages/db` 스키마 테스트 79/79 통과(멱등성 포함). `packages/domain`(828)·`packages/api-contract`·`packages/ui`·`apps/mobile`(66)·`apps/web` 전부 `tsc --noEmit` 통과, mobile·domain 테스트 전부 통과.
  - 검증(2차, `apps/api` 전체 — **완전히 새 DB**로): 처음 이미 한 번 수동 마이그레이션한 DB를 재사용해 486/496으로 나왔던 결과는 `resetDatabase()`가 기대하는 상태와 어긋난 오탐이었다 — 완전히 새 DB(`createdb`부터)로 다시 돌리니 **`apps/api` 566개 중 564개 통과**, 실패 2건은 이 병합이 main에서 새로 가져온 화면(`wedding/[id]/quotes.tsx`, `wedding/index.tsx`, `search/[vendorId]/price-report.tsx` — 이 세션이 만들지 않음)이 `pick-language.test.ts`(v3.13 §O-1/§O-10, `결제`·`견적`·`계약서` 금지)를 어기고 있던 것 — "결제 인증"→"Pick 인증", "견적·계약서"→"Pick 인증 자료"로 고쳐 566/566 전부 통과 확인.
  - 커밋: `packages/db/migrations/0060_wedding_expos_guide.sql`(재번호) + 병합 자체(main→이 브랜치) + 위 3개 화면의 금지어 수정.
- ✅ **후속: main에서 두 번째 마이그레이션 충돌 발견·보고, PR #27로 해소 후 재병합** — 위 검증을 마치고 대기하던 중 `origin/main`을 다시 확인하다가 새 문제를 발견:
  - 다른 세션(PR #22, "웨딩픽 통합 컨트롤 타워")이 §31 월간 웨딩지원금을 `0047_monthly_draw.sql`로 독자적으로 다시 구현했는데, 옛 `0052_mission_draw.sql` 스키마와 둘 다 `reward_grants.draw_entry_id` 컬럼을 만들려 해 완전히 새 DB에서 "column already exists"로 마이그레이션이 처음부터 막힘 — 빈 DB에서 직접 재현·확인(두 번, Postgres 재시작 후 재확인 포함).
  - 코드 참조를 그레핑해 0047(`monthly_draw_entries`, `apps/api/src/routes/rewards.ts`가 실제로 씀)이 살아있는 구현이고 0052 쪽(`mission_completions`·`monthly_draws`·`draw_entries`·`draw_results`·`npay_deliveries`)은 main 어디에서도 참조되지 않는 죽은 스키마임을 확인 — 어느 쪽을 지울지는 이 세션이 정할 문제가 아니라 "웨딩픽 통합 컨트롤 타워" 세션에 근거와 함께 보고(직접 메시지 API가 없어 사용자가 붙여넣는 방식으로 전달).
  - 해당 세션이 PR #27로 해소(0052 완전 삭제, 0047만 남김, `0059_taste_preferences.sql`→`0060`으로 재번호도 함께 정리) — 다시 빈 DB에서 재현해 고쳐졌음을 재확인 후 `origin/main`을 이 브랜치에 두 번째로 merge.
  - 이번엔 main의 `0060_taste_preferences.sql`과 이 브랜치의 `0060_wedding_expos_guide.sql`이 겹쳐 `0061_wedding_expos_guide.sql`로 다시 재번호. 충돌은 `app/(tabs)/wedding/index.tsx` 1건(카피 문구, "AI가" 유무 — 이전에 뺀 쪽을 유지)뿐.
  - **`apps/web/src/admin/pages/rewards.ts`가 삭제된 0052 스키마(`missions_all_done`·`monthly_draws`·`draw_entries`·`draw_results`)를 읽고 있어서 그대로 뒀으면 관리자 화면이 깨질 뻔했다** — 0047 스키마(`monthly_draw_entries`)로 다시 씀: "4개 미션 완료" 카드는 저장된 표가 없어져 `apps/api/src/routes/rewards.ts`의 즉석 판정 조건(예식일·지역·Pick·비교·배우자 연결)을 그대로 옮긴 집계 쿼리로 대체, 추첨 회차 표는 `monthly_draw_entries`를 `draw_month`로 묶고 `reward_grants.kind='monthly_draw'`인 것만 당첨으로 셈(1인 지급액·정원은 이제 DB 컬럼이 아니라 `packages/domain/src/monthly-draw.ts`의 고정 상수).
  - 검증: 로컬 Postgres 16에 이 브랜치의 마이그레이션(0001~0061)을 실제로 적용 — 성공. `apps/web` `tsc --noEmit` 통과, `server.test.ts` 20개 전부 통과. 관리자 서버를 실제로 띄우고 응모·당첨 행을 직접 넣어 `/rewards` 페이지가 올바른 숫자(1건 응모, 1/2 당첨, 50,000원)를 그리는 것까지 curl로 확인.
**다음 세션 참고**: 관리자 화면 나머지(~19개 — 읽기 전용 14개 + 위험한 동작 5개), 박람회 후속(관리자 등록 UI 없음), WP-BIZ 006/007(B2B 계약·광고 스키마 설계 필요), WP-CPL(버전 관리 설계 필요), WP-HOME-006(랭킹 로직 제품 결정 필요), WP-OUR 일정 추가/지도 보기/취향 재선택(전부 이전 세션에서 차단 확인)가 남아 있다. **0052 마이그레이션 버그와 그 뒤에 생긴 0047/0052 스키마 중복 둘 다 고쳐져 main에 병합됐고 이 브랜치에도 반영됐다** — `apps/api` DB 연동 테스트와 production 마이그레이션 모두 정상 진행 가능(완전히 새 DB로 `apps/api` 566/566, 관리자 서버 실사용까지 재확인함). 남은 것은 WP-OUR-013 예식 완료 CTA가 홈 재설계로 다시 안 뜬다는 점(홈 설계 담당 세션 확인 요청함, 응답 대기) 하나뿐이다.

### 프론트엔드 (session_01HTGSU2B4vFjePXFS2ajKBY) — 아카이브
**완료**: 모바일 앱 핵심 화면 구현, 42개 라우터 파일 생성

### 백엔드 갭 투입 (claude/backend-gaps-olvj3m, 이 세션, Sonnet 5)
**완료:**
- ✅ 취향(홈 C-1 시안 1) 서버 API 신설 — `GET`/`PUT /v1/me/taste`
  (`packages/db/migrations/0059_taste_preferences.sql`,
  `packages/api-contract/src/taste.ts`, `apps/api/src/routes/taste.ts`).
  기존에는 `apps/mobile/src/features/home/taste.ts`가 서버에 자리가 없어
  AsyncStorage에만 저장했다(기기를 바꾸면 다시 물었다) — 이제 로그인한 사용자의
  취향이 서버에 남는다. 모바일 쪽(`loadTaste`/`saveTaste`)을 그 API를 부르도록
  교체, 저장 실패는 조용히 넘어가게 유지(낙관적 갱신 유지).
- 조사 방법: Explore 서브에이전트로 `apps/mobile/src/api/client.ts`의 ~83개
  엔드포인트 호출을 `apps/api/src/routes/*`와 전수 대조 — 나머지는 전부 대응하는
  라우트가 있었고, 이 취향 기능과 홈 개인화 피드(`listWeddingContent`, 아래 참고)
  둘만 "프론트는 있는데 백엔드가 없는" 실제 갭이었다.
- typecheck(api-contract/api/mobile) 통과, mobile lint 0 error(기존 무관 경고 1개
  그대로), API 테스트 549개 전체·mobile 테스트 66개 전체 통과(로컬에 Postgres 16을
  띄우고 `npm run migrate --workspace @weddingpick/db`로 0059까지 재현해 확인).

**미착수(다음 사람 참고)**:
- 홈 개인화 웨딩피드 — `apps/mobile/src/features/home/content.ts`의
  `listWeddingContent()`가 `TODO`로 빈 배열만 반환. 계약에도 API에도 "콘텐츠"라는
  개념이 아직 없다 — 무엇을 콘텐츠로 볼지(에디토리얼? 업체 추천 큐레이션?)부터
  정책이 필요해 보여 손대지 않았다.

---

## 프론트엔드 화면 현황

### 기준: 핸드오프 전체 IA (176개 화면 코드)

| 상태 | 수 | 비율 |
|---|---|---|
| 구현됨 | 34 | 19% |
| 부분 구현 | 58 | 33% |
| 미구현 | 49 | 28% |
| 확인 필요 (Bottom Sheet·공통 상태) | 35 | 20% — 2026-09-02 프론트엔드 착수 세션에서 전수 조사·순수 프론트엔드 가능분 구현 완료(아래 세션 로그 참조), 남은 것은 백엔드·정책 선행 필요 |

**라우터 파일**: `apps/mobile/src/app/` 42개 — 핵심 화면 커버

### 미구현 주요 영역

| 영역 | 미구현 수 | 비고 |
|---|---|---|
| 관리자 화면 (WP-ADM-*) | 25개 | 전부 미구현 |
| 박람회·웨딩 정보 (WP-EXPO-*) | 5개 | 2026-09-02 완료(4/5 — WP-EXPO-005 외부 캘린더 등록은 WP-EXPO-002 상세 화면에 통합됨). Neon production DB에는 `0061_wedding_expos_guide.sql`(구 0053→0060→0061, main 재병합 때마다 재번호) 마이그레이션 미적용, `db-migrate.yml` 필요 |
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

### 마이그레이션 이력 (0001 ~ 0061, 전체 완료)

| 범위 | 내용 |
|---|---|
| 0001 ~ 0010 | 기반 인프라 (users, vendors, API keys 등) |
| 0011 ~ 0020 | 검색·매칭·견적 |
| 0021 ~ 0030 | 소셜·리뷰·알림 |
| 0031 ~ 0038 | Pick·비교·결제·광고 |
| 0039 ~ 0046 | 보상·제보·광고·결혼 지역 |
| 0047 ~ 0051 | 데이터 수집 파이프라인(vendor_data_quality, change_log, import_run_log, vendor_images, corrections) **+ 월간 웨딩지원금**(`0047_monthly_draw.sql` — monthly_draw_entries + reward_grants 확장). 옛 `0052_mission_draw.sql`(다른 스키마로 같은 기능을 중복 구현한 것)과 충돌해 PR #27로 0052를 완전히 제거하고 이 파일만 남김(위 세션 로그 "후속" 항목 참조) |
| 0053 | `reward_kind` enum에 `monthly_draw` 값 추가 (별도 트랜잭션 필요해서 분리) |
| 0054 | `reward_grants.grant_source_matches_kind` CHECK 제약 재생성 (0053에서 분리) |
| 0055 ~ 0059 | 회원탈퇴, AI 라우터, 이의제기 만료, 탈퇴 관리자, 소셜 프로필 (백엔드 세션들) |
| 0060 | 취향(`taste_preferences`, 홈 C-1) — 원래 0059였으나 main 자체 정리 때(PR #27) 재번호 |
| **0061** | **박람회·웨딩 정보** (wedding_expos, wedding_guide_articles) — 원래 0053이었으나 main을 두 차례 재병합하며 0060→0061로 재번호 |

### ⚠️ 프로덕션 미적용
`0047`~`0061`은 코드 리포에 머지됐으나 Neon production DB에는 아직 미적용.  
`db-migrate.yml` 워크플로 실행 필요 — 트랜잭션 버그가 고쳐졌으므로 그대로 실행하면 끝까지 성공한다.

---

## 백엔드 API 현황

- **테스트**: 524개 통과 (백엔드 관리 세션 기준, 2026-09-02)
- **서버**: `weddingpickl.fly.dev` (Fly.io)
- **미확인**: 프로덕션 환경 전체 API 엔드포인트 수, 커버리지 %

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
│   │   └── migrations/      # 0001 ~ 0061 SQL 파일
│   ├── domain/              # 도메인 상수·정책 (terms.url, privacy.url 여기)
│   └── ...
├── docs/
│   ├── 통합정책 v3.14       # 현재 확정 기준 정책
│   ├── design-handoff/      # 디자인 핸드오프 (IA 176화면)
│   ├── AI_HANDOFF.md        # 이 파일
│   └── 05-product-spec.md   # Phase 1 제품 스펙 (A-01~A-18)
└── .github/workflows/       # CI/CD 워크플로
```

---

## 정책 문서 참조

기준: `docs/통합정책 v3.14`
코드와 정책이 충돌하면 **정책이 맞다.** 코드를 고친다.

주요 섹션:
- `§I-4` — 월간 웨딩지원금 추첨 (4개 미션 완료 조건, NPay 5만원×2명)
- `§J-3` — 탈퇴 화면 UX 문구
- `§A~§H` — 업체·검색·Pick·비교 핵심 정책

---

## 다음 작업 우선순위

1. ~~**[백엔드]** `0052_mission_draw.sql` 트랜잭션 버그 수정~~ — 2026-09-02 완료(main의 PR #10에서 고쳐 병합, 이 브랜치도 main 병합으로 반영·재검증 — 세션 로그 참조). `db-migrate.yml`을 그대로 실행하면 끝까지 성공한다.
2. **[사용자]** expo.dev에 ASC API Key 62U8N2ZWJR 등록 → iOS 빌드 재시작
3. **[사용자]** Fly.io: `OPERATOR_SESSION_TTL_DAYS=365` 추가
4. **[사용자]** Neon DB: `db-migrate.yml` 실행 → 0001~0061 전체 적용(1번이 고쳐졌으므로 막힘 없이 끝까지 감)
5. **[사용자]** terms.url · privacy.url 확정 → 도메인 상수 업데이트
6. **[AI]** 프론트엔드 미구현 화면 구현 — 아래 4개 모두 순수 프론트엔드 작업이 아님, 착수 전 확인:
   - 회원탈퇴(WP-MY-008): 이미 구현됨(`my/withdraw.tsx`). `withdrawal.ts`의 정책 게이트가 의도한 동작 — 추가 작업 없음, 손대지 말 것(아래 do_not_change 참조)
   - 일정 추가·목록·상세(WP-OUR-004/005/006): API·DB 전무 — `apps/api/src/routes/wedding-plan.ts`에 schedule 엔드포인트 없음. `tasks.tsx`(체크리스트)와는 별개 개념. DB migration(다음 번호 0061)부터 필요한 풀스택 작업 — 프론트 단독 세션에서 임의로 스키마 추가하지 말 것, 다른 세션과 번호 충돌 위험(작업 직전 `origin/main`을 다시 확인해 번호를 정할 것)
   - 지도 보기(WP-SRCH-007): `VendorSummary`(`packages/api-contract/src/vendors.ts`)에 위경도 필드 없음 — 백엔드에 geo 데이터 추가부터 필요
   - 취향 재선택(WP-MY-004): `packages/domain/src/priority.ts`의 `couple_taste` 주석이 "아직 이 종류는 만들어지지 않는다"고 명시 — 취향 수집(이미지 Pick 기반, v3.10 §8) 자체가 설계 전이라 재선택 화면을 만들 대상이 없음
7. ~~**[AI]** 공통 Bottom Sheet 16종 인라인 처리 여부 확인~~ — 2026-09-02 완료(WP-SHT-*·WP-ST-* 전수 조사 및 순수 프론트엔드 가능분 구현, 세션 로그 참조). 남은 것: WP-SHT-009, WP-ST-006/010/014 — 각각 취향수집 시스템·백엔드 API가 먼저 필요 (WP-SHT-012 캘린더 등록은 완료)
8. ~~**[AI]** 박람회·웨딩 정보(WP-EXPO-*, 5개) 화면 구현~~ — 2026-09-02 완료 (DB migration은 `0061_wedding_expos_guide.sql` — main을 두 차례 재병합하며 0053→0060→0061 재번호, production 미적용 상태로 대기 — 4번 참조)
9. **[AI]** 관리자 화면(WP-ADM-*) — 읽기 전용 14/25 완료(2026-09-02, `apps/web/src/admin/`). 남은 5개(WP-ADM-011/013/016/030/032)는 **백엔드 데이터 자체가 없어 스킵** — 각각 새 표(교차검증 신뢰도, 이상치·조작 탐지, 인바운드 이메일 파싱, 마케팅 콘텐츠 자동화, 매출 퍼널)를 설계하는 것부터 시작해야 하는 별도 백엔드 작업. Kill Switch·Policy Engine·롤백·광고 전환·집행 관리(041/051/042/034/033) 5개는 계정 하나짜리 Basic Auth로 지킬 계층이 아니라 판단해 계속 제외 — 사람별 계정·승인 흐름이 먼저 필요, 앱스토어 출시 후 단계로 유지
10. **[사용자]** `fly apps create weddingpick-admin` 실행 + `fly secrets set --app weddingpick-admin DATABASE_URL=... ADMIN_PASSWORD=...` — 관리자 웹이 아직 배포되지 않았다. `fly.admin.toml` 참조
11. **[AI]** WP-OUR-013 예식 완료 CTA — 새 홈 화면 확정본(`features/home/state.ts`)에 post-wedding 상태가 없어 2026-09-02 main 병합 때 배선이 빠짐. 도메인 로직(`COMPLETED_ACTIONS`)은 살아있음 — 홈 설계 담당 세션과 의도 확인 후 재배선할지 결정

---

## 변경 금지 / 주의

- `--no-verify` 사용 금지
- 마이그레이션 파일 번호 순서 역행 금지 (0061 다음은 0062 — 새 마이그레이션 작업 전 `origin/main`에 더 앞선 번호가 없는지 반드시 확인. 오늘만 같은 정책을 두 세션이 다른 번호로 각자 구현해 두 번 충돌했다)
- `main` 브랜치 직접 푸시 금지 — 항상 PR 경유
- `assertReleasable('production')` 우회 금지 — terms.url/privacy.url 설정이 올바른 해결책
- expo.dev 크리덴셜은 Claude가 접근 불가 — 사용자 직접 처리

---

## 롤백

| 항목 | 롤백 방법 |
|---|---|
| DB 마이그레이션 0052~0054 | DROP 구문 없음 — 수동 롤백 필요. 0052(미션·추첨 스키마)는 트랜잭션 버그가 고쳐져(0053이 enum 값 추가, 0054가 그 값을 쓰는 제약 재생성) 이제 정상 적용된다 |
| DB 마이그레이션 0061 | `0061_wedding_expos_guide.sql`(구 0053, main 재병합 때마다 재번호) DROP 구문 없음 — `structured.wedding_expos`·`structured.wedding_guide_articles`·`wedding_guide_stage` 타입, 수동 롤백 필요. 다른 마이그레이션과 의존 관계 없음(0001의 `vendor_category`·`source_type`만 참조) |
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
| 0 | 스플래시 | ✅ | 심볼 88px→64px 수정 완료 |
| 1 | 온보딩 | ✅ | 경미한 레이아웃 차이만 |
| 2 | 이름·예식일 등록 | ⚠️ | 이름 필드 없음, 지역·예산 추가 (정책 변경) |
| 3 | 예식일 캘린더 | ✅ | WeddingCalendar 컴포넌트로 정상 구현 |
| 4 | 로딩 스켈레톤 | ⚠️ | 탭바 숨김 여부, 1.6초 고정 여부 미확인 |
| 5 | 홈 | ⚠️ | 다음 일정→Priority Engine, 지출 툴팁 없음 |
| 6 | 홈 편집 | ⚠️ | 드래그 없음 (버튼 대체, 주석에 인지됨) |
| 7 | 검색 | ⚠️ | 자동완성 없음, 정렬 드롭다운→칩 |
| 8 | 업체 상세 | ⚠️ | **인증후기 섹션 없음**, 상담연결·영업상태 없음 |
| 9 | 비교함 | ⚠️ | "순위 안 매김"·"의견 공유하기"는 SEED `.dc.html` 어디에도 없음 — 폐기된 Toss v7 참고였을 가능성. `compare.tsx`는 SEED와 별도 불일치 없음, 재확인 불필요 |
| 10 | 결제내역 등록 동의 | ⚠️ | **전체 동의 Checkbox 없음** |
| 11 | 촬영 | ⚠️ | **3:4 가이드 프레임 없음**, **품질 피드백 없음** |
| 12 | 읽은 내용 확인 | ⚠️ | A-05~A-10 분리 구현, 상세 확인 필요 |
| 13 | 등록 완료 | ✅ | `capture/payment/register.tsx` `done` 상태 확인 — 매칭·미매칭 문구, 딥데이터 안내 모두 구현됨 |
| 14 | 지출내역 | ⚠️ | 삭제 컨펌 없음 |
| 15 | 웨딩 스케줄 | ⚠️ | "직접 지정" 표기, 삭제 컨펌 확인 필요 |
| 16 | 방문노트 | ⚠️ | 삭제 컨펌 없음 |
| 17 | MY | ⚠️ | 메뉴 구조 다름, 추가 항목 있음 |
| 18 | 미션 완료 모달 | ⚠️ | **바운스 애니메이션 없음** |
| 19 | 설정 | ✅ | 가격 변동 알림 Switch 확인됨 (`my/settings.tsx:139`) |
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
  - 네이버 authorization code 교환과 프로필 조회 경로가 구현됐다. 서버와 앱 환경값 및 네이버 Developers callback URL이 모두 설정된 경우에만 노출한다(`docs/social-login-handoff.md` 참조).
  - `docs/design-handoff/seed/`는 원본 그대로 유지 — 화면 구현할 때 이 폴더 안의 `.dc.html` 파일을 직접 고치지 않는다(참고용 원본).

## 롤백
- rollback_note: 커밋 4개(`f22a512`, `bba48ed`, `10ce66a`, `cf07b15`)는 서로 기능적으로 독립적이라 필요하면 개별 `git revert <hash>`로 되돌릴 수 있다. 순서상 뒤 커밋이 앞 커밋의 파일을 다시 건드리지 않으므로 역순 revert도 안전하다. 전부 origin/main에 push 완료 — 로컬에만 있는 미커밋 변경 없음(`.npm-cache/` 잡음 제외).
