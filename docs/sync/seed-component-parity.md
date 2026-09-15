# SEED 부품 대조표 — 1단계 실측

대표 지시(2026-09-15) 「전체 화면 기본 구조는 건들지말고 seed디자인 컴포넌트로 다 교체도 진행해」의
1단계다. **아직 부품 코드를 고치지 않았다.** 이 표를 보고 MASTER가 순서를 정한다.

- 잰 날 2026-09-15 · 기준 커밋 `6d45e20`(origin/main)
- SEED 쪽 원본 `@seed-design/rootage-artifacts@2.9.0` — 이번에 devDependency로 넣었다
- 우리 쪽 원본 `packages/ui/src/*.tsx` · `packages/ui/src/theme.ts` · `spec/tokens.json`

## 어떻게 쟀는가

SEED는 React Native 판을 내지 않는다(`scripts/sync-seed-tokens.mjs:10`이 이미 적어 둔 사실이다).
대신 `rootage-artifacts`가 **순수 JSON으로 컴포넌트 규격 104개**를 준다. 슬롯 · variant · state별로
값이 적혀 있고, `$dimension.x10` 같은 토큰 참조는 같은 패키지의 토큰 JSON으로 푼다.

`rem`은 16px로 환산했다 — SEED 웹의 루트 글자 크기다. 아래 모든 SEED 값은 그렇게 푼 실측값이다.

## 표 — 우리 36 ↔ SEED 104

「호출」은 `packages/ui/src` 바깥에서 그 부품을 쓰는 **파일 수**다(시험 제외).

