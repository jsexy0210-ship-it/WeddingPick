# 화면 매핑 — Figma ↔ WeddingPickl

작성 2026-09-14 (KST) · 브랜치 `claude/rn-migration-plan`
**분석 문서다. 코드를 고치지 않는다.** 매핑되지 않는 것은 임의로 구현하지 않고 `UNMAPPED`로 남겼다.

## 0. 분류 기준

| 분류 | 뜻 | 2·3단계에서 할 일 |
|---|---|---|
| **REUSE** | 기존 화면이 그대로 있고 구조도 같다 | 토큰 교체만. 화면 코드 손대지 않는다 |
| **ADAPT** | 기존 화면이 있고 Figma가 시각 층만 바꿨다 | 레이아웃·스타일 조정. 데이터·API·라우트 유지 |
| **REIMPLEMENT** | 기존 화면이 있으나 Figma 구성이 실질적으로 다르다 | 화면 다시 짠다. **API는 기존 것을 그대로 쓴다** |
| **REMOVE** | Figma에만 있는 프로토타입 잔재 | 반영하지 않는다 |
| **UNMAPPED** | 대응하는 기존 화면 또는 API가 없다 | **구현하지 않는다.** 대표 판단 대기 |

난이도는 **시각 층 작업량** 기준이다(S 토큰만 · M 레이아웃 조정 · L 재구성).
「기존 API」는 `apps/mobile/src/api/client.ts`에서 실제로 import하는 함수명이다.

## 1. 매핑표

