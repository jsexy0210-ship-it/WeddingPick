# 패딩 · 간격 대조 (2026-09-09)

사용자 오더 「디자인 기준 전체 패딩 위치값 안맞는거 전면 재검토」의 대조 결과다. 시안
(`docs/design-handoff/current/html/*.dc.html`의 `renderVals()`와 템플릿 리터럴) · 토큰
(`spec/tokens.json` · `packages/ui/src/theme.ts`) · 구현(`apps/mobile/src/**`)을 맞춰 봤다.

**좌우 Gutter 24는 모든 화면이 지키고 있다.** 어긋난 것은 헤더 오른쪽 광학 보정과 토큰 오용이다.

## 1. 시안과 다른 곳

| 파일 | 자리 | 시안 | 코드 | 고치는 법 |
|---|---|---|---|---|
| `app/(tabs)/index.tsx:474` | 헤더 오른쪽 | 24 (03-home-states) | 16 | `Layout.gutter` — 시안 두 개가 20/24로 갈려 최신(home-states)을 따른다 |
| `app/(tabs)/my/index.tsx:400` | 헤더 오른쪽 | 20 (05-root) | 16 | `Layout.gutter - Spacing.one` |
| `app/(tabs)/my/index.tsx:476` | 메뉴 그룹 제목→목록 | 6 | 10 | 토큰에 6이 없다 — `spacing.menuGroupGap: 6` 추가 |
| `app/(tabs)/my/index.tsx:414` | 스크롤 아래 | 16 | 64 | `Layout.sectionBand` |
| `features/settings/my-kit.tsx:501` | 상단 내비 좌우 | 12 / 20 | 16 / 24 | `screen-kit.tsx`와 같은 식으로. **MY 하위 전 화면이 이 한 곳을 공유한다** |
| `app/(tabs)/search/index.tsx:1186,1258` | 섹션 제목→내용 | 12 (06-search) | 14 | 02-design-system은 14라 시안끼리 충돌 — 결정 먼저 |
| `app/(tabs)/search/index.tsx:1078` | 결과 카드 이미지 | 342×168 | `100%` + 고정 168 | 비율(`aspectRatio`)로 잡거나 `MaxContentWidth`를 390으로 |
| `features/home/recommendation.tsx:216` | 추천 대표 이미지 | 180 · r10 | 고정 180 | 위와 같다 |
| `app/(tabs)/index.tsx:489` | 스크롤 아래 | 8 | 64 | `Spacing.two` |
| `app/(tabs)/search/[vendorId]/index.tsx:777` | Pick CTA 높이 | 56 (09-core-loop · screens.json) | 52 | 토큰에 56이 없다 — `size.ctaPick: 56` 추가 |
| `app/(tabs)/pick/[category].tsx:474` | dock 안전영역 | 92 + inset | 92 고정 | `screen-kit.tsx` Dock처럼 `insets.bottom` 가산. **노치 기기에서 CTA가 물린다** |
| `app/(tabs)/pick/removed.tsx` · `history.tsx` | 카드 | r10 · padding 18 | r14 · 16/8 | `Radius.medium` + `Layout.cardPaddingCompactY` |
| 입력 필드 15곳 | 좌우 | 14 (`component.field.padding`) | 16 | `Layout.fieldPaddingX` |

## 2. 하드코딩 · 토큰 오용

- **`Spacing.six`(64) 21곳** — theme.ts가 「핸드오프 허용 간격이 아니다(최대 28)」로 표시해 둔 값.
- **`borderRadius: Spacing.three`(16) 12곳 · `Spacing.two`(8) 3곳 · 36 · 5 · 3** — radius 사다리는
  `4 · 6 · 10 · 14 · 20 · 26 · 40 · 999`뿐이고 `radius.$note`가 「이 외 값을 만들지 않는다」로 못 박았다.
- **`Radius.card`(deprecated 14) 8곳** — `Radius.medium`(10)로.
- **24를 `Layout.gutter`가 아니라 `Spacing.four`로 적은 곳 11곳** — 거터의 뜻이 코드에서 사라진다.
- **토큰이 이미 있는데 숫자로 적은 곳** — `compare.tsx:318-321`(36 · 22 · 48 · 6) · `board.tsx`(1.5) ·
  `benefit-sheet.tsx`(40 · 999 · 18) · `screen-kit.tsx:619`(4) 등.
- **토큰이 없어 새로 만들어야 하는 값** — 조건 칩 30/11 · 2열 사이 9 · 홈 대표 이미지 180 ·
  검색 카드 168 · 업체 상세 히어로 260 · 로그인 화면 전용값 여러 개.

## 3. 시안끼리 어긋난 자리 — 정본을 정해야 한다

| 자리 | 시안 A | 시안 B |
|---|---|---|
| 목록 행 아이콘–글 간격 | 05-root 14 | 13-my-sub 12 |
| 홈 헤더 오른쪽 | 03-home 20 | 03-home-states 24 |
| 섹션 제목→내용 | 06-search 12 | 02-design-system 14 |
| 탭바 위 선 | 05-root `#dcdee3` | 03-home · 06-search `#eaebee` |

마지막 하나와 03-home-states의 subImg radius 8은 **코드가 맞고 시안이 틀려서 시안을 고쳤다**(2026-09-09).

## 4. 아직 안 본 것

관리자 화면 28개(`app/admin/**`) · 온보딩 부품 12개(`features/onboarding/**`) · 웹(`apps/web`).
