# 디자인 정책 감독 — 상시

**대표님이 2026-09-15에 다섯 줄을 「절대적인 지침」으로 못 박으시고, 지켜지는지 상시 보는
세션을 두라고 하셨다.** 이 파일이 그 세션의 장부다. 규칙 원문은 `CLAUDE.md` 맨 위
「최상위 정책 규칙」이고, 여기에는 **재어 본 결과만** 적는다.

## 왜 사람이 아니라 세션이 보는가

2026-09-14에 대표님이 앱을 열어 보시고 「피그마랑 아예 다르잖아」라고 하셨다. 그때까지
세션 여럿이 「시안대로 맞췄다」고 보고했고 아무도 거짓말을 하지 않았다 — **두 화면을
나란히 놓고 본 적이 없었을 뿐이다.** 코드를 읽고 판단한 것을 「본 것」으로 적으면 이 일은
반드시 다시 일어난다. 그래서 감독은 **재어서** 한다.

## 다섯 줄을 어떻게 재는가

| # | 규칙 | 재는 법 | 자동 |
| --- | --- | --- | --- |
| 1 | 피그마 기준 · SEED 토큰 · 픽셀 단위 | 앱과 시안을 **같은 폭 430**으로 찍어 나란히 본다. 값이 SEED에서 왔는지는 `seed-parity.test.ts` | 부분 |
| 1 | 화면 코드에 hex · px 직접 금지 | `apps/mobile/src` · `packages/ui/src`에서 `#RRGGBB`와 생px을 센다 | 예 |
| 2 | Pretendard만 | `spec/tokens.json` `typography.$fontFamily`가 원본. Noto Sans KR · Playfair Display · DM Mono가 코드에 있으면 걸린다 | 예 |
| 3 | 피그마에 없는 화면은 기존 정본 재사용 | 지워진 화면 · 라우트가 있는지 diff로 본다. **멀쩡한 화면이 사라지는 것이 제일 잡기 어렵다** | 부분 |
| 4 | 3번이 안 되면 1번 기준으로 신규 | 새로 만든 화면이 SEED 토큰만 쓰는지 | 부분 |
| 5 | 로더 · 토스트 · 얼럿 · 컨펌 · 바텀시트는 색만 교체 | 해당 컴포넌트의 diff에 색 아닌 변경이 있으면 걸린다 | 예 |

### 5번이 지키는 컴포넌트

`packages/ui/src`의 `circle-loader.tsx` · `category-cycle-loader.tsx` · `toast.tsx` ·
`show-alert.ts`, 그리고 바텀시트를 그리는 화면들. **동작 · 크기 · 자리 · 문구는 손대지
않는다** — 이것들에는 이미 규칙이 붙어 있다(페이지 이동은 원형 로더 · 700ms 임계값 ·
로그인 표시는 한 가지만 · 위험한 조작은 한 번 더 확인).

## 어기면 어떻게 하는가

- **고칠 수 있으면 고치고 PR을 건다.** 감독 세션도 브랜치에 커밋만 해 두고 끝내지 않는다.
- **판단이 필요하면 MASTER에게 올린다.** 골라서 밀지 않는다.
- **적고 넘어가지 않는다.** 이 파일에 적힌 채로 두 번 연속 남은 항목은 MASTER가 대표님께
  보고한다.

## 감독 기록

기록은 최신이 위다. 한 번 볼 때마다 한 줄 이상 남긴다 — **어긋난 것이 없으면 「없음」이라고
적는다.** 빈칸은 「안 봤다」와 구별되지 않는다.

### 2026-09-15 12:10 KST — 3차. **R2-5가 풀렸다.** Pretendard가 처음으로 실제로 실린다

`main`을 가져왔다(6aa573c → 8024b04, 29커밋). #232가 머지돼 규칙이 `main`에 올라왔다.

