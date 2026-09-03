# WeddingPickl AI 인수인계서

> 이 파일은 모든 Claude 세션이 읽는 **단일 진실 소스**다.
> 새 세션이 시작되면 이 파일을 먼저 읽어라. 작업이 끝나면 이 파일을 업데이트하고 커밋해라.

---

## 메타

- `updated_at`: 2026-09-03 (ESLint/TS CI 픽스 PR #51 푸시; 관리자 API 갭 정직하게 문서화)
- `repository`: jsexy0210-ship-it/WeddingPickl
- `branch (main)`: 3e10bbc (소셜 로그인 완성 PR 병합 포함)
- `branch (fe-p0-gaps)`: df4a180 — PR #51 (CI 통과 대기 중)
- `policy_version`: 통합정책 v3.14
- `dashboard`: https://claude.ai/code/artifact/a1307c11-f282-4cf2-a26d-e44bd083d7a9
- `ios_handoff_artifact`: https://claude.ai/code/artifact/b8792fcd-fefe-4386-b24e-41d122e90a87
- `screen_status_artifact`: https://claude.ai/code/artifact/b99277b7-3bdc-45dc-9614-a1310507df53

---

## 인프라 현황

### 서버
- **API 서버**: Render — `https://weddingpickl.onrender.com`
- **DB**: Neon PostgreSQL (production)
- **스토리지**: Backblaze B2 (S3 호환)
- **모바일 빌드**: EAS (Expo Application Services) + GitHub Actions

### GitHub Actions 워크플로
| 파일 | 역할 |
|---|---|
| `main.yml` | PR 검증 · 테스트 |
| `release.yml` | iOS EAS 빌드 배포 |
| `db-migrate.yml` | Neon DB 마이그레이션 적용 |
| `fly-init.yml` | 이전 Fly.io 초기화 기록(현재 운영 제외) |
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

### 2. Production DB 마이그레이션 적용
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

### 6. 지도 보기 — Google Maps Android API 키
`apps/mobile/app.json`의 `android.config.googleMaps.apiKey`가 `REPLACE_WITH_GOOGLE_MAPS_ANDROID_API_KEY`
자리표시자로 들어가 있다. Google Cloud Console에서 Maps SDK for Android 키를 발급해 실제 값으로
바꿔야 Android에서 지도 타일이 뜬다(iOS는 기본 Apple Maps라 키가 필요 없다). 키를 안 넣어도
빌드는 되지만 Android 지도 화면에 회색 배경 + 저작권 표시만 나온다.

### 7. 지도 보기 — 업체 좌표 지오코딩 실행
`0062_vendor_geo.sql` 적용 후 기존 업체는 전부 `lat`/`lng`가 NULL이다(좌표 없이 목록에는
그대로 뜨고 지도에만 안 뜬다). `scripts/geocode-vendors.mts`를 카카오 REST API 키로 돌려야
좌표가 채워진다 — 방법은 아래 "지도 보기 — 좌표 지오코딩" 절 참고. 카카오 개발자 콘솔에서
키 발급 필요(Claude 불가).
```
DATABASE_URL=<neon-connection-string> KAKAO_REST_API_KEY=<발급받은 키> \
  npx tsx scripts/geocode-vendors.mts
```

---

## 세션별 작업 완료 현황

### 현재 세션 (session_01SLgCn4pWaQCTyYPzVLcbQr) — 2026-09-03 진행 중

**완료 (커밋 df4a180, 브랜치 home/fe-p0-gaps):**
- ✅ `react-native-maps ~1.29.0` — `apps/mobile/package.json` 추가 (TS2307 해결)
- ✅ `pick/done.tsx`, `pick/confirm.tsx` — `useRef().current` → `useMemo` 전환
  (Cannot access refs during render, react-hooks/rules-of-hooks 해결)
- ✅ 33개 파일 — `setLoading(true)` 앞에 `eslint-disable-next-line react-hooks/set-state-in-effect` 삽입
- ✅ `client.ts` — 미사용 `ExpoItem`/`ExpoStatus` import 제거
- ✅ 로컬 검증: `npm run lint` → **0 errors, 12 warnings**, `npm run typecheck` → **0 errors**

**PR #51 상태:**
- URL: https://github.com/jsexy0210-ship-it/WeddingPickl/pull/51
- 브랜치: `home/fe-p0-gaps` → `main`
- CI: 진행 중 (2026-09-03 07:57 UTC 시작, 결과 대기 중)
- 머지 전략: squash merge (CI 통과 즉시 자동 처리 예정)

**⚠️ 감사 결과 — 관리자 API 실질적 갭:**
모바일 관리자 화면 26개가 호출하는 엔드포인트 중 서버에 **없는** 것들:

| 모바일 호출 | 서버 상태 |
|---|---|
| `GET /v1/admin/dashboard` | ❌ 없음 |
| `GET/POST/DELETE /v1/admin/faq` | ❌ 없음 |
| `GET/PATCH /v1/admin/users` | ❌ 없음 |
| `GET/PATCH /v1/admin/vendors` | ❌ 없음 |
| `GET /v1/admin/revenue` | ❌ 없음 |
| `GET /v1/admin/ads`, `GET /v1/admin/ads-gate` | ❌ 없음 (서버엔 `ad-placements`만 있음) |
| `GET /v1/admin/ai-usage` | ❌ 없음 (서버엔 `ai-budget`만 있음) |
| `GET /v1/admin/automation` | ❌ 없음 |
| `GET /v1/admin/biz-queue` | ❌ 없음 |
| `GET /v1/admin/briefing` | ❌ 없음 (서버엔 `decisions/briefing` 있음) |
| `GET /v1/admin/campaigns` | ❌ 없음 |
| `GET /v1/admin/data/pipeline` 등 | ❌ 없음 |
| `GET /v1/admin/email-matching` | ❌ 없음 |
| `GET /v1/admin/kill-switches` | ❌ 없음 |
| `GET /v1/admin/marketing` | ❌ 없음 |
| `GET /v1/admin/policy-engine` | ❌ 없음 |
| `GET /v1/admin/rollback` | ❌ 없음 |
| `GET /v1/admin/terms` | ❌ 없음 |
| `GET /v1/admin/audit-log` | ❌ 없음 |

**서버에 있는 것:** `price-stats`, `reports`, `rebuttals`, `verifications`, `payment-proofs`, `objections`, `inquiries`, `pii-reviews`, `retention/*`, `ai-budget/*`, `ad-placements`

→ 관리자 화면들은 화면 구조는 있으나 **런타임에 즉시 빈 상태 또는 오류**가 난다.
  다음 AI 세션이 관리자 API 엔드포인트를 `apps/api/src/routes/admin.ts`에 추가해야 한다.

---

### 웨딩픽 통합 운영/관리 (session_01SLgCn4pWaQCTyYJaRa) — 아이들
**완료:**
- ✅ 월간 웨딩지원금 (§I-4) API + 모바일 화면 구현 → 원격 브랜치 푸시 완료
- ✅ 탈퇴 안내 문구 `WITHDRAWAL_NOTICE` 확정 (§J-3)
- ✅ `OPERATOR_SESSION_TTL_DAYS` 도메인 상수 추가
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
**미검증**: 실제 배포·health check(운영 배포 자격 증명 필요),
GitHub Actions 실제 실행 결과, production DB 적용.

### 프론트엔드 (session_01HTGSU2B4vFjePXFS2ajKBY) — 아카이브
**완료**: 모바일 앱 핵심 화면 구현, 42개 라우터 파일 생성

### 백엔드 — 일정 · 지도 보기 (session_016VEKBiJwF4kJzTkxotEiCD)
**배경**: 프론트엔드 세션(PR #16)이 순수 프론트로 가능한 화면을 다 구현하고, 새 백엔드
API·DB 마이그레이션·지도 SDK가 필요한 두 항목(일정 추가, 지도 보기)을 이 세션으로 넘김.

**완료**:
- ✅ `wedding_events` 테이블(마이그레이션 `0061_wedding_events.sql`) — 웨딩 스케줄
  (`wedding_tasks`, 체크리스트)과 다른 개념으로 분리: 일시·장소·업체·메모·알림 여부가
  있는 캘린더 이벤트. `source`(manual/auto) 컬럼은 지금은 항상 manual — 업체 결정에서
  자동 생성하는 기능은 이번 범위 밖.
- ✅ `packages/api-contract/src/wedding-events.ts` + `endpoints.ts` 등록,
  `apps/api/src/routes/wedding-events.ts` CRUD 4종(list/add/update/remove),
  `apps/api/src/test/wedding-events.test.ts`(DB 테스트, 로컬 Postgres로 통과 확인)
- ✅ 모바일 화면 3개: `wedding/[id]/events/index.tsx`(목록, 오늘·예정·지난 구분),
  `events/new.tsx`(추가), `events/[eventId].tsx`(상세 — 수정·삭제·알림 토글).
  `wedding/index.tsx`에 진입 항목 추가. 외부 캘린더 등록(WP-EXPO-005)은 손대지 않음.
- ✅ `vendors` 테이블에 `address`/`lat`/`lng` 컬럼(마이그레이션 `0062_vendor_geo.sql`,
  둘 다 없거나 둘 다 있게 하는 CHECK, 기본값 없음 — 지오코딩 전 업체는 지도에 안 뜬다)
- ✅ `packages/api-contract`의 `vendorSummarySchema`에 `coordinates` 필드,
  `apps/api/src/routes/vendors.ts` 검색·상세 쿼리에 `lat`/`lng` 반영
- ✅ 좌표 백필 스크립트 `scripts/geocode-vendors.mts` — **결정**: vendors에는 구 단위
  region만 있고 정확한 주소가 없어(0001/0007), 업체명+지역을 카카오 로컬 키워드검색
  API에 그대로 넘겨 지오코딩한다(구 중심 좌표를 박아넣는 것보다 정확). 수동 실행
  스크립트로 CI에 물리지 않음 — 실제 실행은 KAKAO_REST_API_KEY 발급 후 사용자 조치
  (위 "사용자 직접 조치 필요" 6·7번 참고).
- ✅ 모바일 지도 SDK: `expo-location` + `react-native-maps` 채택. **결정 근거**:
  Expo 공식 `expo-maps`(57.0.2)는 alpha·Expo Go 미지원·플랫폼별(Apple/Google) 컴포넌트가
  분리돼 있고 **웹 지원이 전혀 없다** — 이 앱은 `export:web`으로 웹도 배포한다.
  `react-native-maps`(1.29.0)는 안정판이고 RN 0.86.3/React 19.2.3과 호환되며, 웹에서는
  `MapView.web.ts`가 `UnimplementedView`로 빌드는 막지 않는다(지도 자체는 웹에서 안 뜸 —
  `apps/mobile/src/features/search/vendor-map.tsx`가 `Platform.OS === 'web'`일 때 안내
  문구로 대체). `apps/mobile/AGENTS.md` 지침대로 두 패키지 다 SDK 57 호환 버전 확인 후
  설치(npm 레지스트리로 확인 — `docs.expo.dev`는 이 환경에서 egress 차단됨).
- ✅ `apps/mobile/src/app/(tabs)/search/index.tsx`에 목록/지도 토글 칩 추가.
  지도는 **새 검색 로직을 만들지 않고** 기존 검색 결과(`vendors` 상태) 위에 좌표
  있는 업체만 핀으로 얹는다. 핀 탭 시 요약 카드, 현재 위치 버튼(`expo-location` 권한
  요청), "이 조건으로 다시 찾기"는 기존 검색을 재실행(별도 영역-기반 쿼리는 만들지
  않음 — 지시사항 범위 밖). 빈 상태: 위치 권한 거부/결과 없음/좌표 미확보 각각 안내.
- ✅ `npm run typecheck`/`lint`/`test`(로컬 Postgres 16 기동, migrate 79개 스키마 테스트+
  API 549개 테스트 전부 통과) + `export:web` + `build --workspace @weddingpick/web` 전부
  통과 확인 — CI(`main.yml`)와 동일한 단계.

**미검증**: 실제 Neon production 배포(마이그레이션 0059·0060 미적용), Android 실기기에서
지도 렌더링(Google Maps API 키 미설정), 카카오 지오코딩 스크립트 실제 실행(API 키 없음).

**PR 작업 중 main 병합**: PR #16(프론트 화면 구현)이 이 세션 도중 main에 병합돼(5090d24)
`wedding/index.tsx` 진입 항목이 충돌(이 세션의 `events` vs PR #16의 `quotes`) — 둘 다
살리는 방향으로 해소. 병합이 main 전체를 다시 lint하게 만들면서 PR #16이 들여온
`react-hooks/set-state-in-effect` 위반 6곳(`my/rebuttals`·`reports`·`rewards`·
`vendor-claims`·`notifications`·`settings.tsx`의 `load` 콜백이 `.then()` 이전에
`setLoadError(null)`을 동기로 부르던 패턴 — clean main worktree에서도 재현 확인, 이
세션 코드가 만든 문제 아님)을 함께 고쳤다. 고치면서 같은 파일들에 있던 "재시도해도
이전 에러 문구가 안 지워지는" 버그도 함께 해소됨(`setLoadError(null)`을 `.then()`
성공 분기 안으로 옮기면 두 문제가 한 번에 풀린다).

**브랜치**: `claude/wedding-events-map-view-260902` · **PR**: #19 (병합 완료)

### 백엔드 갭 투입 (session_01BY3GppUAGgA58aci9XXH3a, Sonnet 5)
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

- ✅ PR #17 머지 후 main이 계속 CI 빨간불이길래 계속 파봤다 — 이 세션과 무관한
  두 가지 원인을 찾아 고쳤다:
  - **PR #23**: `eslint-plugin-react-hooks` 7.x의 `set-state-in-effect` 규칙이
    표준 fetch-in-effect 패턴을 오탐지 — 6개 파일에 `eslint-disable-next-line`
    (나중에 다른 세션이 더 나은 방식으로 재작성해 그 코멘트는 지금은 없다. 문제
    없음 — Lint는 계속 0 error).
  - **마이그레이션 충돌**: `0047_monthly_draw.sql`(PR #20)과 `0052_mission_draw.sql`
    (예전 세션)이 같은 정책(월간 웨딩지원금)을 독립적으로 구현하면서
    `reward_grants.draw_entry_id` 컬럼을 두 번 만들려다 매 마이그레이션마다
    확정적으로 실패 — 동시성 문제가 아니었다. 내가 로컬에서 root-cause를 찾아
    수정을 준비하는 사이 다른 세션이 **PR #25/#27**로 거의 같은 진단·해법(0052
    삭제, 0053에 `IF NOT EXISTS`, production 첫 적용 대비 정리)을 먼저 머지해서
    내 수정은 버리고 검증만 했다.
  - **PR #29**: 마이그레이션 충돌 해소 후 main에 남은 마지막 2개 실패
    (`release-gate.test.ts`, `page.test.ts`)를 고쳤다 — 코드 버그가 아니라
    PR #22/#24가 이용약관·개인정보처리방침을 게시(url 설정)로 바꾼 뒤 "아직
    게시 전"을 전제로 한 낡은 테스트 기대값이었다.
- ✅ **PR #29 머지(head `b8a8df7`)로 main이 처음으로 CI 전체(Typecheck·Lint·
  Test·Bundle·Build)와 `Deploy → Staging`(DB Migrate·Render 배포·health check)
  까지 전부 그린을 찍었다.** Render에 이 세션의 취향 API
  (0060_taste_preferences 등)를 포함한 최신 코드가 실제로 배포됨.
- **Production 배포는 보류 중** — `workflow_dispatch`(environment=production)로
  수동 실행해야 하며, 사용자가 명시적으로 "진행 전에 물어봐달라"고 요청해 아직
  실행하지 않았다. 다음 세션이 이어받으면: staging이 계속 정상인지 확인 후
  사용자에게 production 배포 여부를 물어볼 것.

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
| 우리웨딩 (WP-OUR-*) | 0개 | 일정 추가 ✅(PR #19), 준비 타임라인 ✅(PR #16), 예식 완료 ✅(PR #16) |
| MY (WP-MY-*) | 0개 | 취향 다시 고르기 ✅(PR #16), 회원탈퇴 ✅(PR #10/#15) |
| 홈 (WP-HOME-*) | 2개 | TOP3 전체보기, 개인화 웨딩피드 |
| Pick (WP-PICK-*) | 0개 | WP-PICK-006 결정 완료 ✅(home/fe-p0-gaps) |
| 기타 | ~3개 | 지도 보기 ✅(PR #19), 재실행·세션 복원, 진입 예외 등 |

이 표는 176개 화면 전체 재조사 시점(작성 당시) 기준 카운트라 위 ✅ 항목만큼 실제 미구현
수는 줄었다 — 전체 재집계는 하지 않았다.

상세 목록: https://claude.ai/code/artifact/b99277b7-3bdc-45dc-9614-a1310507df53

---

## DB 스키마 현황

### 마이그레이션 이력 (0001 ~ 0062, 전체 완료)

| 범위 | 내용 |
|---|---|
| 0001 ~ 0010 | 기반 인프라 (users, vendors, API keys 등) |
| 0011 ~ 0020 | 검색·매칭·견적 |
| 0021 ~ 0030 | 소셜·리뷰·알림 |
| 0031 ~ 0038 | Pick·비교·결제·광고 |
| 0039 ~ 0046 | 보상·제보·광고·결혼 지역 |
| 0047 ~ 0051 | 데이터 수집 파이프라인 (vendor_data_quality, change_log, import_run_log, vendor_images, corrections) |
| 0052 ~ 0054 | 미션 완료 추적 + 월간 웨딩지원금 추첨 |
| 0055 ~ 0058 | 회원탈퇴 자동파기 + 운영자 개입, AI 라우터, 이의 만료 |
| 0059 | 소셜 로그인 프로필(`identities.name`/`nickname`/`profile_image_url`) |
| 0060 | 취향(`taste_preferences`) — 홈 C-1 시안 1 |
| **0061** | **일정(`wedding_events`)** — 웨딩 스케줄(체크리스트)과 다른, 일시·장소가 있는 캘린더 이벤트 |
| **0062** | **업체 좌표(`vendors.address`/`lat`/`lng`)** — 지도 보기용, 기본값 없이 지오코딩 전엔 NULL |

**번호 충돌 이력**: PR #19(일정·지도 보기)가 다른 PR과 동시에 진행되며 각자
`0059`·`0060`을 골라 main에 그대로 머지됐다(사회 로그인 프로필·취향 마이그레이션과
파일명이 겹침). 이 파일이 그 충돌을 `0061`·`0062`로 재번호를 매겨 고친다 —
migrate.ts는 파일명 전체를 버전 키로 써서 실제로 깨지지는 않았지만, 번호가 순서를
나타낸다는 규약을 어겼다.

### ⚠️ 프로덕션 미적용
`0052_mission_draw.sql`부터 `0062_vendor_geo.sql`까지 코드 리포에는 머지됐으나 Neon
production DB에는 아직 미적용. `db-migrate.yml` 워크플로 실행 필요.

---

## 백엔드 API 현황

- **테스트**: 524개 통과 (백엔드 관리 세션 기준, 2026-09-02)
- **서버**: `https://weddingpickl.onrender.com` (Render)
- **미확인**: 프로덕션 환경 전체 API 엔드포인트 수, 커버리지 %

---

## 코드 구조 주요 경로

```
WeddingPickl/
├── apps/
│   ├── mobile/              # Expo Router 모바일 앱
│   │   └── src/app/         # 42개 라우터 파일 (화면)
│   └── api/                 # Hono API 서버 (Render 배포)
├── packages/
│   ├── db/
│   │   └── migrations/      # 0001 ~ 0052 SQL 파일
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

1. **[자동 대기 중]** PR #51 CI 통과 시 squash merge → main
2. **[AI — 최우선]** 관리자 API 엔드포인트 추가 (`apps/api/src/routes/admin.ts`)
   - 최소: dashboard, faq, users, vendors, revenue, kill-switches, audit-log
   - 전체 목록: 위 "관리자 API 실질적 갭" 표 참고
3. **[사용자]** expo.dev에 ASC API Key 62U8N2ZWJR 등록 → iOS 빌드 재시작
4. **[사용자]** Neon DB: `db-migrate.yml` 실행 → 0052 ~ 0062 적용
5. **[사용자]** terms.url · privacy.url 확정 → 도메인 상수 업데이트
6. **[사용자]** Google Maps Android API 키 발급 → `apps/mobile/app.json`의
   `REPLACE_WITH_GOOGLE_MAPS_ANDROID_API_KEY` 교체
7. **[사용자]** 카카오 REST API 키 발급 → `scripts/geocode-vendors.mts` 실행해 업체 좌표 채우기
8. **[AI]** 공통 Bottom Sheet 16종 인라인 처리 여부 확인
9. **[완료]** WP-PICK-006 결정 완료 화면(`pick/done.tsx`) 구현 — PR #51 포함

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
  - 네이버 authorization code 교환과 프로필 조회 경로가 구현됐다. 서버와 앱 환경값 및 네이버 Developers callback URL이 모두 설정된 경우에만 노출한다(`docs/social-login-handoff.md` 참조).
  - `docs/design-handoff/seed/`는 원본 그대로 유지 — 화면 구현할 때 이 폴더 안의 `.dc.html` 파일을 직접 고치지 않는다(참고용 원본).

## 롤백
- rollback_note: 커밋 4개(`f22a512`, `bba48ed`, `10ce66a`, `cf07b15`)는 서로 기능적으로 독립적이라 필요하면 개별 `git revert <hash>`로 되돌릴 수 있다. 순서상 뒤 커밋이 앞 커밋의 파일을 다시 건드리지 않으므로 역순 revert도 안전하다. 전부 origin/main에 push 완료 — 로컬에만 있는 미커밋 변경 없음(`.npm-cache/` 잡음 제외).

---

## 공정률 대시보드 (2026-09-02 추가)

`npm run progress`(이 저장소가 이미 갖고 있던 계산기)의 결과를 눈으로 보기 편하게 만든 Artifact를 만들어뒀다: **https://claude.ai/code/artifact/bf90e7aa-91ad-4df3-bcbd-dc950216663a**

- `db` capability로 발행했다. `snapshot/latest` 문서에 `npm run progress -- --format json`을 사람이 보기 좋은 모양으로 변환한 값을 담아두면, 열려 있는 페이지가 새로고침 없이 갱신된다.
- 갱신 방법: `npm run progress -- --format json`을 돌리고 그 결과를 대시보드가 기대하는 모양(`overallRate`, `items[]`, `inventory[]`, `openSections[]`, `unanswered[]`, `decisionSections[]`, `commits[]` 등 — 위 URL의 아티팩트 소스 상단 `FALLBACK` 상수를 참고)으로 옮긴 다음, Artifact 도구의 `write_db`로 `collection: "snapshot"`, `doc_id: "latest"`에 `set` 하면 된다. 사용자가 "progress 다시 돌리고 대시보드 갱신해줘"라고 하면 이 흐름을 그대로 하면 된다.
- 이 문서 위쪽 "변경 금지" 절이 회원탈퇴 자동삭제 백엔드를 만들지 말라고 적어뒀는데, 그 뒤 커밋(`e42d7c4`, `549e2fa` 등)에서 실제로 자동삭제 + 운영자 개입 기능이 만들어진 것으로 보인다 — **그 절이 낡았을 수 있다.** 다음 세션은 `packages/domain/src/withdrawal.ts`와 관련 마이그레이션(`0055_account_deletion.sql`, `0058_withdrawal_admin.sql`)을 직접 열어 지금 상태를 확인하고, 이 문서의 "변경 금지" 절을 현재 상태에 맞게 고칠 것.

