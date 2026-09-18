# 피그마 픽셀 패리티 — 인수인계

작성 2026-09-15 09:40 KST · 브랜치 `claude/figma-pixel-parity` · PR **#235**(draft)
세션 모델이 Fable로 바뀌면서 끊겼다. **뒤를 잇는 세션이 같은 브랜치에서 이어 받는다.**

배정 원문의 목표: 대표님 지시 「피그마랑 아예 다르잖아」 「픽셀 단위로 토시 하나 틀리지
않고 똑같이 만들라」. 순서는 홈 → 검색 → Pick → 웨딩노트 → 업체상세 → 라운지·MY·온보딩·로그인
→ 탭바. **홈까지 갔고 홈 안에서도 둘만 끝냈다.**

---

## 1. 한 것

`claude/figma-integration`(MASTER · `17beaf9`)을 머지한 위에 올렸다. 그 브랜치가 이미
색(SEED) · 코랄 히어로 카드 · 5탭(홈 · 웨딩노트 · Pick · 라운지 · MY) · 검색바를 넣어 뒀다.
**아래 둘이 이 세션이 더한 것이다.**

### 1-1. 준비 현황 — 가로 4칸 칩 → 2×2 카드 격자

`apps/mobile/src/features/home/board.tsx`

| | 고치기 전 | 고친 뒤 |
| --- | --- | --- |
| 배치 | 한 줄 4칸(`flexDirection: row`) | **2×2**(`flexWrap` + `minWidth: 40%`) |
| 칸 안 | 업종명(13 회색) · 상태(16 굵게) | **아이콘 · 우상단 상태 표시** · 업종명(14 굵게) · 상태(13) |
| 위계 | 상태가 큼 | **업종명이 큼** |

근거는 AGENTS.md — 「WP-HOME-001 레이아웃 충돌은 전달 HTML·PNG 시각 디자인을 최종 기준으로
한다. **준비현황 2×2**, 추천 3열」. 시안(`Home.tsx` `PREP_STATUS`)도 같다.

위계를 뒤집은 까닭: 한 줄 네 칸이던 시절에는 칸 폭이 90 남짓이라 상태를 크게 적어야 멀리서
읽혔다. 2×2로 넓어져 그 이유가 없어졌고, 시안도 업종명이 굵다.

**축은 안 건드렸다** — 라벨은 업종명 · 값은 상태(SPEC §13.8). `boardValue`의 말(완료 / N곳 /
먼저 / 시작 전)과 `state.test.ts`는 그대로다. 바뀐 것은 굵기·크기·배치뿐이다.

### 1-2. 카테고리 3×2 격자 — 새 섹션

`apps/mobile/src/features/home/category-grid.tsx`(새 파일) · `layout.ts` · `(tabs)/index.tsx`

시안에는 있는데 앱에 **섹션이 아예 없던** 자리다. 여섯 칸(웨딩홀 · 스튜디오 · 드레스 ·
메이크업 · 본식스냅 · 허니문), 누르면 `/search?category=…`로 간다.

`HomeSectionKey`에 `'category'`를 더했다. **기존 저장분 이행은 저절로 된다** —
`normalizeHomeLayout`이 처음 보는 키를 기본 순서 자리에 이어 붙인다(그 규칙을 지키는 시험이
이미 있었다). `layout.test.ts`의 하드코딩 배열 셋에 새 키를 넣었고, **규칙 자체는 그대로 뒀다.**

### 1-3. `seed-parity.test.ts` 한 줄

MASTER 브랜치의 `apps/api/src/test/seed-parity.test.ts`가 `path.split('.')` 결과를 그대로
색인에 써서 `noUncheckedIndexedAccess`에서 **TS2538로 깨진다.** 머지 탓이 아니라 **그 브랜치
단독으로도 같은 오류가 난다**(워크트리로 확인). 초록이라야 검수를 받으므로 고쳤다.
MASTER가 따로 고치고 계셨다면 이 커밋(`afa1f7e`)은 버려도 된다.

---

## 2. 하다 만 것 — 다음 한 걸음

### 2-1. 홈에 아직 남은 넷

**찍어서 확인한 것만 적는다.** 셋은 손대지 않은 것이 아니라 **일부러 멈춘 것**이다(§3).

