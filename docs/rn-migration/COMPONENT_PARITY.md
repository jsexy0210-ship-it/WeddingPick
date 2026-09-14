# 공용 컴포넌트 대조표 — Figma 신규 ↔ `packages/ui`

Figma 신규 디자인이 요구하는 공용 컴포넌트와 이 저장소가 지금 가진 것을 1:1로 맞춘 표다.
**토큰이 오기 전에 쓴 조사 문서**이고, `claude/rn-tokens`가 들어오면 「해야 할 일」 칸을 실제 구현으로 옮긴다.

- 담당 범위: `packages/ui/src/**` — 공용 부품만.
- 건드리지 않는 것: `spec/tokens.json` · `packages/ui/src/theme.ts`(토큰 세션) · 화면 파일 · 관리자 콘솔.
- 값은 토큰에서만 가져온다. 색 하드코딩 현재 0건이고 그 상태를 깬다.

## 자료 신뢰도

| 등급 | 위치 | 쓰는 법 |
| --- | --- | --- |
| A 픽셀정확 | `src/imports/` 3개(Home · Search · LargeCalendar) | 절대좌표라 코드는 못 쓴다. **값만** 캔다 |
| B 낮음 | `src/app/components/` 16개 | Figma Make가 LLM으로 만든 근사치. **수치를 시안 값으로 믿지 않는다.** 의도만 참고 |
| C 무시 | 라우팅 안 되는 8개(Budget · Checklist · Community · Honeymoon · More · Proposal · Schedule · Studio) | 보지 않는다 |

`src/imports/`의 `#EF5DA8` · `#F09A59` · `#371B34`은 **다른 세대 색이라 쓰지 않는다.**

## 지금 `packages/ui`에 있는 것 (36개 파일)

부품 24 · 토큰/훅 12.

```
부품   ThemedText · ThemedView · ActionButton · FilterChip · RatingPicker · WeddingCalendar
       WeddingMark · ProductSymbol · NpayLogo · SocialLogo · CategoryIcon · VendorImage
       Skeleton · ListSkeleton · Toast · DonutChart · Fab · Accordion · ProgressBar · StepList
       TruncatedText · CategoryCycleLoader · status-view 9종 · 배지 3종
배지   VerificationBadge · PickStatusBadge · DataTierBadge
상태   LoadingView · SkeletonView · RecommendingView · RecommendingBody · ErrorView
       EmptyView · NetworkErrorView · PermissionDeniedView · ProcessingView · MaintenanceView
토큰   Colors · Fonts · Spacing · Layout · Motion · Radius · FontSize · LineHeight
훅     useTheme · useColorScheme · useDelayedVisible
```

## 대조표

판정: **재사용**(그대로) · **확장**(있는 것에 변형 추가) · **신규**(없어서 만든다) · **앱에 있음**(앱 쪽 공용 파일. 승격 보류)

