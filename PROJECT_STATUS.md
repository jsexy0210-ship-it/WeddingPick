# WeddingPick Project Status

> 이 문서는 웨딩픽의 현재 진행 상태를 ChatGPT, Claude, Codex가 공통으로
> 확인하기 위한 상태 문서다. 저장 경로: `/PROJECT_STATUS.md` 작업 시작
> 시 `/AI_START_HERE.md` → 최신 통합정책서 → 이 문서 → 최신 코드 순으로
> 확인한다.

## 현재 운영 기준

-   공식 Source of Truth: GitHub `jsexy0210-ship-it/WeddingPickl` 최신
    main
-   정책: GitHub 최신 통합정책서
-   현재 진행 상태: `PROJECT_STATUS.md`
-   실제 구현 여부: GitHub 최신 코드
-   기존 구현 확인 → 재사용 → 통합/재가공 → 없는 것만 신규 개발
-   GitHub Actions를 개발·검증·배포의 단일 컨트롤 타워로 운영한다.

## 현재 인프라 상태

-   GitHub: 코드·정책·Actions·Secrets 기준
-   Expo / EAS: Android/iOS 앱 빌드
-   Apple Developer / App Store Connect: iOS, TestFlight, App Store 배포
-   Google Play Console: Android 테스트 및 Play Store 배포
-   Neon: PostgreSQL 운영 DB
-   Naver Cloud Platform Object Storage: `weddingpick-test`
-   웨딩픽 웹사이트: 서비스 웹·정책·지원 페이지
-   Render: API 서버·운영 배포 기준 (`https://weddingpickl.onrender.com`)
-   (2026-09-05) Render Blueprint(`render.yaml`) 최초 동기화로 `weddingpick-web`·
    `weddingpick-admin`·`weddingpick-app-web`(실제 앱 화면 검수용, 하이브리드
    웹뷰 정적 호스팅)이 free 플랜으로 배포됨. `weddingpick-api`는 위 운영 API
    (`weddingpickl.onrender.com`)와 **별개인 신규 중복 서비스**로 함께 생성됨.
    사용자 최종 결정: 삭제하지 않고 **스테이징 API로 활용** — `NODE_ENV=staging`,
    `STORAGE_DRIVER=local`로 바꿔 S3 없이도 부팅되게 함(`render.yaml` 반영 완료).
    Neon에 운영과 분리된 `weddingpick_staging` DB를 새로 만들고
    `.github/workflows/db-migrate-staging.yml`(운영 `DATABASE_URL` secret과
    분리된 `STAGING_DATABASE_URL` secret 사용)로 0001~0073 전체 적용 완료.
    Render `weddingpick-api`에 해당 DB의 연결 문자열을 `DATABASE_URL`로 등록,
    배포 후 `/health` 응답 `{"ok":true,"database":"ok"}` 확인 완료 —
    **스테이징 API 정상 동작 확인됨(2026-09-05)**.

## 완료

-   Neon 연결 완료
-   Neon DB migration 실행 완료
-   기존 migration 46개 적용 완료
-   일정(`wedding_events`) 백엔드·화면 3개 구현 — 마이그레이션 0061, `docs/AI_HANDOFF.md`
    참고 (Neon production 미적용, `db-migrate.yml` 실행 필요)
-   지도 보기 백엔드·화면 구현 — 업체 좌표 컬럼(마이그레이션 0062) + 검색 화면
    목록/지도 토글. 업체 검색·상세는 공식 카카오맵 외부 링크를 사용한다.
    2026-09-03 코드 대조: 우리웨딩 MapView, `react-native-maps` 의존성과
    Google Maps 설정은 잔존한다. 전환·제거 전체 완료로 보지 않는다. 좌표 지오코딩은
    `scripts/geocode-vendors.mts`(카카오 로컬 API, 수동 실행) — 상세는
    `docs/AI_HANDOFF.md` "백엔드 — 일정 · 지도 보기" 절
-   마이그레이션 번호 충돌 수정 — PR #19가 다른 PR과 동시에 진행되며 `0059`·`0060`을
    각자 고른 채로 main에 머지됐다(사회 로그인 프로필·취향과 파일명 겹침). 일정·지도
    보기 마이그레이션을 `0061`·`0062`로 재번호
-   PR #16(취향 다시 고르기·준비 타임라인·예식 완료 등 프론트 화면) main 병합 완료.
    병합 과정에서 발견된 base 브랜치 lint 회귀 6곳(`react-hooks/set-state-in-effect`,
    `my/rebuttals`·`reports`·`rewards`·`vendor-claims`·`notifications`·`settings.tsx`)도
    함께 고침 — PR #19에 포함
