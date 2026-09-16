# SEED 부품 대조표 — 1단계 실측

대표 지시(2026-09-15) 「전체 화면 기본 구조는 건들지말고 seed디자인 컴포넌트로 다 교체도 진행해」의
1단계다. **아직 부품 코드를 고치지 않았다.** 이 표를 보고 MASTER가 순서를 정한다.

- 잰 날 2026-09-15 · 기준 커밋 `6d45e20`(origin/main)
- SEED 쪽 원본 `@seed-design/rootage-artifacts@2.9.0` — 이번에 devDependency로 넣었다
- 우리 쪽 원본 `packages/ui/src/*.tsx` · `packages/ui/src/theme.ts` · `spec/tokens.json`
- 피그마 쪽 원본 `docs/figma-spec/*.txt` — 빌드해서 꺼낸 계산된 수치라 해석이 낄 자리가 없다

## ⚖ 무엇이 이기는가 — 2026-09-15 MASTER 확정

> **피그마에 실측값이 있으면 그것이 이긴다. 없는 자리만 SEED에서 가져온다.**

CLAUDE.md 최상위 1번(「모든 디자인 · UX · UI는 **피그마 기준**이고, **SEED 디자인 토큰으로**
픽셀 단위로 맞춘다」)은 두 문장이 아니라 한 문장이다. **기준은 피그마이고, SEED는 그 값을
담는 그릇이자 피그마가 말하지 않은 자리를 채우는 곳**이다.

그래서 이 작업의 뜻은 「SEED 값으로 바꾼다」가 아니라 **「SEED 구조로 정리한다」**이다.

이 판단으로 아래 셋이 닫혔다.

| 자리 | 결정 | 근거 |
| --- | --- | --- |
| 곡률 `control` 16 (SEED 8·12) | **유지** | 피그마 풀폭 CTA 17개 실측 |
| 좌우 여백 20 (SEED 16) | **유지** | 피그마 12화면 실측 |
| `f7`~`f52` 사다리 146곳 | **유지 · 범위에서 뺀다** | 피그마 규격서 값(Tailwind 기본 줄높이) |

**`themed-text`(묶음 6)가 범위에서 빠졌다** — `t*`는 이미 SEED와 같고 `f*`는 피그마 몫이다.

## 어떻게 쟀는가

SEED는 React Native 판을 내지 않는다(`scripts/sync-seed-tokens.mjs:10`이 이미 적어 둔 사실이다).
대신 `rootage-artifacts`가 **순수 JSON으로 컴포넌트 규격 104개**를 준다. 슬롯 · variant · state별로
값이 적혀 있고, `$dimension.x10` 같은 토큰 참조는 같은 패키지의 토큰 JSON으로 푼다.

`rem`은 16px로 환산했다 — SEED 웹의 루트 글자 크기다. 아래 모든 SEED 값은 그렇게 푼 실측값이다.

## 표 — 우리 36 ↔ SEED 104

「호출」은 `packages/ui/src` 바깥에서 그 부품을 쓰는 **파일 수**다(시험 제외).