| # | 결과 | 2차 대비 |
| --- | --- | --- |
| 1 | hex **17건** (baseline 유지) | 그대로 |
| 2 | 금지 서체 **0건** | 그대로 |
| 3 | 사라진 라우트 **없음** (main 150 · 현재 150) | 그대로 |
| 4 | 신규분 위반 **없음** | 그대로 |
| 5 | 로더 · 토스트 · 얼럿 · 컨펌 생색 **0건** | 그대로 |
| — | SEED `--check` 초록 · 금지어 린트 통과 | 그대로 |

**어긋난 것: 없음.**

#### R2-5 — 해결됐다. 재어서 확인했다

1차에 「서체 파일이 없다」, 2차에 「파일은 왔는데 아무것도 안 읽는다」로 올렸던 항목이다.
**이번에 실제로 실렸다.** 제가 2차에 적어 둔 제안(가변 폰트 한 벌)과 같은 길이다.

| 자리 | 무엇이 생겼나 | 확인한 방법 |
| --- | --- | --- |
| 웹 | `apps/web/src/fonts.ts` — `@font-face` · `font-weight: 45 920` · `font-display: swap` · preload(`crossorigin` 포함) | 파일을 읽었다 |
| 웹 자산 | `apps/web/public/assets/fonts/PretendardVariable.woff2` **2.0MB 실재** | `ls -la` |
| 네이티브 | `app.json`의 `expo-font` 플러그인 — iOS 4벌 · Android 4벌(400 · 600 · 700 · 800) | `app.json`을 파싱해 읽었다 |
| 네이티브 자산 | `apps/mobile/assets/fonts/Pretendard-{Regular,SemiBold,Bold,ExtraBold}.ttf` **실재** | `find` |
| 모바일 웹 | `apps/mobile/public/fonts/PretendardVariable.woff2` | `find` |

**첫 화면 지연이 다시 생기지 않는 방식이다.** `useFonts`로 **받지** 않고 빌드가 번들에
박는다 — 2026-09-09에 뺐던 그 비용을 치르지 않는다. 제가 2차에 「첫 화면이 그만큼
늦는다」고 적은 걱정은 이 방식에서는 해당하지 않는다.

**곁따라 나은 것 하나.** `apps/web/src/styles.ts`의 서체 스택이 이제 `FONT_STACK`으로
`spec/tokens.json`에서 온다. 제가 1차에 손으로 맞춰 둔 스택보다 낫다 — **병합에서 제
것을 버리고 `main` 쪽을 택했다.** 옮겨 적은 값은 언젠가 갈라진다.

**남은 것 하나**: `public.zip`(22.9MB)이 아직 저장소 루트에 있다. 필요한 서체는 이미
풀려서 제자리에 들어갔으므로 이 압축본은 중복이다. **대표님이 올리신 파일이라 감독
세션이 지우지 않는다** — MASTER가 정할 일로 넘긴다.

#### 위반이 아닌 것 — 브랜드색이 `#E7898D` → `#FF6F61`로 돌아왔다

감독 세션이 받은 배정 지시는 브랜드색을 `#E7898D` · `#ECA0A3`으로 적고 있다. 지금
`main`은 `#FF6F61`이다. **이것은 위반이 아니다** — `CLAUDE.md`(main) 243–245줄이
**2026-09-15 대표 지시**라고 적는다: 「기존 정본색상으로 싹다 다시 바꿔. 코랄색으로」.
`#E7898D`는 2026-09-14 하루뿐이었다.

**세어 보기 전에 위반으로 적지 않는다.** 배정 지시보다 저장소의 최신 규칙이 앞선다 —
지시는 그 시점의 사본이고, 대표님은 그 뒤에 마음을 정하실 수 있다.

#### 미해결 — R1-1만 남았다

| 항목 | 1차 | 2차 | 3차 | 상태 |
| --- | --- | --- | --- | --- |
| **R2-5** Pretendard | 파일이 없다 | 파일은 왔는데 안 읽는다 | **실렸다** | ✅ **해결** |
| **R1-1** 등급 색 5개 | 토큰 밖 · 두 벌 | 그대로 | **그대로** | **미해결 3회차** |