| 우리 부품 | SEED 대응 | 값 차이(실측) | 호출 | 위험 |
| --- | --- | --- | --- | --- |
| `themed-text` | `typography` | **거의 없다.** t1 줄높이만 43 vs 42. 나머지 t2~t7 · micro · badge는 값이 그대로 같다 | 120 | **높음** |
| `action-button` | `action-button` | 높이 40·48·52·56 vs 32·36·40·52 / 곡률 16 고정 vs 8·8·8·12 / 좌우 16 고정 vs 14·14·16·20 / 라벨 16·18 vs 13·14·14·18 | 63 | **높음** |
| `status-view` | `content-placeholder`(일부) | SEED 쪽은 삽화 규격만 준다(에셋 16~160 · 높이비 0.5). 빈 상태 **배치**는 SEED에 없다 | 61 | 중간 |
| `product-symbol` | `@seed-design/icon`(이미 있음) | 규격이 아니라 아이콘 묶음이다. 별도 판단 | 24 | 중간 |
| `badge` | `badge` | 높이 22 vs 24(large)·20(medium) / 좌우 9 vs 8·6 / 곡률 4 vs 6·4 / 글자 14/19 vs 12/16·11/15 | 22 | 중간 |
| `toast` | `snackbar` | 곡률 10 vs 8 / 안쪽 24·16 vs 10·10 / 글자 16/22/400 vs 14/19/400 / 최소높이 없음 vs 44 | 21 | **정책이 막음** |
| `filter-chip` | `control-chip`(선택형) · `chip` | 높이 36 **일치** / 좌우 14 vs 12 / 굵기 700 고정 vs 500→선택 시 700 / small 28 vs 32 / `sheet` 38은 SEED에 없음 | 13 | 중간 |
| `vendor-image` | 없음 | 업체 사진 전용. `image-frame`은 당근 게시물용이라 뜻이 다르다 | 11 | — |
| `skeleton` | `skeleton` | 곡률 4 vs {0·8·16·full} — **4가 SEED에 없다** / 우리는 불투명도 숨쉬기 1400ms, SEED는 shimmer 그라디언트 1500ms | 9 | 중간 |
| `wedding-mark` | 없음 | **절대 변경 금지**(CLAUDE.md 심볼). SEED 하트를 쓰지 않는다 | 9 | — |
| `seed-icon` | `@seed-design/icon` 래퍼 | 이미 SEED다 | 7 | 낮음 |
| `progress-bar` | **없음** | SEED에 선형 진행바가 없다. `progress-circle`·`slider`뿐이다 | 5 | — |
| `verification-badge` | `badge` | `badge`와 같은 규격을 공유(`STATUS_BADGE_STYLE`)하므로 차이도 같다 | 5 | 중간 |
| `text-field` | `text-input`(outline·large) | 높이 52 **일치** · 글자 16/22 **일치** / 곡률 16 vs 12 / 좌우 14 vs 16 / **포커스 테두리 2px가 우리에겐 없다**(1px 그대로) | 3 | 중간 |
| `list-skeleton` | `skeleton` 조합 | `skeleton`을 따라간다 | 3 | 낮음 |
| `wedding-calendar` | `date-picker`(일부) | 머리 48 · 요일줄 48 · 달 간격 24 · 머리글 16/22/700. 우리 쪽은 예식일 휠 3열 규칙이 따로 있어 그대로 옮길 수 없다 | 3 | 중간 |
| `fab` | **`floating-action-button`**(extended=false) | **56 · 곡률 full 완전 일치.** 아이콘만 24px 규격 vs 우리는 글자 글리프 `+` | 2 | 낮음 |
| `category-icon` | 없음 | 우리 선 아이콘. **2026-09-15 지시로 쓰지 않는다**(「선 아이콘 X」) | 2 | — |
| `category-cycle-loader` | 없음 | **폐기된 것이다.** 그런데 아직 살아서 돌고 있다 — 아래 «걸린 것» ① | 2 | — |
| `rating-picker` | 없음 | SEED에 별점이 없다 | 2 | — |
| `rating-stars` | 없음 | 같음 | 2 | — |
| `npay-logo` | 없음 | 브랜드 규정 | 2 | — |
| `accordion` | `accordion` + `accordion-item` | 항목 간격 8 vs 12 / 제목 18/24/700 vs 16/22/500 / 본문 16 vs 13/18 / 우리는 `+`·`−` 글자, SEED는 20px 셰브런 | 1 | 낮음 |
| `circle-loader` | `progress-circle` | 20·28·40 vs 24·40 / 두께 2·3·4 vs 3·5 | 1 | **정책이 막음** |
| `segmented-tabs` | `segmented-control` + `-item` | 안쪽 4 **일치** / 바깥 곡률 16 vs full / 항목 높이 40 vs 34 / 항목 곡률 22 vs full / 라벨 12 vs 16/22 / 최소폭 없음 vs 86 | 1 | 낮음 |
| `donut-chart` | 없음 | SEED에 차트가 없다 | 1 | — |
| `default-image` | 없음 | 대체 이미지 | 1 | — |
| `social-logo` | 없음 | 카카오·애플 브랜드 규정 | 1 | — |
| `themed-view` | 없음 | 배경색만 입히는 래퍼. SEED에 대응 개념이 없다 | 77 | — |
| `icon-button` | `top-navigation-icon-button` | 40·곡률 full vs 44·곡률 8 / 아이콘 24 규격 | **0** | — |
| `search-bar` | `text-input` 계열 | `TextField` 얇은 껍데기다 — 그래서 높이 52를 쓴다. **토큰 `size.searchField` 48과 어긋난다** | **0** | — |
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

## 걸린 것 — MASTER 판단이 필요하다

### ① `CategoryCycleLoader`가 폐기됐는데 아직 돈다

CLAUDE.md는 「모든 로딩은 기본 로더(원형) 하나다 · 업종 아이콘 순회는 폐기」라고 적는다.
그런데 `apps/mobile/src/features/loading/delayed-loader.tsx:88`이 `wait === 'long'`일 때
아직 `CategoryCycleLoader`를 부른다. 파일이 남은 정도가 아니라 **살아서 돌고 있다.**

화면 파일이라 내 몫이 아니다. 누구에게 줄지 MASTER가 정해 달라.

### ② `f*` 사다리 146곳이 SEED 밖에 있다

`typography.ts`에 t1~t7과 **별개로** 피그마 규격서에서 온 `f7`~`f52` 사다리가 있고
146곳이 쓴다(`f14` 51 · `f12` 40 · `f10` 18 · `f11` 10 …). 주석이 이유를 적어 뒀다 —
「피그마는 Tailwind 기본 줄높이」라 t 사다리와 줄높이가 달라서 따로 둔다는 것이다.