| 우리 부품 | SEED 대응 | 값 차이(실측) | 호출 | 위험 |
| --- | --- | --- | --- | --- |
| `themed-text` | `typography` | t1 줄높이 43 → **42로 맞췄다.** 나머지 t2~t7 · micro · badge는 원래 같다. `f*` 사다리는 피그마 몫이라 범위 밖 | 120 | **닫힘** |
| `action-button` | `action-button` | 높이 40·52는 **이미 같다**(48·56은 SEED에 없는 칸) / 곡률 16은 **피그마 유지** / 남는 것은 좌우 여백과 라벨 크기 | 63 | 낮아짐 |
| `status-view` | `content-placeholder`(일부) | SEED 쪽은 삽화 규격만 준다(에셋 16~160 · 높이비 0.5). 빈 상태 **배치**는 SEED에 없다 | 61 | 중간 |
| `product-symbol` | `@seed-design/icon`(이미 있음) | 규격이 아니라 아이콘 묶음이다. 별도 판단 | 24 | 중간 |
| `badge` | `badge` | 높이 22 vs 24(large)·20(medium) / 좌우 9 vs 8·6 / 곡률 4 vs 6·4 / 글자 14/19 vs 12/16·11/15 — **우리 값이 SEED 두 크기 사이에 있다** → **ⓖ** | 22 | 막힘 |
| `toast` | `snackbar` | 곡률 10 vs 8 / 안쪽 24·16 vs 10·10 / 글자 16/22/400 vs 14/19/400 / 최소높이 없음 vs 44 | 21 | **정책이 막음** |
| `filter-chip` | `control-chip`(선택형) · `chip` | 높이 36 · 좌우 14 **피그마와 일치** / 굵기 700 → **600** · 라벨 `t7` → `f14`(14/20) / `small` 28은 안 쓰여서 그대로 → **ⓕ** | 13 | **닫힘** |
| `vendor-image` | 없음 | 업체 사진 전용. `image-frame`은 당근 게시물용이라 뜻이 다르다 | 11 | — |
| `skeleton` | `skeleton` | 곡률 4 vs {0·8·16·full} — **4가 SEED에 없다** / 우리는 불투명도 숨쉬기 1400ms, SEED는 shimmer 그라디언트 1500ms | 9 | 중간 |
| `wedding-mark` | 없음 | **절대 변경 금지**(CLAUDE.md 심볼). SEED 하트를 쓰지 않는다 | 9 | — |
| `seed-icon` | `@seed-design/icon` 래퍼 | 이미 SEED다 | 7 | 낮음 |
| `progress-bar` | **없음** | SEED에 선형 진행바가 없다. `progress-circle`·`slider`뿐이다 | 5 | — |
| `verification-badge` | `badge` | `badge`와 같은 규격을 공유(`STATUS_BADGE_STYLE`)하므로 차이도 같다 | 5 | 중간 |
| `text-field` | `text-input`(outline·large) | 높이 52 · 글자 16/22 **일치** / 곡률 16 · 좌우 14는 **피그마 유지** / 포커스 테두리 **2px로 고쳤다** | 3 | **닫힘** |
| `list-skeleton` | `skeleton` 조합 | `skeleton`을 따라간다 | 3 | 낮음 |
| `wedding-calendar` | `date-picker`(일부) | 머리 48 · 요일줄 48 · 달 간격 24 · 머리글 16/22/700. 우리 쪽은 예식일 휠 3열 규칙이 따로 있어 그대로 옮길 수 없다 | 3 | 중간 |
| `fab` | **`floating-action-button`**(extended=false) | **56 · 곡률 full · 그림자 일치.** 아이콘도 피그마 원본에서 찾아 SEED `addRegular` 24로 맞췄다 | 2 | **닫힘** |
| `category-icon` | 없음 | 우리 선 아이콘. **2026-09-15 지시로 쓰지 않는다**(「선 아이콘 X」) | 2 | — |
| `rating-picker` | 없음 | SEED에 별점이 없다 | 2 | — |
| `rating-stars` | 없음 | 같음 | 2 | — |
| `npay-logo` | 없음 | 브랜드 규정 | 2 | — |
| `accordion` | `accordion` + `accordion-item` | **맞췄다** — 간격 12 · 안쪽 16 · 제목 16/22/600 · 본문 13/18/600 · 셰브런 20/300ms. 곡률만 SEED 12가 아니라 피그마 카드 규칙 16 | 1 | **닫힘** |
| `circle-loader` | `progress-circle` | 20·28·40 vs 24·40 / 두께 2·3·4 vs 3·5 | 1 | **정책이 막음** |
| `segmented-tabs` | `segmented-control` + `-item` | **피그마 `community.txt`와 이미 픽셀 단위로 같다**(겉 r16 · 안쪽 4 · 칸 40 · r22 · 12/700 · 켠 칸 그림자). SEED와 다른 것은 피그마가 이겨서다 | 1 | **닫힘** |
| `donut-chart` | 없음 | SEED에 차트가 없다 | 1 | — |
| `default-image` | 없음 | 대체 이미지 | 1 | — |
| `social-logo` | 없음 | 카카오·애플 브랜드 규정 | 1 | — |
| `themed-view` | 없음 | 배경색만 입히는 래퍼. SEED에 대응 개념이 없다 | 77 | — |
| `icon-button` | `top-navigation-icon-button` | 40·곡률 full vs 44·곡률 8 / 아이콘 24 규격 | **0** | — |
| `search-bar` | `text-input` 계열 | 높이 52 → **48로 고쳤다**(피그마 «334×48» · 토큰 `size.searchField`). 면색 · 좌우 여백은 아직 피그마와 다르다 — 아래 「덤」 | **0** | 고침 |
| `section-header` | `list-header` | **뜻이 다르다.** 우리는 20px 섹션 제목, SEED는 14px 목록 머리(좌우 16 · 위아래 8) | **0** | — |
| `step-list` | 없음 | SEED에 단계 목록이 없다 | **0** | — |
| `data-tier-badge` | `badge` | 곡률 4 · 자체 여백 토큰 | **0** | — |
| `pick-status-badge` | `badge` | 부품 자체는 안 쓰이지만 `STATUS_BADGE_STYLE`은 `badge`·`verification-badge`가 쓴다 | **0** | — |
| `truncated-text` | 없음 | 말줄임 도우미 | **0** | — |

