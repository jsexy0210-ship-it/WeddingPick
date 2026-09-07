# WeddingPickl AI 인수인계서

> 현재 운영 상태는 `PROJECT_STATUS.md`, 실제 구현은 최신 코드를 기준으로 한다.
> 이 파일은 세션 인수인계와 작업 이력을 보관한다. 과거 기록보다 아래 최신 상태를 우선한다.
> 새 세션이 시작되면 이 파일을 먼저 읽어라. 작업이 끝나면 이 파일을 업데이트하고 커밋해라.

---

## 메타

- `updated_at`: 2026-09-07 (저장소 전수 정리 — 브랜치·PR·문서·워크플로)
- `repository`: jsexy0210-ship-it/WeddingPickl
- `verified_code_base`: eff6f59 (#88 squash merge 시점의 main; 최신 원격 상태는 작업 시작 시 재확인)
- `policy_version`: 통합정책 v3.15
- `dashboard`: https://claude.ai/code/artifact/a1307c11-f282-4cf2-a26d-e44bd083d7a9
- `ios_handoff_artifact`: https://claude.ai/code/artifact/b8792fcd-fefe-4386-b24e-41d122e90a87
- `screen_status_artifact`: https://claude.ai/code/artifact/b99277b7-3bdc-45dc-9614-a1310507df53

---

## 저장소 정리 — 2026-09-07

`main`을 유일한 기준으로 만들기 위해 브랜치·PR·문서·워크플로를 전수 점검했다.
**Git history는 건드리지 않았다** — history rewrite·force push·PR 이력 삭제 없음.

- 정리 기준 main: `eff6f59` (#88 squash merge)
- Open PR 3 → 0. #88·#100 병합, #99 종료(임시 조사 스냅샷 — 실질 내용은 아래 결함
  목록으로 옮겼다)
- Remote branch 68 → 9. 병합 완료·내용이 main에 들어간 브랜치 57개 삭제
- 남긴 브랜치(main 미반영 고유 코드가 있어 diff 확인 후 보류): 아래 «보류 브랜치» 절
- 삭제한 파일: `WeddingPickl`(.gitmodules 없는 깨진 서브모듈 링크),
  `pnpm-lock.yaml`(npm 저장소인데 남아 있던 중복 락파일), `color-test.html`
  (참조 0건, 폐기된 v7 시안 비교용 스크래치)
- `public-data.yml`: 삭제된 작업 브랜치를 보던 죽은 push 트리거 제거
- 워크플로 10개는 전부 목적이 갈린다(로컬 gradle APK / EAS preview APK / EAS init /
  릴리즈 / CI·배포 / 운영·스테이징 마이그레이션 / 스토리지 점검 / env sync /
  공공데이터). **삭제·통합 대상 없음**
- 문서는 `docs/README.md`가 이미 색인·폐기 기준을 관리하고 있고, `archive/`의 과거
  정책서는 코드 주석이 절 번호로 참조한다(`packages/domain/*`·`api-contract/*`).
  **문서 삭제는 하지 않았다** — 지우면 그 참조가 끊긴다

### 보류 브랜치 (삭제하지 않음)

Closed PR이지만 main에 없는 고유 코드가 남아 있다. 되살릴지 버릴지는 사람이 정한다.

| 브랜치 | 무엇이 main에 없나 |
|---|---|
| `claude/backend-gaps-9xrh1d` (#26) | 관리자 API 13종·네이버 로그인 서버 구현 일부 |
| `claude/front-dev-start-nrr0jh` (PR 없음) | `routes/wedding-timeline.ts`·`guide-articles.ts` |
| `claude/frontend-development-i1j2aa` (#16) | `my/preferences.tsx`(WP-MY-004 취향 다시 고르기) |
| `design/search-vendor-clean` (#70) | 디자인 핸드오프 싱크 정리본 — 나머지 `design/*` 4개는 이 브랜치가 포함하므로 삭제함 |
| `feat/login-other-page` (#85) | `other-login-sheet.tsx` — 단, v3.12에서 소셜 4종이 카카오+이메일로 축소돼 유효성 재확인 필요 |
| `home/fe-expo-screens` (PR 없음) | WP-EXPO 화면 5종 보완 |
| `copilot/analyze-code-and-identify-issues` (PR 없음) | 배포 환경별 secret 분리(G05 대응안). Secrets 등록이 선행돼야 해 임의 반영하지 않음 |

`fix/render-sync-inputs-context`(#97)는 삭제했다 — 작성자가 진단을 철회했다.
`${{ inputs.* }}`는 `workflow_dispatch` 밖에서 빈 값이 될 뿐 오류가 아니고, 실제
원인은 계정 차원의 Actions 중단이었다(저장소 공개 전환으로 해소).

---

## 🔴 미해결 결함 (2026-09-07 감사·재검증 기준)

PR #99의 조사 보고서와 그 독립 재검증 결과에서 **코드로 확인된** 항목만 남긴 것이다.
오탐으로 판정된 항목은 없었다. 원문은 Git history(브랜치 `codex/github-audit-handoff-20260907`,
`claude/audit-review-2026-09-07`의 커밋)에서 볼 수 있다.

### 출시 차단

| # | 항목 | 위치 · 근거 |
|---|---|---|
| N01 | **운영 카카오 로그인이 500으로 실패** | `POST /v1/auth/sessions → 500`. `errors.ts`가 `unauthenticated → 401`로 매핑하므로 카카오 검증 실패가 아니다. `routes/auth.ts`의 `signIn()` DB 작업에서 처리되지 않은 예외. **#100 병합으로 이제 로그가 남는다 — 재현해서 스택을 잡는 것이 다음 한 걸음** |
| G04 | **CORS 출처·메서드 누락** | `infra/render-env.yml`의 `CORS_ORIGINS`에 admin 출처·커스텀 도메인 없음. `server.ts`의 `methods`에 **PATCH 없음** — 관리자 화면이 실제로 PATCH를 보내므로(`admin/kill-switch.tsx`·`policy-engine.tsx`·`users.tsx`·`vendors.tsx`·`ads.tsx`·`home.tsx`) preflight에서 전부 막힌다. 도메인은 이미 활성이라 미래 위험이 아니라 현재 차단 |
| G02 | **main 보호 규칙에 필수 PR·CI·리뷰 없음** | `rules/branches/main`이 `deletion`·`non_fast_forward` 2개만 반환. 실패한 변경의 병합을 막는 장치가 없다 |

### 높음

| # | 항목 | 위치 · 근거 |
|---|---|---|
| 잔존-A | 관리자 kill switch가 아무것도 끄지 않는다 | `routes/admin.ts`의 `killSwitches` Map을 `admin.ts` 밖에서 조회하는 코드가 0건. 껐다고 표시돼도 기능은 계속 돌고, 재시작하면 상태도 사라진다 |
| G08 | 이메일 인증 경로에 호출 제한·운영자 TTL 공백 | `passwordAttempts`가 이메일 로그인 한 곳에만 걸려 있다. `/auth/email/lookup`·`/accounts`·`/password-reset`·`/password-reset/confirm`은 무제한이고 요청마다 scrypt를 돈다(계정 열거·자원 소모). 이메일 경로는 `operatorSessionTtlDays`도 넘기지 않는다 |
| G05 | staging 이름의 job이 운영 대상을 검사 | `main.yml`의 Staging·Production 두 job이 같은 `DATABASE_URL`과 같은 health URL(`weddingpickl.onrender.com`)을 쓴다. `db-migrate-staging.yml`만 `STAGING_DATABASE_URL`을 쓴다 |

### 출시 전 처리

| # | 항목 |
|---|---|
| G10 | 마케팅 preview artifact가 업로드되지 않는다 — CLI는 `apps/api/.marketing-preview`에 쓰는데 `main.yml`은 루트를 본다. `.`으로 시작해 `include-hidden-files: true`도 필요 |
| G13 | 랜딩 목업이 실데이터 표기 형식으로 금액을 보여준다 — `landing-v4.ts`에 시연 표기 0건. CLAUDE.md §3의 «금액 표기(고정)»과 충돌 |
| G12 | 마케팅 대시보드가 DB 오류를 «0건 성공»으로 숨긴다 — `routes/admin.ts`의 catch에 `NODE_ENV` 검사가 없다 |
| G11 | 소재를 수정해도 `reviewed`·`reviewed_at`이 갱신되지 않아 과거 승인 상태가 남는다 (`marketing/store.ts`) |
| 잔존-B | 관리자 클라이언트가 204에도 `res.json()`을 호출한다 (`app/admin/_api.ts`) |
| 잔존-C | AI 호출 한도가 원자적이지 않다 — `callsToday()`의 SELECT와 `recordUsage()`의 INSERT가 별도 트랜잭션 (`analysis/pipeline.ts`) |
| 잔존-D | 죽은 워커의 `running` 작업을 회수하는 reaper가 없다 (`analysis/worker.ts`의 `claim()`이 `pending`만 집는다) |
| 잔존-E | `routes/documents.ts`의 `MAX_FILE_SIZE`가 죽은 상수다. S3 드라이버는 presigned POST 정책이 강제하므로 실질 노출은 local 드라이버 한정 |
| 잔존-F | `packages/db/src/reset.ts`의 `DROP SCHEMA ... CASCADE`에 테스트 DB 가드가 없다 |
| sbiz | `collect.ts`의 업종 대분류 `'Q'`가 활용가이드에 없는 값이다. `SBIZ_API_KEY` 등록 후 `public-data.yml`의 `lookup_keyword`로 실제 코드를 찾아 교체해야 `sbiz-seoul`·`sbiz-gyeonggi`가 동작한다 |

### 외부 확인 필요 (저장소 안에서 확인 불가)

- 운영 Render `WeddingPickl`의 `DATABASE_URL`이 GitHub `DATABASE_URL`과 같은 DB인가 — **N01과 직결**
- 운영 DB의 `schema_migrations` 목록과 `identity.identities` 실제 컬럼
- 운영 메일 드라이버가 resend인지 console인지
- 분석 워커 서비스가 Render에 실제로 있는가 (저장소에 선언 없음)
- TestFlight / Play 제출·심사 상태
- legacy branch protection API(`branches/main/protection`) 설정

### 권장 순서

1. N01 재현 → Render 로그의 SQL 오류로 원인 확정 → 수정
2. G04 CORS 수정 (admin 출처·커스텀 도메인 + PATCH). 각 출처에서 PATCH preflight 통과 확인
3. G02 main 보호 규칙 — 필수 PR + head CI 성공
4. 잔존-A kill switch 연결, G08 이메일 경로 보강
5. G05 환경별 secret·health URL 1:1 분리
6. 나머지 항목에 각각 단위 테스트를 붙이며 정리

---

## 🔴 2026-09-04 정책 변경 — 하이브리드 웹뷰 전환

### 배경
사용자가 2026-09-04에 확정: 홈·진입/내비게이션·공통(FAQ·약관·시트·상태) 화면군을
시작으로 RN 네이티브 화면을 점진적으로 **하이브리드 웹뷰**로 전환한다.

### 기술 방식
- `apps/mobile`의 기존 Expo Router/React Native 코드베이스는 그대로 유지한다 — 화면을
  새로 만들지 않는다.
- 이 코드베이스를 `expo export -p web`(react-native-web)으로 웹 빌드해 호스팅한다.
- 네이티브 iOS/Android 앱은 그 호스팅 URL을 `react-native-webview`로 감싸는 얇은 셸이
  된다. **`react-native-webview`는 아직 `apps/mobile`에 설치돼 있지 않다** — 전환
  작업의 일부로 추가해야 한다.
- `apps/web`(정적 랜딩 1장, `tsx src/cli.ts` 빌드)과는 완전히 별개다 — 이 전환과
  무관하며 건드리지 않는다.
- 이 방식을 고른 이유: `apps/mobile`이 이미 Expo 웹 빌드를 지원하므로(네이티브 전용
  의존성은 `Platform.OS === 'web'` 조건부 처리, 위 "일정·지도 보기" 세션 기록 참고)
  별도 웹앱을 새로 만들 필요가 없다 — 가장 적은 신규 인프라로 시작할 수 있는 경로다.

### 이번 전환의 실질적 의미
RN 화면의 웹 렌더링 품질이 이제 "부가 기능"이 아니라 **실제 앱 화면 그 자체**가 된다.
`apps/mobile/src/app/` 아래 화면 소스가 모바일 폭부터 데스크톱 폭까지 브라우저에서
정상 렌더링돼야 실제 앱이 정상 동작하는 것이다. 점검 기준:
`docs/design-handoff/hybrid-web-qa-checklist.md`.

### 정책 1 — 비회원 진입 삭제
로그인 없이 들어갈 수 있는 화면(게스트 홈 등)을 폐지한다. 로그인 완료 후에만 앱 진입이
가능하도록 진입 흐름(`apps/mobile/src/app/_layout.tsx` 등)을 바꿔야 한다.
**아직 구현되지 않았다** — 다음 작업.

### 정책 2 — 홈 헤더 검색버튼 삭제
홈 탭(`apps/mobile/src/app/(tabs)/index.tsx`, 헤더의 `router.push('/search')` 버튼,
341번째 줄 부근)의 검색 버튼을 없앤다. 알림 아이콘만 남긴다. 검색 자체는 하단 탭의
검색 탭(`(tabs)/search`)으로 계속 접근 가능하니 기능 손실은 아니다.
**아직 구현되지 않았다** — 다음 작업.

### 다음 작업 (미착수)
1. `react-native-webview` 설치 + 네이티브 래퍼 셸 구현
2. 웹 빌드 호스팅 방식 결정(`expo export -p web` 결과물을 어디에 올릴지)
3. 정책 1·2 실제 코드 반영
4. `docs/design-handoff/hybrid-web-qa-checklist.md` 기준으로 홈·진입/내비게이션·공통
   화면군부터 웹 렌더링 QA

---

## 인프라 현황

### 최신 P0 상태 (2026-09-03)

운영 기록은 `PROJECT_STATUS.md`와 동기화했다. 이번 작업에서 외부 콘솔·운영 DB·실기기를 재검증한 것은 아니다.

| 항목 | 상태와 남은 검증 |
|---|---|
| 로그인 설정 | APK의 callback·Client ID 반영 기록 있음. 네이버·카카오·Google·Apple 외부 등록과 실제 로그인 검증 필요 |
| 카카오맵 | 외부 카카오맵 열기가 채택된 방식. 업체 검색·상세에 링크 구현. 우리웨딩 지도와 웹 경로는 아래 6번의 잔여 작업 참고 |
| 운영 서버·DB | 2026-09-03 `/health` HTTP 200, `database: ok` 기록 있음. 전체 기능·마이그레이션 적용 완료를 뜻하지 않음 |
| 운영 마이그레이션 | 0052~0062 적용 여부 확인 필요. PR #53의 0003 → 0068 이동은 main 반영됨. 운영 적용 결과·기존 DB 이력 확인 필요 |
| iOS | Release #13의 Sign in with Apple 프로비저닝 권한 누락 기록. 수정 후 Production Build·TestFlight 확인 필요 |
| Android 제출 | Google Play 계정 본인확인 이의 제기 결과 대기 기록. 해제 후 제출 검증 |
| 기능 검증 | PR #53 머지 전 로컬(0912715 + 기존 작업 변경)에서 946개 통과, 별도 테스트 DB 미연결로 619개 스킵. 최신 main·실기기·운영 환경 전체 흐름은 미검증 |

P0 전체 항목의 완료 기준과 검증 증거가 확정되지 않아 P0 진척률은 미측정이다. `npm run progress`는 문서 표시 기반 전체 공정률이며 P0 출시 준비율이 아니다.

### 서버
- **API 서버**: Render — `https://weddingpickl.onrender.com`
- **DB**: Neon PostgreSQL (production)
- **스토리지**: NCP Object Storage (`weddingpick-test`, `PROJECT_STATUS.md` 기준). B2 관련 아래 기록은 과거 구성이다.
- **모바일 빌드**: EAS (Expo Application Services) + GitHub Actions

### GitHub Actions 워크플로
| 파일 | 역할 |
|---|---|
| `main.yml` | PR CI; main push 시 CI → DB 마이그레이션 → Render 배포·헬스체크 |
| `release.yml` | iOS EAS 빌드 배포 |
| `db-migrate.yml` | Neon DB 마이그레이션 적용 |
| `fly-init.yml` | 이전 Fly.io 초기화 기록(현재 운영 제외) |
| `eas-init.yml` | EAS 프로젝트 초기화 |
| `storage-test.yml` | B2 스토리지 연결 테스트 |
| `android-apk.yml` | Android APK 빌드 |

---

## 하이브리드 웹뷰 쉘 POC (2026-09-04, `hybrid/shell-poc` 브랜치, PR 별도)

`apps/mobile`의 웹 export(react-native-web, `npm run export:web`, CI `main.yml`의
`Bundle (web)` 스텝에서 이미 매번 빌드 검증됨)를 실제로 호스팅해서, 네이티브 쉘이
자기 자신의 웹 빌드를 웹뷰로 띄우는 구조를 검증한 POC다.

**인프라 정정(2026-09-04, 같은 세션 내 수정)**: 이 섹션은 처음에 "이 저장소는
Render를 쓰지 않는다"고 적었었다 — `main`만 보고 판단해서 생긴 착오다. 실제로는
`main`이 인프라 문서·CI(`main.yml`의 `flyctl deploy`)·`fly.toml` 전부 Fly.io
기준으로 **뒤처져** 있고, 실제 운영 인프라는 **Render**다(API:
`weddingpickl.onrender.com`, `claude/session-a4bq31` 브랜치의 `render.yaml`·
`docs/AI_HANDOFF.md`가 최신 상태 — 사용자가 직접 확인해준 사실이다). `main`의
나머지 Fly.io 언급(§인프라 현황, 2번 항목, 코드 구조 등)을 전부 Render로
갱신하는 것은 이 PR의 범위 밖이다 — 이 PR은 호스팅 설정 하나만 Render로 바꿨다.

### 1. 웹 번들 호스팅 — Render 정적 사이트, 설정만 추가함
- `main`에 없던 `render.yaml`을 새로 만들었다 — `claude/session-a4bq31`의
  실제 운영 정의(`weddingpick-web`/`weddingpick-admin`/`weddingpick-api`)를
  그대로 옮기고, 새 서비스 `weddingpick-app-web`을 추가했다.
- `weddingpick-app-web`: `buildCommand: npm run export:web --workspace
  @weddingpick/mobile`, `staticPublishPath: ./apps/mobile/dist`, expo-router
  클라이언트 라우팅을 위한 `/* → /index.html` rewrite 포함.
- **실제 Render 서비스 생성·배포는 하지 않았다.** 새 유료 리소스이므로 사용자
  승인이 필요하다 — 아래 "사용자 직접 조치 필요" 8번 참고.

### 2. 웹뷰 쉘 — 홈 · Pick 두 화면에 opt-in으로 배선
- `apps/mobile/src/features/webshell/WebShellView.tsx` — `react-native-webview`
  래퍼. `apps/mobile/src/app/(tabs)/index.tsx`(홈), `.../pick/index.tsx`(Pick)에
  연결.
- **기본값은 꺼짐이다.** `EXPO_PUBLIC_WEBSHELL_SCREENS` 환경변수(쉼표 목록, 예
  `"home,pick"`)에 화면 id가 들어있을 때만 그 화면이 웹뷰로 바뀐다
  (`features/webshell/config.ts`). eas.json에는 아무 값도 넣지 않았다 — 즉
  프로덕션·프리뷰 빌드는 지금과 똑같이 100% 네이티브다.
- **왜 opt-in인가**: 홈(`(tabs)/index.tsx`, 통합정책 C-1)과 Pick(`pick/index.tsx`,
  v3.2 §6)은 스텁이 아니라 이미 완성된 네이티브 화면이다. 웹뷰로 무조건 대체하면
  회귀 위험만 있고 얻는 것이 없다 — 그래서 검증용 스위치로만 만들었다. **다른
  세션이 이 방향을 실제 프로덕션 전환으로 오해하지 말 것.** 화면을 웹으로
  대체할지는 이 POC가 정하는 게 아니라 별도 결정이 필요하다.

### 3. 로그인 세션 전달 — 기존 `api/session.ts`를 그대로 재사용
- **결정**: URL 쿼리 파라미터로 최초 1회 전달 + 웹 쪽 저장은 새 메커니즘을 만들지
  않고 기존 `apps/mobile/src/api/session.ts`(`saveToken`/`loadToken`, AsyncStorage
  키 `weddingpick.sessionToken.v1`)를 그대로 쓴다. 웹 export는 같은 코드베이스가
  react-native-web으로 빌드된 것이라 AsyncStorage가 web에서는 localStorage로
  동작하는 폴리필을 그대로 쓰기 때문에 자연스럽게 맞는다.
- **흐름**: `WebShellView`가 `loadToken()`으로 토큰을 읽어 `?wp_token=<token>`을
  최초 진입 URL에 한 번만 붙인다(웹뷰 내부 이동에는 다시 붙이지 않는다) →
  `apps/mobile/src/app/_layout.tsx`(웹 타깃에서도 같은 파일)가 부팅 시
  `wp_token`을 읽어 `saveToken()`으로 저장하고 `history.replaceState`로 주소창·
  히스토리에서 지운다.
- **왜 postMessage나 쿠키가 아닌가**: 토큰이 opaque 문자열 하나뿐이고(리프레시
  토큰·만료시각은 클라이언트에 저장하지 않음, `api/client.ts`도 마찬가지), 서버가
  쿠키 세션을 발급하지 않는다(Bearer 헤더만). 네이티브 웹뷰와 호스팅된 정적
  사이트는 오리진이 달라 쿠키 공유도 애초에 안 된다. 반면 URL 파라미터 → 기존
  저장 함수 재사용은 새 프로토콜 없이 HTTPS 한 번으로 끝나고, 받은 즉시
  `replaceState`로 주소창에서 지워 히스토리·로그에 남지 않는다.

### 4. 네이티브로 유지되는 화면 — 손대지 않음
- WP-RPT-002(이미지 선택): `apps/mobile/src/app/(tabs)/capture/index.tsx`,
  `.../capture/camera.tsx`, `apps/mobile/src/features/capture/pickers.ts`
- WP-NOTI-003(알림 설정): `apps/mobile/src/app/(tabs)/my/notifications.tsx`
- 이번 POC 브랜치에서 이 파일들은 전혀 수정하지 않았다(git diff로 확인됨).

### 5. 아직 안 정한 것 (이 POC가 답하지 않은 부분)
- **웹뷰 내부 라우팅과 RN 라우터 동기화**: 지금은 화면 전체를 웹뷰로 통째로
  바꾸는 구조라, 웹뷰 안에서 (호스팅된 앱의) expo-router가 다른 경로로 이동해도
  네이티브 탭바·스택은 그 사실을 모른다. 웹뷰 화면 안에서 다른 탭으로 가야 하는
  링크를 누르면 어떻게 할지(웹뷰 안에서 그대로 이동 vs `postMessage`로 네이티브
  라우터에 알려서 네이티브 화면 전환) 정하지 않았다.
- **딥링크**: `weddingpick://` 커스텀 스킴이 웹뷰로 대체된 화면을 가리킬 때 동작을
  정하지 않았다.
- **로그아웃 시 웹뷰 쪽 정리**: 네이티브에서 `clearToken()` 호출 시 이미 열려있는
  웹뷰의 localStorage까지 지울지, 다음 로드 때만 반영할지 정하지 않았다.

---

## 🚨 사용자 직접 조치 필요 (Claude 불가)

### 8. 하이브리드 웹뷰 쉘 POC — Render 서비스 생성 필요 (2026-09-04, 도메인 확정 2026-09-05)
**상태**: `render.yaml`에 `weddingpick-app-web` 정의만 추가됨, 실제 서비스
미생성.

**도메인 결정(2026-09-05, 사용자 확정)**: 커스텀 도메인을 별도로 붙이지 않고
Render 기본 서브도메인 `weddingpick-app-web.onrender.com`을 그대로 쓴다. DNS
등록·연결 작업이 필요 없다.

**필요한 조치(사용자만 가능 — Claude는 Render 대시보드 접근 권한 없음)**:
1. Render 대시보드에서 이 저장소의 Blueprint(`render.yaml`)를 동기화하거나
   `weddingpick-app-web` 정적 사이트를 수동 생성 (새 유료 리소스 — 생성
   여부·요금제 확인 필요). 이름을 `weddingpick-app-web`으로 두면 위 도메인이
   그대로 나온다.
2. 생성·배포가 끝나면 운영자는 브라우저로 `https://weddingpick-app-web.onrender.com`에
   바로 접속해 `apps/mobile`의 실제 화면(react-native-web export)을 검수할 수
   있다 — 이 용도만으로는 네이티브 앱 빌드나 아래 3번 설정이 필요 없다.

**아래는 별개 작업(네이티브 앱이 자체적으로 이 URL을 웹뷰로 감싸게 하려는 경우에만 필요, 검수 목적이면 생략 가능)**:
3. 배포된 URL을 `apps/mobile/eas.json`의 `build.preview.env`와
   `build.production.env`에 `EXPO_PUBLIC_WEB_URL`로 추가
4. 실제로 웹뷰 쉘을 켜보려면 빌드 시 `EXPO_PUBLIC_WEBSHELL_SCREENS=home,pick`도
   함께 넣어야 함(기본은 꺼짐)

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
- `docs/통합정책 v3.15`와 실제 탈퇴 구현의 정합성을 확인.

### 1. iOS EAS 빌드 수정 — 최우선
`PROJECT_STATUS.md`의 최신 장애 기록은 Release #13의 Provisioning Profile에
Sign in with Apple capability/entitlement가 빠진 것이다. ASC API Key 등록 완료 기록이
있으므로 예전 #1~#10의 미등록 원인을 현재 원인으로 사용하지 않는다.

Apple Developer App ID `kr.weddingpick.app`의 Sign in with Apple 활성화를 확인하고,
EAS iOS Provisioning Profile을 재생성한 뒤 Production Build·TestFlight를 검증한다.
외부 콘솔 변경 완료 여부는 미검증이며, 최신 실패 로그 확인 없이 키를 교체하지 않는다.

### 2. Production DB 마이그레이션 적용
현재 남은 일은 운영 DB의 0052~0062 적용 이력과 main의 0068 변경 적용 결과 확인이다.
코드 병합·헬스체크 성공만으로 마이그레이션 완료로 판정하지 않는다.
아래 0052 enum 실패 설명은 분리 수정 전 이력이며, 현재 코드의 실패를 재확인한 결과가 아니다.
```
# GitHub Actions → db-migrate.yml → Run workflow
# 또는 직접:
DATABASE_URL=<neon-connection-string> npm run migrate --workspace @weddingpick/db
```
적용 대상: `0052_mission_draw.sql` (미션 완료 추적 + 월간 웨딩지원금 추첨 스키마)

**과거 수정 전 실패 기록:** `ALTER TYPE reward_kind ADD VALUE 'monthly_draw'`를
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

### 6. 지도 보기 — 카카오맵 외부 연결로 전환
**채택한 방식**: 앱 내부 카카오 지도 SDK가 아니라 공식 카카오맵 링크
(`https://map.kakao.com/?q=...`)를 연다. 전환된 외부 연결 경로에는 Google Maps 키가 필요 없다.
카카오맵 사용 설정·플랫폼 키 활성화는 운영 문서의 기록이며, 이번에는 콘솔을 재검증하지 않았다.

| 경로 | 코드 확인 결과 | 남은 작업 |
|---|---|---|
| `features/search/vendor-map.tsx` | 업체 선택 후 카카오맵 링크 열기 | Android/iOS 실기기에서 결과·복귀 확인 |
| `(tabs)/search/[vendorId]/index.tsx` | 업체명·지역으로 카카오맵 링크 열기 | 실제 위치 검색 결과 확인 |
| `(tabs)/wedding/[id]/map.tsx` | `react-native-maps`의 MapView 사용 잔존 | 채택한 카카오맵 방식과 통일 필요 |
| 검색·우리웨딩 `map.web.tsx` | 앱 이용 안내만 표시 | 웹에서 외부 링크를 제공할지 범위 확정 후 반영 |

`package.json`의 `react-native-maps`, `app.json`의 관련 플러그인·Google Maps 설정도
남아 있다. 따라서 의존성 제거 완료로 기록하지 않는다. 우리웨딩 사용처를 전환한 뒤 정리한다.
`expo-location` 플러그인 제거는 PR #53에서 main(5b0479b)에 반영됐다. 현재 위치 기능 영향과 main 배포 결과는 별도 확인한다.

### 7. 지도 보기 — 업체 좌표 지오코딩 실행
`0062_vendor_geo.sql` 적용 후 기존 업체는 전부 `lat`/`lng`가 NULL이다(좌표 없이 목록에는
그대로 뜨고 지도에만 안 뜬다). `scripts/geocode-vendors.mts`를 카카오 REST API 키로 돌려야
좌표가 채워진다. 좌표 백필은 외부 카카오맵 열기와 별도 작업이며, 링크 열기의 선행 조건은 아니다. 카카오 개발자 콘솔에서
키 발급 필요(Claude 불가).
```
DATABASE_URL=<neon-connection-string> KAKAO_REST_API_KEY=<발급받은 키> \
  npx tsx scripts/geocode-vendors.mts
```

---

## 세션별 작업 완료 현황

### 과거 세션 (session_01SLgCn4pWaQCTyYPzVLcbQr) — 2026-09-03 작업 기록

**완료 (커밋 df4a180, 브랜치 home/fe-p0-gaps):**
- ✅ `react-native-maps ~1.29.0` — `apps/mobile/package.json` 추가 (TS2307 해결)
- ✅ `pick/done.tsx`, `pick/confirm.tsx` — `useRef().current` → `useMemo` 전환
  (Cannot access refs during render, react-hooks/rules-of-hooks 해결)
- ✅ 33개 파일 — `setLoading(true)` 앞에 `eslint-disable-next-line react-hooks/set-state-in-effect` 삽입
- ✅ `client.ts` — 미사용 `ExpoItem`/`ExpoStatus` import 제거
- ✅ 로컬 검증: `npm run lint` → **0 errors, 12 warnings**, `npm run typecheck` → **0 errors**

**PR #51 상태 (2026-09-03 정정):**
- URL: https://github.com/jsexy0210-ship-it/WeddingPickl/pull/51
- 브랜치: `home/fe-p0-gaps` → `main`
- main 병합 완료: 7967312. 아래 감사 목록은 당시 기록이며, 새 작업 전 최신 API 구현을 재확인한다.

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
> 아래 SDK·Google Maps·현재 위치 설명은 당시 구현 이력이다. 현재 채택한 방식과 잔여 작업은 위 6번을 따른다. 여기의 완료·테스트 기록은 현재 릴리즈 검증 결과가 아니다.
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
│   ├── 통합정책 v3.15       # 현재 확정 기준 정책
│   ├── design-handoff/      # 디자인 핸드오프 (IA 176화면)
│   ├── AI_HANDOFF.md        # 이 파일
│   └── 05-product-spec.md   # Phase 1 제품 스펙 (A-01~A-18)
└── .github/workflows/       # CI/CD 워크플로
```

---

## 정책 문서 참조

기준: `docs/통합정책 v3.15`
코드와 정책이 충돌하면 **정책이 맞다.** 코드를 고친다.

주요 섹션:
- `§I-4` — 월간 웨딩지원금 추첨 (4개 미션 완료 조건, NPay 5만원×2명)
- `§J-3` — 탈퇴 화면 UX 문구
- `§A~§H` — 업체·검색·Pick·비교 핵심 정책

---

## 다음 작업 우선순위

1. **[AI]** PR #51·#53은 병합 완료. main(5b0479b)의 CI·마이그레이션·배포 결과와 핵심 흐름 검증
2. **[AI — 최우선]** 관리자 API 엔드포인트 추가 (`apps/api/src/routes/admin.ts`)
   - 최소: dashboard, faq, users, vendors, revenue, kill-switches, audit-log
   - 전체 목록: 위 "관리자 API 실질적 갭" 표 참고
3. **[사용자]** Release #13의 Sign in with Apple 권한·Provisioning Profile 수정 여부 확인 → iOS 빌드·TestFlight 검증
4. **[사용자]** Neon DB: `db-migrate.yml` 실행 → 0052 ~ 0062 적용
5. **[사용자]** terms.url · privacy.url 확정 → 도메인 상수 업데이트
6. **[AI/사용자]** 카카오맵 전환 잔여 경로·의존성 정리, Android/iOS 외부 링크 실기기 검증 (위 6번)
7. **[사용자]** 카카오 REST API 키 발급 → `scripts/geocode-vendors.mts` 실행해 업체 좌표 채우기
8. **[AI]** 공통 Bottom Sheet 16종 인라인 처리 여부 확인
9. **[사용자]** `weddingpick-app-web` Render 정적 사이트 생성(도메인 확정: 기본
   서브도메인 `weddingpick-app-web.onrender.com` 그대로 사용, 2026-09-05) — 위
   "사용자 직접 조치 필요" 8번 참고. 생성되면 운영자가 그 URL로 실제 앱 화면을
   바로 검수할 수 있다.
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
  - `docs/design-handoff/current/`는 원본 그대로 유지 — 화면 구현할 때 이 폴더 안의 `.dc.html` 파일을 직접 고치지 않는다(참고용 원본). 옛 `seed/`는 v3.11 반영 시점(2026-09-06)에 삭제했다.

## 롤백
- rollback_note: 커밋 4개(`f22a512`, `bba48ed`, `10ce66a`, `cf07b15`)는 서로 기능적으로 독립적이라 필요하면 개별 `git revert <hash>`로 되돌릴 수 있다. 순서상 뒤 커밋이 앞 커밋의 파일을 다시 건드리지 않으므로 역순 revert도 안전하다. 전부 origin/main에 push 완료 — 로컬에만 있는 미커밋 변경 없음(`.npm-cache/` 잡음 제외).

---

## 공정률 대시보드 (2026-09-02 추가)

`npm run progress`(이 저장소가 이미 갖고 있던 계산기)의 결과를 눈으로 보기 편하게 만든 Artifact를 만들어뒀다: **https://claude.ai/code/artifact/bf90e7aa-91ad-4df3-bcbd-dc950216663a**

- `db` capability로 발행했다. `snapshot/latest` 문서에 `npm run progress -- --format json`을 사람이 보기 좋은 모양으로 변환한 값을 담아두면, 열려 있는 페이지가 새로고침 없이 갱신된다.
- 갱신 방법: `npm run progress -- --format json`을 돌리고 그 결과를 대시보드가 기대하는 모양(`overallRate`, `items[]`, `inventory[]`, `openSections[]`, `unanswered[]`, `decisionSections[]`, `commits[]` 등 — 위 URL의 아티팩트 소스 상단 `FALLBACK` 상수를 참고)으로 옮긴 다음, Artifact 도구의 `write_db`로 `collection: "snapshot"`, `doc_id: "latest"`에 `set` 하면 된다. 사용자가 "progress 다시 돌리고 대시보드 갱신해줘"라고 하면 이 흐름을 그대로 하면 된다.
- 이 문서 위쪽 "변경 금지" 절이 회원탈퇴 자동삭제 백엔드를 만들지 말라고 적어뒀는데, 그 뒤 커밋(`e42d7c4`, `549e2fa` 등)에서 실제로 자동삭제 + 운영자 개입 기능이 만들어진 것으로 보인다 — **그 절이 낡았을 수 있다.** 다음 세션은 `packages/domain/src/withdrawal.ts`와 관련 마이그레이션(`0055_account_deletion.sql`, `0058_withdrawal_admin.sql`)을 직접 열어 지금 상태를 확인하고, 이 문서의 "변경 금지" 절을 현재 상태에 맞게 고칠 것.

