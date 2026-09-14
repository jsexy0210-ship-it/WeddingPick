# 공용 컴포넌트 대조표 — Figma 신규 ↔ `packages/ui`

Figma 신규 디자인이 요구하는 공용 컴포넌트와 저장소가 가진 것을 1:1로 맞춘 표다.

- 기준은 **최신 `main`**이다(CLAUDE.md 「모든 규칙은 최신 main을 기준으로 한다」).
- 담당 범위: `packages/ui/src/**` — 공용 부품만.
- 건드리지 않는 것: `spec/tokens.json` · `packages/ui/src/theme.ts` · `design-tokens.ts`(토큰 세션) ·
  화면 파일 · 관리자 콘솔.
- 값은 토큰에서만 가져온다. 하드코딩 금지.

## 자료 신뢰도 — Figma 저장소

| 등급 | 위치 | 쓰는 법 |
| --- | --- | --- |
| A 픽셀정확 | `src/imports/` 3개(Home · Search · LargeCalendar) | 절대좌표라 코드는 못 쓴다. **값만** 캔다 |
| B 낮음 | `src/app/components/` 16개 | Figma Make가 LLM으로 만든 근사치. **수치를 시안 값으로 믿지 않는다.** 의도만 참고 |
| C 무시 | 라우팅 안 되는 8개(Budget · Checklist · Community · Honeymoon · More · Proposal · Schedule · Studio) | 보지 않는다 |

`src/imports/`의 `#EF5DA8` · `#F09A59` · `#371B34`은 **다른 세대 색이라 쓰지 않는다.**
저장소의 정본 시안은 `docs/design-handoff/root/` 36장이고, Figma 자료는 그 아래다.

## 대조표

판정: **재사용**(이미 있다) · **신규**(없어서 만들었다) · **앱에 있음**(앱 쪽 공용 파일. 승격 보류)

| # | Figma 신규가 쓰는 것 | 저장소 현재 | 판정 |
| --- | --- | --- | --- |
| 1 | **Button** | `ActionButton` — variant 3 · size 4 · tone | 재사용 |
| 2 | **IconButton** | 없었다 → `icon-button.tsx` | **신규** |
| 3 | **Card** | 없었다 → `card.tsx` | **신규** |
| 4 | **VendorCard** | 없었다 → `vendor-card.tsx` | **신규** |
| 5 | **PickCard** | 없었다 → `pick-card.tsx` | **신규** |
| 6 | **Chip** | `FilterChip` — size `default·small·sheet` · accent `ink·tint` · off `fill·outline` | 재사용 |
| 7 | **Badge** | `Badge` — kind `ok·wait·no·brand·none·info` | 재사용 |
| 8 | **Input** | `TextField` — label · error · hint · trailing (+ `leading` 추가) | 재사용 |
| 9 | **SearchBar** | 없었다 → `search-bar.tsx`(`TextField` 위 한 겹) | **신규** |
| 10 | **SectionHeader** | 없었다 → `section-header.tsx` | **신규** |
| 11 | **Tab**(세그먼트) | 없었다 → `segmented-tabs.tsx` | **신규** |
| 12 | **BottomNavigation** | `apps/mobile/src/features/navigation/tab-bar.tsx` | 앱에 있음 |
| 13 | **Modal**(가운데 대화상자) | `showAlert` + 앱 `BottomSheet`가 덮는다. 새로 만들지 않았다 | 재사용 |
| 14 | **BottomSheet** | `apps/mobile/src/features/common/bottom-sheet.tsx` — 화면 12곳 사용 | 앱에 있음 |
| 15 | **Loading** | `CircleLoader`(기본) · `CategoryCycleLoader`(오래 기다리는 자리) · `useDelayedVisible`(700ms) · `Skeleton` · `ListSkeleton` | 재사용 |
| 16 | **EmptyState** | `EmptyView` | 재사용 |
| 17 | **ErrorState** | `ErrorView` · `NetworkErrorView` · `PermissionDeniedView` · `MaintenanceView` | 재사용 |

**신규 6 · 재사용 9 · 앱에 있음 2.**

## 새로 만든 것

