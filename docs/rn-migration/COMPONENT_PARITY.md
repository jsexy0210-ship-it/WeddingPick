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
저장소의 정본 시안은 `docs/design/figma-export/` 36장이고, Figma 자료는 그 아래다.

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

**2. 사진 위 배지의 대비.**
`VendorCard` · `PickCard`가 대표 사진 왼쪽 위에 `<Badge kind="brand">`를 얹는다. `main`의 `Badge`에서
`brand`는 `tintSubtle`(#fbebec) 면에 `tint`(#e7898d) 글자다. 2026-09-14 새 팔레트(#225)에서 그 조합은
**연분홍 면에 더스티 로즈 글자**라 사진 위에서 거의 안 읽힌다.

저장소에 이 자리를 위한 토큰이 이미 있다 — `theme.pillOnImage`(rgba(0,0,0,.5), 「이미지 위 순위 ·
광고 pill 배경」). 검색 화면의 광고 pill이 그것을 쓴다. 어느 쪽으로 갈지 정해주면 반영한다.

**3. Claude GitHub App이 이 저장소에 설치돼 있지 않다.**
PR 웹훅이 오지 않아 CI 상태를 직접 조회로 확인하고 있다.

---

해소된 항목은 지운다 — 남겨두면 다음 사람이 또 확인한다.

- ~~원형 로더를 만들지 말고 대기~~ → `circle-loader.tsx`가 이미 `main`에 있다(2026-09-11 대표 지시가
  커밋 `dcbd19f9`로 반영됨). 「대표 지시 > 최신 md」가 맞고 앞선 판단이 틀렸다.
- ~~`claude/rn-tokens`가 낡은 base 위에 있다~~ → `8a259608`(#225)이 새 팔레트와 Pretendard를
  `CLAUDE.md`까지 함께 고쳐 `main`에 넣었다.
