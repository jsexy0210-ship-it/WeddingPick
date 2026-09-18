# Figma 디자인 시스템 추출 — 디자인 개편 1단계

작성 2026-09-14 (KST) · 브랜치 `claude/rn-migration-plan`
이 문서는 **분석 결과**다. `spec/tokens.json`을 포함해 어떤 토큰·코드도 고치지 않는다. 반영은 2단계다.
파일 경로는 별도 표기가 없으면 **Figma 저장소**(`docs/design/figma-export`) 기준이다.

## 0. 결론 먼저 — A등급은 색과 서체를 줄 수 없다

「A등급 출처만 값으로 쓴다」는 원칙을 적용하려 했으나, **A등급 3파일의 색과 서체는 대표님 결정으로 이미 배제된 구세대다.** 실측:

| A등급 파일 | 쓰인 색 | 쓰인 서체 |
|---|---|---|
| `src/imports/Home/index.tsx` | `#EF5DA8` · `#F09A59` · `#FCDDEC` · `#EDE6FC` · `#AEAFF7` · `#A0E3E2` | `Alegreya` · `Alegreya Sans` (12곳) |
| `src/imports/Search/index.tsx` | `#FEB052` · `#FFD7A8` · `#F3F4F6` · `#E5E7EB` | `Inter` (33곳) · `Poppins` (1곳) |
| `src/imports/LargeCalendar/index.tsx` | `#EE5C51` · `#B54896` | `Pretendard` (22곳) |

Primary는 `#E7898D`로 확정됐고 서체는 Pretendard 단일로 확정됐다. 위 값 중 살아남는 것은 없다.
게다가 A등급은 Figma 절대좌표 export라 여백값도 못 쓴다 — `Home/index.tsx`의 `p-[231px]` `p-[743px]`, `LargeCalendar`의 `p-[256px]`는 패딩이 아니라 좌표 잔재다.

**따라서 이 문서의 값 출처 규칙을 다음과 같이 바꾼다.**

| 층 | 정본 출처 | 등급 |
|---|---|---|
| 색 (primary · accent) | `src/styles/theme.css` — **대표님이 직접 확정한 값** | 결정 출처 (시안 등급 밖) |
| 색 (그 외 전부) | SEED 시맨틱 토큰 · `spec/tokens.json` | 기존 정본 |
| 서체 | 대표 결정 「Pretendard 단일」 | 결정 출처 |
| 기하(radius · 간격 · 크기) | A등급에서 캘 수 있는 것 + B등급(근거 약함) | 아래 §3 |
| 상태·문구·정책 | `spec/` · 통합정책 v3.15 | 기존 정본 |

## 1. 색

### 1-1. 확정값

| 토큰 | 값 | 출처 | 비고 |
|---|---|---|---|
| `--primary` | `#E7898D` | `src/styles/theme.css:16` | 대표 확정. `:41`(sidebar-primary)·`:36`(ring)·`:37`(chart-1)에도 같은 값 |
| `--primary-foreground` | `#ffffff` | `src/styles/theme.css:17` | |
| `--accent` | `#ECA0A3` | `src/styles/theme.css:22` | 대표 확정 |
| `--accent-foreground` | `#ffffff` | `src/styles/theme.css:23` | |
| `--chart-2` | `#F4BFC1` | `src/styles/theme.css:38`(인접) | primary의 연한 단계. **역할 이름이 없다** — 2단계에서 `primaryWeak`로 승격할지 판단 필요 |

그 밖의 시맨틱 색(`--background` `--card` `--muted` `--border` 등)은 **전부 `var(--seed-color-*)`를 가리킨다**(`theme.css:10~36`). 즉 Figma는 SEED 팔레트를 그대로 쓰고 **Primary/Accent 두 개만 갈아끼웠다.** 이것이 「시스템 교체가 아니라 값 교체」의 실제 내용이다.

### 1-2. 「크림 바탕」에 값이 없다 — 미해결