## 「다른 곳이 없다」 — 이미 맞는 것

MASTER가 「값진 결과」라고 한 자리다. 건드릴 이유가 없다.

| 자리 | 값 |
| --- | --- |
| 타이포 사다리 t2~t7 · micro · badge | 26/35 · 24/32 · 20/27 · 18/24 · 16/22 · 14/19 · 13/18 — SEED t10·t9·t7·t6·t5·t4·t3과 **전부 같다** |
| `fab` 크기 | 56 · 곡률 full = SEED `floating-action-button`(extended=false) |
| `text-field` 높이·글자 | 52 · 16/22 = SEED `text-input` outline·large |
| `filter-chip` 기본 높이 | 36 = SEED `chip`·`control-chip` medium |
| `action-button` 두 자리 | medium 40 = SEED medium 40 · xlarge 52 = SEED large 52 |
| `segmented-tabs` 트랙 안쪽 여백 | 4 = SEED `segmented-control` padding |
| 누름 배율 | `Motion.press` .97 = `$scale.s97` · `Motion.pressButton` .98 = `$scale.s98` |
| 칩 사이 간격 | `Layout.chipGap` 8 = `$dimension.spacing-x.between-chips` |
| 배지 위아래 여백 | 4 = SEED badge large paddingY |

**이름만 역순이다.** 우리 t1이 가장 크고 SEED t1이 가장 작다. 값은 같은데 이름이 반대라
옮길 때 **뒤집어 적기 쉽다** — t4를 t4에 맞추면 20px이 14px이 된다.

## 묶음 1 결과 — 잰 것과 고친 것

### 고쳤다

| 자리 | 무엇 | 근거 |
| --- | --- | --- |
| `text-field` 포커스 · 오류 테두리 | 1px → **2px**(안쪽 여백을 그만큼 줄여 칸 크기는 그대로) | 피그마 규격서는 화면을 가만히 찍은 것이라 **포커스 상태가 없다.** 피그마가 말하지 않는 자리 → SEED `text-input` «focused · invalid → 2px» |
| `search-bar` 높이 | 52 → **48** | 피그마 `search.txt` «div 334×48» · 옆 필터 단추 «button 48×48». 토큰 `size.searchField`가 이미 48인데 **코드만 `TextField` 기본 52를 쓰고 있었다** |
| `LineHeight.t1` · `spec/tokens.json` display | 43 → **42** | 사다리 여덟 중 일곱은 SEED와 같은데 이 하나만 1px 어긋나 있었다. 피그마의 32px은 `vendor-1.txt` 업체명 하나뿐이고 **역할이 다르다**(히어로 제목 · `f32` 몫) |
| `segmented-tabs` 주석 | 「그림자는 없다」 → 「켠 칸은 흰 면 + 그림자」 | **코드는 이미 그림자를 얹고 있었다.** 규격서 `community.txt`가 켠 칸에만 «shadow»를 적는다 |