| # | Figma 신규가 쓰는 것 | 저장소 현재 | 판정 | 해야 할 일 |
| --- | --- | --- | --- | --- |
| 1 | **Button** | `ActionButton` — `variant` primary/secondary/ghost, `size` auto/medium/large/xlarge, `tone`, `icon`, `hint` | 재사용 | 새로 만들지 않는다. 더스티 로즈를 primary에 물리는 것은 토큰 교체로 끝난다. 화면당 Primary 1개 규칙은 화면 세션 몫 |
| 2 | **IconButton** | 없음. `Layout.iconButton`(40) 토큰만 있고 화면 7곳이 직접 그린다 | 신규 | 40 원형 · 터치 44 보장 · `accessibilityLabel` 필수. 헤더(검색 · 알림 · 더보기)와 카드 우상단 Pick 하트가 쓴다 |
| 3 | **Card** | 없음. `Radius.card`(14) · `Layout.cardPadding`(20)만 있고 화면 10곳이 직접 그린다 | 신규 | 얇은 면(surface) 하나. 배경 · 둥글기 · 패딩 · 눌림만 안다. 내용은 모른다 |
| 4 | **VendorCard** | 없음. 재료는 다 있다 — `VendorImage` · `VerificationBadge` · `DataTierBadge` · `TruncatedText` · `priceLine()`(domain) | 신규 | 위 재료를 조립만 한다. 금액 한 줄은 반드시 `priceLine(paidPrice, guidePrice)`. 검색 결과 · 홈 추천 · 비교가 같은 것을 쓴다 |
| 5 | **PickCard** | 없음. `PickStatusBadge`만 있다 | 신규 | **VendorCard와 합치지 않는다.** Pick 화면 카드는 업종별 후보 묶음 · 결정 상태 · 공유 여부를 보여주는 다른 물건이다(현재 `pick/index.tsx`의 `CategoryRow` · `StarterCard` · `SharedVendorRow`가 그 자리) |
| 6 | **Chip** | `FilterChip` — `label` · `selected` · `onPress` · `role` checkbox/radio | 확장 | 누르는 칩은 그대로 쓴다. Figma가 쓰는 **안 눌리는 태그 칩**(스타일 · 지역 표시)만 `interactive: false` 한 갈래로 붙인다. 두 번째 칩 컴포넌트를 만들지 않는다 |
| 7 | **Badge** | 뜻이 정해진 3종(`VerificationBadge` · `PickStatusBadge` · `DataTierBadge`) | 신규 | 뜻 없는 **일반 Badge** 하나가 없다(Figma의 「인기」 「신규」 자리). 기존 3종은 **그대로 둔다** — 뜻을 가진 배지라 일반 Badge로 갈아끼우면 의미가 사라진다. 전수 검수한 **글자 잘림 금지**를 새 Badge에도 건다 |
| 8 | **Input** | 없음. 화면 20곳이 `TextInput`을 직접 쓴다. `Layout.field`(52) · `Radius.input` · `fieldBorder` 토큰은 있다 | 신규 | 라벨 · 상태(기본/포커스/오류/비활성) · 도움말 · 오류문구. 오류는 색만으로 알리지 않는다 |
| 9 | **SearchBar** | 없음. `search/index.tsx`의 `renderSearchBox()`가 화면 안에 있다 | 신규 | Input 위에 얹는 한 겹(돋보기 · 지우기 · 제출). 자동완성 화면과 검색 홈이 같은 것을 쓴다 |
| 10 | **SectionHeader** | 없음. `Layout.sectionGap`(28) · `sectionHeadGap`(14)만 있고 화면 36곳이 직접 맞춘다 | 신규 | **제목 1줄 · 서브카피 없음**(CLAUDE.md). 오른쪽 「더보기」는 선택 |
| 11 | **Tab** (세그먼트) | 없음 | 신규 | Figma 웨딩노트의 3칸 세그먼트(채운 트랙 안에 뜬 알약). 하단 탭바와 다른 물건이다 |
| 12 | **BottomNavigation** | `apps/mobile/src/features/navigation/tab-bar.tsx` — 05-root 시안 1:1, `Layout.tabBar` 계열 토큰 사용 | 앱에 있음 | **옮기지 않는다.** expo-router `BottomTabBarProps`에 묶여 있어 `packages/ui`로 올리면 화면 세션들의 import가 전부 흔들린다. 대표님 판단 대기 |
| 13 | **Modal** (가운데 대화상자) | `showAlert`(네이티브 Alert)가 알림·확인을 덮는다. RN `Modal`을 직접 쓰는 곳은 이미지 뷰어 1곳뿐 | 재사용 | **새 Modal을 만들지 않는다.** 지금 필요한 자리는 `showAlert`와 BottomSheet가 이미 덮는다. 시안에 가운데 대화상자가 새로 필요해지면 그때 만든다 |
| 14 | **BottomSheet** | `apps/mobile/src/features/common/bottom-sheet.tsx` — 화면 12곳이 쓴다. 스크림/패널 분리 애니메이션이 이미 잡혀 있다 | 앱에 있음 | **옮기지 않는다.** 12곳이 물려 있어 이동은 화면 세션들과 충돌한다. 대표님 판단 대기 |
| 15 | **Loading** | `CategoryCycleLoader` · `useDelayedVisible`(700ms) · `LoadingView` · `SkeletonView` · `Skeleton` · `ListSkeleton` | 재사용 | 700ms 임계값 유지. **원형 로더 신설은 보류 — 아래 «판단 필요» 참조** |
| 16 | **EmptyState** | `EmptyView` — 제목 · 설명 · 행동 1개 | 재사용 | 새로 만들지 않는다. 문구만 신규 카피 규칙에 맞춘다 |
| 17 | **ErrorState** | `ErrorView` · `NetworkErrorView` · `PermissionDeniedView` · `MaintenanceView` | 재사용 | 새로 만들지 않는다. 네 갈래가 이미 원인별로 갈라져 있고, 하나로 합치면 원인별 안내가 사라진다 |

정리: **신규 8** · **확장 1** · **재사용 6** · **앱에 있음(보류) 2**.

## 새로 만들 때 지키는 것

- **Pick Mark 심볼은 절대 변경 금지** — `WeddingMark`의 두 path를 건드리지 않는다.
- **배지가 글자를 자르지 않게** 한다. 전수 검수한 항목이다.
- **로그인 진행 표시는 한 가지만** — 문구만이거나 로더만이다. 둘을 같이 세우지 않는다.
- **뒤로 가기 단추 자리는 상세 화면끼리 같다**(Depth Back). `apps/mobile/src/components/back-button.tsx`가 그 자리다.
- 사용자 화면 문구에 `AI` · `데이터` · `탐색` · `관심업체` 금지. `확인된 제보` → `실 제보`.
- 값은 `Colors` · `Spacing` · `Layout` · `Radius` · `FontSize`에서만. 하드코딩 금지.
- 이미 있는 것을 새로 만들지 않는다. 모양이 비슷하다고 억지로 합치지도 않는다.

## 판단 필요

**1. 원형 로더 — 지시와 저장소 핸드오프가 정면으로 어긋난다.**

- 이번 오더: 「페이지 사이 이동은 기본 원형 로더다. `CategoryCycleLoader`는 첫 실행·재시작처럼 오래 기다리는 자리에만.」
- 저장소 핸드오프 v3.20 (`docs/design-handoff/current/CHANGELOG.md`, «로더 통일 · 원형 스피너 폐기»):
  「로더를 업종 아이콘 순회 하나로 통일했습니다. **원형 스피너를 새로 만들지 않습니다.** `tokens.json`의 `motion.spinner`를 삭제하고 `motion.loaderIconCycle`로 교체했습니다.」

`CLAUDE.md`는 충돌 시 최신 핸드오프 md를 따르라고 한다. 그래서 **원형 로더를 만들지 않고 대기한다.**
700ms 임계값은 양쪽이 같으므로 그대로 지킨다. 어느 쪽으로 갈지 정해주시면 그때 반영한다.

**2. `BottomSheet` · `BottomNavigation`을 `packages/ui`로 올릴지.**
지금은 앱 쪽 공용 파일이고 화면 12곳 · 탭 전체가 물려 있다. 옮기면 화면 세션 셋과 동시에 부딪힌다.
지금은 두고, 화면 작업이 끝난 뒤 따로 옮기는 것을 권한다.