`guidelines/Guidelines.md` 첫 문장이 「크림 바탕의 따뜻한 에디토리얼 UI를 유지한다」고 적었다. 그러나 **Figma 코드 어디에도 크림색 값이 없다.**

- `theme.css:10` `--background: var(--seed-color-bg-layer-default)` — SEED 기본 배경(흰색)
- `Root.tsx`의 바깥 프레임은 `bg-muted` = `var(--seed-color-bg-layer-fill)` — 회색. 이것은 시안을 감싸는 액자이지 앱 배경이 아니다
- `#e8d9d1` `#d7e1d6` `#e9dfcf`(`FlowScreens.tsx:498~500, 601, 615, 627`)는 라운지 피드 카드의 **장식 배경**이지 페이지 배경이 아니다

**크림 바탕은 산문으로만 존재하고 값이 없다.** 2단계에서 페이지 배경을 흰색에서 크림으로 바꿀지, 바꾼다면 어떤 hex인지는 **대표 판단이 필요하다.** 임의로 정하지 않는다.

### 1-3. 테라코타 자리가 비었다 — 미해결

`Guidelines.md`는 「더스티 로즈는 사용자의 다음 행동, **테라코타는 검증·신뢰의 강조**」로 두 역할을 나눈다.
확정된 두 색(`#E7898D` primary · `#ECA0A3` accent)은 **둘 다 더스티 로즈 계열**이다. 테라코타에 해당하는 값이 없다.

기존 정본에서 「검증·신뢰」를 맡는 색은 `spec/tokens.json` `color.status.successFg` `#1AA174`(초록)이고, 이는 의미색이라 스킨과 무관하게 고정이다. **Guidelines의 테라코타 역할을 살릴지, 기존 초록 의미색을 유지할지 대표 판단이 필요하다.** 스킨 6종 체계 정리가 차후로 밀렸으므로 이 항목도 함께 묶는 것이 자연스럽다.

### 1-4. 프로토타입 전용 — 반영하지 않음

`Home.tsx:76~80`에 하드코딩된 5색 배열(`#E7898D` `#F26A5F` `#E1AE2E` `#9A82C9` `#4D9D87`)이 있다. `heroTheme`/`paletteOpen` 상태(`Home.tsx:85~86`)가 쓰는 **히어로 테마 전환 UI**다. 사용자 기능이 아니라 시안 확인용 컨트롤이므로 **개편에 반영하지 않는다**(`RN_MIGRATION_MAP.md`에서 REMOVE).

## 2. 타이포그래피

### 2-1. Pretendard 단일 — 현재 Figma 저장소는 이 결정을 아직 반영하지 않았다

| 항목 | 현재 상태 | 출처 |
|---|---|---|
| Pretendard 로드 | **되어 있음** | `src/styles/fonts.css:2` (jsDelivr CDN) |
| Playfair Display · Noto Sans KR · DM Mono 로드 | **되어 있음** | `src/styles/fonts.css:1` (Google Fonts) |
| `--font-display` | `'Playfair Display', Georgia, serif` | `src/styles/theme.css:87` |
| `--font-sans` | `'Noto Sans KR', system-ui, sans-serif` | `src/styles/theme.css:88` |
| `--font-mono` | `'DM Mono', 'Courier New', monospace` | `src/styles/theme.css:89` |

즉 **Pretendard는 받아만 놓고 어디에도 연결되어 있지 않다.** 세 서체를 빼는 결정을 반영하면 다음이 따라온다:

- `font-display` 사용 **18곳** (Home 2 · Search 1 · Pick 1 · OurWedding 4 · FlowScreens 7 · VendorFlows 3)
- `font-mono` 사용 **38곳** (Home 2 · Search 1 · Pick 3 · OurWedding 8 · My 1 · FlowScreens 12 · VendorFlows 11)
- 인라인 하드코딩 1곳: `My.tsx:85` `style={{ fontFamily: "'Playfair Display', Georgia, serif" }}`