### 재보니 이미 맞았다 — 값을 바꾸지 않았다

| 부품 | 피그마 실측 | 우리 값 |
| --- | --- | --- |
| `segmented-tabs` | `community.txt` «nav 390×48 · pad 4 · r16», 칸 «127×40 · r22 · 12/700 · lh 16», 켠 칸 흰 면 + shadow | 겉 r16 · 안쪽 4 · 칸 40 · r22 · `f12`/700 · `Elevation.figmaCard` — **전부 같다** |
| `fab` 크기 · 곡률 · 그림자 | `our-wedding.txt` «button 56×56 · r9999 · shadow» | 56 · `Radius.pill` · `Elevation.floatingCard` — **같다** |

**SEED `segmented-control`(칸 34 · r full · 16/22 · 최소폭 86)은 따르지 않는다** — 피그마에
실측값이 있는 자리라 그쪽이 이긴다.

## 막힌 것 — 판단이 필요하다

### ⓐ 굵기 500 — **닫혔다. 500이 나오는 자리는 600으로 간다**

2026-09-15 MASTER 확정. SEED는 `accordion-item` 제목 · 본문, `chip` · `control-chip`
라벨, `badge(weak)`, `list-header(mediumWeak)`에 **500(Medium)**을 적는데 우리는
Pretendard를 넷만 싣는다 — **Regular 400 · SemiBold 600 · Bold 700 · ExtraBold 800.**

**500을 싣지 않는다.** 근거는 실린 폰트가 말한다 — `apps/mobile/assets/fonts/README.md`가
화면 코드를 세어 「400이 1곳 · 600이 14곳 · 700이 188곳 · 800이 2곳」이라고 적어 뒀다.
**500은 우리 화면 어디에도 없다.** 화면 코드가 피그마에서 나왔으니 피그마가 500을
쓰지 않는다는 뜻이고, 그러면 위 원칙에 그대로 걸린다.

없는 굵기를 적으면 안드로이드가 흉내 내서(합성) 글자가 뭉개진다. **뭉개진 글자도
SEED가 규정한 모습이 아니다** — 둘 다 SEED와 다르다면 실제로 보기 나쁜 쪽을 피한다.

**피그마가 칩에 대해서는 직접 600이라고 재어 두었다** — `search.txt` «14/600» ·
`community.txt` «12/600», 켠 칸도 «12/600 #FFFFFF». 이 결정과 어긋나지 않는다.

### ⓑ `accordion` — **했다**

ⓐ가 풀려 진행했다. 피그마에 아코디언이 없어(`my.txt`의 고객지원은 펼치는 것이 아니라
넘어가는 메뉴 행이다) SEED가 채우는 자리다.

| 자리 | 전 | 후 | 출처 |
| --- | --- | --- | --- |
| 항목 간격 | 8 | **12** | SEED `accordion` separated·medium |
| 안쪽 위아래 | (없음) | **16** | SEED `accordion-item` size=medium «trigger.paddingY» |
| 제목 | 18/24/700 | **16/22/600** | SEED 16/22 · 굵기는 ⓐ |
| 본문 | 16/22 | **13/18/600** | SEED 13/18 · 굵기는 ⓐ |
| 펼침 표시 | `+`·`−` 글자 | **셰브런 20 · 300ms 회전** | SEED «suffixIcon.size 20 · rotateDuration 300ms» |

**곡률만 SEED를 안 따랐다 — 12가 아니라 16이다.** 피그마에 r12가 **한 곳도 없고**
카드는 r16(68곳) 아니면 r22(41곳)다. 최상위 규칙 3번이 「피그마에 없는 화면은 피그마의
«규칙»으로 만든다」고 적는데 **곡률에 대해서는 피그마가 규칙을 갖고 있다.** 없는 값을
새로 만들지도 않는다(`radius.$note` 「이 외 값을 만들지 않는다」).

**행 최소 높이 56은 그대로 뒀다.** SEED대로면 22 + 16×2 = 54인데, 56은 손가락이 닿는
자리의 최소치다(`touchTarget` 44보다 커야 한다). 2px 때문에 낮추지 않는다.

