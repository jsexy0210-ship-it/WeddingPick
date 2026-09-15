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

### 2026-09-15 — 장부를 연다

- 규칙 다섯을 `CLAUDE.md` 맨 위 · `docs/session-prompt.md` · `docs/codex-handoff.md`
  세 곳에 적었다.
- 색은 SEED에서 뽑아 쓰도록 바꿨다(`scripts/sync-seed-tokens.mjs` · `spec/seed-tokens.json` ·
  `spec/seed-map.json`). `seed-parity.test.ts`와 CI의 `--check`가 지킨다.
- **아직 안 잰 것**: 1번의 픽셀 대조(전담 세션 `claude/figma-pixel-parity` 진행 중) ·
  라운드 토큰(피그마 카드 16px, 우리 10px) · 2·3·4·5번 전수.