| 자리 | 시안 | 지금 앱 | 다음 한 걸음 |
| --- | --- | --- | --- |
| 헤더 검색 아이콘 | 「웨딩픽」 + 검색 + 알림 | 알림만 | **대표님 확인 먼저**(§3 D-a) |
| 히어로 내용 | D-127 · 예식일·예식장 한 줄 · 참여자 아바타 2 · 우상단 더보기 | D-214 · 2줄 질문 · 진행바 `0 / 12` | **대표님 확인 먼저**(§3 D-b) |
| 웨딩픽 추천 | 부제 + 「비교하기」 알약 + 가로 스크롤 이미지 카드 | 코랄 라벨 + 조건 칩 + 빈 상태 + CTA | **대표님 확인 먼저**(§3 D-c) |
| 웨딩피드 | 「더보기」 + 가로 썸네일 카드 2장 | 「웨딩 정보」 섹션은 **있다**(fixture가 비어 안 보일 뿐) | **바로 할 수 있다** — `features/home/wedding-content.tsx`를 시안 카드 모양(썸네일 80 좌 · 분류/제목/메타 · 우측 chevron)으로. fixture에 `GET /v1/wedding-info`를 채워야 눈으로 보인다 |

### 2-2. 손도 안 댄 화면

검색 · Pick · 웨딩노트 · MY · 업체상세 · 라운지 · 온보딩 · 로그인 · 탭바 **전부.**
시안·앱 양쪽 캡처만 떠 봤고 대조·수정을 하지 않았다.

다음 세션은 **검색부터** 하면 된다. 시안 `/search`는 찍어 뒀고 눈으로 확인했다 — 뒤로가기 +
「업체 탐색」 제목 + 부제 + 검색 입력 + 필터 버튼 + 칩 4개(카테고리 · 서울 · 가격 · 인기순) +
「7개 업체」 + 카드 목록(좌측 썸네일 · 분류 · 이름 · 위치 · 해시태그 · 금액 · 별점 · 저장수).
**제목의 「탐색」은 금지어다** — §3 C-1.

### 2-3. 라운드 토큰 — MASTER가 「당신 몫」이라 했지만 안 했다

`spec/tokens.json` `radius`에는 `card: 10`뿐이고 피그마 실효값은 `rounded-2xl`=16 ·
`rounded-lg`=18 · `rounded-xl`=22다. **박아 넣기 전에 §4 함정 T-3을 반드시 읽어라.**

---

## 3. 알아낸 것 — 피그마와 우리 규칙이 부딪히는 자리

**이게 제일 값진 부분이다.** 다시 알아내려면 같은 시간이 든다.

### 3-1. 판단 필요 — 골라서 밀면 안 되는 셋

> **D-a. 헤더 검색 아이콘.** AGENTS.md에 **「WP-HOME-001 메인 헤더 검색 버튼을 제거하고
> 알림만 유지한다」(2026-09-05 사용자 지시)** 가 명시돼 있다. 시안은 그 버튼을 되살린다.
> 뒤의 지시가 앞의 지시를 뒤집은 것인지, 시안이 그 결정을 모르고 그려진 것인지 파일만
> 봐서는 알 수 없다. **`WP-APP-020` 휠 3열과 똑같은 모양의 함정이다.**

> **D-b. 히어로의 진행바.** 시안 히어로에는 진행바가 없고 예식일 · 예식장 · 참여자 아바타가
> 있다. 그런데 CLAUDE.md의 **「코랄은 홈에서 다섯 곳 — 현재 업종 테두리 · 진행바 · 웨딩픽
> 추천 라벨 · CTA · D-day」** 가 진행바를 그 다섯 중 하나로 센다. 빼면 규칙이 넷이 된다.
> 더해서 **예식장 이름은 지금 `CurrentUser`에 없다** — 넣으려면 계약을 손대야 한다.

> **D-c. 웨딩픽 추천의 배치.** AGENTS.md는 「추천 **3열**」, 시안은 **가로 스크롤 카드**.
> 둘 다 사용자 확정 계열이라 우열을 정할 근거가 없다.

### 3-2. 판정 끝 — 시안이 지는 자리(그대로 밀지 마라)