### 2-2. DM Mono를 빼면 영문 eyebrow 장치가 같이 사라진다

`font-mono`는 대부분 화면 상단의 영문 소제목(eyebrow)에 쓰인다. 실측 13종:

`WEDDING, LESS OVERWHELMING` · `JUST FOR YOU` · `VERIFY THE FACTS` · `MY NOTES` · `TODAY"S PICK` · `UPCOMING FAIR` · `RELATED` · `OUR CALENDAR` · `BUDGET OVERVIEW` · `CONSULTATION` · `YOUR CONSULTANT` · `BLOOMING STUDIO` · `VERIFIED PRICE RANGE`

이 문구들은 **`spec/strings.ko.json`에 없는 임의 영문**이다. `VERIFIED PRICE RANGE`는 v3.18 용어 통일이 정한 「실 제보」 자리를 영문으로 대체한 것이라 **용어 규칙 위반**이기도 하다.
→ **eyebrow 장치 전체를 걷어낸다.** 서체 결정과 용어 정본이 같은 방향을 가리키므로 별도 판단이 필요 없다.

### 2-3. 크기 체계 — Figma는 독자 스케일을 안 쓴다

B등급 8파일은 Tailwind 유틸(`text-sm` `text-xs` 등)과 임의 px(`text-[26px]` `text-[42px]` `text-[38px]` `text-[28px]` `text-[15px]` `text-[11px]` `text-[10px]`)을 섞어 쓴다. **8단계 스케일 같은 체계가 없다.**
기존 정본은 `packages/ui/src/typography.ts`의 `FontSize`/`LineHeight`가 8단계로 잠겨 있고 `typography.test.ts`가 저장소를 훑어 표 밖의 크기를 막는다.
→ **크기 체계는 기존 정본이 이긴다.** Figma의 임의 px는 반영하지 않는다. `text-[42px]`(로그인 헤드라인) 같은 큰 값이 필요하면 **먼저 `spec/tokens.json`과 `typography.ts`에 단계를 추가**하고 전 화면에 반영한다(`tokens.json` `typography.$forbidden`이 정한 절차).

## 3. 기하 — radius · 간격 · 그림자

### 3-1. radius

| 출처 | 값 | 신뢰도 |
|---|---|---|
| `theme.css:38` `--radius` | `1.125rem` = **18px** | 결정 출처 |
| 파생 (`theme.css:116~119`) | sm 14 · md 16 · lg 18 · xl 22 | 결정 출처 |
| A등급 `imports/Search` | `rounded-[12px]` 20회 · `rounded-[45px]` 6회 | 구세대 시안 — 참고만 |
| A등급 `imports/Home` | `rounded-[20px]` 6회 · `rounded-[10px]` 2회 | 구세대 시안 — 참고만 |
| A등급 `imports/LargeCalendar` | `rounded-[21.67px]` | 구세대 시안 — 참고만 |
| B등급 실사용 빈도 | `rounded-full` 88 · `rounded-2xl` 52 · `rounded-xl` 33 · `rounded-lg` 8 · `rounded-[22px]` 5 · `rounded-[26px]` 3 · `rounded-3xl` 3 · `rounded-[28px]` 1 | 근거 약함 |

**Figma 저장소 자체에 결함이 있다.** `--radius-2xl`을 정의하지 않아서(`theme.css`에 sm/md/lg/xl만 있음) 가장 많이 쓰인 `rounded-2xl` 52곳이 Tailwind 기본값 **16px**로 떨어진다. 이는 `rounded-xl`(22px)보다 **작다** — 크기 순서가 뒤집혀 있다. 시안의 곡률을 수치로 읽을 때 이 점을 감안해야 한다.

### 3-2. 간격

A등급에서 **여백값은 캘 수 없다**(§0). 유효한 것은 A등급 `Search`의 `gap-[4px]`(16회)·`gap-[8px]`(13회)·`px-[20px]`(4회)·`px-[24px]`(2회) 정도이고, 나머지 `p-[231px]` 류는 좌표다.

