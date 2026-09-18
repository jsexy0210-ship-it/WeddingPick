# Figma 화면 인벤토리 — 디자인 개편 1단계

작성 2026-09-14 (KST) · 1단계 설계 세션 · 브랜치 `claude/rn-migration-plan`
이 문서는 **분석 결과**다. 코드·토큰을 고치지 않는다.

## 0. 이 문서를 읽기 전에 — 과제의 실제 정의

`apps/mobile`은 **이미 Expo/RN**이다(expo-router, `src/` 223파일, 라우트 파일 125개).
WebView는 `apps/mobile/src/features/webshell/WebShellView.tsx` 한 곳뿐이다.
따라서 이번 과제는 「웹을 RN으로 전환」이 아니라 **「이미 RN인 앱의 UI 층을 새 디자인으로 개편」**이다.
문서 이름이 `rn-migration`인 것은 단계 명칭을 따른 것이고, 실제 범위는 Design Migration이다.

## 1. 자료 신뢰도 등급

| 등급 | 위치 | 성격 | 이 문서에서의 취급 |
|---|---|---|---|
| **A** 픽셀 정확 | `src/imports/` 3개 (Home · Search · LargeCalendar) | Figma 원본 export | **좌표가 절대값이라 코드로 못 쓴다.** 기하값(radius·크기)만 참고. **색·서체는 구세대라 쓰지 않는다**(§4 참조) |
| **B** 낮음 | `src/app/components/` 라우팅되는 8파일 | Figma Make가 LLM으로 생성한 근사치 | 화면 구성·IA·흐름의 근거로만 쓴다. **수치를 시안 값으로 믿지 않는다** |
| **C** 무시 | 라우팅 안 되는 8파일 | 구버전 잔재 | 범위 밖. §5 목록 |

라우팅되는 파일(B등급)은 `src/app/routes.ts` 기준으로 8개다:
`Root.tsx` `Home.tsx` `Search.tsx` `Pick.tsx` `OurWedding.tsx` `My.tsx` `FlowScreens.tsx` `VendorFlows.tsx`.
(MASTER 브리핑의 「B등급 16개」는 `src/app/components/` 최상위 파일 수(16)이고, 그중 8개는 §5의 죽은 파일이다.)

## 2. 개편 범위 화면 — 21개

### 2-1. Figma가 그린 화면 (16)

| # | 화면 | Figma 소스 | 등급 | Figma 라우트 | 주요 컴포넌트 | 로딩/빈/오류 | 바텀시트 |
|---|---|---|---|---|---|---|---|
| F01 | 홈 | `Home.tsx` (+ `imports/Home/`) | B (+A 참고) | `/` | 헤더(검색·알림 아이콘) · Hero · 추천 카드 · Pick 토글 · toast | **없음** | 없음 |
| F02 | 검색 | `Search.tsx` (+ `imports/Search/`) | B (+A 참고) | `/search`, `/explore` | 검색 입력 · 카테고리 칩 · 정렬 드롭다운 · 필터 패널(`FilterGroup`) · 업체 카드 | 부분(1곳) | 없음 (필터는 인라인 패널) |
| F03 | Pick 목록 | `Pick.tsx` `Pick()` | B | `/pick` | 카테고리 칩 · Pick 카드 · 비교 선택 · 결정 애니메이션 | 부분(1곳) | 없음 |
| F04 | Pick 비교 | `Pick.tsx` `CompareScreen` (98행) | B | `/pick` 내 상태 전환 | 비교 표 · 결정 CTA | 없음 | 없음 |
| F05 | 웨딩노트 — 캘린더 탭 | `OurWedding.tsx` (`tab==="calendar"`) | B | `/our-wedding` | 3열 탭 나브(263~283행) · 월 이동 · 일 선택 · 일정 목록 | 부분(3곳) | **있음** — `event` 추가/수정, `delete` 확인 |
| F06 | 웨딩노트 — 상담기록 탭 | `OurWedding.tsx` (`tab==="consult"`) | B | `/our-wedding` | 상담 목록 · 상세(`consultDetail`) · 편집 모드 · `AnalysisSection`/`AnalysisRow` | 없음 | 상세는 전체화면 전환 |
| F07 | 웨딩노트 — 예산현황 탭 | `OurWedding.tsx` (`tab==="budget"`) | B | `/our-wedding` | 예산 항목 목록 · 합계 | 없음 | **있음** — `budget` 추가/수정, `delete` 확인 |
| F08 | MY | `My.tsx` | B | `/my` | 프로필 카드 · 5개 섹션 행 목록 · 알림 토글 | **없음** | 없음 |
| F09 | 라운지 — 리얼후기 탭 | `FlowScreens.tsx` `CommunityFeed`+`ReviewContent` | B | `/community` | 3열 탭 나브 · `CategoryRail` · `StarRating` · 후기 카드 · 좋아요 | **없음** | FAB 팝오버(`mineOpen`) |
| F10 | 라운지 — 웨딩피드 탭 | `FlowScreens.tsx` `FeedContent` | B | `/community?tab=feed` | 콘텐츠 카드 · 좋아요 | **없음** | 없음 |
| F11 | 라운지 — 박람회 탭 | `FlowScreens.tsx` `ExpoContent` (552행) | B | `/community?tab=fair` | 박람회 카드 | **없음** | 없음 |
| F12 | 라운지 상세 | `FlowScreens.tsx` `FeedDetailPage` (639행) | B | `/community/feed/:id` | 히어로 · 본문 · 관련 목록 · 좋아요 | **없음** | 없음 |
| F13 | 업체 상세 | `VendorFlows.tsx` `VendorDetailPage` (169행) | B | `/vendor/:id` | `PageHeader` · 탭(소개 등) · `StarRow` · FAQ 아코디언 · Pick 토글 | **없음** | 없음 |
| F14 | 상담 신청 | `VendorFlows.tsx` `ConsultPage` (533행) | B | `/vendor/:id/consult` **· `/vendor/:id/booking`(별칭)** | 날짜 선택 · 시간 선택 · 메모 입력 · 제출 CTA | **없음** | 없음 |
| F15 | 후기 상세 | `VendorFlows.tsx` `ReviewDetailPage` (689행) | B | `/vendor/:id/reviews/:reviewId` | 후기 본문 · 좋아요 · 댓글 입력 | **없음** | 없음 |
| F16 | 로그인 | `FlowScreens.tsx` `Login` (31행) | B | `/login` | 헤드라인 · 소개 카드 · **카카오 버튼 단독** | **없음** | 없음 |
| F17 | 온보딩 | `FlowScreens.tsx` `Onboarding` (75행) | B | `/onboarding` | 3스텝(날짜/지역/우선순위) · 선택지 3개씩 · 진행 표시 | **없음** | 없음 |
| F18 | 계약 인증 | `FlowScreens.tsx` `ContractVerify` (124행) | B | `/contract-verify` | 파일 선택 · `status: idle/reading/done` · 결과 요약 | **처리 중 상태만 있음** | 없음 |