| 파일 | 무엇 |
| --- | --- |
| `icon-button.tsx` | 아이콘만 있는 단추. 보이는 40(`Layout.iconButton`) · 터치 44(`hitSlop`) · `accessibilityLabel` 필수 |
| `card.tsx` | 면 하나. `Radius.medium`(10) · 그림자 없음(`elevation.$rule`) · `plain`/`filled` · `flush` |
| `vendor-card.tsx` | 업체 카드. 사진 위 · 세로. 검색 결과 · 홈 추천 · 비교가 같은 것을 쓴다 |
| `pick-card.tsx` | Pick 목록 카드. 썸네일 옆 · 가로 · `Radius.pickCard`(14). 업종과 결정 여부가 먼저 읽힌다 |
| `search-bar.tsx` | 검색 칸. `TextField` 위에 돋보기·지우기를 얹은 한 겹 |
| `section-header.tsx` | 섹션 제목 줄. **제목 1줄, 서브카피 prop을 두지 않는다**(CLAUDE.md) |
| `segmented-tabs.tsx` | 화면 안에서 내용만 바꾸는 줄. 하단 탭 바와 다른 물건 |

**`VendorCard`와 `PickCard`를 합치지 않았다.** Figma에서 전자는 사진이 위에 깔리고 아직 고르지
않은 업체를 훑는 카드고, 후자는 썸네일이 옆에 붙고 업종 · 결정 여부 · 빼기가 먼저 읽히는
카드다. 같은 정보라도 순서가 달라서, 한 벌로 합치면 두 화면 중 하나는 맞지 않는다.

금액은 두 카드 모두 `priceLine(paidPrice, guidePrice)`의 **결과만** 받는다 — `packages/ui`는
`packages/domain`을 import하지 않는 표시 전용이라 금액 규칙을 두 벌 두지 않는다.

## 기존 파일에 손댄 것 — 한 곳

`text-field.tsx`에 `leading` 한 자리를 더했다. `trailing`만 있어서 검색 칸의 돋보기를 넣을
자리가 없었다. **입력 칸을 두 벌 만들지 않으려고** 기존 것을 늘렸다. 기존 호출부는 그대로다.

## 안 만든 것과 그 이유

- **원형 로더** — `circle-loader.tsx`가 이미 `main`에 있다. 2026-09-11 대표 지시(페이지 사이
  이동은 기본 원형 로더 · `CategoryCycleLoader`는 오래 기다리는 자리만 · 700ms 유지)가 이미
  코드에 들어와 있고 `LoadingView`가 그렇게 갈라 쓴다. 새로 만들 것이 없다.
- **Badge · Input · Chip** — `Badge` · `TextField` · `FilterChip`이 이미 있다. 시안에서 직접 뽑은
  값과 갈래를 갖고 있어 내가 만든 것보다 정확하다.
- **Modal** — 지금 필요한 자리를 `showAlert`와 `BottomSheet`가 덮는다. 시안에 가운데 대화상자가
  새로 필요해지면 그때 만든다.

## 판단 필요

**1. `BottomSheet` · `BottomNavigation`을 `packages/ui`로 올릴지.**
지금은 앱 쪽 공용 파일이다. 시트는 화면 12곳이 쓰고, 탭 바는 expo-router `BottomTabBarProps`에
묶여 있다. 옮기면 화면 세션들의 import가 한꺼번에 흔들린다. 화면 작업이 끝난 뒤 따로 옮기는
것을 권한다.

**2. `claude/rn-tokens`는 낡은 `main` 위에서 갈라졌다 — 리베이스가 필요하다.**
그 브랜치는 키 컬러를 코랄 `#ff6f61` → 더스티 로즈 `#e7898d`로 바꾸고 서체를 Pretendard 단일로
돌렸는데, 그 뒤 `main`이 `theme.ts`를 크게 고쳤고 `design-tokens.ts` · `circle-loader.tsx` ·
`text-field.tsx` · `rating-stars.tsx`가 새로 들어왔다. 현재 `main`의 `CLAUDE.md`는 아직
**코랄 #FF6F61 기본 · 「폰트는 시스템 서체 유지(Pretendard 미적용)」**라고 적는다.

이 브랜치는 `main`을 머지하면서 `theme.ts`와 `spec/tokens.json`을 **`main` 쪽으로 받았다.**
토큰 세션 파일이라 내가 해결할 자리가 아니고, 낡은 판을 끌고 들어가면 `main`의 토큰 개편이
지워진다. **토큰 세션이 최신 `main` 위로 리베이스한 뒤 다시 머지하겠다.**
같이 정해야 할 것 둘 — 키 컬러를 로즈로 갈지, 서체를 Pretendard로 갈지. 둘 다 `CLAUDE.md`
본문과 어긋나므로 규칙 문서도 함께 고쳐야 한다.