이 중 **f7 · f9 · f10 · f15 · f30 · f38 · f42 · f46 · f52는 SEED 사다리에 없는 크기다.**

그리고 같은 파일 12번째 줄이 「15 · 17 · 19 · 22px은 금지다」라고 적는데 **`f15`가 있고
4곳이 쓴다**(`login/index.tsx` 3곳 · `onboarding/option-row.tsx` 1곳). 규칙과 코드가 어긋난다.

**여기가 이 작업의 가장 큰 갈림길이다.** 최상위 규칙 1번은 「피그마 기준 + SEED 토큰으로
픽셀 단위」인데, 이 두 사다리는 **그 둘이 실제로 어긋나는 자리**다. 셋 중 하나다.

1. `f*`를 그대로 둔다 — 피그마가 정본이므로. SEED 교체 범위에서 뺀다
2. `f*`를 SEED 사다리로 흡수한다 — 146곳이 움직이고 줄높이가 바뀐다
3. SEED에 있는 크기만 흡수하고 나머지 아홉은 남긴다

**나는 고르지 않는다.** CLAUDE.md가 「고르지 않고 묻는 것이 규칙이다」라고 적은 자리다.

### ③ 곡률 16이 SEED와 정면으로 어긋난다

`Radius.control` 16은 **피그마 풀폭 CTA 17개를 재서 나온 값**이다(CLAUDE.md `radius.$note`).
SEED는 같은 자리에 8(medium) · 12(large)를 쓴다. 버튼 63곳 · 입력칸 3곳이 걸린다.

규칙 1번이 「피그마 기준」과 「SEED 토큰」을 같이 말하는데 이 자리에서는 둘이 다른 값을
가리킨다. **피그마가 이긴다고 읽는 것이 맞아 보이지만**, 그러면 「SEED 컴포넌트로 교체」의
뜻이 「SEED 값으로 바꾼다」가 아니라 「SEED 구조로 정리한다」가 된다. 확인이 필요하다.

### ④ 좌우 여백 20 vs SEED 16

`$dimension.spacing-x.global-gutter`는 16px이다. 우리 `spacing.gutter`는 20이고, 이것도
**피그마 12화면을 재서 나온 값**이다. ③과 같은 성격이라 같이 정해야 한다.

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
- **부품 일곱이 아무도 안 쓴다** — `icon-button` · `search-bar` · `section-header` ·
  `step-list` · `data-tier-badge` · `pick-status-badge` · `truncated-text`. SEED로 맞추는
  값이 화면에 안 나타난다는 뜻이라 **순서를 맨 뒤로 두거나 뺄 후보다.**
  (`pick-status-badge`는 부품만 안 쓰이고 `STATUS_BADGE_STYLE`은 살아 있다.)

## 제안하는 순서

MASTER가 정하는 것이지만, 잰 사람으로서 근거를 적어 둔다.
**위험한 것을 맨 나중에** 두라는 지시를 그대로 따른다.

| 묶음 | 부품 | 왜 이 순서인가 |
| --- | --- | --- |
| 0 | ②③④ 판단 | **값을 옮기기 전에 정해야 한다.** 안 정하면 묶음 1부터 되돌리게 된다 |
| 1 | `accordion` · `segmented-tabs` · `fab` | 호출 1·1·2. 방법이 맞는지 여기서 본다 |
| 2 | `skeleton` · `list-skeleton` · `text-field` | 호출 9·3·3. 곡률·포커스 테두리가 걸린다 |
| 3 | `badge` · `verification-badge` · `data-tier-badge` · `pick-status-badge` | 규격을 공유해서 같이 움직인다 |
| 4 | `filter-chip` | 호출 13 |
| 5 | `action-button` | 호출 63. ③이 정해진 뒤에만 |
| 6 | `themed-text` | 호출 120 + `f*` 146곳. ②가 정해진 뒤에만. **맨 나중** |
| — | 안 함 | 「정책이 막는 것」 넷 · 「SEED 대응 없음」 열셋 · 안 쓰이는 일곱 |

2단계(뽑는 스크립트 + `--check`)는 묶음 1을 시작할 때 같이 만든다 — 무엇을 뽑아야 하는지가
묶음 0의 답에 달려 있다.