-   NCP Object Storage 연결 완료
-   Object Storage 업로드/다운로드/삭제 테스트 성공
-   App Store Connect API 접근 승인
-   App Store Connect API Key `EAS Build` 생성
-   Expo에 App Store Connect API Key 등록
-   GitHub Actions에서 EAS Build 실행 가능 상태까지 연결

## 진행 중

### 웹 링크 공유 미리보기 (2026-09-04)

- 최신 main `7a1ffce` 기준 기존 OG를 공통 `apps/web/src/social-meta.ts`로 통합.
  공개 페이지별 OG URL·이미지 및 Twitter large image 카드 적용, 기존 favicon/manifest 유지.
- 공유 이미지: `apps/web/public/assets/weddingpick-og.png` (1200×630), 편집 원본 SVG 동봉.
  `spec/tokens.json` 공식 Pick Mark path 및 Coral 사용. 핵심 요소를 중앙 안전영역에 배치.
- 실제 접속 가능한 웹은 `https://weddingpick-web.onrender.com` (HTTP 200).
  배포 설정의 `weddingpick.kr`은 공용 DNS 8.8.8.8에서도 NXDOMAIN으로 확인되어 OG에 사용하지 않음.
- 로컬 웹 타입 검사 및 테스트 49개 통과. 실제 build 함수로 공개 HTML의 필수 태그 1회 노출,
  페이지별 URL, 이미지 규격, 기존 아이콘 파일 보존 검증. 이미지 시각 검수 완료.
- 시스템 Node에서 빌드/테스트 프로세스가 비정상 종료되어 번들 Node로 테스트·build 함수 검증.
  기존 main 문구 검사 위반 3건(landing-v4.ts/subpages.ts)은 이번 OG 변경과 무관하게 남아 있음.
- 완료: PR #64 main 병합 (`706c556`), CI `33847125953` 전체 성공, Render 웹 배포 완료.
- 2026-09-04 운영 검증: 일반·kakaotalk-scrap·Slackbot User-Agent 모두 HTTP 200.
  HTML source에 요청한 OG/Twitter 태그 9개가 각각 1회 노출되고 지정 title/description 일치.
- `https://weddingpick-web.onrender.com/assets/weddingpick-og.png` 인증 없이 HTTP 200,
  image/png, 1200×630. 브라우저 직접 열기 및 이미지 표시 확인. 검수 PNG와 운영 바이트 일치.
  SHA256: `40cf031d1d5115aac9ce907cc973826d10650a71214148d2c75e459b53e9a6e7`.
- 운영 favicon-32.png·apple-touch-icon.png·site.webmanifest 모두 HTTP 200.
- 남은 확인: 실제 메신저 앱 내부 미리보기/캐시 갱신 미검증.
  weddingpick.kr DNS 연결 완료 후 SITE_ORIGIN 변경 및 재검증 필요.

### 홍보 자동화 파이프라인 (2026-09-04)

- 범위: 출시 후 사용할 홍보 포맷과 자동화 파이프라인 준비. 실제 외부 게시 없음. dry_run만 허용.
- 구현 완료(이번 세션):
  - `packages/api-contract/src/marketing.ts` — Zod 스키마 (채널·포맷·상태·소재·잡·응답)
  - `packages/db/migrations/0072_marketing_pipeline.sql` — marketing_sources / marketing_jobs / marketing_events
  - `apps/api/src/marketing/content.ts` — 템플릿 기반 생성, 금지 표현·PII 검사, UTM 생성, 계획 프롬프트
  - `apps/api/src/marketing/store.ts` — DB CRUD, FOR UPDATE SKIP LOCKED, 재시도 한도
  - `apps/api/src/marketing/cli.ts` — demo / preview / simulate / facts CLI
  - `apps/api/src/marketing/demo.ts` — programmatic 예제 실행기
  - `apps/api/src/marketing/content.test.ts` — 단위 테스트 15개
  - `apps/api/src/routes/admin.ts` — 기존 빈 stub 교체, 8개 마케팅 엔드포인트
  - `apps/mobile/src/app/admin/marketing.tsx` — 새 스키마(queued/simulated/failed) 반영, 모의 실행 버튼
  - `docs/marketing-pipeline.md` — 파이프라인 사용 안내
  - `.github/workflows/main.yml` — CI 미리보기 생성 + 7일 artifact
  - `apps/api/package.json` — `marketing` 스크립트 추가
- 검증 한계:
  - DB 통합 테스트는 DATABASE_URL 부재로 미실행 (격리된 PG 필요)
  - 관리자 화면 실제 앱 실행·시각 검증 미완료
  - 운영 DB 마이그레이션 0072 미적용
- 실행 안내: `docs/marketing-pipeline.md`
- 아직 구현 안 됨: 실 SNS 게시 어댑터, AI API 자동 호출, 카드뉴스 이미지, 성과 수집, 상시 예약, 실게시 활성화 체계