| Figma 화면 | Figma 파일 | 기존 WeddingPickl 화면 (파일 경로) | 기존 API | RN 대상 | 전환 난이도 | 분류 | 비고 |
|---|---|---|---|---|---|---|---|
| 홈 | `Home.tsx` | `apps/mobile/src/app/(tabs)/index.tsx` | `getAppBootstrap` · `getMyMonthlyDraw` | 동일 파일 | M | **ADAPT** | 홈 상태 2층(진행 0 / 1~8 / 9+)·준비 현황 4칸은 정본 유지. Figma에 없는 구조다 |
| 검색 | `Search.tsx` | `(tabs)/search/index.tsx` | `searchVendors` · `listVendorRegions` | 동일 파일 | M | **ADAPT** | Figma의 인라인 필터 패널 → 기존 `search/filter.tsx` 유지. **검색을 탭에서 빼지 않는다**(§3-1) |
| Pick 목록 | `Pick.tsx` `Pick()` | `(tabs)/pick/index.tsx` | `listCandidates` · `searchVendors` · `getCurrentUser` | 동일 파일 | M | **ADAPT** | |
| Pick 비교 | `Pick.tsx` `CompareScreen` | `(tabs)/pick/compare.tsx` | `listCandidates` · `getVendor` · `getCurrentUser` | 동일 파일 | M | **ADAPT** | Figma는 같은 화면 안 상태 전환, 기존은 별도 라우트. **기존 라우트 유지** |
| 웨딩노트 — 캘린더 | `OurWedding.tsx` `tab=calendar` | `(tabs)/wedding/[id]/index.tsx` · `events/index.tsx` | `listWeddingEvents` · `ensureWedding` · `getExpenses` · `listWeddingTasks` | 기존 유지 | M | **ADAPT** | 바텀시트 2종(일정 추가/수정 · 삭제 확인)은 기존 흐름으로 흡수 |
| 웨딩노트 — 예산현황 | `OurWedding.tsx` `tab=budget` | `(tabs)/wedding/[id]/expenses/index.tsx` | `getExpenses` · `setBudget` · `removeExpense` | 기존 유지 | M | **ADAPT** | |
| 웨딩노트 — 상담기록 | `OurWedding.tsx` `tab=consult` | **없음** | **없음** | — | — | **UNMAPPED** | §2-1 |
| MY | `My.tsx` | `(tabs)/my/index.tsx` | `getCurrentUser` · `getWeddingInvite` · `listMyReports` | 동일 파일 | S | **ADAPT** | Figma 5섹션 ⊂ 기존 MY 하위 21화면. 섹션 구성은 정본 유지 |
| 라운지 — 리얼후기 | `FlowScreens.tsx` `ReviewContent` | `(tabs)/search/[vendorId]/reviews.tsx` | `listVendorReviews` · `reportReview` · `listReportReasons` | 기존 유지 | L | **REIMPLEMENT** | 기존은 **업체별** 후기, Figma는 **전역** 후기 피드. 전역 목록 API 없음 → §2-2 |
| 라운지 — 웨딩피드 | `FlowScreens.tsx` `FeedContent` | `(tabs)/search/wedding-info/index.tsx` | `listWeddingInfo` | 기존 유지 | M | **ADAPT** | 기존 「웨딩 콘텐츠」가 같은 것이다 |
| 라운지 — 박람회 | `FlowScreens.tsx` `ExpoContent` | `(tabs)/search/expo/index.tsx` | `listExpos` | 기존 유지 | M | **ADAPT** | |
| 라운지 상세 | `FlowScreens.tsx` `FeedDetailPage` | `(tabs)/search/wedding-info/[infoId]/index.tsx` | `listWeddingInfo` 계열 | 기존 유지 | M | **ADAPT** | |
| 업체 상세 | `VendorFlows.tsx` `VendorDetailPage` | `(tabs)/search/[vendorId]/index.tsx` | `getVendor` · `getVendorConditions` · `listVendorPhotos` · `listVendorReviews` · `addCandidate` · `ensureWedding` · `getCurrentUser` | 동일 파일 | L | **ADAPT** | 가장 큰 화면. 금액 한 줄은 `priceLine()` 단일 경로 유지 |
| 상담 신청 | `VendorFlows.tsx` `ConsultPage` | **없음** | **없음** | — | — | **UNMAPPED** | §2-3. `/vendor/:id/booking`은 같은 컴포넌트 별칭이라 별도 화면 아님 |
| 후기 상세 | `VendorFlows.tsx` `ReviewDetailPage` | **없음** (목록만 있음) | `listVendorReviews` | — | — | **UNMAPPED** | §2-4 |
| 로그인 | `FlowScreens.tsx` `Login` | `src/app/login/index.tsx` | — (`features/auth`) | 동일 파일 | M | **ADAPT** | Figma 카카오 단독 → 정본은 카카오+이메일. **정본이 이긴다**. 애플은 §3-3 |
| 온보딩 | `FlowScreens.tsx` `Onboarding` | `src/app/onboarding.tsx` · `src/app/setup.tsx` | `getSignupState` · `completeSignup` · `completeSetup` · `getCurrentUser` | 기존 유지 | M | **ADAPT** | Figma 3스텝 ≠ 정본 초기 설정 4단계. **정본 4단계 유지**. 날짜는 휠 3열 유지(§3-4) |
| 계약 인증 | `FlowScreens.tsx` `ContractVerify` | `(tabs)/capture/verify/[quoteId].tsx` · `capture/*` | `createVerificationRequest` · `getQuote` | 기존 유지 | M | **ADAPT** | 기존 capture 흐름이 훨씬 상세(촬영·분석·결제증빙·상태조회 13화면) |
| 회원탈퇴 | **없음** | `(tabs)/my/withdrawal.tsx` | `getWithdrawalNotice` · `withdraw` | 기존 유지 | S | **REUSE** | 토큰만 따라온다 |
| 연령 확인 | **없음** | `src/app/login/age-required.tsx` | — | 기존 유지 | S | **REUSE** | |
| 약관·개인정보처리방침 | 진입점만 | `(tabs)/my/policies.tsx` · `my/privacy.tsx` | — | 기존 유지 | S | **REUSE** | Figma `My.tsx`에 진입 행은 이미 있다 |
| 배우자 연결 | 진입점만(「연결 관리」) | `(tabs)/wedding/partner.tsx` · `wedding/join.tsx` | `createWeddingInvite` · `getWeddingInvite` · `revokeWeddingInvite` · `unlinkPartner` · `ensureWedding` · `getWedding` | 기존 유지 | S | **REUSE** | 진입 행은 이미 있다 |
| 애플 로그인 | **없음** | **없음** | **없음** | — | — | **UNMAPPED** | §3-3. 디자인이 아니라 인증 정책 문제 |
| 히어로 테마 전환 | `Home.tsx:76~86` | — | — | — | — | **REMOVE** | 시안 확인용 팔레트 컨트롤 |
| 영문 eyebrow 13종 | `font-mono` 38곳 | — | — | — | — | **REMOVE** | 임의 영문 · 용어 정본 위반 |
| C등급 죽은 파일 8개 | `Budget`·`Checklist`·`Community`·`Honeymoon`·`More`·`Proposal`·`Schedule`·`Studio` | — | — | — | — | **REMOVE** | 라우팅 안 됨 |

**나머지 사용자 화면 약 65개**(총 87개 라우트 파일 중 위에 나오지 않은 것)는 **REUSE**다. 토큰 교체로 따라온다. 관리자 27화면은 범위 밖이다.

## 2. UNMAPPED 상세 — 구현하지 않은 이유

### 2-1. 웨딩노트 상담기록 탭
Figma `OurWedding.tsx`에 상담 목록·상세·편집·`AnalysisSection`까지 구현되어 있다. 그러나
- 기존 앱에 대응 화면이 없다
- 대응 API가 없다 (`packages/api-contract/src/`에 상담기록 계약 없음)
- **대표님 문서 §6이 「AI 상담기록은 아직 구현되어 있지 않다면 … 새 기능으로 만들지 않는다」고 적었다**