**면과 테두리는 손대지 않았다.** SEED separated는 «strokeWidth 1»이고 피그마 카드도
«border 1 #000000 6%»인데 우리 항목은 테두리 없는 채움이다. 테두리를 더하는 것은
색 쪽 결정이라 이번 범위 밖으로 둔다.

### ⓕ `filter-chip` — 대부분 했다. 작은 칩 하나만 남겼다

| 자리 | 전 | 후 | 출처 |
| --- | --- | --- | --- |
| 라벨 굵기 | 700 | **600** | 피그마 «14/600» · «12/600»(켠 칸도 600) · ⓐ |
| 기본 칩 라벨 | `t7` 14/19 | **`f14` 14/20** | 피그마 `search.txt` «14/600 · lh 20» |
| 좌우 14 | — | **유지** | 피그마 «pad 0 14»가 h36 · h30 둘 다 그렇게 적는다 |
| `sheet` 38 | — | **유지** | 우리만 쓰는 크기 |

**`chipSmall` 28은 바꾸지 않았다.** MASTER 지시는 「SEED 32로 가되 근거를 찾으면
되돌려라」였는데, 재보니 되돌릴 근거가 셋이다.

1. **이 변형을 쓰는 곳이 하나도 없다** — `size="small"` 호출처 0. 바꿔도 화면에 안 나타난다
2. **28에 출처가 있다** — `theme.ts`가 「v3.24 «추천 이유 첫 줄 칩 28» · image.textOnImage.tasteCard」
   라고 적어 뒀다. 근거 없는 수가 아니다
3. **피그마의 30 · 19는 역할이 다르다** — 30은 커뮤니티 **분류 필터 칩**이고, 「스타일 태그」
   역할에 해당하는 것은 «span …×19 · 10/500 · pad 2 8»로 **칩이 아니라 태그**다

쓰지도 않는 변형을 역할이 다른 실측으로 갈아끼우는 것은 「임의로 만들지 말라」에 걸린다.
**되돌리라면 한 줄이다** — `Layout.chipSmall`.

### ⓖ `badge`(묶음 3) — **했다. 피그마에 배지가 있었다**

MASTER가 「고르지 말고 피그마에서 배지를 세어 재라」고 했고, 재보니 **있다.**

규격서의 배지꼴 34개 중 **28개가 한 가지다.**

    18개   h19 · 10/500 #868B94 · lh 15 · pad 2 8 2 8 · bg #F7F8F9 · r9999
     8개   h19 · 10/700 #FFFFFF · lh 15 · pad 2 8 2 8 · bg #1A1C20 · r9999   ← 사진 위 「인기」·「신규」
     2개   h19 · 10/600 #868B94 · lh 15 · pad 2 8 2 8 · bg #F7F8F9 · r9999
    (나머지 6개는 h32 칩 5 · h24 개수 알약 1)

**우리 것과 전부 달랐다.**

| 자리 | 전 | 후 |
| --- | --- | --- |
| 최소 높이 | 22 | **19** |
| 좌우 · 위아래 | 9 · 4 | **8 · 2** |
| 곡률 | 4 | **알약(r9999)** |
| 글자 | 14/19/700 | **10/15/600**(사진 위만 700) |

SEED는 두 크기(large 24 · medium 20)를 주는데 **우리 22가 그 사이**라 어느 쪽도 우리
근거가 아니었다. 피그마에 실측이 있으므로 **피그마가 이긴다** — SEED로 옮기지 않았다.

**굵기 500은 우리가 그 폰트를 싣지 않아 600이다**(ⓐ).

**`Radius.badge` 4는 건드리지 않았다.** 뼈대(`skeleton` 기본 곡률) · 관리자 · 화면 여덟
곳이 그 토큰을 쓰는데, 배지만 알약이 되면 되는 자리다. `STATUS_BADGE_STYLE`에서
`Radius.pill`을 직접 든다.

**남긴 것 둘 — 화면 몫이다.**