> **16이 아니라 18행이다.** MASTER 브리핑이 「웨딩플랜(+캘린더/예산 탭)」으로 2탭을 센 것과 달리 실제 Figma는 **3탭(캘린더·상담기록·예산현황)**이고(`OurWedding.tsx:271`), 라운지도 **3탭(리얼후기·웨딩피드·박람회)**이다(`FlowScreens.tsx:259`).
> 「화면 16개」는 **최상위 화면 단위**로 세면 맞다: 홈·검색·Pick목록·Pick비교·웨딩노트·MY·라운지·라운지상세·업체상세·상담신청·후기상세·로그인·온보딩·계약인증 = **14**. 여기에 탭 내부를 독립 화면으로 세면 웨딩노트 +2, 라운지 +2 = **18**.
> **16이라는 숫자는 어느 세는 방식으로도 나오지 않는다.** 아래 §3에서 최종 집계를 정리한다.

`/vendor/:id/booking`은 `VendorFlows.tsx:671`에서 `export { ConsultPage as BookingPage }` — 같은 컴포넌트의 별칭이므로 별도 화면이 아니다(MASTER 브리핑과 일치, 실측 확인함).

### 2-2. 반드시 추가해야 하는 화면 (5) — Figma에 없음

| # | 화면 | Figma 존재 | 근거 | 기존 앱 위치 |
|---|---|---|---|---|
| M01 | 회원탈퇴 | **0건** (`grep -r "탈퇴" src/` = 0) | 카카오 심사 반려 이력 · 법적 요건 | `apps/mobile/src/app/(tabs)/my/withdrawal.tsx` |
| M02 | 연령 확인(연령대) | **0건** (`grep -r "연령\|나이\|19세" src/` = 0) | 법적 요건 | `apps/mobile/src/app/login/age-required.tsx` |
| M03 | 애플 로그인 | **0건** (`grep -i apple` = 0) | 앱스토어 심사지침 4.8 | 없음 — §6 미해결 |
| M04 | 약관·개인정보처리방침 **본문** | **진입점만 있음** | 법적 요건 | `my/policies.tsx` · `my/privacy.tsx` |
| M05 | 배우자 연결 | **진입점만 있음**(「연결 관리」) | 핵심 기능 | `(tabs)/wedding/partner.tsx` · `wedding/join.tsx` |

> M04·M05는 MASTER 브리핑이 「Figma에 없음」으로 분류했으나 실측은 다르다. `My.tsx`의 「서비스」 섹션에 **이용약관·개인정보처리방침 행이 있고**, 「함께 준비하기」 섹션에 **「연결 관리」 행이 있다**. 없는 것은 **행이 아니라 그 행을 눌렀을 때 열리는 화면**이다. 개편 시 진입점을 새로 만들 필요는 없고 목적지 화면만 기존 것을 쓰면 된다.

## 3. 최종 집계

| 세는 방식 | 수 |
|---|---|
| Figma 최상위 화면 | 14 |
| + 웨딩노트 탭 2개 · 라운지 탭 2개를 독립 화면으로 | **18** |
| + 반드시 추가 5 | **23** |
| (MASTER 브리핑의 집계) | (16 + 5 = 21) |