`packages/ui/src/verification-levels.ts`와 `apps/mobile/src/features/verification/levels.ts`가
여전히 같은 hex 5개를 각자 들고 있다. 남은 17건 중 10건이 이것이다.

#### PR #236 — CI가 아직 한 번도 돌지 않았다 (3회차)

네 번째 실행(run 866)도 `action_required`였다. **승인 없이는 시작하지 않는다.**

### 2026-09-15 10:45 KST — 2차. 서체 파일이 왔다. 그런데 아무것도 그것을 읽지 않는다

`main`을 가져와(036423d → 6aa573c) 다시 쟀다.

| # | 결과 | 1차 대비 |
| --- | --- | --- |
| 1 | hex **17건** (baseline 유지) | 그대로 |
| 2 | 금지 서체 **0건** | 그대로 |
| 3 | 사라진 라우트 **없음** | 그대로 |
| 4 | 신규분 위반 **없음** | 그대로 |
| 5 | 로더 · 토스트 · 얼럿 · 컨펌 생색 **0건** | 그대로 |
| — | SEED `--check` 초록 · 금지어 린트 통과 | 그대로 |

**어긋난 것: 없음.** 새로 생긴 위반은 하나도 없다.

#### 그 사이 `main`에 들어온 것 — R2-5의 절반이 풀렸다

대표님이 서체를 올리셨다. 커밋 셋이다.

    ca436e0  프리텐다드 Pont_web      web.7z 추가 (24.1MB)
    10d9f38  Delete web.7z            web.7z 삭제
    6aa573c  Fonts_public             public.zip 추가 (22.9MB)

`public.zip`을 열어 보니 **Pretendard 서체 20벌**이다 — `static/` OTF 9 · `static/alternative/`
TTF 10 · `variable/PretendardVariable.ttf` 1.

**1차에서 「서체 파일이 어디에도 없다」고 적은 것은 이제 사실이 아니다. 파일은 왔다.**

**그런데 앱도 웹도 여전히 Pretendard로 그려지지 않는다.** 재어 본 결과다 —
`grep -rn "public.zip\|PretendardVariable\|@font-face\|expo-font\|useFonts"`가 `apps/` ·
`packages/`에서 잡는 것은 **제가 1차에 쓴 주석 한 줄뿐**이다. 즉:

- zip이 **저장소 루트에 압축인 채로 있다.** 풀린 자리가 없다.
- `@font-face`도 `expo-font`도 없다. **아무것도 이 파일을 읽지 않는다.**
- 그래서 `theme.ts`의 `Fonts`가 집는 `'Pretendard'`는 여전히 폴백으로 떨어진다.

**R2-5는 풀린 것이 아니라 성격이 바뀌었다** — 「실을 것이냐」에서 **「어떻게 실을
것이냐」**로. 그리고 이것은 **두 번 연속 미해결**이라 MASTER에게 따로 올렸다.

**감독 세션이 직접 잇지 않는 이유.** 고를 것이 남아 있고, 고르면 되돌리기 비싸다.

- **어느 벌을 싣나** — Variable 한 벌(≈2MB)이냐 정적 9벌이냐. 정적을 다 실으면 앱이
  그만큼 무거워진다.
- **웹은 어디서 받나** — zip은 서빙되지 않는다. 풀어서 `apps/web`이 내보내는 자리에
  두든, 서브셋을 떠서 두든 자산 파이프라인이 필요하다.
- **네이티브는 첫 화면이 그만큼 늦는다.** 2026-09-09에 `useFonts`를 뺀 이유가 그것이다.
  같은 값을 다시 치르는 결정이다.
- **22.9MB 바이너리가 git에 들어왔고 풀면 또 그만큼이다.** 서브셋·LFS를 쓸지도 같이 정해야
  한다. 이건 감독이 혼자 정할 자리가 아니다.

**제안(고르지 않고 적어만 둔다)**: 웹은 `variable/PretendardVariable.ttf` 한 벌을 woff2로
서브셋해 `@font-face`로 싣고, 네이티브는 `expo-font`로 같은 Variable 한 벌만 싣는다.
정적 19벌과 `public.zip` 원본은 저장소에서 내린다. **대표님·MASTER가 정하실 일이다.**