1. **`type="badge"`(14/19)를 화면 16곳이 «인라인 글자»로 쓴다**(`wedding-info` ·
   `expo` · `top3` · `tasks` · `candidates` …). 부품 넷은 `f10`으로 옮겼지만 그 열여섯은
   배지 상자가 아니라 글자라 손대지 않았다. **그 자리들이 배지라면 같이 옮겨야 하고,
   글자라면 타입 이름이 오해를 부른다** — 어느 쪽인지는 화면을 봐야 안다
2. **`search/compare.tsx:384`가 `Layout.badgeHeight`를 「키 칩」 높이로 빌려 쓴다.**
   그 줄의 주석이 「키 칩 22(component.badge.height)」라고 **일부러** 배지를 따라간다고
   적어 두었으므로 22 → 19로 같이 줄어든다. 의도한 추종이지만 화면이 바뀌므로 적어 둔다

### ⓗ `action-button`(묶음 5) — **했다**

피그마가 **스무 자리에서 한 가지로** 말한다 — `14/700 · lh 20`(h48 열두 개 · h56 여덟 개).
우리는 18(`xlarge`·`sheet`)과 16이었고, 그 값의 근거는 피그마가 아니었다(주석에 출처가
적혀 있지 않았다). **`f14` + 700 하나로 합쳤다.**

**높이는 손대지 않았다.** 셋은 이미 피그마와 같고(`medium` 40 · `large` 48 · `sheet` 56),
**`xlarge` 52만 피그마에 없다**(52짜리 단추가 한 개도 없다). 52에는 핸드오프
`size.ctaPrimary` 근거가 있어 **피그마의 56으로 올릴지는 대표 판단 대기**로 남긴다 —
올리면 `ctaPrimary`와 `ctaSheet`가 같은 수가 된다.

곡률 16 · 아이콘 간격 8은 이미 피그마와 같다.

### ⓒ `fab` 아이콘 — **풀렸다. 더하기다**

크기 56 · 곡률 · 그림자는 처음부터 피그마와 같았고 **속만 달랐다.** 규격서
(`our-wedding.txt`)는 «svg 24×24»라고만 적어 **무엇을 그린 svg인지 말하지 않는다.**
그래서 한동안 「피그마 그림 미확인」으로 두었다.

**규격서가 말하지 않으면 원본을 연다.** 피그마 저장소를 받아
`src/app/components/OurWedding.tsx:569`를 보니 **`IconAddRegular size={24}`**다.
탭이 일정이든 예산이든 녹음이든 **아이콘은 언제나 더하기**이고 바뀌는 것은
`aria-label`뿐이다.

| 자리 | 전 | 후 |
| --- | --- | --- |
| 아이콘 | 글자 글리프(`+` · `✎`) | **SEED `addRegular` 24** |
| `glyph` props | 있음(호출 2곳이 서로 다른 글자) | **없앴다** |

path는 `@seed-design/icon`의 `icon_add_regular.svg`에서 그대로 옮겼다 — `SeedIcon`이
이미 그렇게 하는 방식이다.

**`glyph`를 없앤 이유**는 일정 화면이 `✎`(연필)을 넘기고 있었기 때문이다. **피그마에
연필은 없다.** 단추마다 다른 기호를 넣을 수 있게 열어 두면 화면마다 다른 그림이 생기고,
정확히 그렇게 됐다.

**규격서에 없는 것을 원본에서 찾는 길이 있다는 것**을 적어 둔다 — `docs/figma-spec`은
계산된 «수»를 담고 **무엇을 그렸는지는 담지 않는다.** 아이콘 · 문구처럼 수가 아닌 것은
피그마 저장소를 직접 열어야 한다.

### ⓓ `f15` — **풀렸다. 규칙이 낡았고 코드가 맞았다**