B등급 실사용 좌우 여백: `px-5`(20px) 43회 · `px-4`(16px) 36회 · `px-6`(24px) 4회.
→ Figma는 **좌우 여백 20px**을 주로 쓴다. 정본은 **24px 고정**(`spec/tokens.json` `spacing.gutter`, `CLAUDE.md` 「좌우 Gutter 24px」).
**근거 약함(B등급)이므로 정본 24를 유지한다.** 20으로 바꾸려면 별도 대표 결정이 필요하다.

### 3-3. 그림자

Figma B등급 실사용: `shadow-sm` 7 · `shadow-lg` 3 · `shadow-primary` 4 · `shadow-md` 1 · `shadow-2xl` 1 (총 16곳, 전부 Tailwind 기본 그림자).
정본은 `spec/tokens.json` `elevation.$rule` — 「그림자를 거의 쓰지 않는다. 구분은 inset 선과 배경 톤으로 한다」.
→ **정본이 이긴다.** Figma의 Tailwind 기본 그림자는 반영하지 않는다. 단 `shadow-2xl` 1곳은 `Root.tsx`의 시안 액자용이라 앱과 무관하다.

## 4. `spec/tokens.json`과 1:1 대조

WeddingPickl 정본(`spec/tokens.json` v3.10) 기준. **「그대로」가 압도적으로 많다.**

| 토큰 경로 | 현재 값 | 개편 후 | 판정 |
|---|---|---|---|
| `color.brand.primary` | `#FF6F61` | **`#E7898D`** | **변경** — `theme.css:16` |
| `color.brand.primaryPressed` | `#EE6255` | **재계산 필요** | **변경** — Figma에 눌림 상태 값 없음. `#E7898D`에서 파생해야 함 |
| `color.brand.primaryDark` | `#C2453A` | **재계산 필요** | **변경** — 연한 배경 위 대비 확보용. 파생 필요 |
| `color.brand.onPrimary` | `#FFFFFF` | `#FFFFFF` | 그대로 — `theme.css:17`과 일치 |
| (신규) `color.brand.accent` | 없음 | **`#ECA0A3`** | **추가** — `theme.css:22` |
| `color.skin.options[]` 6종 | coral/red/yellow/green/blue/darkgray | **이번 범위 밖** | **보류** — 대표 확정 ①. 스킨 체계 정리는 차후 |
| `color.skin.options[0].value` (coral 기본) | `#FF6F61` | **충돌** | **미해결** — Primary가 `#E7898D`가 되면 「코랄」 스킨의 정체가 흔들린다. 스킨 정리와 함께 판단 |
| `color.social.*` (카카오·애플·구글·네이버·Npay) | 각 사 공식색 | 그대로 | 그대로 — 스킨·Primary와 무관하다고 `$rule`이 명시 |
| `color.text.*` (ink·ink2·secondary·tertiary·disabled) | SEED gray 램프 | 그대로 | 그대로 — Figma도 SEED 시맨틱을 그대로 씀 |
| `color.line.*` · `color.surface.*` | SEED | 그대로 | 그대로 |
| `color.surface.paper` | `#FFFFFF` | **미해결** | **판단 필요** — 「크림 바탕」(§1-2). 값 없음 |
| `color.status.*` | 의미색 고정 | 그대로 | 그대로 — 단 테라코타 역할(§1-3) 미해결 |
| `typography.$fontFamily` | 시스템 서체 · 「Pretendard 미적용」 | **Pretendard 단일** | **변경** — 대표 확정 ③. 기존 규칙을 뒤집는다 |
| `typography.scale[]` 8단계 | 32/26/24/20/18/16/14/13 | 그대로 | 그대로 — Figma에 대체 체계 없음(§2-3) |
| `typography.$weights` (700/400 두 가지) | 700·400 | **확인 필요** | Figma는 `font-medium`(500)·`font-black`(900)도 씀. Pretendard 웨이트 반입 범위를 2단계에서 결정 |
| `spacing.gutter` | 24 | 24 | 그대로 — Figma 20은 근거 약함(§3-2) |
| `spacing.*` (그 외 전부) | — | 그대로 | 그대로 — Figma에서 캘 수 있는 값 없음 |
| `radius.*` (badge 4 · control 6 · card 10 · pick 14 · sheet 20 · full 999) | — | **검토 필요** | Figma는 18px 기준으로 훨씬 둥글다. 다만 `theme.css` 외 근거가 약하고 자체 결함도 있음(§3-1) |
| `elevation.*` | 그림자 거의 없음 | 그대로 | 그대로 (§3-3) |
| `motion.*` | — | 그대로 | 그대로 — Figma는 `transition-colors`·`active:scale` 정도만 씀 |
| `symbol.*` (Pick Mark) | 확정본 | 그대로 | **절대 변경 금지**. Figma는 SEED 아이콘(`IconHeartRegular` 등)을 쓰므로 Pick Mark로 되돌려야 함 |
| `symbol.appIcon.background` | `#FF6F61` 고정 | **판단 필요** | 앱 아이콘·스플래시는 스킨과 무관하게 코랄 고정이라고 적혀 있다. Primary가 바뀌어도 유지할지 확인 필요 |
| `tabBar.items[]` | 홈·검색·Pick·웨딩일정·MY | **충돌** | **미해결** — Figma는 검색 대신 라운지(`INVENTORY.md` §6-1) |
| `auth.providers` | 카카오 · 이메일 | **충돌** | **미해결** — Figma는 카카오 단독, 앱스토어 4.8은 애플 요구 |
| `image.*` · `safeArea.*` · `platform.*` | — | 그대로 | 그대로 — 플랫폼 사실이지 디자인 값이 아님 |

