# 패딩 · 간격 대조 (2026-09-09)

사용자 오더 「디자인 기준 전체 패딩 위치값 안맞는거 전면 재검토」의 대조 결과다. 시안
(`docs/design-handoff/current/html/*.dc.html`의 `renderVals()`와 템플릿 리터럴) · 토큰
(`spec/tokens.json` · `packages/ui/src/theme.ts`) · 구현(`apps/mobile/src/**`)을 맞춰 봤다.

**좌우 Gutter 24는 모든 화면이 지키고 있다.** 어긋난 것은 헤더 오른쪽 광학 보정과 토큰 오용이다.

## 1. 시안과 다른 곳

| 파일 | 자리 | 시안 | 코드 | 고치는 법 | 상태 |
|---|---|---|---|---|---|
| `app/(tabs)/index.tsx:474` | 헤더 오른쪽 | 24 (03-home-states) | 16 | `Layout.gutter` — 시안 두 개가 20/24로 갈려 최신(home-states)을 따른다 | **반영함** — `paddingHorizontal: Layout.gutter`. 40 원형 버튼 안의 24 아이콘은 32 선에 앉는다(검색·Pick 헤더와 같은 방식) |
| `app/(tabs)/my/index.tsx:400` | 헤더 오른쪽 | 20 (05-root) | 16 | `Layout.gutter - Spacing.one` | 남김 — 다른 작업이 이 파일을 잡고 있다 |
| `app/(tabs)/my/index.tsx:476` | 메뉴 그룹 제목→목록 | 6 | 10 | 토큰에 6이 없다 — `spacing.menuGroupGap: 6` 추가 | 남김 — 같은 이유 |
| `app/(tabs)/my/index.tsx:414` | 스크롤 아래 | 16 | 64 | `Layout.sectionBand` | 남김 — 같은 이유. `Spacing.six`가 남은 마지막 자리다 |
| `features/settings/my-kit.tsx:501` | 상단 내비 좌우 | 12 / 20 | 16 / 24 | `screen-kit.tsx`와 같은 식으로. **MY 하위 전 화면이 이 한 곳을 공유한다** | **반영함** — `Layout.navPaddingLeft/Right/navGap`(새 토큰 `component.navBack`). `screen-kit.tsx` · `progress.tsx` · `compare.tsx` · `pick/[category].tsx`도 같은 이름으로 통일 |
| `app/(tabs)/search/index.tsx:1186,1258` | 섹션 제목→내용 | 12 (06-search) | 14 | 02-design-system은 14라 시안끼리 충돌 — 결정 먼저 | **반영함** — 그 화면 시안(06-search 12)을 따랐다. 새 토큰 `spacing.sectionGapCompact` · `Layout.sectionHeadGapCompact`. 전역 `sectionGap` 14는 그대로 |
| `app/(tabs)/search/index.tsx:1078` | 결과 카드 이미지 | 342×168 | `100%` + 고정 168 | 비율(`aspectRatio`)로 잡거나 `MaxContentWidth`를 390으로 | 남김 — 이번 작업 범위(패딩·간격) 밖이다. 이미지 규격은 따로 |
| `features/home/recommendation.tsx:216` | 추천 대표 이미지 | 180 · r10 | 고정 180 | 위와 같다 | 남김 — 같은 이유 |
| `app/(tabs)/index.tsx:489` | 스크롤 아래 | 8 | 64 | `Spacing.two` | **반영함** |
| `app/(tabs)/search/[vendorId]/index.tsx:777` | Pick CTA 높이 | 56 (09-core-loop · screens.json) | 52 | 토큰에 56이 없다 — `size.ctaPick: 56` 추가 | 토큰만 반영함 — `size.ctaPick: 56` · `Layout.ctaPick`. **적용은 남김**(다른 작업이 이 파일을 잡고 있다) |
| `app/(tabs)/pick/[category].tsx:474` | dock 안전영역 | 92 + inset | 92 고정 | `screen-kit.tsx` Dock처럼 `insets.bottom` 가산. **노치 기기에서 CTA가 물린다** | **반영함** — `SafeAreaView edges={['top']}` + dock `minHeight: Layout.dock + insets.bottom` · `paddingBottom: Layout.sectionGap + insets.bottom`. dock 흰 면이 화면 아래 끝까지 닿는다 |
| `app/(tabs)/pick/removed.tsx` · `history.tsx` | 카드 | r10 · padding 18 | r14 · 16/8 | `Radius.medium` + `Layout.cardPaddingCompactY` | **반영함** — 좌우는 `Layout.cardPadding` 20(component.card.paddingCompact «18px 20px»). `FontSize`/`LineHeight` 직접 사용도 `ThemedText` 타입으로 옮겼다 |
| 입력 필드 15곳 | 좌우 | 14 (`component.field.padding`) | 16 | `Layout.fieldPaddingX` | **반영함** — 17곳(금지 파일 제외). 이미 14였지만 식으로 적던 두 곳(`screen-kit` · `expenses/index`)도 토큰 이름으로 |

