# Release Audit Summary

- 감사 회차: **1차 (감사 전용 — 코드·문서 수정 없음)**
- 감사일: 2026-09-09
- 감사 대상 커밋: **`a7f2d73`** (origin/main · #150 병합 시점)
- 감사자 세션: Release Audit (MASTER 배분)

**출시 판정: BLOCKED**

P0 7건 · P1 21건. 출시 기준(P0=0 · P1=0)을 만족하지 않는다.

> **감사 중 main이 7커밋 움직였다.** 최초 조사는 `169a508` 기준이었고, MASTER의 경고를
> 받아 `a7f2d73`까지 받아 **모든 P0·P1을 새 HEAD에서 재검증했다.** 그 결과 2건이 이미
> 해소된 것으로 확인돼 아래 「감사 중 해소된 항목」으로 옮겼다. 남은 항목은 전부
> `a7f2d73`에서 재확인한 것이다.

이 보고서의 모든 발견사항에는 `파일:줄` 근거를 붙였다. 근거를 붙이지 못한 것은
결함이 아니라 「미검증」으로 따로 적었다. 값(키·토큰·접속 문자열·전화번호)은 어디에도
옮기지 않았고 위치만 적었다.

---

## 이번 감사에서 뒤집은 기존 판정

MASTER가 넘긴 기존 판정 중 셋은 현재 코드와 맞지 않는다. 근거를 들어 정정한다.

| 기존 판정 | 재검증 결과 |
|---|---|
| 「시안 ID 208개 중 61개가 코드에 흔적 없음」 | 리터럴 무흔적은 **68건**(61은 v3.22 이전 수치). 그러나 실제 미구현(**진짜 결번**)은 **5건**뿐이고, 그중 1건은 의도적 폐기라 **실질 4건**이다. 41건은 구현돼 있고 ID 주석만 없다(웹 LAND 6종·admin 4종 전부). 13건은 `screens.json`이 스스로 `excluded`/보류로 적어둔 것이다. **리터럴 grep은 결번 지표로 93% 오탐이다.** |
| 「화면 파일에 `paddingHorizontal` 숫자 직접 지정 101곳」 | 현재 `src/app/**`에 **165건**이나 그중 **164건이 `src/app/admin/**`**이고, **사용자 화면은 1건**뿐이다(`apps/mobile/src/app/(tabs)/capture/payment/register.tsx:582`). `docs/padding-audit-2026-09-09.md`가 이 정리를 기록하고 있다. 사용자 화면 기준으로는 사실상 해소됐고, 남은 것은 관리자 화면이다. |
| 「Depth Back — 화면 헤더 11곳 · 오류 화면 24곳」 | **수치는 정확하다.** `onBack={() => router.back()}` 총 35건 = ErrorView 문맥 24건 + 그 밖 11건으로 정확히 재현된다. 다만 11건 중 **공유 헤더(NavBar)를 실제로 덮는 것은 1건**(`apps/mobile/src/app/(tabs)/(home)/progress.tsx:112`)이고 나머지는 여러 줄에 걸친 ErrorView이거나 화면 내 단계 되돌리기(정당한 예외)다. **등급 P2.** |

「금지어 게이트가 48개 중 37개를 검사하지 않는다」는 판정은 **정확하다** — 아래 P1-10에서
스크립트로 재현했다. 「`worker.ts`가 배포되지 않는다」도 **정확하며, 영향이 기존 판정보다
훨씬 크다** — P0-2·P0-3으로 승격했다.

---

## 감사 중 해소된 항목 — 결함으로 세지 않는다

`169a508`에서 결함으로 잡았으나 `a7f2d73`에서 고쳐진 것을 확인했다. 총계에서 뺐다.

| 원래 등급 | 항목 | 해소 커밋 | 재확인 근거 |
|---|---|---|---|
| P0-5 | `app.json`의 사용처 0건 민감 권한 3종 | `0d2b68d` (#148) | `apps/mobile/app.json:28-30` — `permissions` 배열에 `android.permission.CAMERA` 하나만 남았다. `expo-image-picker` 플러그인에 `microphonePermission: false`도 함께 들어갔다(`app.json:58`) |
| P1-1 | CORS 허용 출처에 관리자·커스텀 도메인 누락 (G04) | `a7f2d73` (#150) | `infra/render-env.yml`의 `CORS_ORIGINS`에 admin 출처와 커스텀 도메인이 들어갔다. PATCH는 앞서 해소됨(`apps/api/src/server.ts:65`) |
| (기존 G10) | 마케팅 preview 아티팩트가 비어서 올라감 | `3c8877e` (#145) | `.github/workflows/main.yml`에 `MARKETING_PREVIEW_DIR` 단일 출처 + `include-hidden-files: true` + `if-no-files-found: error` |

**다음 항목은 새 HEAD에서도 그대로 열려 있음을 재확인했다** — `render.yaml`에 `type: worker`
**0건**(P0-2·P0-3), `infra/render-env.yml`에 `LEGAL_` **0건**(P0-7), `main.yml`의 배포 잡에
Environment 보호 **없음**(P0-6 — #145의 변경은 아티팩트 경로뿐이다), `sbiz-seoul` 스위치
마이그레이션 **없음**(P1-11), `lint-copy` CI 참조 **0건**(P1-10).

---

## P0

### P0-1. 이용자 문서 원본이 국외(Anthropic)로 전송되는데 개인정보처리방침이 이를 고지하지 않는다

- **문제** — 이용자가 올린 견적서·계약서·결제 영수증의 **이미지/PDF 바이트 전체**가
  마스킹 없이 Anthropic API로 전송된다. 그런데 개인정보처리방침의 처리위탁 표는
  문자인식·영상 분석 수탁자를 「수탁자가 정해지는 경우 서비스 내 처리방침에 공개」로,
  국외 이전은 「국외 이전이 발생하는 경우 … 공개합니다」로 **미래형으로** 적어두었다.
  수탁자는 이미 정해져 있고 국외 이전은 이미 발생한다.
- **영향** — 개인정보 보호법 제26조(위탁)·제28조의8(국외 이전) 위반. 구글 플레이
  데이터 안전 섹션의 「제3자와 공유」 미신고는 정책 위반으로 앱 게시 중단 사유다.
  문서에는 신랑신부 이름·예식일·업체명·금액·카드 승인번호가 그대로 들어 있다.
- **원인**
  - 전송: `apps/api/src/analysis/claude-analyzer.ts:17`(base64 인코딩) · `:22`·`:32`(document/image 블록)
  - 전송: `apps/api/src/analysis/claude-payment-reader.ts:20`(base64) · `:101`(메시지에 첨부)
  - 원본 로드(마스킹 없음): `apps/api/src/analysis/worker.ts:69` `deps.storage.download(row.storage_key)`
  - 미고지: `apps/web/src/subpages.ts:295`(처리위탁 표 — 수탁자 미기재) · `apps/web/src/subpages.ts:302`(국외 이전 — 미래형)
  - 완화책은 **출력 쪽에만** 있다(`claude-payment-reader.ts:32-55` 스키마에 카드번호 칸 없음,
    `apps/api/src/analysis/persist.ts:59`). **저장은 막았지만 전송은 막지 않았다.**
- **최소 수정안**
  1. `apps/web/src/subpages.ts:295` 처리위탁 표의 「문자인식·영상 분석」 행 수탁자 칸을
     실제 수탁자명·보유기준으로 교체.
  2. `apps/web/src/subpages.ts:302` 국외 이전 절을 미래형 서술이 아닌 **실제 이전 사실**
     (이전받는 자·국가·항목=문서 이미지·목적·시기·방법·보유기간·거부 방법)로 교체.
  3. 구글 플레이 콘솔 데이터 안전 양식에 「제3자와 공유」 신고(저장소 밖 작업).
- **P0 판정 근거** — MASTER가 P0/P1 판정을 위임한 항목이다. 구글 데이터 안전 미신고만이면
  P1로 볼 여지가 있으나, **국내법상 국외 이전 고지 의무 위반이 동시에 성립**하고
  고지 없이 이전한 상태로 서비스를 여는 것이므로 P0으로 판정한다.
- **수정 여부: 미수정 · 담당 배분 필요 (FE(웹 문안) + 운영(콘솔 신고))**

### P0-2. worker가 배포되지 않아 개인정보 자동파기(24시간)가 한 번도 실행되지 않는다

- **문제** — 개인정보처리방침과 이용약관이 「원본 이미지는 업로드 완료 시점부터 최대
  24시간 이내 삭제합니다」라고 약속하는데, 그 삭제를 수행하는 `sweepExpiredDocuments`가
  **스케줄된 실행 경로가 없다.**
- **영향** — 이용자의 신분 확인 가능한 문서 원본이 무기한 보관된다. 공표한 처리방침
  위반이자 개인정보 파기 의무(개인정보 보호법 제21조) 위반.
- **원인**
  - 유일한 주기 호출: `apps/api/src/worker.ts:85` (`sweep` 인터벌 안)
  - `render.yaml`에 `type: worker` 서비스가 **없다** — 정의된 서비스는 `render.yaml:13`(web) ·
    `:34`(admin) · `:58`(app-web) · `:104`(api) 넷뿐이다
  - API 서비스의 실행 명령은 `Dockerfile:11` → `apps/api/package.json:7` = `src/index.ts`(HTTP 서버)
  - `npm run worker`(`apps/api/package.json:10`)를 부르는 워크플로가 없다
  - 코드 자신이 이 사실을 인정한다: `apps/api/src/index.ts:88` 「지금 배포에는 worker
    서비스가 없다(render.yaml)」
  - 약속한 문구: `apps/web/src/subpages.ts:287` · `apps/web/src/subpages.ts:208`(약관 제7조)
  - 수동 경로는 있으나 스케줄이 아니다: `apps/api/src/routes/admin.ts:597` · `apps/api/src/retention-admin.ts:100`
- **최소 수정안** — `render.yaml`에 워커 서비스 1개를 추가한다(같은 Dockerfile, 시작 명령만
  `npm run worker --workspace @weddingpick/api`). 운영 API가 Blueprint 밖에서 관리되므로
  Render 대시보드 수동 생성이 필요할 수 있다. 그때까지의 임시 방편으로는
  `apps/api/src/index.ts:93`의 부팅 시 1회 정리 블록에 `sweepExpiredDocuments`를 함께 넣는
  방법이 있으나, **24시간 약속을 지키지 못하므로 임시 방편이지 해결이 아니다.**
- **수정 여부: 미수정 · 담당 배분 필요 (RELEASE 또는 BE)**

### P0-3. worker 미배포로 견적서 분석이 영원히 «분석 중»에 멈춘다 — 핵심 기능 사용 불가

- **문제** — 문서를 올리면 `analyses` 행이 `pending`으로 생성되는데, 이를 집어가는
  프로세스가 배포돼 있지 않아 상태가 바뀌지 않는다.
- **영향** — 사용자는 견적서를 올린 뒤 무한히 「분석 중」 화면을 본다. 실패 표시조차
  없어 재시도할 방법도 없다. 제품의 핵심 가치(문서에서 금액을 읽어오는 것)가 동작하지 않는다.
- **원인**
  - 생성: `apps/api/src/routes/documents.ts:155-158` — `INSERT INTO structured.analyses` (기본 status `pending`)
  - 소비: `apps/api/src/analysis/worker.ts:33-45` `claim()` — worker.ts에서만 호출된다
  - 조회 응답: `apps/api/src/routes/analyses.ts:41-42` — `pending`/`running`을 그대로 돌려준다
  - 배포 부재 근거는 P0-2와 동일(`render.yaml`에 worker 서비스 없음)
- **최소 수정안** — P0-2와 같은 수정 하나로 함께 해소된다(워커 서비스 1개 추가).
- **수정 여부: 미수정 · 담당 배분 필요 (RELEASE 또는 BE) — P0-2와 묶어서 처리**

### P0-4. 모바일에 전역 오류 경계·오프라인 처리가 전혀 없다 — 렌더 예외 시 흰 화면

- **문제** — Error boundary가 0건이고, 네트워크 연결 감지가 0건이며, 이미 만들어 둔
  오프라인 UI 3종이 전부 호출부 0건인 죽은 코드다.
- **영향** — 프로덕션 빌드에서 렌더 예외가 나면 앱이 흰 화면으로 죽고 복구 수단이 없다
  (개발 빌드의 expo-router 기본 오류 화면은 프로덕션에 없다). 비행기 모드·지하철에서는
  화면마다 제각각인 회색 텍스트만 보이고 「연결이 불안정해요」 화면은 뜨지 않는다.
- **원인** (수치는 `apps/mobile/src` 기준 직접 grep으로 재현)
  - `ErrorBoundary` · `componentDidCatch` · `getDerivedStateFromError` — **0건**
  - `NetInfo` · `isInternetReachable` — **0건** (`@react-native-community/netinfo` 미설치)
  - `apps/mobile/src/app/_layout.tsx:281-297` — `ThemeProvider > DocumentStoreProvider >
    CaptureDraftProvider > Stack`만 감싼다. 오류 경계 없음
  - 죽은 코드 3종:
    - `apps/mobile/src/features/errors/full-screen-error.tsx` (WP-APP-006 「연결이 불안정해요」) — 호출부 0건
    - `packages/ui/src/status-view.tsx:249` `NetworkErrorView` (WP-ST-010) — 호출부 0건
    - `apps/mobile/src/features/errors/kind.ts:19` `errorKindOf()` — 유닛 테스트만 있고 화면 호출부 0건
  - 신호 자체는 잘 만들어져 있다: `apps/mobile/src/api/client.ts:290-292`가 fetch 실패를
    `status: null`로 구분해 던진다. **읽는 화면이 하나도 없을 뿐이다.**
- **최소 수정안**
  1. `apps/mobile/src/app/_layout.tsx:281`의 Provider 스택 최상단에 오류 경계 컴포넌트를
     하나 감싸고, 그 fallback으로 이미 있는 `FullScreenError`를 쓴다.
  2. 목록 화면의 `<ErrorView>`가 `errorKindOf(error)`를 보고 `status === null`이면
     `NetworkErrorView`를 쓰도록 분기. 이미 있는 부품 3개를 연결만 하면 된다 — 새로 만들 것 없음.
- **수정 여부: 미수정 · 담당 배분 필요 (FE)**

### P0-5. 견적서 업로드 경로에 동의 절차가 아예 없다 — 묻지도 기록하지도 않는다

MASTER가 배포 세션 실측으로 넘긴 항목이다. **재확인했고 등급을 매겼다.**

- **문제** — 견적서 원본이 외부(Anthropic)로 전송되는데, 그 경로에 동의 화면도 서버
  동의 기록도 없다. **같은 앱의 결제 증빙 경로에는 둘 다 있다** — 즉 정책적 결정이 아니라
  누락이다.
- **영향** — 개인정보 보호법상 수집·이용 동의와 국외 이전 동의를 받지 않은 상태로
  개인정보가 국외로 나간다. P0-1(고지 부재)과 원인이 다르다 — 그쪽은 «적지 않았다»,
  이쪽은 «묻지 않았다»라서 수정 대상도 다르다. Google Play 데이터 안전 선언과도 어긋난다.
- **원인** (직접 재확인)
  - 두 경로의 비대칭이 근거다:
    - 결제 증빙(경로 B): `apps/mobile/src/app/(tabs)/capture/index.tsx:68` →
      `/capture/payment/consent`로 보낸다. 서버 기록도 있다
    - 견적서(경로 A): `apps/mobile/src/app/(tabs)/capture/index.tsx:78` →
      `/capture/review` 또는 `/capture/camera`로 **바로 간다.** 중간에 동의 없음
  - 업로드 지점에도 게이트가 없다: `apps/mobile/src/app/(tabs)/capture/review.tsx:48`
    `uploadForAnalysis(pages)` → `:51` 화면 이동. 동의 단계 없음
  - 서버도 막지 않는다: `apps/api/src/routes/documents.ts`와
    `apps/mobile/src/features/capture/upload.ts`에 `consent` 참조 **각 0건**
  - 가입 동의로 덮이지 않는다: `packages/domain/src/signup.ts`의 `CONSENT_ITEMS`는
    이용약관·개인정보처리방침·혜택 소식 셋뿐. 문서 분석이나 국외 전송을 지목한 항목이 없다
- **범위 정정 (MASTER 전달 내용 대비)** — 경로 A는 **견적서까지이고 계약서는 받지 않는다.**
  코드가 명시한다: `apps/mobile/src/app/(tabs)/capture/index.tsx:50` 「계약서 원본은
  받지 않는다(비밀유지 조항 · 법률 확인 전)」. 다만 견적서에도 이름·예식일·업체명·금액이
  들어 있어 결함의 성립에는 영향이 없다.
- **최소 수정안** — `capture/index.tsx:78`의 견적서 진입을 결제 증빙과 같은 모양으로
  동의 화면에 먼저 보내고, 그 동의를 서버에 기록한 뒤에야 `uploadForAnalysis`가 통과하도록
  `routes/documents.ts`에 게이트를 건다. **문구는 쓰지 않았다 — 법률 문구는 사용자 결정이다.**
- **P0 판정 근거** — MASTER가 등급을 위임했다. 동의 없는 개인정보 국외 이전은 고지 누락보다
  무거우며, 같은 앱의 다른 경로가 이미 동의를 받고 있어 «미결정 사항»으로 볼 수도 없다.
- **수정 여부: 미수정 · 담당 배분 필요 (FE + BE · 문구는 사용자 결정 선행)**

### P0-6. main에 push할 때마다 운영 DB에 마이그레이션이 승인·백업 없이 자동 적용된다

- **문제** — `deploy-staging` 잡이 `github.ref == 'refs/heads/main'`인 모든 push에서 돌고,
  `secrets.DATABASE_URL`(= 운영 DB)에 마이그레이션을 적용한다. GitHub Environment
  보호 규칙도, 백업도, dry-run도 없다.
- **영향** — 잘못된 마이그레이션이 main에 들어가는 순간 운영 데이터가 손상되고 되돌릴
  방법이 없다. 저장소에는 실제로 파괴적 구문을 담은 마이그레이션이 있다 —
  `packages/db/migrations/0081_drop_planner_agency_vendors.sql:8` `DELETE FROM structured.vendors …`,
  `packages/db/migrations/0089_taste_category.sql:36` `DELETE FROM structured.taste_preferences …`.
- **원인**
  - `.github/workflows/main.yml:91` `deploy-staging` · `:93-96` 트리거 조건(main push)
  - `.github/workflows/main.yml:110-112` `npm run migrate` + `DATABASE_URL: ${{ secrets.DATABASE_URL }}`
  - `.github/workflows/main.yml:183` `deploy-production`도 같은 시크릿을 쓴다
  - `secrets.DATABASE_URL`이 운영 DB라는 근거: `infra/render-env.yml`의 운영 API(`WeddingPickl`)
    `secrets` 목록에 `DATABASE_URL`이 선언돼 있고, 같은 파일 주석이 이 값이 운영 API가
    쓰는 DB임을 설명한다
  - `main.yml` 전체에 job 레벨 `environment:` 키가 없다(21번째 줄의 `environment:`는
    `workflow_dispatch` 입력 이름이지 보호 규칙이 아니다)
  - **DB를 나누지 않기로 한 것은 사용자 결정이다**(`main.yml:87-90` 주석). 이 항목이
    지적하는 것은 DB 공유가 아니라 **승인 게이트와 백업의 부재**다.
- **최소 수정안** — `.github/workflows/main.yml:91`의 `deploy-staging` job에
  `environment: production`을 추가하고 GitHub에서 그 Environment에 required reviewer를
  건다. 마이그레이션 스텝 앞에 백업(또는 Neon 브랜치 스냅샷) 스텝을 넣는다.
- **수정 여부: 미수정 · 담당 배분 필요 (RELEASE)**

### P0-7. 운영 API의 `LEGAL_*` 8개가 비어 있으면 서버가 부팅되지 않는다 — 저장소에서 확인 불가

- **문제** — `assertReleasable`이 production에서 필수 법적 고지 8개 중 하나라도 비었거나
  placeholder면 **throw**하고, 이 호출이 API 부팅 경로에 있다.
- **영향** — 값이 안 채워져 있으면 운영 API가 아예 뜨지 않는다(전면 장애). 채워져
  있더라도 `TBD`·`미정`·`확인 필요` 같은 임시값이면 같은 결과다.
- **원인**
  - `packages/domain/src/release-gate.ts:118-127` `assertReleasable` — production이면 throw
  - `packages/domain/src/release-gate.ts:15-24` `REQUIRED_LEGAL_FIELDS` 8개
  - `packages/domain/src/release-gate.ts:40` `PLACEHOLDER_MARKERS`
  - 호출: `apps/api/src/index.ts:49` — 부팅 시점
  - 값 출처: `apps/api/src/config.ts:97-104` (`LEGAL_*` 환경변수)
  - `infra/render-env.yml`의 운영 API `secrets` 목록에는 `DATABASE_URL`·`KAKAO_CLIENT_SECRET`
    **둘뿐이고 `LEGAL_*`가 없다.** 같은 파일이 「여기 적히지 않은 키는 건드리지 않는다」고
    적고 있으므로 값은 Render 대시보드에만 있다 — **저장소에서 확인 불가**
- **참고 — 기존 판정 정정** — 「`terms.url`·`privacy.url` 미설정 시 throw」라는 기존 기록은
  **현재 코드에서 사실이 아니다.** `packages/domain/src/policies.ts:30`·`:37`에 URL이
  설정돼 있어 `release-gate.ts:85-87`의 `blockingDocuments`는 빈 배열이다. 남은 차단
  요인은 `LEGAL_*` 8개뿐이다.
- **최소 수정안** — 코드 수정 없음. Render 운영 서비스에서 `LEGAL_*` 8개가 실값으로
  채워져 있는지 확인하고, 확인 결과를 `infra/render-env.yml`에 키 이름만 선언해
  저장소가 원본이 되게 한다(값은 GitHub Secrets).
- **수정 여부: 미수정 · 미검증(외부 콘솔) · 담당 배분 필요 (RELEASE)**

---

## P1

| # | 문제 | 영향 | 원인(파일:줄) | 최소 수정안 | 수정 여부 |
|---|---|---|---|---|---|
| ~~P1-1~~ | ~~CORS 허용 출처에 관리자·커스텀 도메인 누락~~ | — | — | — | **해소됨 (`a7f2d73` / #150) — 위 「감사 중 해소된 항목」 참조** |
| **P1-22** | 카카오 REST API 키가 **public 저장소**에 평문 커밋돼 있고, 용도가 둘이다 | 제3자가 이 키로 카카오 REST API 할당량을 프로젝트 명의로 소진시킬 수 있다. 로그인용 키와 같은 값이라 교체하면 리다이렉트 URI 재등록까지 따라온다 | `infra/render-env.yml`이 이 키를 `secrets:`가 아니라 **`vars:`에 평문으로** 둔다(운영 API의 `KAKAO_APP_KEY`, app-web의 `EXPO_PUBLIC_KAKAO_CLIENT_ID` — 같은 값. **값은 여기 옮기지 않았다**). 두 번째 용도가 문제다 — `apps/api/src/seed-sample-images.ts:47`이 `Authorization: KakaoAK ${appKey}` 헤더로 서버에서 카카오 이미지 검색을 부르고, 키 출처는 같은 파일 `:72` `process.env.KAKAO_APP_KEY`다. **그 자리에서 이 키는 공개 식별자가 아니라 자격증명이다.** 그리고 이 스크립트는 실제로 워크플로에서 돈다: `.github/workflows/db-seed-samples.yml:62` | 서버 호출용 키를 카카오 콘솔에서 별도 발급해 GitHub Secrets로 옮기고, `seed-sample-images.ts:72`가 그 새 변수를 읽게 한다. 로그인용 client_id는 공개 값이 맞으므로 `vars:`에 그대로 둔다 | 미수정 · 담당 배분 필요 (RELEASE + DATA) |
| P1-2 | 관리자 화면의 API 주소 기본값이 `localhost:3000` | 배포된 관리자 페이지를 열면 아무것도 안 뜨고, 운영자가 매번 주소를 손으로 넣어야 한다. `WEDDINGPICK_API_URL`을 넣어줬는데도 읽지 않는다 | `apps/web/src/admin-page.ts:226` `sessionStorage.getItem('wp_admin_api') \|\| 'http://localhost:3000'` | 빌드 시 주입되는 `WEDDINGPICK_API_URL`을 기본값으로 쓰도록 `admin-page.ts:226` 수정 | 미수정 · 담당 배분 필요 (FE) |
| P1-3 | `KeyboardAvoidingView`가 저장소 전체 0건 | 바텀시트 폼에서 키보드가 저장/취소 CTA를 덮어 입력을 끝낼 수 없다 | grep 0건(`apps/mobile/src`·`packages/ui/src`). 위험 화면: `apps/mobile/src/app/(tabs)/wedding/[id]/notes.tsx:284` · `.../tasks.tsx:239` · `.../visit-notes.tsx:146` · `apps/mobile/src/app/(tabs)/my/profile.tsx:142` · `.../my/settings.tsx:243` (전부 `apps/mobile/src/features/common/bottom-sheet.tsx`의 Modal 안) | `bottom-sheet.tsx`의 Modal 내부를 `KeyboardAvoidingView`로 감싸면 5개 화면이 한 번에 해소된다 | 미수정 · 담당 배분 필요 (FE) |
| P1-4 | API fetch에 타임아웃이 없다 | 응답이 오지 않는 요청이 무한 로딩으로 남는다. 사용자가 앱을 껐다 켜는 것 말고 방법이 없다 | `apps/mobile/src/api/client.ts:281` `fetch()` — `AbortController`/`AbortSignal` 저장소 전체 0건 | `client.ts:281`에 `signal: AbortSignal.timeout(…)` 추가 | 미수정 · 담당 배분 필요 (FE) |
| P1-5 | 푸시 알림에 딥링크가 전혀 없다 | 알림을 눌러도 홈으로만 간다. 알림의 목적(해당 화면으로 보내기)이 성립하지 않는다 | 발송 payload에 `data` 없음: `apps/api/src/push/expo.ts:35-42`. 수신 핸들러 0건 — `addNotificationResponseReceivedListener`·`useLastNotificationResponse`·`setNotificationHandler` 전부 `apps/mobile/src`에서 0건. `expo-notifications` 참조는 `apps/mobile/src/features/notifications/register-device.ts:2`(등록 전용) 한 곳 | `expo.ts:35-42`에 `data: { targetId, kind }` 추가 + 앱에 응답 리스너 1개 추가. 라우팅 매핑은 `apps/mobile/src/app/(tabs)/my/notifications.tsx:23-31`의 `go()`를 재사용 | 미수정 · 담당 배분 필요 (BE+FE) |
| P1-6 | 테스트/스테이징에서 실제 푸시 발송을 막는 장치가 없다 | 스테이징 DB에 실사용자 토큰이 있으면 테스트 발송이 실제 사용자 폰으로 나간다 | `apps/api/src/push/expo.ts:31` — 조건 없이 Expo 발송 엔드포인트로 POST. `apps/api/src/push`·`notify`·`retention`·`worker.ts` 전체에 `NODE_ENV`·`dryRun` 문자열 0건. 스테이징은 `render.yaml:113-114` `NODE_ENV=staging` | `expo.ts:31` 앞에 `NODE_ENV !== 'production'`이면 로그만 남기고 반환하는 가드 추가 | 미수정 · 담당 배분 필요 (BE) |
| P1-7 | 사용자 대면 알림 18곳이 푸시 없이 알림함에만 쌓인다 | 심사 결과·반론·리워드 알림이 폰에 뜨지 않는다. 사용자가 앱을 열어봐야만 안다 | 두 경로가 갈려 있다 — `apps/api/src/notify.ts:14` `notify()`(알림함 INSERT만) vs `apps/api/src/notify/send.ts:87` `deliver()`(설정·한도·푸시 전부 적용). `notify()` 사용처: `apps/api/src/verification-admin.ts:498`·`:538`·`:578`, `apps/api/src/rebuttal-decide.ts:126`·`:147`, `apps/api/src/objection-decide.ts:102`·`:155`, `apps/api/src/routes/rewards.ts:193`·`:240`, `apps/api/src/routes/wedding-invites.ts:247`, `apps/api/src/routes/reviews.ts:722`·`:819` 외 | 의도인지 누락인지 먼저 판정. 누락이면 해당 호출을 `deliver()`로 교체 | 미수정 · 담당 배분 필요 (BE) |
| P1-8 | AI 호출이 타임아웃·429·5xx일 때 폴백이 없다 | 결제내역 읽기가 500으로 끝난다. 예산 소진일 때만 규칙 폴백이 있고 장애일 때는 없다 | `apps/api/src/analysis/proof-pipeline.ts:197-211` rethrow, `apps/api/src/routes/payment-proofs.ts:105`에 try/catch 없음. 상위 모델 재호출 `proof-pipeline.ts:231`은 try/catch 자체가 없어 이미 얻은 저비용 모델 결과까지 버린다. 문서 분석은 `apps/api/src/analysis/worker.ts:151-155`에서 재시도 없이 영구 `failed` | 예산 소진 폴백(`proof-pipeline.ts:180-192`)과 같은 경로를 예외에도 적용 | 미수정 · 담당 배분 필요 (BE) |
| P1-9 | Anthropic 클라이언트에 timeout·maxRetries가 지정돼 있지 않다 | SDK 기본값(10분 타임아웃 × 재시도)에 의존해 요청 하나가 워커를 최대 30분 붙잡을 수 있다 | `apps/api/src/analysis/claude-analyzer.ts:37` · `apps/api/src/analysis/claude-payment-reader.ts:82` — 둘 다 `new Anthropic()` 인자 없음 | 두 줄에 `{ timeout, maxRetries }` 명시 | 미수정 · 담당 배분 필요 (BE) |
| P1-10 | 금지어 게이트가 `spec/glossary.json`을 읽지 않고, 읽는 스크립트는 CI에 연결돼 있지 않다 | 48개 금지어 중 **37개가 검사되지 않는다**(스크립트로 재현). v3.18·v3.22·v3.24 용어 전부가 무방비 | `packages/domain/src/copy-rules.ts:12` `BANNED_PHRASES`는 하드코딩 22개. `spec/glossary.json`을 읽는 `lint-copy.js:17`은 **어느 package.json script에도, 어느 워크플로에도 참조가 없다**(grep 0건). 실제로 돌려보니 실 위반 검출: `apps/api/src/routes/wedding-invites.ts:251` 「관심업체」(알림 본문), `packages/domain/src/review-checklist.ts:177` 「별점」(→ `apps/api/src/review-view.ts:78`로 사용자에게 전달), `packages/domain/src/review.ts:322` 「별점」(검증 오류 문구), `packages/domain/src/payment-proof.ts:79`·`:162`·`packages/domain/src/price-report.ts:108` 「중앙값」, `packages/domain/src/disclosure.ts:229` 「데이터」 | `.github/workflows/main.yml`의 CI 잡에 `node lint-copy.js spec/strings.ko.json apps packages` 스텝 추가. 그러면 위 위반이 자동으로 드러난다 | 미수정 · 담당 배분 필요 (FE 또는 RELEASE) |
| P1-11 | `sbiz-seoul`·`sbiz-gyeonggi` 킬 스위치 행이 없어 주간 수집이 전량 실패한다 | 토요일 크론이 매주 실패한다. 공공데이터가 한 건도 들어오지 않는다 | **실제 DB로 재현** — 마이그레이션 93개를 빈 DB에 적용한 뒤 조회하니 `structured.import_switches`에 `icheon-halls`·`jecheon-halls`·`localdata`·`sbiz` 4행뿐. `apps/api/src/public-data/sync.ts:22-23`은 행이 없으면 `SOURCE_DISABLED`를 던진다. 크론은 이 두 출처를 `--apply`한다: `.github/workflows/public-data.yml:18`(cron) · `:69`·`:71`(matrix) · `:118` | 새 마이그레이션 1개로 두 `source_key` 행을 INSERT | 미수정 · 담당 배분 필요 (DATA) |
| P1-12 | 킬 스위치 부재 시 동작이 두 경로에서 정반대다 | 새 출처를 켜지도 끄지도 못한다. 관리자 토글은 UPDATE만 해서 없는 행에 404를 낸다 | `apps/api/src/public-data/sync.ts:23` 행 없음 → **차단**. `apps/api/src/public-data-import.ts:163-173` 행 없음 → **허용**(주석에 명시). 토글: `apps/api/src/routes/admin.ts:856-866` UPDATE만 | 두 경로의 기본값을 하나로 통일하고, 토글을 upsert로 바꾼다 | 미수정 · 담당 배분 필요 (DATA/BE) |
| P1-13 | 저작권 근거 `unknown`인 업체 이미지가 그대로 노출된다 | 제3자 이미지를 권리 근거 없이 핫링크로 노출한다. 저작권 분쟁 위험 | 마이그레이션이 「이 상태는 노출하지 않는다」고 적었으나(`packages/db/migrations/0050_vendor_images.sql:24`) 제약은 `kogl_type4`만 막는다(`:95-96`). 노출 쿼리는 `status='approved'`만 보고 `copyright_basis`를 보지 않는다: `apps/api/src/routes/vendors.ts:186`·`:575`·`:781`, `apps/api/src/routes/candidates.ts:61`, `apps/api/src/routes/recommendations.ts:157`. 그리고 `unknown`+`approved`를 실제로 넣는 코드가 있다: `apps/api/src/seed-sample-images.ts:127-128`(카카오 이미지 검색 결과) | 노출 쿼리 5곳에 `copyright_basis <> 'unknown'` 조건 추가. **그리고 출시 전 시드 이미지 제거** — 파일 자신이 `seed-sample-images.ts:7-8`에서 「검수용 · 출시 전 교체」라고 적고 있으나 강제하는 장치가 없다 | 미수정 · 담당 배분 필요 (BE+DATA) |
| P1-14 | 개인정보처리방침·이용약관이 「초안」 상태다 | 확정 전 문안으로 스토어 심사에 제출하면 실제 처리 항목과 불일치로 반려될 수 있다 | `packages/domain/src/policies.ts:28`·`:35` `status: '초안 게시'`. 앱 내 뷰어 `apps/mobile/src/app/(tabs)/my/privacy.tsx:22` `LAST_UPDATED = '확정 전'`, 본문에 「법률 자문 후 최종본으로 교체해요」 | 확정본 교체 | 미수정 · 담당 배분 필요 (운영/법무) |
| P1-15 | 앱의 약관·방침 링크와 API 주소가 `.onrender.com`을 가리킨다 | 스토어 심사에 무료 호스팅 주소가 그대로 노출되고, 콜드스타트로 링크가 느리게 뜬다. 도메인 이전 시 구버전 앱의 링크가 깨진다 | `packages/domain/src/site.ts:8` `SITE_ORIGIN`, `apps/mobile/eas.json:33`·`:39`(production 프로필 `EXPO_PUBLIC_API_URL`) | `weddingpick.kr` DNS 연결 후 두 곳 교체 | 미수정 · 담당 배분 필요 (RELEASE) |
| P1-16 | 메모·할 일·방문기록에 중복 제출 방어가 없다 | 버튼을 두 번 누르면 같은 항목이 두 개 생긴다 | `apps/mobile/src/app/(tabs)/wedding/[id]/notes.tsx:326`(저장 버튼에 `disabled` 없음, `submit()` `:159-186`에 재진입 가드 없음) · `.../tasks.tsx:322`(`add()` `:99-115`) · `.../visit-notes.tsx`(`addVisitNote`). 주요 CTA 4종(Pick·초대 수락·제보·로그인)은 제대로 막혀 있다 — `apps/mobile/src/features/pick/use-my-candidates.ts:64`, `apps/mobile/src/app/(tabs)/wedding/join.tsx:69`, `.../price-report.tsx:203`, `apps/mobile/src/app/login/index.tsx:178` | `packages/ui/src/action-button.tsx`에 `loading` prop을 추가하고 세 화면에 in-flight state를 건다 | 미수정 · 담당 배분 필요 (FE) |
| P1-17 | 오류 화면의 65건 중 52건에 재시도 버튼이 없고, 당겨서 새로고침이 0건이다 | 일시적 실패에서 빠져나올 방법이 화면을 나갔다 들어오는 것뿐이다 | `<ErrorView>` 65건 중 `onRetry` 13건. `RefreshControl`·`onRefresh` 저장소 전체 0건. 재시도 없는 예: `apps/mobile/src/app/(tabs)/wedding/[id]/tasks.tsx:76` · `.../quotes.tsx:107` · `apps/mobile/src/app/(tabs)/search/[vendorId]/index.tsx:226` · `apps/mobile/src/app/(tabs)/(home)/feed.tsx:42` | 목록 화면에 `onRetry` 연결 | 미수정 · 담당 배분 필요 (FE) |
| P1-18 | 「돌아가기」 라벨의 버튼이 실제로는 재시도를 한다 — 22건 | 라벨과 동작이 어긋나 사용자가 뒤로 가려다 화면을 다시 불러온다 | `packages/ui/src/status-view.tsx:230` `backLabel` 기본값 「돌아가기」인데 MY 하위 화면이 `onBack={load}`를 넘긴다: `apps/mobile/src/app/(tabs)/my/reports.tsx:63` · `my/settings.tsx:137` · `my/account.tsx:86` · `my/profile.tsx:96` · `my/notifications.tsx:93` · `my/reviews.tsx:75` · `my/rewards/index.tsx:70` · `my/rewards/npay.tsx:51` 외 14건 | `onRetry`로 넘기거나 `backLabel="다시 시도"`를 함께 넘긴다 | 미수정 · 담당 배분 필요 (FE) |
| P1-19 | 관리자 kill switch가 아무것도 끄지 않는다 (기존 잔존-A — 재확인) | 껐다고 표시돼도 기능은 계속 돌고, 서버가 재시작하면 상태도 사라진다 | `apps/api/src/routes/admin.ts`의 `killSwitches` Map을 `admin.ts` 밖에서 조회하는 코드 0건 | 스위치 상태를 DB로 옮기고 기능 진입점에서 조회 | 미수정 · 담당 배분 필요 (BE) |
| P1-20 | 죽은 워커의 `running` 작업을 회수하는 reaper가 없다 (기존 잔존-D — 재확인) | 프로세스가 죽으면 그 문서는 영구히 `running`에 갇히고 화면은 계속 「분석 중」이다 | `apps/api/src/analysis/worker.ts:33-45` `claim()`이 `pending`만 집는다. `running` → `pending` 되돌리기나 `started_at` 경과 검사 쿼리가 저장소 전체에 없다 | `claim()`에 `started_at`이 임계를 넘은 `running`도 집도록 조건 추가 | 미수정 · 담당 배분 필요 (BE) |
| P1-21 | 결제내역 읽기 경로에 사용자별 호출 한도가 없다 | 한 사용자가 반복 호출로 월 AI 예산을 혼자 소진시킬 수 있다 | `apps/api/src/analysis/proof-pipeline.ts:110-115` INSERT에 `user_id` 컬럼 없음(문서 분석 쪽 `apps/api/src/analysis/pipeline.ts:83-86`에는 있다). `readPaymentProof`(`proof-pipeline.ts:136`)에 `dailyCallLimit` 파라미터 자체가 없다 | 문서 분석 경로와 같은 방식으로 `user_id` 기록 + 일일 한도 검사 추가 | 미수정 · 담당 배분 필요 (BE) |

---

**P1-22를 P0으로 올리지 않은 이유** — MASTER가 등급을 위임했다. 이 키만으로는 사용자
데이터에 닿을 수 없고 인증을 우회할 수도 없다. 카카오 토큰 교환에는 `KAKAO_CLIENT_SECRET`이
따로 필요한데 그것은 제대로 `secrets:`에 있다. 피해는 할당량 소진과 프로젝트 명의 오용에
그치므로 P1로 판정한다. 다만 **Git history에 이미 남아 있어 지워도 되돌릴 수 없다** —
교체가 유일한 해소책이다(I절 「Git history 노출」에 해당하는 유일한 항목이다. 그 밖의
시크릿 스캔은 전부 깨끗했다).

---

## P2 — 출시 후 개선 가능

- **Depth Back 미적용 35곳** — `onBack={() => router.back()}` 총 35건(ErrorView 문맥 24 + 그 밖 11).
  공유 헤더를 실제로 덮는 것은 `apps/mobile/src/app/(tabs)/(home)/progress.tsx:112` 1건이고,
  이 화면은 공유 NavBar 대신 자기 NavBar를 복제해 뒀다(`progress.tsx:197`).
- **관리자 화면 하드코딩 간격 164곳** — `apps/mobile/src/app/admin/**`. 사용자 화면은 1건
  (`apps/mobile/src/app/(tabs)/capture/payment/register.tsx:582`)뿐이다.
- **관리자 화면 27개에 Safe Area 처리가 없다** — `apps/mobile/src/app/admin/_layout.tsx`에
  safe-area import 자체가 없다. 노치 기기에서 상태바에 물린다. 사용자 화면 누락은 0건.
- **화면 내 단계가 있는 화면 3곳에 `BackHandler`가 없다** — 안드로이드 하드웨어 백이
  단계를 되돌리지 않고 화면 전체를 pop한다. `apps/mobile/src/app/(tabs)/capture/payment/register.tsx:364`
  (촬영 결과 유실 위험) · `.../wedding/[id]/events/[eventId].tsx:182` · `.../wedding/partner.tsx:214`.
  온보딩은 제대로 처리돼 있다(`apps/mobile/src/app/setup.tsx:222-235`).
- **업체 사진 갤러리 3곳에 `onError`가 없다** — `apps/mobile/src/app/(tabs)/search/[vendorId]/images.tsx:133`·`:235`·`:334`.
  주요 카드 경로는 `packages/ui/src/vendor-image.tsx:60-71`이 폴백을 잘 처리한다.
- **AI 한도·알림 한도 검사가 원자적이지 않다** (기존 잔존-C 재확인) —
  `apps/api/src/analysis/pipeline.ts:61-69`(SELECT) vs `:82-102`(INSERT), `apps/api/src/notify/send.ts:116` vs `:128`.
  워커가 1개인 동안은 직렬이라 실질 위험이 낮으나 워커를 늘리면 한도가 무력화된다.
- **죽은 푸시 토큰이 사용자 경로에서 비활성화되지 않는다** — `apps/api/src/notify/send.ts:181-183`이
  실패 사유를 버린다. `apps/api/src/retention/alert.ts:159-172`에는 제대로 있다.
- **`region` 표기 차이로 같은 업체가 두 행이 될 수 있다** — 유니크 키가 `region` 원문
  (`packages/db/migrations/0004_vendor_matching.sql:25-26`)인데 `apps/api/src/public-data/localdata.ts:81-85`는
  「서울특별시 강남구」, `apps/api/src/seed-samples.ts:75`는 「서울 강남구」를 만든다.
- **문서 중복 등록 시 unique violation이 500으로 나간다** — `apps/api/src/routes/documents.ts:154`에
  `ON CONFLICT` 없음.
- **스테이징에 인증 없는 파일 업로드 경로가 열려 있다** — `apps/api/src/routes/dev-storage.ts:24`
  `PUT /dev-storage/:key`. 운영에서는 `storage.driver !== 'local'`(`dev-storage.ts:14`)과
  `apps/api/src/config.ts:153`이 막지만, 스테이징은 `render.yaml:113-114`가 `STORAGE_DRIVER=local`이라
  등록된다. 저장은 메모리 Map(`apps/api/src/storage/local.ts:46`)이라 경로 조작 위험은
  없으나 무제한 업로드로 메모리를 소진시킬 수 있다.
- **운영자 CLI가 전화번호 전체를 표준출력에 찍는다** — `apps/api/src/reward-admin.ts:235`.
  송금을 위해 필요한 값이라 의도된 것이나, 터미널·CI 로그에 남을 수 있다.
- **미사용 설정 3개** — `render.yaml`의 `LEGAL_TERMS_URL`·`LEGAL_PRIVACY_POLICY_URL`·
  `LEGAL_SERVICE_TERMS_URL`을 코드 어디서도 읽지 않는다.
- **`buildNumber`가 무시된다** — `apps/mobile/app.json:12`. `apps/mobile/eas.json:3`
  `appVersionSource: "remote"`라 EAS 서버 값이 우선이다. 혼동을 부른다.
- **`android-apk.yml`의 Kakao client ID가 `eas.json`과 다르다** —
  `.github/workflows/android-apk.yml:62` vs `apps/mobile/eas.json:17`·`:34`. 검수용 APK로 한
  카카오 로그인 테스트가 스토어 빌드와 다른 결과를 낼 수 있다. (값은 옮기지 않았다 —
  두 줄을 대조하면 된다.)
- **`eas.json`의 preview·production env가 완전히 동일하다** — `apps/mobile/eas.json:15-23` vs `:32-40`.
  환경 분리가 없다.
- **마이그레이션 번호 중복** — `packages/db/migrations/0047_monthly_draw.sql`과
  `0047_vendor_data_quality.sql`. 파일명 정렬로 순서가 결정되므로 현재는 동작하나,
  운영 DB의 `schema_migrations`와 대조할 때 혼동을 부른다.
- **루트 `HANDOFF.md`가 이틀 전 스냅숏에 멈춰 있다** — `HANDOFF.md:1` 「안정화 핸드오프 —
  2026-09-07」, `:3` 「새 기능 개발 중단」, `:5` 「기준 커밋 `b098e3c`」. 셋 다 지금 사실이
  아니다(main은 그 뒤 40커밋 넘게 움직였다). 이 파일을 현재 상태로 읽으면 이미 고친 것을
  결함으로 올리게 된다 — **이번 감사에서 실제로 그럴 뻔했다.** 문서 맨 위에 「이 문서는
  2026-09-07 스냅숏이다 · 현재 상태는 `PROJECT_STATUS.md`」 한 줄을 넣는 것이 최소 수정이다.
- **시안 대비 실질 미구현 4건** — WP-HOME-007(홈 편집) · WP-RPT-006(분할 결제 연결) ·
  WP-BIZ-008(웹 하단 업체 문의 진입) · WP-FAQ-003(FAQ 상세). WP-SHT-001(다른 방법으로 시작)은
  의도적 폐기로 코드에 명시돼 있다(`apps/mobile/src/app/login/index.tsx:47-51`).
  이 밖에 PARTIAL 9건은 별도 백로그.

---

## 자동 검증 결과

컨테이너 안에서 실제로 실행한 결과다. 모바일 jest는 `apps/mobile`에서 실행했다.

| 항목 | 결과 | 비고 |
|---|---|---|
| `npm ci` | **PASS** | exit 0 |
| `npm run lint` (전 워크스페이스) | **PASS** | exit 0. 경고 1건 — `apps/mobile/src/features/auth/is-auth-popup.test.ts:6` `import/first`. 오류 0건이라 CI를 막지 않는다 |
| `npm run typecheck` (7개 워크스페이스) | **PASS** | api · mobile · web · api-contract · db · domain · ui 전부 exit 0 |
| mobile jest (`cd apps/mobile && npx jest`) | **PASS** | 13 suites / **170 tests** |
| domain jest | **PASS** | 57 suites / **889 tests** |
| api jest (**실제 PostgreSQL 연결**) | **PASS** | 58 suites / **711 tests** (`a7f2d73` 기준. `169a508`에서는 709였고 #147이 `collect.test.ts`로 2개를 더했다) |
| web jest | **PASS** | 5 suites / **55 tests** |
| api-contract jest | **PASS** | 1 suite / **13 tests** |
| db schema jest (**실제 PostgreSQL 연결**) | **PASS** | 1 suite / **79 tests** — DATABASE_URL 없이는 건너뛴다 |
| **테스트 합계** | **PASS** | **135 suites / 1,917 tests · 실패 0 · 스킵 0** |
| migration validation | **PASS** | 빈 PostgreSQL 16에 `packages/db/migrations`의 **93개 전부 순서대로 적용 성공**. 중간 실패·수동 개입 없음 |
| build (`@weddingpick/web`) | **PASS** | CI의 `Build landing` 스텝과 동일(`.github/workflows/main.yml:84-85`) |
| Secret 검사 — 작업 트리 | **PASS** | 추적되는 `.env`류는 `apps/api/.env.example` 하나. 키·토큰·접속 문자열 하드코딩 없음 |
| Secret 검사 — **Git history 전체** | **PASS** | `sk-ant-*` · `AKIA*` · PRIVATE KEY · Slack 토큰 · 비-로컬 DB 접속 문자열 **0건**. 검출된 것은 전부 로컬 테스트 자격증명(`postgres://weddingpick:weddingpick@localhost`)과 npm 레지스트리 메타데이터다 |
| dead code / TODO | **PASS** | `apps/*/src`·`packages/*/src` 전체에서 TODO/FIXME/HACK/XXX **4건**뿐이고 그중 2건은 금지어 목록·테스트 자체다 |
| 금지어 게이트(`lint-copy.js`) | **FAIL** | CI에 연결돼 있지 않다(P1-10). 직접 돌리니 실 위반 검출 |
| production env 참조 검사 | **부분 FAIL** | `apps/mobile`에 `localhost`·`ngrok`·`10.0.2.2` 잔존 0건(테스트 파일 제외). 다만 `.onrender.com`이 운영 주소로 쓰인다(P1-15), 관리자 페이지는 `localhost` 기본값(P1-2) |
| API contract test | **PASS** | api-contract 13 tests. 다만 운영 서버 대상 계약 검증은 **미검증**(아래) |

**빌드·테스트·타입은 전부 초록이다.** 이 감사가 잡은 것은 테스트가 보지 않는 영역
— 배포 정의(worker 부재) · 법적 고지 · 권한 선언 · 런타임 오류 처리 · CI 게이트 연결 — 이다.

---

## 핵심 사용자 여정 결과

코드 경로 정적 추적 기준이다. **실기기·실운영 실행 검증은 하지 않았다**(아래 미검증 참조).

| 여정 | 판정 | 근거 |
|---|---|---|
| 최초 실행 · 스플래시 | PASS | `apps/mobile/app.json:50` splash 플러그인, 아이콘 4종 파일 실재 확인 |
| 비회원 진입 차단 | PASS | `apps/mobile/src/app/_layout.tsx:188` — 로그인 안 되면 무조건 로그인 화면 |
| 카카오 로그인 | **미검증** | 코드 경로는 정상(`apps/api/src/routes/auth.ts:41` · `apps/api/src/auth/identity-provider.ts`). N01(운영 500)은 원인이 이미 특정돼 있고(운영 API가 빈 DB를 보고 있었다 — `infra/render-env.yml` 주석) `DATABASE_URL`이 저장소 원본으로 옮겨져 수정됐다. **운영에서 재현 확인은 못 했다 — 컨테이너에서 운영 API로 나가는 연결이 정책상 차단된다** |
| Apple 로그인 (iOS) | **미검증** | `apps/mobile/app.json`에 apple-authentication 플러그인 있음. Provisioning Profile에 capability 누락 장애가 미해결로 기록돼 있다(`PROJECT_STATUS.md`) |
| 온보딩 5문항 | PASS | `apps/mobile/src/app/setup.tsx` — 하드웨어 백 처리까지 정상(`:222-235`) |
| 신규/기존 사용자 분기 | PASS | `apps/mobile/src/features/auth/next-after-sign-in.test.ts` 통과 |
| 첫 Pick | PASS | `apps/mobile/src/features/pick/use-my-candidates.ts:64` 중복 방어 있음 |
| 업체 검색 · 상세 | PASS | `apps/api/src/routes/vendors.ts`, `apps/mobile/src/app/(tabs)/search/**` |
| 비교 | PASS | `apps/mobile/src/app/(tabs)/search/compare.tsx` |
| 웨딩일정 | PASS | `apps/api/src/routes/wedding-events.ts` 4개 라우트 전부 인증됨 |
| 커플 초대 생성 · 수락 · 해제 | **PASS (구현 품질 우수)** | `apps/api/src/routes/wedding-invites.ts` — 코드 원문 미저장(`:21` sha256), 한 웨딩에 살아 있는 초대 1개, `FOR UPDATE`로 동시 수락 차단(`:185`), 자기 자신 연결 차단(`:194`), 이미 참여 중 차단(`:200`), 연결과 알림이 같은 트랜잭션(`:239`), 양쪽 다 해제 가능(`:262`) |
| 커플 데이터 격리 (IDOR) | **PASS** | `apps/api/src/access.ts:9` `assertWeddingAccess` — 소유자/배우자만. `apps/api/src/access.ts:26` `assertQuoteAccess`는 문서가 속한 웨딩까지 확인 |
| MY | PASS | `apps/mobile/src/app/(tabs)/my/**` |
| 로그아웃 | PASS | `apps/api/src/routes/auth.ts:113` |
| 회원탈퇴 | **PASS (조건부)** | 화면 `apps/mobile/src/app/(tabs)/my/withdrawal.tsx:61`, 진입 2곳(`my/settings.tsx:200`·`my/account.tsx:135`), 동의+재확인, API `apps/api/src/routes/withdrawal.ts:37`, 기기 정리 `withdrawal.tsx:84`. **조건**: 계정 행의 실제 삭제(`completeWithdrawals`)가 worker 부재로 **배포마다 1회**만 돈다(`apps/api/src/index.ts:94`) — 접수는 즉시 되지만 파기가 지연된다 |
| **견적서 업로드 → 분석** | **FAIL** | P0-3. worker 미배포로 `pending`에 영구 정체 |
| **Pick 인증 원본 24시간 파기** | **FAIL** | P0-2. worker 미배포로 실행 경로 없음 |
| 푸시 알림 수신 → 해당 화면 이동 | **FAIL** | P1-5. payload에 `data` 없고 수신 핸들러 0건 |
| 오프라인 · 네트워크 끊김 | **FAIL** | P0-4 |
| 공공데이터 주간 수집 | **FAIL** | P1-11. 킬 스위치 행 부재로 전량 실패 |
| 관리자 화면 운영 | **FAIL** | CORS는 `a7f2d73`(#150)로 해소됐다. 남은 것은 P1-2(API 주소 기본값이 `localhost`라 열어도 안 뜬다) + P1-19(kill switch가 아무것도 끄지 않는다) |

---

## Production 위험

| 영역 | 상태 |
|---|---|
| **env** | 운영 API의 `LEGAL_*` 8개가 저장소에 선언되지 않았다 — 비어 있으면 부팅 실패(P0-7, 미검증). `infra/render-env.yml`의 운영 API `secrets`는 `DATABASE_URL`·`KAKAO_CLIENT_SECRET` 둘뿐이다 |
| **DB** | main push마다 승인·백업 없이 운영 DB에 마이그레이션이 적용된다(P0-6). 저장소의 93개는 빈 DB에서 전부 정상 적용됨을 확인했다. **운영 DB의 `schema_migrations` 실제 목록과 「저장소에 없는 마이그레이션 3개」는 미검증** — 컨테이너에서 운영 DB에 접근할 수 없다 |
| **API** | **CORS는 해소됐다** — 출처는 `a7f2d73`(#150), PATCH는 `apps/api/src/server.ts:65`. 라우트 인증은 전수 확인 결과 양호 — 사용자 데이터 라우트 전부 `requireUser`, 관리자 라우트는 `requireOperatorUser`(`apps/api/src/routes/admin.ts:107` · `apps/api/src/auth/plugin.ts:63-87`) |
| **Secret** | 자동 스캔은 깨끗하다 — 작업 트리·Git history 모두 `sk-ant-*`·`AKIA*`·PRIVATE KEY·비-로컬 DB 접속 문자열 0건. 개발용 로그인은 production에서 확실히 차단된다(`apps/api/src/index.ts:24-27`). **다만 패턴 스캔이 잡지 못하는 것이 하나 있다 — 카카오 REST API 키가 public 저장소에 평문으로 있고 서버 자격증명으로도 쓰인다(P1-22).** 그 밖의 평문 값(구글·네이버 client ID)은 공개 값이 맞다 |
| **외부서비스** | Anthropic 국외 이전 미고지(P0-1). Expo 푸시에 환경 가드 없음(P1-6). 공공데이터 API는 컨테이너·러너 양쪽에서 네트워크 차단 — **재시도하지 않았고 코드 경로만 정적 점검했다**(지시대로) |
| **worker** | `render.yaml`에 worker 서비스가 없다. 이 하나로 P0 2건(P0-2·P0-3)과 P1 1건(P1-7 일부)이 발생한다. **가장 파급이 큰 단일 결함이다** |

---

## 스토어 준비상태

### Android — **불가**

| 항목 | 상태 |
|---|---|
| package ID · version | `apps/mobile/app.json:20`·`:5` 정상. versionCode는 EAS 원격 관리(`apps/mobile/eas.json:43` `autoIncrement`) |
| 아이콘 · 스플래시 | `apps/mobile/app.json:7`·`:21-26`·`:50` — 참조 파일 4종 실재 확인 |
| 빌드 | 가능. `apps/mobile/eas.json:42` `buildType: app-bundle` 정합 |
| **권한 선언** | **해소됨** — `0d2b68d`(#148)로 민감 권한 3종이 빠지고 `apps/mobile/app.json:28-30`에 CAMERA만 남았다 |
| **`SYSTEM_ALERT_WINDOW`** | **주입원 규명 · 릴리즈 영향 없음(단, 실측 미실시)** — 아래 별도 항목 |
| **데이터 안전** | **차단** — 제3자 공유(Anthropic) 미신고(P0-1) + 동의 미취득(P0-5) |
| 계정 삭제 | 충족 — 인앱 구현·연결 확인(`apps/mobile/src/app/(tabs)/my/withdrawal.tsx:61`) |
| 제출 자동화 | `apps/mobile/eas.json:51` `submit.production`이 빈 객체 · track 미지정 → internal 트랙만 가능. Play 서비스 계정 JSON 등록 여부 **미검증** |
| 계정 상태 | Google Play 개발자 계정 본인확인 이의 제기 결과 대기 중(`PROJECT_STATUS.md`) — **미검증** |

### iOS — **불가**

| 항목 | 상태 |
|---|---|
| bundle ID · version · buildNumber | `apps/mobile/app.json:11`·`:5`·`:12` 정상. `ITSAppUsesNonExemptEncryption: false`(`:16`) 설정됨 |
| 권한 설명 | 정상 — 카메라(`app.json:53`)·사진(`:61`) 문구가 플러그인으로 주입되고, 마이크·위치는 iOS에 주입되지 않는다(`:55-56`) |
| **빌드** | **차단** — Provisioning Profile에 Sign in with Apple capability 누락(Release #13). App ID `kr.weddingpick.app`에 활성화 후 Profile 재생성 필요 — **미검증(외부 콘솔)** |
| **개인정보 라벨** | **차단** — P0-1과 같은 사유 |
| 계정 삭제 | 충족 |
| 심사 계정 | **미검증** — 심사용 테스트 계정·재현 절차가 저장소에 없다 |

### `SYSTEM_ALERT_WINDOW` — MASTER가 「주입원 미확인」으로 넘긴 항목

**주입원을 찾았다. React Native가 debug 빌드 전용으로 넣는 것이다.**

- 선언 위치: `node_modules/react-native/ReactAndroid/src/debug/AndroidManifest.xml:8`
  `<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>`
- 같은 파일 주석이 스스로 밝힌다 — 「This manifest file is used only by Gradle to configure
  **debug-only** capabilities for React Native Apps」. 개발자 메뉴 오버레이(`DevSettingsActivity`)에
  필요한 권한이다
- 릴리즈 소스셋에는 없다: `node_modules/react-native/ReactAndroid/src/main/AndroidManifest.xml`에
  `SYSTEM_ALERT_WINDOW` **0건**
- 저장소 자체 코드·설정에도 없다: `apps/mobile/app.json` 포함 저장소 전체 grep **0건**.
  `apps/mobile/android`·`ios` 디렉터리는 없다(prebuild 시 생성)

**구조상 `debug` 소스셋은 release 변종에 병합되지 않으므로 릴리즈 AAB에는 남지 않는다.**
누군가 매니페스트에서 이것을 봤다면 debug 변종 산출물을 본 것일 가능성이 높다
(`android-apk.yml`은 디버그 키로 서명한다).

**다만 이것은 소스 추적이지 실측이 아니다.** 릴리즈 AAB를 뽑아 병합된 매니페스트를 덤프한
것이 아니므로 「없다」로 확정하지 않는다. 확정하려면 릴리즈 빌드 산출물에
`aapt2 dump badging` 또는 병합 매니페스트(`app/build/outputs/logs/manifest-merger-release-report.txt`)를
한 번 보면 끝난다 — **그 실측이 남은 유일한 작업이다.**

### 공통 미비

- 개인정보처리방침·이용약관이 초안 상태(P1-14)
- 스토어 메타정보(설명·스크린샷·키워드)가 저장소에 없다 — **미검증**
- 앱 내 링크가 `.onrender.com`(P1-15)

---

## 미검증 영역 — 「문제 없음」이 아니라 「보지 않았음」이다

1. **운영 API의 실제 동작 전부** — 컨테이너에서 `weddingpickl.onrender.com`으로 나가는
   연결이 정책상 차단된다(3회 시도 모두 `connect_rejected`). `/health`·`/v1/auth/providers`
   응답을 한 번도 받지 못했다. N01(카카오 로그인 500)의 해소 여부를 **확인하지 못했다.**
2. **운영 DB의 실제 상태** — 이 감사에서는 접근할 수 없었으나, **감사 중 다른 세션이
   `db-status.yml`(읽기 전용)로 실측했고 그 결과가 `PROJECT_STATUS.md`에 들어왔다.**
   그 기록을 그대로 옮긴다(내가 검증한 것이 아니다 — 출처를 밝혀 인용한다):
   운영 DB는 **적용 96 / 기대 93 · 밀린 것 없음**이고 스키마는 정상. 「저장소에 없는
   마이그레이션 3개」는 `0052_mission_draw`·`0059_wedding_events`·`0060_vendor_geo`로
   **번호 재부여 흔적이며 멱등 가드가 있어 무해한 no-op**으로 판정됐다.
   즉 MASTER가 넘긴 「`0003_integrity_constraints`가 운영에만 남아 있을 가능성」은
   **성립하지 않는 것으로 정리됐다.** 새로 드러난 것은 **스테이징이 73/92로 19개
   밀려 있다**는 사실이다 — 「스테이징에서 먼저 검수」가 지금은 성립하지 않는다.
   `identity.identities` 실제 컬럼은 여전히 미확인.
3. **Render 대시보드의 환경변수 실값** — 특히 `LEGAL_*` 8개(P0-7)와 운영 API의
   `DATABASE_URL`이 CI가 쓰는 것과 같은 DB인지.
4. **공공데이터 API의 실제 응답** — 지시대로 재시도하지 않았다. 업종 코드 `'Q'`
   (`apps/api/src/public-data/collect.ts:228`)가 실제로 0건을 돌려주는지는 **정적으로만**
   점검했다. 코드 자신의 주석(`collect.ts:192-197`)이 「'Q' 단독 코드는 활용가이드에
   없다」고 적고 있어 의심은 강하지만 실증하지 못했다.
5. **실기기(Android/iOS) 동작** — 로그인·카카오맵 링크 복귀·키보드 가림(P1-3)·
   푸시 수신·안드로이드 하드웨어 백. 전부 실기기 QA 단계의 몫이다.
6. **외부 콘솔 상태** — Apple Developer의 Sign in with Apple 활성화, EAS credentials,
   Google Play 계정 제한 해제, Play 서비스 계정 JSON 등록, TestFlight·심사 상태.
7. **스토어 메타정보·심사용 테스트 계정** — 저장소에 없다.
8. **main 브랜치 보호 규칙(G02)** — GitHub API 조회가 이 세션에서 불가. 기존 판정
   (필수 PR·CI·리뷰 없음)을 뒤집을 근거도 확인할 근거도 얻지 못했다.
9. **웹 렌더링 QA(하이브리드 웹뷰)** — `docs/design-handoff/hybrid-web-qa-checklist.md`
   기준 점검은 스테이징 분리가 선행돼야 한다(`docs/AI_HANDOFF.md`).
10. **AI 응답 품질** — 실제 문서로 분석 정확도를 측정하지 않았다(`analysis-eval.ts` 미실행).

---

## 남은 작업 — 출시 전 반드시 해야 할 것만

우선순위 순이다. 1번 하나로 P0 2건이 함께 해소된다.

1. **`render.yaml`에 worker 서비스 추가** → P0-2 · P0-3 해소. (RELEASE/BE)
2. **개인정보처리방침의 처리위탁·국외 이전 절을 실제 사실로 교체** + 구글 데이터 안전
   「제3자와 공유」 신고 → P0-1. (FE + 운영)
3. **견적서 경로에 동의 화면·서버 기록 추가** → P0-5. 결제 증빙 경로와 같은 모양으로.
   문구는 사용자 결정이 선행된다. (FE + BE)
4. **모바일 전역 오류 경계 + 오프라인 화면 연결** → P0-4. 부품은 이미 다 있다. (FE)
5. **`main.yml`의 배포 잡에 Environment 보호 + 백업 스텝** → P0-6. (RELEASE)
6. **운영 Render의 `LEGAL_*` 8개 실값 확인** → P0-7. 확인 후 `infra/render-env.yml`에
   키 이름 선언. (RELEASE)
7. **P1 21건 처리** — 특히 P1-3(키보드) · P1-10(금지어 게이트 CI 연결) ·
   P1-11(킬 스위치 행) · P1-13(저작권 unknown 이미지 노출 + 시드 이미지 제거) ·
   P1-14(정책 확정본) · P1-22(카카오 서버용 키 분리).
8. **운영 API 실측** — 미검증 1·3번을 저장소 밖에서 확인해 2차 감사에 넘긴다.
   운영 DB는 감사 중 다른 세션이 실측을 끝냈다(미검증 2번 참조).
9. **iOS Provisioning Profile 재생성 → Production Build → TestFlight**.
10. **릴리즈 AAB의 병합 매니페스트 1회 덤프** — `SYSTEM_ALERT_WINDOW`가 실제로 빠지는지
    확정한다(K절). 소스 추적으로는 빠지는 것이 맞다.
11. **실기기 QA** — 미검증 5번.

---

## 최종 결론

**지금 출시 불가.** worker가 배포되지 않아 견적서 분석이 동작하지 않고 약속한 개인정보
24시간 파기가 한 번도 실행된 적이 없으며, 이용자 문서가 국외로 전송되는데 그 사실을
고지하지도(P0-1) 동의를 받지도(P0-5) 않는다 — 이 셋만으로 심사 이전에 법적·기능적 출시
요건이 성립하지 않는다.

다만 **코드 자체의 건강도는 높다.** 테스트 1,917개가 전부 통과하고, 마이그레이션 93개가
빈 DB에서 정상 적용되며, Git history에 유출된 비밀이 없고, 인증·권한 격리와 커플 초대
동시성 처리는 감사 기준을 여유 있게 넘는다. 막고 있는 것은 대부분 **배포 정의와 고지
문서** — 코드를 새로 쓰는 일이 아니라 연결하고 적는 일이다.