#### PR #236 — CI가 아직 한 번도 돌지 않았다

세 번 실행이 전부 `action_required`로 **시작조차 못 했다**(run 850 · 851 · 852).
이 저장소의 PR 워크플로는 사람이 승인해야 돈다 — #232 · #235도 같다. **감독 세션이 풀 수
있는 것이 아니다.** MASTER가 Actions에서 승인해 주셔야 한다.

로컬 검증은 `main` 병합 뒤에도 전부 초록이다 — typecheck 오류 0 · lint 오류 0 ·
`npm test` 통과 · 금지어 린트 통과 · SEED `--check` 초록.

#### 두 번 연속 미해결 — MASTER에 올림

| 항목 | 1차 | 2차 | 상태 |
| --- | --- | --- | --- |
| **R2-5** Pretendard | 서체 파일이 없다 | **파일은 왔는데 아무것도 안 읽는다** | **미해결 2회차** |
| **R1-1** 등급 색 | 토큰 밖 · 두 벌 중복 | 그대로 | **미해결 2회차** |

### 2026-09-15 09:40 KST — 1차 전수. 잰 것 · 고친 것 · MASTER로 올린 것

감독 세션(`claude/design-policy-audit`)이 다섯 줄을 처음으로 전수로 쟀다. **코드를 읽고
판단한 것은 하나도 적지 않았다** — 잰 명령과 찍은 화면만 적는다.

**만든 것 — `scripts/check-design-policy.mjs`.** R1 · R2 · R5를 센다. `npm test` 맨 앞과
CI(`main.yml` 「디자인 정책」)에 붙였다. 남은 빚은 `scripts/design-policy-baseline.json`에
수로 적혀 있고 **늘어나면 깨진다.**

**이 스크립트가 주석을 걷어내는 것이 핵심이다.** 단순 grep은 hex를 457건으로 세는데,
실제 위반은 **20건**이었다. 나머지 437건은 「시안의 `#eaebee`와 같은 값」처럼 근거를
적어 둔 주석과, 남의 브랜드 마크(구글 블루 · 카카오 · 네이버 그린)다. 근거를 적어 둔
것을 위반으로 세면 다음 사람은 근거를 지운다.

| # | 잰 법 | 결과 |
| --- | --- | --- |
| 1 | `check-design-policy.mjs` · 앱/시안 430 대조 · `sync-seed-tokens.mjs --check` | hex **20 → 17건**. 3건 고침. 토큰 출처는 초록(`@seed-design/css@2.8.1`) |
| 2 | 같은 스크립트 + `spec/tokens.json` 스택 검사 | **2건 → 0건.** 다만 **서체 파일이 어디에도 없다**(R2-5, 아래) |
| 3 | `main`과 라우트 대조 — 사라진 화면 찾기 | 2건 발견, **둘 다 정당한 리팩터.** 조용한 삭제 **없음** |
| 4 | 새 화면의 생 hex | 신규분 위반 **없음** |
| 5 | 로더 · 토스트 · 얼럿 · 컨펌의 생색 | **0건.** `circle-loader.tsx`는 hex 3개가 전부 주석이고 코드는 `theme.line` · `theme.tint` · `Layout.loaderCircleStroke*`만 쓴다 |

#### 고친 것 (7건)

- **R2** `packages/ui/src/tokens.css` — `--font-sans`에 Pretendard가 **아예 없었고**
  `Noto Sans KR`이 있었다. 주석은 아직 「Pretendard 미적용」을 근거로 들고 있었다.
- **R2** `apps/web/src/styles.ts` — Pretendard가 스택 **4번째**였고 `Noto Sans KR`이 그 뒤에
  있었다. `spec/tokens.json`의 web 스택으로 맞췄다.