| # | 시안 | 우리 정본 | 근거 |
| --- | --- | --- | --- |
| C-1 | 검색 제목 **「업체 탐색」** | **「탐색」은 금지어 → 「검색」** | CLAUDE.md 용어. `lint-copy.js`가 막는다 |
| C-2 | 준비현황 상세 **「아직 탐색 전」** | 「시작 전」 등 | 위와 같음 |
| C-3 | 이모지 🏛️ 📷 👗 💄 ✈️ | **업종 아이콘 WP-ST-016** | AGENTS.md 「임의 이모지·유사 아이콘·스타일로 대체하지 않는다」. 이모지는 기기마다 그림이 다르다 |
| C-4 | 업종 「**스냅**」 | **본식스냅** | CLAUDE.md 2026-09-11 대표 지시(세어서 본식스냅 14 · 스냅 6). 칩 폭 때문에 줄인 표기다 |
| C-5 | `IconHeartRegular`/`Fill` | **Pick Mark**(하트 안 체크) | `tokens.json` `symbol.$rule` 「절대 변경 금지」 |
| C-6 | 좌우 여백 `px-5`(20) | **24 고정** | `spacing.gutter`. 시안 근거는 B등급 |
| C-7 | 임의 px 글자 크기 `text-[42px]` 등 | **8단계 스케일** | `typography.test.ts`가 저장소를 훑어 막는다 |
| C-8 | Tailwind 기본 그림자 16곳 | **그림자 거의 안 씀** | `elevation.$rule` — 구분은 inset 선과 배경 톤 |
| C-9 | 영문 eyebrow 13종(`VERIFIED PRICE RANGE` 등) | **걷어낸다** | `strings.ko.json`에 없는 임의 영문 + v3.18 용어 위반 |
| C-10 | 히어로 테마 팔레트 5색 전환 UI | **반영 안 함** | 시안 확인용 컨트롤이지 사용자 기능이 아니다 |

### 3-3. 시안에 있지만 만들지 **않는** 화면

`/vendor/:id/booking` · `/vendor/:id/consult`(상담 신청) — **이용약관 제3조 때문에 고지가
먼저다.** 시안만 읽고 「고지 후 구현 대기」로 둔다. 업체 예약 API 계약도 없다.
전역 후기 피드 · 후기 상세+댓글 · 웨딩노트 상담기록 탭도 같은 이유(API 계약 없음)로 범위 밖이다.
자세한 것은 `docs/rn-migration/RN_MIGRATION_MAP.md` §2.

---

## 4. 함정 — 여기서 넘어졌다

### T-1. 「시안은 못 찍는다」는 절반만 맞다 (해결됨)

`screenshot-screens.mjs` 머리말의 「시안은 찍지 않는다」는 `docs/design/handoff/`의
`.dc.html`에만 맞다(`_ds/`·`support.js`가 저장소에 안 들어온다). **피그마 저장소는 그냥 도는
Vite 앱이라 빌드하면 찍힌다.** 이 전제를 넓혀 읽은 채로 2026-09-14까지 왔다.

MASTER가 `scripts/screenshot-figma.mjs`를 이미 만들어 뒀다. **그것을 쓴다.**

### T-2. 캡처가 오류 화면만 찍고 있었다 — 그리고 내 진단은 틀렸다 (해결됨)

`screenshot-screens.mjs`가 **모든 화면을 「연결이 불안정해요」로 찍고 있었다.** PNG는 나오니
실패로 보이지도 않았다. CLAUDE.md가 「찍어서 붙인다」로 막으려던 자리가 그대로 뚫려 있었다.

**진단은 MASTER 판(`5875ff5`)이 맞다:** ① 포트 1이 크로뮴 차단 목록이라 `ERR_UNSAFE_PORT`로
가로채기 전에 끊긴다 ② base가 `/capture`로 끝나 pathname이 `/capture/v1/...`이 되고
`installFixtures`의 `startsWith('/v1/')`를 벗어나 실제 네트워크로 샌다.

**나는 이것을 CORS 프리플라이트로 잘못 짚었다.** 「화면과 API를 같은 오리진에 둔다」로 고쳤고
통하기는 했는데, 통한 까닭은 부수적으로 경로도 없앴기 때문이었다. 병합에서 내 변경 셋
(`screenshot-screens.mjs` · `screenshot-figma.mjs` · `docs/screen-capture.md`)을 **버리고 MASTER
판을 받았다.** 지금 브랜치에 있는 것은 MASTER 판이다.

> **다음 세션에게 남기는 것 하나.** **메트로는 인라인된 `EXPO_PUBLIC_*` 값을 캐시 키에 넣지
> 않는다.** 주소를 고쳐도 `--clear` 없이 다시 export하면 **지난 번들을 그대로 내놓는다.**
> 여기서 한 번 속았다 — 고친 줄을 보고 「고쳤다」고 적었는데 `dist`에는 옛 주소가 남아 있었다.
> 지금 판에는 `--clear`가 없으니 **캡처가 이상하면 이것부터 의심하라.**
>
> ```bash
> grep -o "127\.0\.0\.1:[0-9]*" apps/mobile/dist/_expo/static/js/web/*.js | sort -u
> ```