`typography.ts`가 「15 · 17 · 19 · 22px은 금지다」라고 적는데 `f15`가 있고 네 곳이 썼다.
어느 쪽이 낡았는지 **피그마를 재서 갈랐다** — **로그인의 카카오 CTA가 `15/700 · lh 23`**
이다(`login.txt` «button 382×56 · bg #FEE500»). **피그마에 15가 있다.**

금지 목록에서 **15만 뺐다.** 17 · 19 · 22는 실측 근거가 없어 그대로 금지다. 지우지 않고
**왜 바뀌었는지**를 그 자리에 적었다 — 근거 없이 풀면 다음 사람이 되돌린다.

### ⓔ `CategoryCycleLoader` — MASTER가 걷어냈다. **내 2차 확인이 틀렸다**

1단계 원 보고(「폐기됐는데 아직 돈다」)는 **맞았다.** 그런데 MASTER가 「경로만 살아 있다」고
정정했을 때 나는 그것을 확인했다고 적었다 — **틀렸다.** `wait="long"` 갈래만 세었고,
`RecommendingBody`가 `CategoryCycleLoader`를 **직접** 부르는 경로를 놓쳤다.

MASTER가 다시 재서 **화면 다섯에서 실제로 돌고 있던 것**을 찾아 걷어냈다(`106e298`) —
온보딩 완료 · 홈 첫 진입 · TOP3 · 분석 중 · 확인 중. `category-cycle-loader.tsx`와
`exclude.ts`가 지워졌고 `LoadingViewProps`의 `exclude` · `loader`도 없어졌다.
이 브랜치는 `32c300a`를 머지해 그 결과를 들고 있다.

**남길 교훈은 세는 법이다.** 부품이 어디서 쓰이는지는 **부르는 이름으로** 세야 하고,
갈래 하나(`wait`)를 보고 「안 쓰인다」고 적으면 이렇게 된다. 이 문서의 호출처 수는
export 이름으로 세었지만, 그 2차 확인만은 갈래로 세었다.

## 정책이 막는 것 — 값을 바꾸지 않는다

최상위 규칙 5번이 「로딩 서클 · 토스트 · 얼럿 · 컨펌 · 바텀시트는 **색만** 새 색으로 바꾼다.
동작 · 크기 · 자리 · 문구는 손대지 않는다」고 못 박는다.

- `circle-loader` — 20·28·40 / 두께 2·3·4 / 700ms 임계값 그대로. SEED 24·40은 **넣지 않는다**
- `toast` — 곡률 10 · 안쪽 24·16 · 아래 96 · 글자 16/22 그대로. SEED snackbar 값은 **넣지 않는다**
- `show-alert` · 컨펌 · 바텀시트 — 같음

이 넷은 대조표에 값 차이를 적어 두기만 했다. **옮기라는 뜻이 아니다.**

## 절대 바꾸지 않는 것

1. `wedding-mark` 두 path — SEED에 하트가 있어도 우리 마크를 쓴다
2. 앱 아이콘 · 스플래시 `#FF6F61` · 마크 `#FFFFFF`
3. 위 「정책이 막는 것」 넷의 동작 · 크기 · 자리 · 문구
4. 주소 `/wedding` · `/community`

## 덤으로 잰 것

- **`prefers-reduced-motion`이 우리에겐 없다.** SEED `scale.json`은 값마다 `preferred`(0.97)와
  `reduced`(1)를 같이 준다. 우리 `Motion.press`는 배율 하나뿐이라 동작 줄이기 설정을 켠
  기기에서도 그대로 튄다. SEED 교체와 별개로 손볼 수 있는 자리다.
- **`packages/ui/src/design-tokens.ts`(723줄)는 죽은 파일이다.** 파일 머리가 이미
  「import 하는 곳이 없다」고 적어 뒀고 실제로 그렇다. 이번 작업 범위 밖이지만 적어 둔다.
- **`search-bar`는 높이 말고도 피그마와 다르다.** 규격서 `search.txt`는 «pad 0 16 · bg #F7F8F9»
  인데 우리 칸은 좌우 14에 흰 면이다. **높이만 고쳤다** — 나머지는 이 부품을 쓰는 화면이 하나도
  없어서(검색 화면은 자기 칸을 따로 그린다) 고쳐도 아무 데도 안 나타나고, 면색을 바꾸는 것은
  보고된 어긋남 밖이다.
- **부품 일곱이 아무도 안 쓴다** — `icon-button` · `search-bar` · `section-header` ·
  `step-list` · `data-tier-badge` · `pick-status-badge` · `truncated-text`. SEED로 맞추는
  값이 화면에 안 나타난다는 뜻이라 **순서를 맨 뒤로 두거나 뺄 후보다.**
  (`pick-status-badge`는 부품만 안 쓰이고 `STATUS_BADGE_STYLE`은 살아 있다.)

## 남은 순서

| 묶음 | 부품 | 상태 |
| --- | --- | --- |
| 0 | 곡률 · 여백 · `f*` | **닫힘** — 셋 다 피그마 유지 |
| ⓐ | 굵기 500 | **닫힘** — 500이 나오는 자리는 600 |
| 1 | `accordion` · `segmented-tabs` · `fab` | **닫힘** — accordion 맞췄고, 나머지 둘은 이미 피그마와 같았다(ⓒ 제외) |
| 2 | `skeleton` · `list-skeleton` · `text-field` | **닫힘** — `text-field` 했고, `skeleton` 곡률 4는 **유지**(MASTER 확정), 애니메이션은 안 건드린다 |
| 3 | `badge` 넷 | **막힘** — ⓖ(우리 값이 SEED 두 크기 사이 · 호출 22) |
| 4 | `filter-chip` | **닫힘** — ⓕ(작은 칩만 남겼다) |
| 5 | `action-button` | **닫힘 — ⓗ**(라벨 14/700 lh20). `xlarge` 52 → 56만 대표 판단 대기 |
| 6 | `themed-text` | **범위에서 뺌** |
| — | 안 함 | 정책이 막는 넷 · SEED 대응 없는 열둘 · 안 쓰이는 일곱 |

**전부 닫혔다.** 남는 것은 대표 판단 하나뿐이다 — `xlarge` 52를 피그마의 56으로 올릴지(ⓗ). 올리면 `ctaPrimary`와 `ctaSheet`가 같은 수가 된다.

**`skeleton` 곡률 4를 유지하는 이유**(2026-09-15 MASTER 확정): SEED의 {0·8·16·full} 중
무엇을 골라도 지금보다 커지고, 뼈대가 둥글면 실제 카드보다 물러 보인다. 애니메이션
(불투명도 숨쉬기 vs shimmer)도 건드리지 않는다 — 최상위 규칙 5번이 잠근 자리에 가깝고
바꾸면 화면 아홉이 한꺼번에 달라 보인다.

## 2단계 — 뽑는 스크립트와 시험

`scripts/sync-seed-components.mjs` → `spec/seed-components.json`(부품 16개).
`sync-seed-tokens.mjs`를 본떴고 **`--check`가 있다.**

    node scripts/sync-seed-components.mjs           # 새로 쓴다
    node scripts/sync-seed-components.mjs --check   # 어긋나면 빨개진다

**색은 뽑지 않는다** — `spec/seed-tokens.json` 한 길로만 온다. 같은 값이 두 곳에 생기면
언젠가 한쪽이 낡는다. 담는 것은 크기 · 여백 · 곡률 · 글자 · 굵기 · 시간 · 배율이고,
그림자 · 그라디언트만 예외로 자기 색을 함께 적는다(면 · 글자 팔레트가 아니다).

`apps/api/src/test/seed-components.test.ts`가 셋을 센다.

1. `spec/seed-components.json`이 현행인가(`--check`를 돌린다)
2. **「이미 SEED와 같다」고 적은 값이 정말 같은가** — 위 표가 글로만 남으면 다음 사람이
   다시 재야 한다. 세는 시험으로 옮겼다
3. 타이포 사다리 여덟 칸이 SEED와 같은가 — **이름이 역순이라 역할 이름으로 맞춘다**

**피그마가 이기는 자리는 이 시험에 넣지 않았다.** 넣으면 시험이 피그마를 되돌리라고
요구하게 된다 — 곡률 16 · 여백 20 · `f*` · `segmented-tabs`가 그렇다.

`apps/api/src/test/tokens.test.ts`에는 `SUPERSEDED_NUMBERS`를 더했다. 핸드오프(옛 정본)가
적은 수치 중 SEED를 따르기로 한 것을 **경로별로** 적는 자리다 — 맨 숫자로 면제하면 다른
자리의 같은 수도 같이 새어 나간다. 지금 들어 있는 것은 display 줄높이 하나뿐이다.