- **R2** `packages/ui/src/design-tokens.ts` — `font.android`가 `Roboto · Noto Sans KR`이었다.
- **R2** `apps/mobile/src/app/_layout.tsx` — 파일 첫 줄과 본문 주석이 뒤집힌 규칙
  (「폰트는 시스템 서체 유지(Pretendard 미적용)」)을 근거로 들고 있었다.
- **R1** `apps/mobile/src/components/states/guest-gate-sheet.tsx` — 그래버가 `'#eaebee'`를
  직접 적고 있었다. **다른 시트는 전부 `theme.border`를 쓴다**(`bottom-sheet` · `benefit-sheet`).
- **R1** `packages/ui/src/wedding-mark.tsx` — 기본 색이 `'#e7898d'` 생값이었다.
  `Colors.light.tint`로 바꿨다(호출부는 전부 색을 넘기고 있어 화면은 그대로다).
- **도구** 시험 파일(`*.test.tsx`)은 세지 않도록 했다 — 시험은 값을 직접 적는 자리다.

#### 못 고친 것 — MASTER 판단 필요

- **R2-5 · 가장 큰 것. Pretendard가 이름만 있고 서체 파일이 없다.** `theme.ts`의 `Fonts`는
  세 플랫폼 모두 Pretendard를 맨 앞에 두는데, **번들에도 웹에도 서체가 없다** —
  `find -iname "*pretendard*"` 0건 · `expo-font` 의존성 없음 · `@font-face` 없음 · 웹폰트
  `<link>` 없음. 즉 **지금 앱과 웹은 Pretendard로 그려지지 않는다.** iOS는 Apple SD Gothic
  Neo, Android는 Roboto로 떨어진다. 규칙 2번은 「Pretendard만 쓴다」인데 **한 번도 쓰인 적이
  없다.** 되싣는 것이 맞지만 2026-09-09에 뺀 이유가 첫 화면 지연이라, 그 값을 다시 치를지는
  제품 결정이다. **골라서 밀지 않는다.**
- **R1-1 · 등급 색 5개가 토큰 밖에 있고, 그것도 두 벌이다.**
  `packages/ui/src/verification-levels.ts`와 `apps/mobile/src/features/verification/levels.ts`가
  `#8B8D98 · #208AEF · #2A9D5C · #12786A · #7A4DD1`을 **똑같이 하드코딩**한다(주석 한 줄만
  다르다). `spec/tokens.json` · `spec/seed-tokens.json` 어디에도 없는 값이다. 남은 17건 중
  10건이 이것이다. 규칙대로면 토큰에 더해야 하는데, **감독 세션은 `spec/tokens.json`의
  `color` 블록을 건드리지 않는다**(MASTER가 SEED에서 뽑아 넣었고 시험이 지킨다). 두 벌인
  것도 같이 정리해야 한다.
- **R1-2 · 나머지 7건은 픽셀 전담 세션 몫이다.** `capture/camera.tsx`(3 · 카메라 뒷바탕
  검정) · `capture/sample.tsx`(2) · `my/display.tsx`(1) · `onboarding/style-grid.tsx`(1 ·
  시안 `rgba(0,0,0,.55)`를 hex+알파로 만드는 자리). `claude/figma-pixel-parity`가 본다.

#### 재어 본 화면 — 홈 (430 나란히)

`node scripts/screenshot-figma.mjs` · `node scripts/screenshot-screens.mjs --build --full
--viewport 430x932`. **둘 다 430으로 찍었다.**

| 자리 | 피그마 | 앱 | 판정 |
| --- | --- | --- | --- |
| 탭바 | 홈 · 웨딩노트 · Pick · 라운지 · MY | 같다 | **맞다** |
| D-day 카드 | 코랄 · 「두근두근」 · 날짜/장소 한 줄 · 아바타 둘 · 우상단 ⋯ | 코랄 · 아바타 하나 · 2줄 문구 · 하단 진행바 `0/12` | **구성이 다르다** |
| 홈 검색칸 | 없다(GNB 돋보기) | 본문에 입력칸이 있다 | **다르다** |
| 준비 현황 | 2×2 카드 · 아이콘 + 상태 아이콘 · 「4개 중 1개 완료」 | 1×4 칩 · 텍스트 | **다르다**(칸 수 4는 맞다) |
| 웨딩픽 추천 | 가로 업체 카드(이미지 · 금액 · 별점 · 하트) | 칩 3 + 「아직 정보가 적어요」 + Pick 인증 | **상태가 달라 비교 불가** |
| 카테고리 6칸 | 있다 | 홈에 없다 | **다르다** |