**개편 범위는 21이 아니라 23으로 본다.** 차이 2개는 `OurWedding` 상담기록 탭(F06)과 라운지 박람회 탭(F11)이며, 둘 다 실제 Figma 코드에 존재한다. 다만 F06은 대표님 문서 §6이 「AI 상담기록은 아직 구현되어 있지 않다면 이번 저장소 정리 작업에서 새 기능으로 만들지 않는다」고 적었으므로 **구현 여부는 대표 판단 대기**다(`RN_MIGRATION_MAP.md` UNMAPPED 참조).

나머지 화면은 토큰 교체로 따라온다. **173개가 아니다** — 실측은 아래와 같다.

| 구분 | 실측 | 출처 |
|---|---|---|
| `apps/mobile` 라우트 파일 총계 | 125 | `find src/app -type f` |
| 그중 `_layout.tsx`/`_api.ts` (화면 아님) | 11 | |
| 그중 관리자 (범위 밖) | 27 | `src/app/admin/` |
| **사용자 화면 라우트 파일** | **87** | (`map.web.tsx`는 `map.tsx`의 플랫폼 변형이라 고유 화면은 86) |
| 정본 화면 목록 | **189** (app 155 · web 8 · admin 26) | `docs/design/handoff/screens.json` v3.22 (2026-09-09) |

## 4. 상태(로딩·빈·오류)에 대한 결론 — 중요

**Figma 시안에는 상태 화면이 사실상 없다.** 위 표의 「로딩/빈/오류」 칸이 대부분 「없음」인 것은 누락이 아니라 프로토타입의 성격이다.

따라서 **상태는 Figma에서 가져오지 않는다.** 정본은 `spec/screens.json`의 `stateSets`이며 그대로 유지한다:

- `loading`: Skeleton · 부분 로딩 · 처리 중
- `error`: 일반 오류 · 네트워크 · 권한 거부 · 점검
- `info`: 0~2건 수집 중 · 3~4건 안내 동반 · 5~9건 구간 · 10건 이상 상세
- `member` · `couple` · `pick` · `image` · `benefit`

기존 앱은 이미 이를 구현한 컴포넌트를 갖고 있다(`packages/ui/src/`): `list-skeleton.tsx` · `skeleton.tsx` · `status-view.tsx` · `category-cycle-loader.tsx` · `use-delayed-visible.ts` · `data-tier-badge.tsx`. **3단계에서 이 컴포넌트들을 그대로 재사용한다.**

## 5. C등급 — 라우팅되지 않는 죽은 파일 (8)

`src/app/routes.ts`가 import하지 않는다. 대표님 문서 §7이 같은 8개를 지목했다.

`Budget.tsx` · `Checklist.tsx` · `Community.tsx` · `Honeymoon.tsx` · `More.tsx` · `Proposal.tsx` · `Schedule.tsx` · `Studio.tsx`

**이번 개편에서 참조하지 않는다.** 삭제 여부는 Figma 저장소 소관이고 WeddingPickl 범위 밖이다.

## 6. 미해결 — 대표 판단 필요

1. **탭 구성이 정본과 다르다.** `Root.tsx:26~32`의 5탭은 홈 · **웨딩노트** · Pick · **라운지** · MY다. 정본(`spec/screens.json` navigation, `spec/tokens.json` tabBar)의 5탭은 홈 · **검색** · Pick · **웨딩일정** · MY다. Figma는 검색을 탭에서 빼고(헤더 아이콘으로 강등, `Home.tsx:101`) 라운지를 탭에 넣었다. 층 원칙상 IA는 정본이 이기므로 **검색 탭 유지**가 기본값이지만, 그러면 Figma 라운지 화면이 붙을 자리가 없다.
2. **같은 영역의 이름이 셋이다.** 정본 `웨딩일정` · Figma `웨딩노트`(`OurWedding.tsx:267`) · 대표님 문서 §6 `웨딩플랜`.
3. **라운지 화면 제목이 아직 「커뮤니티」다**(`FlowScreens.tsx:255`). Figma 안에서도 개명이 안 끝났다.
4. **애플 로그인(M03)은 기존 앱에도 없다.** `spec/tokens.json` `auth.retired`가 네이버·구글·애플을 이미 폐기 처리했다. 앱스토어 4.8을 통과하려면 되살려야 하는데, 이는 디자인이 아니라 인증 정책 변경이다.
5. **날짜 선택.** 현행 정본은 **휠 3열**(2026-09-11 대표 지시, PR #217). `CLAUDE.md` v3.24절의 「날짜 선택은 WP-APP-023(연월 셀렉트 + 달력)」은 **낡았다**. Figma `imports/LargeCalendar`는 월 격자 미니 캘린더이고, Figma 온보딩(`FlowScreens.tsx:75~`)의 날짜 스텝은 선택지 3개짜리 칩이라 **셋 다 다르다**. 휠 3열을 유지한다.

---
출처는 모두 2026-09-14 KST 기준 두 저장소의 작업 트리에서 직접 읽었다.
Figma 저장소: `github.com/jsexy0210-ship-it/docs/design/figma-export` (읽기 전용) · WeddingPickl: `main` `f8cd22c`