### T-3. 피그마의 radius 16px은 시안가가 아닐 수 있다

`FIGMA_DESIGN_SYSTEM.md` §3-1이 적었다 — **「피그마 저장소 자체에 결함이 있다.
`--radius-2xl`을 정의하지 않아서 가장 많이 쓰인 `rounded-2xl` 52곳이 Tailwind 기본값 16px로
떨어진다. 이는 `rounded-xl`(22px)보다 **작다** — 크기 순서가 뒤집혀 있다.」**

즉 **16은 누군가 고른 값이 아니라 정의 누락의 결과일 수 있다.** 같은 문서 §6이 「radius 18px
기준 채택 여부」를 대표 판단 대기로 올려 둔 것도 그래서다. MASTER 전달문은 16을 실효값으로
적었지만 그 결함은 언급하지 않았다. **박아 넣기 전에 확인하라.**

### T-4. 배정 프롬프트의 사실 셋이 저장소와 달랐다

배정 원문을 그대로 믿고 코드를 찾으면 헤맨다. 실측은 이렇다.

| 배정 원문 | 실제 |
| --- | --- |
| 「탭 원본은 `features/navigation/root-tabs.ts` 하나」 | **그 파일은 없다.** 탭은 `app/(tabs)/_layout.tsx` + `features/navigation/tab-bar.tsx` |
| 「온보딩은 세 질문. 원본은 `flow.ts` `QUESTION_STEPS`」 | `QUESTION_STEPS`는 **다섯**(예식일·지역·준비현황·예산·스타일) |
| 「`CHROMIUM_PATH=…`가 필요하다」 | **필요 없다.** playwright가 그냥 찾는다 |
| 「`scripts/screenshot-figma.mjs`를 만들어 뒀다」 | 그때는 **없었다**(지금은 MASTER가 만들어 둠) |