**「상태가 달라 비교 불가」를 위반으로 적지 않는다.** 피그마는 진행이 찬 홈(D-127 ·
1개 완료 · 업체 카드)을 그리고 앱은 진행 0 · 정보 0층을 그린다. 빈 화면과 찬 화면을
나란히 놓고 「다르다」고 적으면 2026-09-14가 반대 방향으로 되풀이된다. **구성 차이는
`claude/figma-pixel-parity`에 넘긴다 — 감독 세션은 화면을 새로 그리지 않는다.**

#### 다섯이 못 이기는 것 — 어기지 않았다

- 금지어: `lint-copy.js` **통과**. 피그마 홈이 그리는 **「아직 탐색 전」이 우리 코드에
  들어오지 않았다**(`grep` 0건). 앱은 「시작 전」으로 적는다. **없음.**
- 주소: `/wedding` · `/community` 그대로. 피그마의 `/our-wedding`을 따라가지 않았다. **없음.**
- 사라진 화면 2건은 둘 다 살아 있다 — `my/rewards.tsx`는 `my/rewards/` 디렉터리로 펼쳐졌고
  (`index` · `history` · `npay` · `missions` · `promotion` · `fund`), `search/filter.tsx`는
  `features/search/filter-sheet.tsx` 시트가 됐다. 라우트 수는 124 → 149로 **늘었다.**

### 2026-09-15 — 브랜드색을 코랄 정본으로 되돌렸다

대표님 지시: 「기존 정본색상으로 싹다 다시 바꿔」 · 「코랄색으로」.

2026-09-14에 하루 동안 키 컬러가 피그마의 `#E7898D`였고 그 위 글자가 플럼 `#371B34`였다.
**되돌린 값은 전부 코랄판(`8a259608~1`)에서 그대로 읽어 왔다** — 지어낸 값이 하나도 없다.

| 자리 | 하루 동안 | 코랄 정본(지금) |
| --- | --- | --- |
| primary | `#E7898D` | **`#FF6F61`** |
| primaryPressed | `#D87D80` | `#EE6255` |
| primaryDark | `#C63F45` | `#C2453A` |
| primaryTint | `#FBEBEC` | `#FFE8E4` |
| primarySurface | `#FDF6F6` | `#FFF5F2` |
| primaryBorder | `#F9DFE0` | `#FFD9D4` |
| onPrimary | `#371B34`(플럼) | **`#FFFFFF`** |
| 어두운 벌 tint | `#EB9C9F` · `#EFB0B3` · `#F1BCBE` | `#FF8478` · `#FF9A90` · `#FFA79E` |

파일 16개 · 자리 87곳. `accent` `#ECA0A3` · `onAccent`는 **코랄 정본에 없던 칸이라 걷어냈다**
(2색 체계와 함께 들어왔던 것이고, `theme.ts`의 `Colors.accent`는 그것이 아니라 링크색
`accentAction` `#0088CC`다 — 이름만 같고 다른 자리다). `palette.plum`은 이름을 `onKey`로
바꿨다 — 값이 흰색이 된 자리에 「플럼」이라는 이름이 남으면 다음 사람이 헷갈린다.

**알고 넘어가는 것:** 흰 글자는 `#FF6F61` 위에서 **3.03:1**이다. WCAG AA 본문 4.5:1에는
못 미치고 큰 글자 3.0:1은 넘는다. 코랄판이 원래 그랬고 대표님이 그 판으로 돌아가라고
하셨다 — 되돌리자는 것이 아니라 적어 두는 것이다.