### 웨딩픽 전용 공공데이터 수집 (2026-09-04)

- 추가 영향/비용 점검: docs/wedding-data-cost-impact.md. 상시 수집 서버는 불필요,
  Actions·Neon 사용량 증가 가능. 실제 계정 플랜/잔여 한도/청구액은 미확인.
  중복 다운로드, DB 이력 누적, migration 잠금, main CI/배포 영향도 기록했다.

- 사용자 확정: 공공데이터·업체 직접 제공·수집 허용 공식 출처를 원천으로 사용.
  Google·네이버·카카오 결과의 저장용 통합은 제외한다. 통합정책 N-9~N-12와
  AI_START_HERE.md에 모든 AI의 필수 확인 경로를 추가했다.
- 최신 main bbc6ce8에서 기존 public-data:import를 확장했다. 이천·제천 공개 CSV
  자동 다운로드, 전국 상권 CSV 어댑터, 최소 필드 추출, 출처별 최신성·중복·잠금 보호,
  기존 실행/변경 로그와 연결하는 DB 경로를 추가했다.
- 로컬 실수집: 이천 6개 + 제천 4개 = 10개, 제외 0개. 기준일과 수집시각을 분리했다.
  업체 운영 상태는 확인필요이며 전국 전체 수집 완료가 아니다.
- 로컬 단위/기존 파서 테스트 18개 통과, API 타입 검사 통과.
- 공유 PR: https://github.com/jsexy0210-ship-it/WeddingPickl/pull/62 (main 미병합).
  정책 변경도 PR에 있으므로 main 기준으로 적용 완료라고 보고하지 않는다.
- GitHub Actions 실행 33838694039는 계정 결제 실패 또는 지출 한도 문제로
  verify 작업 시작 전에 차단됐다(실행 화면 Annotations 확인). PostgreSQL 통합
  테스트는 미실행, 수집 작업은 skipped다. 계정 소유자가 Billing & plans 문제를
  해결한 뒤 검증 재실행 → main 병합 → 0071 migration → 수집 apply 순으로 진행한다.
- 현재 로컬 DATABASE_URL·공공데이터 API 키가 없다. 운영 DB 반영은 아직 미실행.
  0071_vendor_public_sources 적용과 GitHub Actions DB 반영 결과를 후속 확인한다.
- 카카오 API 응답을 저장하는 geocode-vendors.mts는 실행을 차단했다.
- 실행 안내: apps/api/src/public-data/README.md. 리스크: docs/wedding-data-source-risks.md.

1.  GitHub 중심 단일 CI/CD 통합
2.  iOS EAS Production Build 정상화
3.  Render production deploy 정상화
4.  Render `/health` 자동 검증
5.  TestFlight 제출 자동화 연결

### P0 운영 등록 점검 (2026-09-03)

- Android APK 워크플로의 네이버 callback을 운영 HTTPS 주소로 통일하고,
  카카오·Google 공개 Client ID를 production과 동일하게 주입했다.
- 외부 콘솔에서 남은 등록: 네이버 HTTPS callback,
  카카오 Redirect URI/플랫폼 키, Google Android·iOS OAuth 클라이언트,
  Apple Sign in Services ID/redirect, Render 운영 Secret 및 DB migration 확인.
- 카카오맵 사용 설정·플랫폼 키 활성화 기록이 있다(이번 문서 동기화에서 콘솔 재검증 안 함).
  업체 검색·상세는 카카오맵 공식 외부 링크로 전환했으며 이 경로에는 Google Maps 키가 필요 없다.
  우리웨딩 지도·웹 경로 및 의존성은 잔여 작업이다. 상세 경로는 `docs/AI_HANDOFF.md` 6번 참고.
- 2026-09-03 Render `https://weddingpickl.onrender.com/health` 검증 결과
  HTTP 200, `{"ok":true,"database":"ok"}`. 운영 DB 연결은 정상이며,
  migration 0052~0062 적용 여부는 DB Migrate 워크플로 실행 후 확정한다.
- 2026-09-03 Release #11은 코드 단계에 도달하기 전에 GitHub Actions 계정의
  결제 실패/지출 한도 초과로 차단됐다. GitHub 결제 없이 운영한다는 원칙상
  Actions 재시도 대신 EAS 대시보드 또는 승인된 외부 빌드 경로를 사용한다.
- Release #13에서 결제 제한은 해소됐지만 iOS 빌드는 Provisioning Profile에
  Sign in with Apple capability/entitlement가 없어 실패했다. Apple Developer의
  App ID `kr.weddingpick.app`에 Sign in with Apple을 활성화한 뒤 EAS iOS
  credentials에서 Provisioning Profile을 재생성해야 한다.

## 현재 장애 / 제한

### iOS