`CLAUDE.md` 2026-09-14 「화면의 정본은 피그마다」 항목도 main의 `CLAUDE.md`에서 **찾지 못했다.**
관련 판정은 `docs/rn-migration/` 문서 넷(#227)과 AGENTS.md를 근거로 삼았다.

### T-5. 시안 캡처의 서체·사진은 판정에 쓰면 안 된다

`screenshot-figma.mjs`가 바깥 요청(unsplash · fonts.googleapis.com · cdn.jsdelivr.net)을 막는다.
**사진 자리는 회색으로 비고 서체는 폴백으로 떨어진다.** 레이아웃·간격·크기는 그대로지만
**글자 모양을 이 그림으로 판정하지 마라.**

### T-6. `--full`이 스크롤 아래를 못 찍는다

RN 웹의 `ScrollView`는 높이가 고정이라 playwright의 `fullPage`가 늘어나지 않는다. 홈 전체를
보려면 **뷰포트를 키운다**: `--viewport 430x1700`. 폭은 **430으로 고정**한다(시안 셸이
`max-w-[430px]`). 390으로 찍어 나란히 놓으면 없는 차이가 보이고 있는 차이가 묻힌다.

---

## 5. 다시 찍는 법

```bash
# 시안 (처음 한 번만 clone + build)
git clone --depth 1 https://github.com/jsexy0210-ship-it/docs/design/figma-export \
  /home/user/jsexy0210-ship-it/docs/design/figma-export
cd /home/user/jsexy0210-ship-it/docs/design/figma-export && npm install && npx vite build
node scripts/screenshot-figma.mjs --out /tmp/figma

# 앱 — 폭을 맞추고, 홈처럼 긴 화면은 뷰포트를 키운다
node scripts/screenshot-screens.mjs --build --viewport 430x1700 \
  --out /tmp/app --route "/(tabs)/"
```

찍은 뒤 **콘솔 오류 줄을 읽어라.** `ERR_UNSAFE_PORT`나 `ERR_CONNECTION_REFUSED`가 있으면
그 그림은 화면이 아니라 오류 화면이다(T-2).

라우트 대조표는 `docs/rn-migration/RN_MIGRATION_MAP.md`.

---

## 6. 검증 상태 (마지막으로 돌린 것)

| 검사 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 (7 workspace) |
| `npm run lint` | **0 errors** (warning 3 — 전부 기존 것) |
| `npm test` | **948 passed** · 실패 0 |
| `node lint-copy.js apps/mobile/src packages` | 통과 — 금지어 없음 |

**빌드가 깨진 채로 넘기지 않았다.** 브랜치는 초록이다.

색 토큰은 **손대지 않았다** — `spec/tokens.json` `color` · `packages/ui/src/theme.ts` gray 램프
diff 0(MASTER 지시). 화면 코드에 hex를 직접 적은 곳도 없다.

---

# 두 번째 세션 — 2026-09-15 (검색부터 MY까지)

앞 세션의 인수인계를 그대로 받아 같은 브랜치 · 같은 PR(#235)에서 이었다. MASTER 브랜치
`claude/figma-integration`의 `7dfc4c7`(글자색)까지 머지했다(`seed-parity.test.ts` 충돌은 MASTER 판).

## 한 것 — 화면마다 앱과 시안을 430으로 찍어 대조하고 고쳤다

| 화면 | 커밋 | 요지 |
| --- | --- | --- |
| 검색 | `1d21a84` | 헤더(← + 「업체 검색」 + 부제) · 검색창 48/16 · 드롭다운 칩 넷 · 테두리 카드 · 필터 시트에 카테고리 그룹 |
| Pick | `487a313` | 진행바 + 업종 행 → 저장 업체 카드 목록 · 비교 배너 · 업종 칩 · 빈 상태 |
| 웨딩노트 | `cbbb62c` | 히어로 · 지출 상자 → 세 칸 탭(캘린더 · 상담기록 · 예산현황) + 패널 + FAB. 캡처 fixture에 일정 · 지출 |
| 업체 상세 | `216973f` | 틀만: 헤더 · 히어로 오버레이(svg 그라데이션) · 요약 줄 · 잉크 탭 · 소개 탭 · 하단 CTA. 정보 구조는 그대로 |
| MY · 라운지 · 로그인 · 온보딩 | (이 커밋) | MY 카드 섹션 · 라운지 헤더/세 칸 탭 · 로그인 카피 + 안내 카드 · 온보딩 진행 줄/질문 머리 |

토큰(전부 `$figmaNote`에 출처): `radius.cardLarge` 16 · `thumb` 18 · `hero` 22 · `panel` 26 · `callout` 28 ·
`size.searchField` 48 · `headerBack` 36 · `pickCircle` 28 · `iconField` 16 · `iconMicro` 12 · `thumbSearch` ·
`emptyMark` 64 · `iconEmpty` 32 · `heroVendor` 288 · `thumbPortfolio` 144 · `spacing.pickEmptyPaddingY` 80.
`ProductSymbol`에 arrowLeft · chevronDown · pin · link · chart · checkCircle · edit · trash · mic · file ·
lock · info · headset · signout · gift. `BackButton`은 꺾쇠 → ← 화살(피그마 세 화면 모두 ArrowLeft).

## 판단 필요 — PR #235 본문에 화면별로 적어 두었다

S-a 10~12px 글자(전부 micro 13) · S-b 카드 하트(Pick Mark 하트 path, 체크 없음) · P-a 「Pick하기」→「결정하기」 ·
W-a 우리둘 · 초대하기 카드 삭제 · V-a 하단 CTA(Primary = Pick, 정사각 = 비교; 상담은 고지 후 구현 대기) ·
L-a 로그인 카피를 피그마로 바꿈 · D-d radius 16(`--radius-2xl` 누락) · 온보딩 dock(이전/다음 두 단추 유지 ·
Primary는 키 컬러) · 탭 바 아이콘 24/라벨 12(피그마 20/10 — 기존 토큰 그대로).

## 안 한 것

- 홈의 나머지 넷(§2-1)은 그대로 「판단 필요」다 — D-a · D-b · D-c.
- 라운지 본문(후기 · 피드 · 카테고리 레일 · 글쓰기 FAB) · 후기 상세 · 예약 · 상담 신청 — 서버 계약 없음 / 고지 후 구현 대기.
- 로그인 · 온보딩은 캡처를 못 찍었다 — fixture 사용자가 로그인 상태라 `/login`은 홈으로, `/setup`은 홈으로 튕긴다.
  코드로만 맞춘 자리다. 찍으려면 `screenshot-screens.mjs`에 「토큰 없이 찍기」 옵션이 필요하다.
- 온보딩 보기 목록(예식일 휠 · 지역 아홉 · 스타일)은 대표 규칙이라 손대지 않았다. 질문 머리와 진행 줄만 피그마다.

---

# 세 번째 세션 — 2026-09-15 (규격서 방식 · 홈 · 로그인 · 온보딩 · 상담 예약)

같은 브랜치 · 같은 PR(#235). 이 세션 중에 MASTER 지시 셋이 왔고 방법이 바뀌었다.

1. **규격서대로만.** `docs/design/figma-export/<화면>.txt`(피그마를 브라우저에서 잰 노드 수)를 그대로 옮긴다 — 판단 없이.
   값은 여전히 토큰을 거친다(`spec/tokens.json` `$figmaNote` · `packages/ui` `FontSize.f*` · `LineHeight.lh*` ·
   `LetterSpacing.*`). 규격서와 다르게 둔 자리는 **근거를 적어야** 끝난 것이다.
2. **말만 정본, 나머지는 피그마.** 용어(업종 이름 · 지역 아홉 · Npay · 실 제보) · 금지어 · 주소(`/wedding` `/community`)만
   피그마를 이긴다. 예식일 휠 · 온보딩 세 질문 · 브랜드색 · 아이콘 모양은 더 이상 보호 대상이 아니다. 이모지는 이모지로,
   SEED 아이콘은 SEED로(`packages/ui/src/seed-icon.tsx` — `@seed-design/icon` 0.6.2 svg path 그대로). 우리 선 아이콘은
   피그마가 lucide를 쓴 자리에서만 쓴다. **탭 바의 Pick 자리는 보류** — Pick Mark 그대로.
3. **코랄 복귀 · 「고지가 먼저」 파기.** 상담 예약 · 예약 · 후기 상세를 만든다. 약관 반영이 필요하다고 PR에 한 줄 적는다.

## 한 것

| 화면 | 커밋 | 규격서 |
| --- | --- | --- |
| 검색 · Pick · 웨딩노트 · 업체 상세 · MY · 라운지 수 옮김 | `cb32313` | search · pick · our-wedding · vendor-1 · my · community |
| 홈 + 탭 바 | `16be46c` | home.txt — 헤더 · 히어로 · 준비현황(이모지) · 추천 가로 카드 · 카테고리 · 웨딩피드 · nav |
| 로그인 · 온보딩 | `e95bad8` | login.txt · onboarding.txt — 보기 65 줄 · 잉크 「다음」 · 머리 줄 + 막대 |
| 상담 예약 · 예약 · 후기 상세 · 업체 CTA | `d98cc95` | vendor-1-consult.txt · vendor-1-booking.txt · (후기 상세는 피그마 소스) |

캡처 도구: `--guest`(토큰 없이 — `/login`) · `FIXTURE_SETUP_COMPLETE=false`(`/setup`) · bootstrap fixture에 추천 3곳.

## 규격서와 다르게 둔 것 — 화면 파일 JSDoc과 PR #235 본문에 근거가 있다

토큰에 없는 색(만들지 않고 MASTER에 보고): 준비현황 picking 하늘색 `#F0F9FF` `#B8E6FE` `#0084D1` · 히어로 아바타 면
`#F7D2C4` `#C9DAEC` · 로그인 안내 카드 `#EE8888 6%` `#E4868D 15%` · 온보딩 고른 줄 `#E38E8E 7%` · 별 `amber-400`.
계약에 없는 값(그리지 않음): 추천 배지 「인기 · 신규」 · 별점 · 예식장 이름 · 웨딩피드 셋째 줄 · 상담 담당자 · 후기 사진 ·
좋아요 · 댓글. 우리 흐름에 없는 것: 온보딩 첫 질문 「나중에」 · 히어로 색 팔레트(더보기 단추는 잠가 둠).

## 안 한 것 · 다음 세션이 볼 것

- 라운지 본문(후기 피드 · 카테고리 레일 · 글쓰기) — 서버 계약 없음.
- 홈 편집의 「다음 준비」 항목은 켜도 그리지 않는다(규격서에 없는 섹션) — 항목을 지울지는 판단 필요.
- 업체 상세의 비교 정사각을 뺐다(규격서 [♡][상담 일정 잡기]) — 비교 진입은 Pick 탭 · 홈 「비교하기」.
- 스타일 3/3의 사진 타일(`style-grid.tsx`)과 PNG 4장은 **2026-09-15에 지웠다**(대표 지시 「안 쓰는건 싹다 삭제해」). 사진으로 되돌릴 일이 생기면 지운 커밋에서 꺼낸다.
