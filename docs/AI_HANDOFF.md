# WeddingPickl AI 인수인계서

> 이 파일은 모든 Claude 세션이 읽는 **단일 진실 소스**다.
> 새 세션이 시작되면 이 파일을 먼저 읽어라. 작업이 끝나면 이 파일을 업데이트하고 커밋해라.

---

## 메타

- `updated_at`: 2026-09-02 (프론트엔드 착수 세션 갱신)
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

### 백엔드 관리 (session_01GcqCiteAfxQ5X6SaHDhbDq) — 실행 중 (Sonnet 5)
**현황**: API 테스트 524개 통과, 마무리 중  
**브랜치**: `claude/daily-progress-briefing-3k7lez`

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
  - 차단(백엔드·정책·미설계 데이터모델, 이번 세션에서 시도 안 함): WP-SHT-009(취향 이미지 Pick, 취향수집 시스템 자체 없음) · WP-SHT-012(캘린더 등록, 일정 관리 화면 WP-OUR-004/005/006 자체가 없어 붙일 곳이 없음) · WP-ST-006(혜택 상태, `priority.ts` 주석에 "없는 혜택을 말할 수 없다"로 명시) · WP-ST-010(네트워크 오류, `NetInfo` 등 새 의존성 필요 — 이번 세션은 새 패키지 설치 없이 진행) · WP-ST-014(점검·강제업데이트, 백엔드 API 필요) · WP-ST-004(이미지 상태, 이미지 자체가 없는 텍스트 전용 설계라 해당 없음)
  - 검증: `apps/mobile`·`packages/domain`·`packages/ui` 전부 `tsc --noEmit` 통과, `apps/mobile`(46개)·`packages/domain`(797개, 신규 5개 포함) 테스트 전부 통과, 변경 파일 eslint 통과
**다음 세션 참고**: 진짜 순수 프론트엔드로 남은 미구현 화면은 관리자(WP-ADM-*, 25개)·박람회(WP-EXPO-*, 5개) 정도. 공통 Bottom Sheet·공통 상태는 이번 세션에서 순수 프론트엔드 가능분을 마쳤고, 남은 것은 위 "차단" 목록처럼 다른 선행 작업이 필요하다. 그 외 상위 우선순위 항목은 백엔드 세션과 조율 필요.

### 프론트엔드 (session_01HTGSU2B4vFjePXFS2ajKBY) — 아카이브
**완료**: 모바일 앱 핵심 화면 구현, 42개 라우터 파일 생성

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
4. **[사용자]** terms.url · privacy.url 확정 → 도메인 상수 업데이트
5. **[AI]** 프론트엔드 미구현 화면 구현 — 아래 4개 모두 순수 프론트엔드 작업이 아님, 착수 전 확인:
   - 회원탈퇴(WP-MY-008): 이미 구현됨(`my/withdraw.tsx`). `withdrawal.ts`의 정책 게이트가 의도한 동작 — 추가 작업 없음, 손대지 말 것(아래 do_not_change 참조)
   - 일정 추가·목록·상세(WP-OUR-004/005/006): API·DB 전무 — `apps/api/src/routes/wedding-plan.ts`에 schedule 엔드포인트 없음. `tasks.tsx`(체크리스트)와는 별개 개념. DB migration(다음 번호 0053)부터 필요한 풀스택 작업 — 프론트 단독 세션에서 임의로 스키마 추가하지 말 것, 동시 진행 중인 백엔드 세션과 번호 충돌 위험
   - 지도 보기(WP-SRCH-007): `VendorSummary`(`packages/api-contract/src/vendors.ts`)에 위경도 필드 없음 — 백엔드에 geo 데이터 추가부터 필요
   - 취향 재선택(WP-MY-004): `packages/domain/src/priority.ts`의 `couple_taste` 주석이 "아직 이 종류는 만들어지지 않는다"고 명시 — 취향 수집(이미지 Pick 기반, v3.10 §8) 자체가 설계 전이라 재선택 화면을 만들 대상이 없음
6. **[AI]** ~~공통 Bottom Sheet 16종 인라인 처리 여부 확인~~ — 2026-09-02 완료(WP-SHT-*·WP-ST-* 전수 조사 및 순수 프론트엔드 가능분 구현, 세션 로그 참조). 남은 것: WP-SHT-009/012, WP-ST-006/010/014 — 각각 취향수집 시스템·일정 화면·백엔드 API가 먼저 필요
7. **[AI]** 관리자 화면 설계 및 구현 (앱스토어 출시 후 단계)
8. **[AI]** 박람회·웨딩 정보(WP-EXPO-*, 5개) 화면 구현

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
  - 소셜 로그인 관련 파일(`identity-provider.ts`, `config.ts`, `client.ts` 등)은 이번 세션에서 커밋됐지만, **네이버는 아직 실제 제공자 목록에 노출 안 함** — 서버 콜백·토큰 교환 API가 따로 필요하다(`docs/social-login-handoff.md` 참조). 임의로 노출시키지 말 것.
  - `docs/design-handoff/seed/`는 원본 그대로 유지 — 화면 구현할 때 이 폴더 안의 `.dc.html` 파일을 직접 고치지 않는다(참고용 원본).

## 롤백
- rollback_note: 커밋 4개(`f22a512`, `bba48ed`, `10ce66a`, `cf07b15`)는 서로 기능적으로 독립적이라 필요하면 개별 `git revert <hash>`로 되돌릴 수 있다. 순서상 뒤 커밋이 앞 커밋의 파일을 다시 건드리지 않으므로 역순 revert도 안전하다. 전부 origin/main에 push 완료 — 로컬에만 있는 미커밋 변경 없음(`.npm-cache/` 잡음 제외).
