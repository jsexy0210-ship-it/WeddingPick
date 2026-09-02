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
-   Fly.io: API/Worker 배포 자동화 구성 진행 중

## 완료

-   Neon 연결 완료
-   Neon DB migration 실행 완료
-   기존 migration 46개 적용 완료
-   일정(`wedding_events`) 백엔드·화면 3개 구현 — 마이그레이션 0059, `docs/AI_HANDOFF.md`
    참고 (Neon production 미적용, `db-migrate.yml` 실행 필요)
-   지도 보기 백엔드·화면 구현 — 업체 좌표 컬럼(마이그레이션 0060) + `expo-location`/
    `react-native-maps` 도입 + 검색 화면 목록/지도 토글. 좌표 지오코딩은
    `scripts/geocode-vendors.mts`(카카오 로컬 API, 수동 실행) — 상세는
    `docs/AI_HANDOFF.md` "백엔드 — 일정 · 지도 보기" 절
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

1.  GitHub 중심 단일 CI/CD 통합
2.  iOS EAS Production Build 정상화
3.  Fly.io 자동 production deploy 정상화
4.  Fly.io `/health` 자동 검증
5.  TestFlight 제출 자동화 연결

## 현재 장애 / 제한

### iOS

-   최근 `EAS Build #5` 실패
-   Summary의 exit code 1만 확인된 상태
-   실제 실패 Step 로그를 기준으로 원인 수정 필요
-   추측으로 Apple Credential/API Key를 재생성하지 않는다.

### Fly.io

-   기존 GitHub Action에서 `fly: command not found` 오류 이력 있음
-   `flyctl` 설치 및 호출 구조 재검증 필요
-   Fly API Token은 Secret으로 관리하며 실제 값을 문서/로그에 기록하지
    않는다.

### Google Play

-   개발자 계정 본인확인 이의 제기 결과 대기 중
-   계정 제한 해제 전 Google Play production submit을 강제 실행하지
    않는다.
-   제한 해제 후 기존 release workflow에 제출 자동화를 연결한다.

## CI/CD 목표 구조

### 일반 개발

`Claude/Codex 수정 → GitHub commit/push → CI → 필요한 DB migration → Fly.io 자동 배포 → health check`

### 앱 릴리즈

`GitHub Release workflow 1회 → EAS Production Build → iOS/Android Build → Store Submit`

-   앱은 매 commit마다 production build하지 않는다.
-   CI 또는 migration 또는 deploy 또는 health check 실패 시 이후
    production 단계를 중단한다.
-   반복적인 Expo/Fly.io/Neon/App Store Connect/Google Play 수동 조작을
    최소화한다.

## 다음 작업 우선순위

1.  현재 GitHub Actions와 workflow 전체 점검
2.  중복 workflow 제거가 아니라 우선 재사용·통합
3.  `EAS Build #5` 실제 실패 로그 분석 및 수정
4.  Fly.io deploy 자동화 정상화
5.  `/health` 검증 성공
6.  iOS Production Build 성공
7.  TestFlight 제출 흐름 검증
8.  Google Play 계정 제한 해제 후 Android 제출 자동화 활성화
9.  Neon production에 마이그레이션 0052~0060 적용 (`db-migrate.yml`)
10. Google Maps Android API 키 발급 → `apps/mobile/app.json` 자리표시자 교체
11. 카카오 REST API 키 발급 → `scripts/geocode-vendors.mts`로 업체 좌표 백필

## 갱신 규칙

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

2026-09-02