→ 새 기능이므로 이번 개편 범위 밖. 만들려면 API 계약 신설이 필요하고, 그것은 「기존 API 계약을 바꾸지 않는다」는 이번 단계 제약과 충돌한다.
(덧: 화면 라벨이 「상담기록」인 것은 맞다. 대표님 문서의 「AI 상담기록」은 내부 문서 표현이고, 사용자 화면에 `AI`는 금지다.)

### 2-2. 라운지 리얼후기 — 전역 후기 피드
Figma는 업체와 무관한 **전역 후기 피드**를 그렸다. 기존 앱의 후기는 전부 **업체 종속**이다(`search/[vendorId]/reviews.tsx`, `listVendorReviews(vendorId)`).
전역 후기 목록 API가 없다. → 매핑 표에서는 **REIMPLEMENT**로 두되, **전역 목록 API가 신설되기 전까지는 3단계에서 착수하지 않는다.** 착수 조건을 `RN_MIGRATION_PLAN.md`에 적었다.

### 2-3. 상담 신청 (`ConsultPage`)
업체에 날짜·시간·메모를 보내 상담을 예약하는 화면이다. 기존 앱에 **해당 기능 자체가 없다.**
- `createInquiry`는 **고객센터 문의**다(`my/contact.tsx` · `my/biz/*`에서만 쓰임). 업체 예약이 아니다
- `wedding/[id]/visit-notes.tsx`는 **다녀온 뒤 적는 방문 기록**이지 예약이 아니다

→ 업체 예약 API 계약 신설이 필요하다. **이번 범위 밖.** 대표 판단 대기.

### 2-4. 후기 상세 (`ReviewDetailPage`)
기존 앱은 후기를 **목록 안에서** 보여주고 개별 상세 라우트가 없다. 댓글 기능도 없다(`reviews.ts` 계약에 댓글 스키마 없음).
Figma는 상세 + 좋아요 + 댓글 입력을 그렸다. → 댓글은 새 기능이라 범위 밖. **상세만 떼어낼지도 대표 판단이 필요하다.**

## 3. 충돌 목록 — 두 저장소가 어긋나는 자리

층 원칙(「보이는 것」은 Figma, 「지켜야 하는 것」은 기존 정본)으로 판정했다. **판정이 명확한 것과 대표 판단이 필요한 것을 나눠 적는다.**

### 3-1. 판정 끝 — 정본이 이긴다 (대표 판단 불필요)

| # | 충돌 | Figma | 정본 | 근거 |
|---|---|---|---|---|
| C1 | 사용자 화면 `AI` 표기 3곳 | `OurWedding.tsx` | 금지 | `CLAUDE.md` 용어 |
| C2 | `탐색` 표기 2곳 | `FlowScreens.tsx` · `Pick.tsx` | `검색` | `CLAUDE.md` 용어 |
| C3 | 로그인 카카오 단독 | 카카오만 | 카카오 + 이메일 | `spec/tokens.json` `auth.providers` |
| C4 | `실 제보` 용어 0건 · 임의 영문 13종 | `VERIFIED PRICE RANGE` 등 | `실 제보` · `제보 금액` · `Pick 인증` | v3.18 용어 통일 |
| C5 | 업체 반론이 일반 사용자 MY에 노출 | `My.tsx` 「고객지원 > 업체 반론」 | 소속 확인 후 B2B 영역 | 기존 `my/biz/*` 분리 구조 |
| C6 | 임의 px 글자 크기 | `text-[42px]` 등 | 8단계 스케일 | `typography.ts` + `typography.test.ts`가 막는다 |
| C7 | 좌우 여백 20px | `px-5` 43곳 | 24px 고정 | `spacing.gutter`. Figma 근거는 B등급 |
| C8 | Tailwind 기본 그림자 16곳 | `shadow-sm` 등 | 그림자 거의 안 씀 | `elevation.$rule` |
| C9 | SEED 아이콘을 Pick 자리에 사용 | `IconHeartRegular`/`Fill` | Pick Mark 확정본 | `tokens.json` `symbol.$rule` 「절대 변경 금지」 |
| C10 | 온보딩 3스텝 | 날짜·지역·우선순위 | 초기 설정 4단계 | `platform.backButton` 규칙이 4단계를 전제 |
| C11 | 라운지 화면 제목이 「커뮤니티」 | `FlowScreens.tsx:255` | 「라운지」 | 2026-09-14 대표 확정 |
| C12 | URL 개명 | — | **URL은 그대로 둔다** | 대표님 문서 §9 (`/community`를 `/lounge`로 바꾸지 않는다) |

### 3-2. 대표 판단 필요