## 2. 하드코딩 · 토큰 오용

- **`Spacing.six`(64) 21곳** — theme.ts가 「핸드오프 허용 간격이 아니다(최대 28)」로 표시해 둔 값.
  **반영함**(27곳). 스크롤 아래 여백은 시안대로 두 갈래로 갈랐다 — 안쪽 블록이 제 아래 여백(24·28)을
  이미 들고 있는 화면은 꼬리 `Spacing.two`(8), 스크롤 컨테이너가 유일한 아래 여백인 화면
  (MY 하위 · 제보 화면 9곳)은 시안 padSec 아래값 `Spacing.four`(24). `register.tsx`의 제출 완료
  히어로 64는 11-report-review «padding:64px 24px 40px»의 실제 값이라 새 토큰
  `component.doneHero`(`Layout.doneHeroPaddingTop/Bottom/Ring`)로 이름을 줬다.
  남은 한 곳은 `my/index.tsx`(다른 작업이 잡고 있다).
- **`borderRadius: Spacing.three`(16) 12곳 · `Spacing.two`(8) 3곳 · 36 · 5 · 3** — radius 사다리는
  `4 · 6 · 10 · 14 · 20 · 26 · 40 · 999`뿐이고 `radius.$note`가 「이 외 값을 만들지 않는다」로 못 박았다.
  **반영함.** 숫자로 반올림하지 않고 자리의 뜻으로 골랐다 — 카드·안내 박스·행은 `Radius.medium`(10),
  입력 칸은 `Radius.input`(6), 작은 썸네일·오버레이 버튼은 `Radius.control`(6),
  지름의 절반이던 36·5·3(셔터 · 점)은 `Radius.pill`. 뼈대 바 `radius={4}`는 `Radius.badge`.
- **`Radius.card`(deprecated 14) 8곳** — `Radius.medium`(10)로. **반영함**(map · removed · history).
- **24를 `Layout.gutter`가 아니라 `Spacing.four`로 적은 곳 11곳** — 거터의 뜻이 코드에서 사라진다.
  **반영함**(12곳). 덤으로 `padding: Spacing.four`로 적힌 카드 4곳은 `Layout.cardPadding`(20 ·
  component.card.padding)로 바로잡았다 — 24는 카드 패딩 토큰이 아니다.
- **토큰이 이미 있는데 숫자로 적은 곳** — `compare.tsx:318-321`(36 · 22 · 48 · 6) · `board.tsx`(1.5) ·
  `benefit-sheet.tsx`(40 · 999 · 18) · `screen-kit.tsx:619`(4) 등. **반영함** —
  `Layout.chip` · `Layout.badgeHeight` · `Layout.rowMinHeightCompact` · 새 토큰 `Layout.bulletDot`(6) ·
  `Border.selected`(1.5) · `Layout.grabberWidth/Height` · `Layout.stepDot` · `Layout.iconRow` ·
  `Radius.pill` · `Radius.badge`. 검색 홈의 최근 검색 칩 좌우도 `Layout.chipPaddingX`(14)로.