## 5. 2단계에 넘길 `$note` 초안

토큰에 값을 더할 때 출처를 `$note`에 적는다. 아래는 문안 초안이며 **이번 단계에서는 파일에 쓰지 않는다.**

```
color.brand.primary.$note:
  "#E7898D — docs/design/figma-export/src/styles/theme.css:16. 2026-09-14 대표 확정."
color.brand.accent.$note:
  "#ECA0A3 — docs/design/figma-export/src/styles/theme.css:22. 2026-09-14 대표 확정."
typography.$fontFamily.$note:
  "Pretendard 단일. 2026-09-14 대표 확정 — Playfair Display · Noto Sans KR · DM Mono 제외.
   기존 '시스템 서체 유지 · Pretendard 미적용' 규칙을 뒤집는 결정.
   폰트 파일은 대표님이 제공 예정 — 반입 전에는 시스템 서체로 떨어진다."
```

`primaryPressed` · `primaryDark`는 Figma에 출처가 없으므로 **`$note`에 「파생값」임을 명시**하고 어떤 공식으로 뽑았는지 적어야 한다. 출처 없는 값을 출처 있는 값처럼 적지 않는다.

## 6. 이 문서가 값을 정하지 않은 것 (대표 판단 대기)

1. **크림 바탕의 hex** — 값이 어디에도 없다 (§1-2)
2. **테라코타(검증·신뢰) 색** — 확정 2색이 둘 다 로즈 계열이라 자리가 빈다 (§1-3)
3. **스킨 6종과 `#E7898D`의 관계** — 「코랄」 스킨의 정체 (§4)
4. **`primaryPressed` · `primaryDark` 파생 공식** — 승인 필요
5. **radius 18px 기준 채택 여부** — Figma 쪽 근거에 결함이 있다 (§3-1)
6. **Pretendard 웨이트 반입 범위** — 현행 규칙은 700/400 둘뿐

---
모든 값은 2026-09-14 KST 기준 작업 트리에서 직접 읽었다. 읽지 않은 값은 적지 않았다.