-   최신 문서 기록은 Release #13의 Sign in with Apple capability/entitlement 누락이다.
-   App ID 설정과 Provisioning Profile 수정 후 Production Build·TestFlight 검증 필요.
-   현재 외부 콘솔 상태와 최신 실패 Step 로그를 재확인한다.
-   추측으로 Apple Credential/API Key를 재생성하지 않는다.

### 이전 배포 기록

-   신규 배포·검증은 Render 기준으로만 진행한다.

### Google Play

-   개발자 계정 본인확인 이의 제기 결과 대기 중
-   계정 제한 해제 전 Google Play production submit을 강제 실행하지
    않는다.
-   제한 해제 후 기존 release workflow에 제출 자동화를 연결한다.

## CI/CD 목표 구조

### 일반 개발

`Claude/Codex 수정 → GitHub commit/push → CI → 필요한 DB migration → Render 자동 배포 → health check`

### 앱 릴리즈

`GitHub Release workflow 1회 → EAS Production Build → iOS/Android Build → Store Submit`

-   앱은 매 commit마다 production build하지 않는다.
-   CI 또는 migration 또는 deploy 또는 health check 실패 시 이후
    production 단계를 중단한다.
-   반복적인 Expo/Render/Neon/App Store Connect/Google Play 수동 조작을
    최소화한다.

## 다음 작업 우선순위

1.  현재 GitHub Actions와 workflow 전체 점검
2.  중복 workflow 제거가 아니라 우선 재사용·통합
3.  Release #13 이후 최신 실패 로그 확인, Sign in with Apple 권한·Provisioning Profile 수정 검증
4.  Render deploy 자동화 정상화
5.  Render `/health` 검증 성공
6.  iOS Production Build 성공
7.  TestFlight 제출 흐름 검증
8.  Google Play 계정 제한 해제 후 Android 제출 자동화 활성화
9.  Neon production에 마이그레이션 0052~0062 적용 (`db-migrate.yml`)
10. 카카오맵 잔여 경로·의존성 정리 및 운영 링크 실기기 검증(Android/iOS), 웹 제공 범위 확인
11. 카카오 REST API 키 발급 → `scripts/geocode-vendors.mts`로 업체 좌표 백필

### 홍보 파이프라인 후속 (2026-09-04)

12. 격리된 PostgreSQL에서 마이그레이션 0072 및 통합 테스트 검증
    - 중복 요청, 동시 처리(FOR UPDATE SKIP LOCKED), 예약 시각, 소재 만료·폐기, 재시도 한도 확인
13. 관리자 화면 실제 실행 — 소재 등록·생성·모의 흐름 시각 검증
14. VERIFIED_FACTS 추가 및 소재 등록 운영자 작성 흐름 보완
15. 실게시 활성화 조건 설계 (출시 기능·스토어 주소·채널 권한 확인 체크리스트)

## 제품 범위 결정

-   (2026-09-05) **플래너 기능·광고 제휴 기능을 삭제하기로 확정.** 우선순위는
    P2(출시 전 처리 필요, P0·P1보다는 후순위) — 상세는 `CLAUDE.md`의 "정책 변경 —
    2026-09-05" 절 참고. 착수 전 영향범위 조사·계획 보고가 선행되어야 한다.
-   (2026-09-02) **초기 출시는 예식 당일까지만 지원한다.** 예식 완료(post-wedding)
    이후 단계의 화면·CTA·API는 이번 출시 범위 밖 — 사용자·업체 데이터가 어느
    정도 모인 뒤 운영자가 판단해 추가 lifecycle 정책을 안내한다. 상세 근거와
    지침은 최신 통합정책서 D-4를 반드시 확인한다. 그 안내가 나오기 전까지 AI는
    예식 완료 전용 기능을 새로 만들지 않는다.

## 갱신 규칙

`docs/AI_HANDOFF.md`의 최신 P0 상태·지도 전환 절을 함께 갱신한다. 운영 기록과
코드·실기기 검증 결과를 구분하고 확인 날짜·커밋을 남긴다. 과거 세션 기록을 최신 완료 근거로 쓰지 않는다.
P0 항목별 완료 기준과 검증 증거가 확정되기 전에는 P0 진척률을 미측정으로 표시한다.
`npm run progress`의 전체 문서 공정률은 P0 출시 준비율이 아니다.

다음 상태가 변경되면 작업과 함께 이 파일을 갱신한다.

-   기능 완료
-   인프라 연결/제거
-   배포 구조 변경
-   장애 발생/해결
-   외부 심사 또는 계정 상태 변경
-   작업 우선순위 변경
-   중요한 프로젝트 진행 상태 변경

단순 리팩터링처럼 프로젝트 상태 변화가 없는 작업은 갱신하지 않아도 된다.

## 마지막 상태 기준일

2026-09-04