| # | 충돌 | 상태 |
|---|---|---|
| D1 | **탭 구성** — Figma 5탭(홈·웨딩노트·Pick·**라운지**·MY) vs 정본 5탭(홈·**검색**·Pick·웨딩일정·MY). Figma는 검색을 헤더 아이콘으로 강등했다 | 층 원칙상 IA는 정본이 이겨 검색 탭 유지가 기본값이지만, 그러면 라운지가 붙을 자리가 없다 |
| D2 | **영역 이름이 셋** — 정본 `웨딩일정` · Figma `웨딩노트` · 대표 문서 `웨딩플랜` | 하나로 정해야 한다 |
| D3 | **크림 바탕 hex** — 값이 어디에도 없다 | `FIGMA_DESIGN_SYSTEM.md` §1-2 |
| D4 | **테라코타(검증·신뢰) 색** — 확정 2색이 둘 다 로즈 계열 | `FIGMA_DESIGN_SYSTEM.md` §1-3 |
| D5 | **스킨 6종과 `#E7898D`** — 「코랄」 스킨의 정체 | 스킨 정리가 차후로 밀림 |
| D6 | **애플 로그인** — 앱스토어 4.8 요구 vs `auth.retired`가 폐기 처리 | 인증 정책 변경 |
| D7 | **상담 신청 / 전역 후기 피드 / 후기 상세+댓글** — API 계약 신설 필요 | §2-2 · §2-3 · §2-4 |
| D8 | **앱 아이콘·스플래시 코랄 고정** — Primary가 바뀌어도 `#FF6F61` 유지할지 | `tokens.json` `symbol.appIcon` |
| D9 | **radius 18px 기준 채택 여부** | Figma 쪽 근거에 결함 (`FIGMA_DESIGN_SYSTEM.md` §3-1) |

### 3-3. 문서끼리 어긋난 것 (저장소 안에서 발견)

| # | 내용 |
|---|---|
| E1 | `CLAUDE.md` v3.24절 「날짜 선택은 WP-APP-023(연월 셀렉트 + 달력)」이 **낡았다.** 현행은 휠 3열(2026-09-11 대표 지시, PR #217). CLAUDE.md 갱신이 필요하다 — **이번 단계에서는 고치지 않았다**(코드·규칙 파일 수정 범위 밖) |
| E2 | `CLAUDE.md` 「폰트는 시스템 서체 유지(Pretendard 미적용)」 vs `packages/ui/src/tokens.css`가 이미 웹에서 Pretendard를 1순위로 둔다. 2026-09-14 대표 확정(Pretendard 단일)이 이 충돌을 해소한다 |
| E3 | MASTER 브리핑의 「`docs/design-handoff/root/`」 경로가 **존재하지 않는다.** 실제는 `docs/design-handoff/current/`이고 화면 총계는 **189**(app 155 · web 8 · admin 26), 194가 아니다 |
| E4 | MASTER 브리핑의 「`#FF6F61` 하드코딩 0건」은 관리자 제외 시 **거의** 맞으나 정확히 0은 아니다: `packages/ui/src/theme.ts:35`(팔레트 원본, 정상) · **`packages/ui/src/wedding-mark.tsx:38` `color = '#ff6f61'` 기본 인자(토큰 교체로 안 바뀜)** · `apps/mobile/src/app/admin/` 50곳(범위 밖) |
| E5 | MASTER 브리핑은 「`spec/tokens.json` → `packages/ui/src/theme.ts` 단일 진입점」이라 했으나, `theme.ts`는 **생성물이 아니라 손으로 옮겨 적은 파일**이다(파일 주석 「값을 여기 적어 든다」). `gen-tokens.js`는 ios/android/web만 생성하고 `theme.ts`는 만들지 않는다. **토큰 교체는 두 파일을 손으로 맞춰야 한다** |

## 4. 이번 개편이 실제로 바꾸는 것

MASTER 브리핑의 「실제로 바뀌는 것은 다섯」을 실측으로 다듬으면:

1. **Primary 색** `#FF6F61` → `#E7898D` — `spec/tokens.json` + `packages/ui/src/theme.ts` 두 곳
2. **Accent 색** 신규 `#ECA0A3`
3. **서체** 시스템 서체 → Pretendard 단일 (+ Playfair·Noto Sans KR·DM Mono 배제, eyebrow 13종 제거)
4. **IA 명칭** 커뮤니티→라운지 등 — **URL은 그대로**(대표 문서 §9)
5. **크림 바탕** — ⚠️ **값이 없어 아직 바꿀 수 없다**(D3)

여기에 실측으로 하나 더 붙는다:

6. **`packages/ui/src/wedding-mark.tsx:38`의 기본 인자** — 토큰을 바꿔도 따라오지 않으므로 2단계에서 직접 고쳐야 한다(E4)

---
2026-09-14 KST 기준 두 저장소 작업 트리 실측.
