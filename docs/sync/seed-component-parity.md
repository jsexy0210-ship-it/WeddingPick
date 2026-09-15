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
| `badge` | `badge` | 높이 22 vs 24(large)·20(medium) / 좌우 9 vs 8·6 / 곡률 4 vs 6·4 / 글자 14/19 vs 12/16·11/15 | 22 | 중간 |
| `toast` | `snackbar` | 곡률 10 vs 8 / 안쪽 24·16 vs 10·10 / 글자 16/22/400 vs 14/19/400 / 최소높이 없음 vs 44 | 21 | **정책이 막음** |
| `filter-chip` | `control-chip`(선택형) · `chip` | 높이 36 **일치** / 좌우 14 vs 12 / 굵기 700 고정 vs 500→선택 시 700 → **ⓐ에 막힘** / small 28 vs 32 / `sheet` 38은 SEED에 없음 | 13 | 막힘 |
| `vendor-image` | 없음 | 업체 사진 전용. `image-frame`은 당근 게시물용이라 뜻이 다르다 | 11 | — |
| `skeleton` | `skeleton` | 곡률 4 vs {0·8·16·full} — **4가 SEED에 없다** / 우리는 불투명도 숨쉬기 1400ms, SEED는 shimmer 그라디언트 1500ms | 9 | 중간 |
| `wedding-mark` | 없음 | **절대 변경 금지**(CLAUDE.md 심볼). SEED 하트를 쓰지 않는다 | 9 | — |
| `seed-icon` | `@seed-design/icon` 래퍼 | 이미 SEED다 | 7 | 낮음 |
| `progress-bar` | **없음** | SEED에 선형 진행바가 없다. `progress-circle`·`slider`뿐이다 | 5 | — |
| `verification-badge` | `badge` | `badge`와 같은 규격을 공유(`STATUS_BADGE_STYLE`)하므로 차이도 같다 | 5 | 중간 |
| `text-field` | `text-input`(outline·large) | 높이 52 · 글자 16/22 **일치** / 곡률 16 · 좌우 14는 **피그마 유지** / 포커스 테두리 **2px로 고쳤다** | 3 | **닫힘** |
| `list-skeleton` | `skeleton` 조합 | `skeleton`을 따라간다 | 3 | 낮음 |
| `wedding-calendar` | `date-picker`(일부) | 머리 48 · 요일줄 48 · 달 간격 24 · 머리글 16/22/700. 우리 쪽은 예식일 휠 3열 규칙이 따로 있어 그대로 옮길 수 없다 | 3 | 중간 |
| `fab` | **`floating-action-button`**(extended=false) | **56 · 곡률 full · 그림자까지 피그마와 일치.** 아이콘만 24px 규격 vs 우리는 글자 글리프 → **ⓒ** | 2 | 닫힘(ⓒ 제외) |
| `category-icon` | 없음 | 우리 선 아이콘. **2026-09-15 지시로 쓰지 않는다**(「선 아이콘 X」) | 2 | — |
| `category-cycle-loader` | 없음 | **폐기된 것이다.** 그런데 아직 살아서 돌고 있다 — 아래 «걸린 것» ① | 2 | — |
| `rating-picker` | 없음 | SEED에 별점이 없다 | 2 | — |
| `rating-stars` | 없음 | 같음 | 2 | — |
| `npay-logo` | 없음 | 브랜드 규정 | 2 | — |
| `accordion` | `accordion` + `accordion-item` | 피그마에 없다 → SEED가 채운다. 간격 8 vs 12 / 곡률 10 vs 12 / 제목 18/24/700 vs 16/22/**500** / 본문 16 vs 13/18/**500** / `+`·`−` vs 셰브런 20 → **ⓐ·ⓑ에 막힘** | 1 | 막힘 |
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

### ⓐ SEED가 굵기 **500(Medium)**을 쓰는데 우리에겐 그 폰트가 없다

실린 Pretendard는 넷이다 — **Regular 400 · SemiBold 600 · Bold 700 · ExtraBold 800**
(`apps/mobile/assets/fonts/`). **500은 없다.**

SEED가 500을 쓰는 자리를 세어 보면 이렇다.

    accordion-item   title.fontWeight · description.fontWeight
    chip             label.fontWeight
    control-chip     label.fontWeight · count.fontWeight
    badge            variant=weak label.fontWeight
    list-header      variant=mediumWeak

**묶음 1(accordion) · 묶음 3(badge) · 묶음 4(filter-chip)에 전부 걸린다.** 지금 500을 적으면
안드로이드가 가장 가까운 굵기로 흉내 내서 글자가 뭉개진다 — 폰트 README가 굵기를 넷 싣는
이유로 적어 둔 바로 그 문제다.

셋 중 하나다.

1. **Pretendard Medium을 싣는다** — 대표님이 올리신 원본 배포판에 들어 있다. 파일 하나가 는다
2. **500 → 600(SemiBold)으로 맞춘다** — 이미 실려 있고 14곳이 쓴다. SEED 값은 아니다
3. **굵기는 SEED를 따르지 않는다** — 크기 · 여백만 맞추고 굵기는 우리 것을 쓴다

### ⓑ `accordion`은 ⓐ가 풀려야 간다

피그마에 아코디언이 없다(`my.txt`의 고객지원은 **펼치는 것이 아니라 넘어가는 메뉴 행**이라
다른 부품이다). 그래서 SEED가 채우는 자리가 맞는데, SEED 규격이 **한 덩어리**다.

    항목 간격   8 → 12            accordion variant=separated size=medium
    항목 곡률   10 → 12           accordion-item variant=separated (+ 테두리 1px)
    제목        18/24/700 → 16/22/**500**
    본문        16/22 → 13/18/**500**
    펼침 표시   `+`·`−` 글자 → 셰브런 20px · 300ms 회전

**크기만 옮기고 굵기를 두면 SEED가 규정한 적 없는 모습이 된다.** ⓐ의 답을 받고 한 번에
간다. 곡률 12는 `Radius`에 없는 값이라 토큰을 하나 더해야 하는 것도 같이 본다
(`radius.$note`가 「이 외 값을 만들지 않는다」고 적어 둔 자리다).

### ⓒ `fab` 아이콘 — 피그마의 그림을 모른다

크기 · 곡률 · 그림자는 피그마와 같다. 다른 것은 **속**이다 — 피그마는 «svg 24×24»,
SEED도 `icon.size` 24인데 **우리는 글자 글리프**다(`glyph="✎"` · `glyph="+"`).

`ProductSymbol`에도 `SeedIcon`에도 **더하기 · 연필 아이콘이 없다.** 새로 그리려면 피그마가
무엇을 그렸는지 봐야 하고, 그것은 「임의로 만들지 말라」에 걸린다. 그리고 `glyph`는
**부르는 쪽 둘이 서로 다른 글자를 넘기는 props**라 갈아치우면 그 둘이 같이 움직인다.

    apps/mobile/src/app/(tabs)/wedding/[id]/tasks.tsx   glyph="✎"
    apps/mobile/src/app/(tabs)/wedding/index.tsx        (기본값 "+")

아이콘 두 개를 받거나, 피그마에서 꺼낼 수 있는 길을 알려 주시면 그때 간다.

### ⓓ `f15` — 규칙과 코드가 어긋난다. **어느 쪽이 낡았는지 미확인**

`typography.ts` 12번째 줄이 「15 · 17 · 19 · 22px은 금지다」라고 적는데 **`f15`가 있고 4곳이
쓴다**(`login/index.tsx` 3 · `onboarding/option-row.tsx` 1).

**고치지 않았다.** 둘 중 무엇이 낡았는지는 피그마를 봐야 알고, 그 화면 둘은 다른 세션이
만지고 있다. MASTER가 대표님께 올린다.

### ⓔ `CategoryCycleLoader` — MASTER가 직접 고친다

폐기된 것이 `delayed-loader.tsx:88`에 남아 있다. **다만 `wait="long"`을 넘기는 화면이 하나도
없다** — 실제로 뜨지는 않고 경로만 살아 있다(2026-09-15 MASTER 정정 · 내가 다시 세어 확인).
화면 파일과 `packages/ui`에 걸쳐 있어 **MASTER가 한 번에 정리한다. 이 브랜치에서 건드리지
않는다.**

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

묶음 0은 닫혔고(위 「무엇이 이기는가」) 묶음 1은 위 「묶음 1 결과」에 적었다.

| 묶음 | 부품 | 상태 |
| --- | --- | --- |
| 0 | 곡률 · 여백 · `f*` 판단 | **닫힘** — 셋 다 피그마 유지 |
| 1 | `segmented-tabs` · `fab` | **닫힘** — 재보니 피그마와 이미 같다 |
| 1 | `accordion` | **막힘** — ⓐ 굵기 500 |
| 2 | `skeleton` · `list-skeleton` · `text-field` | `text-field`는 했다. `skeleton` 곡률 4가 SEED 집합{0·8·16·full}에 없는 것이 남았다 |
| 3 | `badge` 넷 | ⓐ에 걸린다(`variant=weak`가 500) |
| 4 | `filter-chip` | ⓐ에 걸린다(라벨이 500) |
| 5 | `action-button` | 높이 40·52는 이미 같고 곡률은 피그마 유지 — **옮길 값이 거의 없다.** 확인만 |
| 6 | `themed-text` | **범위에서 뺌** — `t*`는 이미 SEED, `f*`는 피그마 몫 |
| — | 안 함 | 정책이 막는 넷 · SEED 대응 없는 열셋 · 안 쓰이는 일곱 |

**ⓐ(굵기 500)가 묶음 1·3·4를 한꺼번에 막고 있다.** 그 하나가 풀리면 셋이 같이 간다.

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