- **토큰이 없어 새로 만들어야 하는 값** — 조건 칩 30/11 · 2열 사이 9 · 홈 대표 이미지 180 ·
  검색 카드 168 · 업체 상세 히어로 260 · 로그인 화면 전용값 여러 개. **남김** — 이번은 패딩·간격만 봤다.

## 3. 시안끼리 어긋난 자리 — 정본을 정해야 한다

| 자리 | 시안 A | 시안 B |
|---|---|---|
| 목록 행 아이콘–글 간격 | 05-root 14 | 13-my-sub 12 |
| 홈 헤더 오른쪽 | 03-home 20 | 03-home-states 24 |
| 섹션 제목→내용 | 06-search 12 | 02-design-system 14 |
| 탭바 위 선 | 05-root `#dcdee3` | 03-home · 06-search `#eaebee` |

마지막 하나와 03-home-states의 subImg radius 8은 **코드가 맞고 시안이 틀려서 시안을 고쳤다**(2026-09-09).

**정본을 정했다(2026-09-09 반영).**

| 자리 | 고른 쪽 | 근거 |
|---|---|---|
| 홈 헤더 오른쪽 | **24**(03-home-states) | 두 시안 중 최신. 검색·Pick 루트 헤더는 제 시안(05-root · 06-search)이 20이라 20을 지킨다 — `Layout.navPaddingRight` |
| 섹션 제목→내용 | **화면 시안 우선** — 검색 홈은 12, 나머지는 14 | 02-design-system 14는 전역 기본(`Layout.sectionHeadGap`), 06-search 12는 그 화면 값(`Layout.sectionHeadGapCompact`) |
| 목록 행 아이콘–글 간격 | 남김 | 이번 작업에서 손대지 않았다 |
| 탭바 위 선 | 남김 | 이미 코드가 맞고 시안을 고쳤다 |

## 4. 아직 안 본 것

관리자 화면 28개(`app/admin/**`) · 온보딩 부품 12개(`features/onboarding/**`) · 웹(`apps/web`).
관리자 화면의 `borderRadius: 6/10/14/4/3/2`와 `padding` 숫자는 그대로 남아 있다 — 위 사다리 정리에서
`app/admin/**`은 건드리지 않았다.

## 5. 새로 만든 토큰(2026-09-09)

| 토큰 | 값 | 왜 |
|---|---|---|
| `component.navBack` → `Layout.navPaddingLeft/navPaddingRight/navGap` | 12 · 20 · 8 | 시안 18개의 navBack이 모두 «padding:0 20px 0 12px». 화면이 거터에서 빼 계산하면 버튼 크기가 바뀔 때 한 곳만 어긋난다 |
| `size.ctaPick` → `Layout.ctaPick` | 56 | 09-core-loop의 «Pick하기 · N곳 비교하기»가 56(screens.json WP-VEND-001도 56). 일반 Primary 52와 다른 자리다 |
| `spacing.sectionGapCompact` → `Layout.sectionHeadGapCompact` | 12 | 06-search 섹션 컨테이너 gap. 전역 14와 갈리는 자리를 이름으로 나눴다 |
| `spacing.bulletDot` → `Layout.bulletDot` | 6 | 09-core-loop · 01a-login · 19c-web의 «width:6px;height:6px;border-radius:999px» |
| `component.doneHero` → `Layout.doneHeroPaddingTop/PaddingBottom/Ring` | 64 · 40 · 72 | 11-report-review «padding:64px 24px 40px · 원 72». 64·40은 간격 사다리 밖이라 이 자리 이름으로만 든다 |