### 2026-09-15 — 글자색을 피그마에서 재서 가져왔다

대표님 지시: 「텍스트 색상도 피그마 기준으로 만들어.」 추측하지 않고 **아홉 화면을 렌더해
글자 노드의 계산된 색을 전부 셌다**(`/` · `/search` · `/pick` · `/our-wedding` · `/my` ·
`/community` · `/vendor/1` · `/onboarding` · `/login`).

| 피그마에서 센 색 | 횟수 | 쓰이는 자리 |
| --- | --- | --- |
| `#1A1C20` | 191 | 제목 · 본문 · 업종명 |
| `#868B94` | 185 | 보조 · 메타 · 「4개 중 1개 완료」 · 부제 |
| `#FFFFFF` | 27 | 코랄 면 위 — 히어로 `D-127` · 「비교하기」 · 배지 |
| `#E7898D` | 5 | 브랜드색 글자 |
| 흰색 + 투명도 0.45~0.7 | 8 | 히어로 안 보조 글자 |

**피그마는 글자에 두 색만 쓴다.** 우리가 들고 있던 사이 단계 `#2A3038` · `#555D6D`는
아홉 화면에서 **한 번도 나오지 않았다** — 피그마는 굵기와 크기로 가르지 색으로 가르지 않는다.

고친 것:

- `text.secondary` `#555D6D` → **`#868B94`**(SEED `fg-neutral-subtle`). `spec/seed-map.json`의
  대응도 `fg-neutral-muted` → `fg-neutral-subtle`로 옮겼다.
- `theme.ts` 글자 역할: `textStrong`이 `text`와, `textSecondary`가 `textAssistive`와 같은
  값이 됐다. **이름은 지우지 않았다** — 쓰는 자리가 많고, 피그마가 나중에 단계를 늘리면
  그 자리만 고치면 된다.
- **`onTint` 플럼 `#371B34` → 흰색.** 코랄 면 위 글자다.

`onTint`를 바꾼 근거를 남긴다. 2026-09-14에 「흰색이 아니다」로 잡혔고 근거가 「Figma 픽셀
export(`src/imports/Home/index.tsx`)에 있던 색」이었는데, **그 파일은 웨딩픽이 아니다** —
「Peer Group Meetup」 · 「Meditation」 · Alegreya 서체가 든 다른 앱의 템플릿이고 피그마
라우터(`routes.ts`)가 부르지도 않는다. 값을 엉뚱한 데서 집어 온 것이었다.

**(이 항목은 위 「브랜드색을 코랄 정본으로 되돌렸다」로 정리됐다.)** 당시 기록: 흰 글자는 `#E7898D` 위에서 **2.51:1**이다. WCAG AA(4.5:1)에
못 미친다는 사실 자체는 그대로다. 피그마가 그렇게 그렸고 대표님이 그 기준으로 맞추라고
하셨다 — 되돌리자는 제안이 아니라, **알고 있다는 것을 적어 둔다.** 앱 아이콘 · 스플래시의
마크는 `#371B34` 그대로다(`spec/tokens.json` `symbol.appIcon`).

**피그마에 표본이 없어 SEED를 그대로 둔 것:** `text.disabled`(비활성 상태를 그린 화면이
없다) · `text.ink2`(사이 단계가 안 나온다). 최상위 규칙 3번이 지키는 자리다.

### 2026-09-15 — 장부를 연다

- 규칙 다섯을 `CLAUDE.md` 맨 위 · `docs/session-prompt.md` · `docs/codex-handoff.md`
  세 곳에 적었다.
- 색은 SEED에서 뽑아 쓰도록 바꿨다(`scripts/sync-seed-tokens.mjs` · `spec/seed-tokens.json` ·
  `spec/seed-map.json`). `seed-parity.test.ts`와 CI의 `--check`가 지킨다.
- **아직 안 잰 것**: 1번의 픽셀 대조(전담 세션 `claude/figma-pixel-parity` 진행 중) ·
  라운드 토큰(피그마 카드 16px, 우리 10px) · 2·3·4·5번 전수.
