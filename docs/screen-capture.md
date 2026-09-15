# 화면을 눈으로 보는 법

2026-09-11에 검색 화면이 시안과 전혀 다른 채로 배포됐다. 세션 셋이 그 화면을 고쳤는데
셋 다 **코드와 시안 HTML을 눈으로 대조했을 뿐**이라 「시안대로 맞췄다」는 보고가 계속
올라왔고, 대표님이 앱을 여실 때까지 아무도 몰랐다. PR 본문에도 그렇게 적혀 있었다 —
「앱에서 눈으로 본 것은 아니다. 이 세션에는 기기도 시뮬레이터도 없다」.

이 도구는 그 자리를 메운다. 컨테이너 안에서 화면을 **실제로 렌더해 PNG로 찍는다.**

## 한 줄

```bash
node scripts/screenshot-screens.mjs
```

`/(tabs)/search/`를 390×844로 찍어 임시 폴더에 넣고 그 경로를 적어 준다.
`apps/mobile/dist`가 없으면 먼저 만든다(몇 분 걸린다).

다른 화면:

```bash
node scripts/screenshot-screens.mjs --route "/(tabs)/pick/" --route "/(tabs)/(home)/"
```

고친 코드로 다시 찍을 때는 `--build`를 붙인다 — 안 붙이면 **지난번 dist를 찍는다.**

```bash
node scripts/screenshot-screens.mjs --build
```

| 옵션 | 하는 일 |
| --- | --- |
| `--route <경로>` | 찍을 화면. 여러 번 줄 수 있다. 기본값 `/(tabs)/search/` |
| `--out <폴더>` | 저장 자리. 기본값은 저장소 **밖**이다 |
| `--build` | dist를 새로 만든 뒤 찍는다 |
| `--full` | 스크롤 포함 전체. 기본은 한 화면(390×844) |
| `--wait <ms>` | 렌더를 기다리는 시간. 기본 1500 |
| `--tap <이름>` | 찍기 전에 누른다. 여러 번 줄 수 있고 준 순서대로 누른다 — 아래 |
| `--viewport WxH` | 창 크기. 기본은 경로를 보고 정한다 — 아래. **피그마와 나란히 놓을 때는 `430x932`** |

## 눌러야 나오는 화면

바텀시트 · 펼침처럼 **경로만으로는 닿지 않는 화면**이 있다. `--tap`이 찍기 전에 눌러 준다.
이름은 `accessibilityLabel`을 먼저 보고, 없으면 화면에 그대로 적힌 글자로 찾는다.

```bash
node scripts/screenshot-screens.mjs --route "/(tabs)/my/wedding-settings" --tap "예식일"
```

**못 찾으면 멈춘다.** 조용히 넘어가지 않는 쪽으로 만들었다 — 「눌렀다고 치고」 찍은 그림은
안 찍은 것보다 나쁘다. 시트가 안 열린 화면을 시트라고 믿게 된다.

같은 화면이 여러 경로에 걸려 있으면 **닿는 쪽**으로 찍는다. 날짜 시트가 그 예다 —
`/setup`은 온보딩을 이미 마친 fixture 사용자라 홈으로 튕기고, `/(tabs)/my/wedding-settings`로
들어가면 같은 시트가 열린다.

## PR에 붙인다

**찍은 PNG를 저장소에 커밋하지 않는다.** 이미지가 쌓이면 저장소가 부푼다. 기본 저장
자리가 저장소 밖인 것도 그래서다. PR에 넣을 때는 GitHub 본문에 끌어다 올린다.

본문에는 **무엇을 찍었는지**도 적는다 — 어느 경로를, 어느 커밋으로 만든 dist에서.
「찍었다」만 적힌 그림은 다음 사람이 다시 찍어야 한다.

## 관리자 화면은 크기가 다르다

관리자 콘솔의 기준 해상도는 **1920×1080**이고 앱은 390×844다(CLAUDE.md v3.27).
`--route`가 전부 `/admin/…`이면 자동으로 1920으로 찍고, 아니면 390이다. 섞어 찍으면
한쪽이 반드시 뭉개지므로 **관리자와 앱은 따로 돌린다.**

```bash
node scripts/screenshot-screens.mjs --route "/admin/ads-gate"        # 1920x1080
node scripts/screenshot-screens.mjs --route "/(tabs)/search/"        # 390x844
node scripts/screenshot-screens.mjs --route "/admin/x" --viewport 1440x900
```

앱 크기로 관리자를 찍으면 사이드바 240이 본문을 밀어 글자가 세로 한 줄로 선다.
그림은 나오지만 **화면을 봤다고 할 수 없는 그림**이 된다 — 실제로 한 번 그렇게
찍혔다(2026-09-11).

관리자는 토큰 자리도 다르다(`weddingpick.adminToken.v1`). 도구가 둘 다 심는다.

## 무엇이 가짜이고 무엇이 진짜인가

**진짜:** 화면 코드 전부. 레이아웃 · 간격 · 색 · 글자 · 라우팅 · 로그인 가드.

**가짜:** 서버 응답뿐이다. `scripts/fixtures/api.cjs`에 적어 둔 것으로 답한다.

- **운영 API로 나가지 않는다.** 브라우저 안에서 `/v1/**`를 전부 가로챈다. 그 밖의
  외부 주소도 막고, 무엇을 부르려 했는지 적어 준다.
- **로그인 가드를 끄지 않는다.** 제품 코드에 「캡처일 때는 통과」를 넣으면 그 구멍이
  운영에 나간다. 토큰(`weddingpick.sessionToken.v1`)을 기기 저장소에 심어 통과한다.

화면이 늘어 새 경로를 부르면 캡처가 이렇게 적는다.

```
fixture 없음 (scripts/fixtures/api.cjs에 더한다):
  GET /v1/weddings/:weddingId/tasks
```

그 파일에 한 줄 더하고, **`packages/api-contract/src/capture-fixtures.test.ts`에도
계약을 한 줄 더한다.** 경로에 `:이름`을 쓰면 그 칸은 무엇이든 맞는다.

### 「연결이 불안정해요」가 뜬다면

**fixture가 계약에 어긋났을 때도 똑같이 그 화면이 뜬다.** 앱은 둘을 구별하지 않는다 —
`apps/mobile/src/api/client.ts`가 zod 실패를 「서버 응답을 이해하지 못했습니다」 하나로
묶어 던지기 때문이다. 칸 하나가 빠진 것이 네트워크 문제로 보인다.

그래서 계약 검사를 시험으로 따로 뒀다. 먼저 이것부터 돌린다.

```bash
npx jest --config packages/api-contract/jest.config.js --rootDir packages/api-contract capture-fixtures
```

어느 칸이 어떻게 틀렸는지 zod가 그대로 말해 준다. `npm test`에도 같이 돈다.

## 피그마 시안은 찍는다 — `screenshot-figma.mjs`

**2026-09-15에 바뀐 것.** 아래 「`.dc.html`은 못 찍는다」는 그대로 맞지만, 그 전제를
**피그마 저장소에까지 넓혀 읽은 것이 틀렸다.** `weddingpick_figma`는 자산이 다 들어
있는 평범한 Vite + React 앱이라 빌드하면 찍힌다. 그 전제를 고치지 않은 채 2026-09-14까지
왔고, 대표님이 앱을 열어 보시고 「피그마랑 아예 다르잖아」라고 하실 때까지 **아무도 두
장을 나란히 놓은 적이 없었다.**

처음 한 번 준비한다.

```bash
git clone --depth 1 https://github.com/jsexy0210-ship-it/weddingpick_figma \
  /home/user/jsexy0210-ship-it/weddingpick_figma
cd /home/user/jsexy0210-ship-it/weddingpick_figma && npm install && npx vite build
```

찍는다. **폭을 앱과 맞춘다** — 기본값이 양쪽 다 430이라 그냥 두면 맞는다.

```bash
node scripts/screenshot-figma.mjs --out /tmp/figma --route "/" --route "/search"
node scripts/screenshot-screens.mjs --build --full --viewport 430x932 \
  --out /tmp/app --route "/(tabs)/" --route "/(tabs)/search/"
```

라우트 대조표는 `docs/rn-migration/RN_MIGRATION_MAP.md`에 있다.

**찍힌 것을 시안 값으로 믿지 않는다.** 피그마 저장소의 `src/app/components/`는 Figma
Make가 LLM으로 생성한 근사치(B등급)라 **구성·IA·흐름의 근거**이지 수치의 근거가
아니다. 자세한 등급은 `docs/rn-migration/FIGMA_SCREEN_INVENTORY.md` §1.

또 시안은 바깥 자산(unsplash 사진 · Google Fonts · jsDelivr)을 부르는데 도구가 전부
막는다 — 사진 자리는 회색으로 비고 **서체는 폴백으로 떨어진다.** 글자 모양을 이
그림으로 판정하지 않는다.

## 「연결이 불안정해요」만 찍히던 시절 — 2026-09-15에 고쳤다

**이 도구는 2026-09-15 전까지 모든 화면을 오류 화면으로 찍고 있었다.** 파일은
나왔으므로 실패로 보이지도 않았다.

까닭은 오리진이 둘이었던 것이다. 정적 서버는 `listen(0)`으로 아무 포트나 잡고
`EXPO_PUBLIC_API_URL`은 따로 `http://127.0.0.1:1`을 구웠다. 그러면

1. 포트 1은 크로뮴이 막는 well-known 포트라 `ERR_UNSAFE_PORT`로 **가로채기 전에** 끊기고,
2. 그 자리를 안전한 포트로 옮겨도 화면과 API의 오리진이 달라 **CORS 프리플라이트
   (OPTIONS)** 가 먼저 나가는데, playwright의 `page.route`는 프리플라이트를 못 가로챈다.

어느 쪽이든 fixtures가 답할 기회를 못 얻고 앱은 「연결이 불안정해요」를 그린다.

고친 방법은 **화면과 API를 같은 오리진에 두는 것**이다. 정적 서버를 고정 포트
`4317`에 앉히고 같은 주소를 굽는다(`CAPTURE_PORT`). 프리플라이트가 아예 없다.

`--build`에 `--clear`를 붙인 것도 같은 일의 일부다 — 메트로는 인라인된
`EXPO_PUBLIC_*` 값을 캐시 키에 넣지 않아, 주소를 고쳐도 **지난 번들을 그대로 다시
내놓는다.** 고친 줄을 보고 「고쳤다」고 적었는데 dist에는 옛 주소가 남아 있었다.

그래서 찍은 뒤에 **콘솔 오류 줄을 읽는다.** 거기 `ERR_UNSAFE_PORT`나
`ERR_CONNECTION_REFUSED`가 있으면 그림은 화면이 아니라 오류 화면이다.

## 핸드오프 `.dc.html` 시안은 찍지 않는다 — 사람이 옆에 놓고 본다

`docs/design-handoff/`의 `.dc.html`은 **이 도구가 찍지 않는다.** 자산이 저장소에
들어오지 않기 때문이다(2026-09-11 대표님 확인 — 용량 때문에 올릴 수 없다).

| 시안이 부르는 것 | `root/`(정본) | `current/html/` |
| --- | --- | --- |
| `support.js` · `image-slot.js` · `doc-page.js` (템플릿 실행기) | 없음 | 있음 |
| `_ds/seed-design-system-karrot-…/` (토큰 CSS 8 · 컴포넌트 CSS 6 · `_ds_bundle.js`) | 없음 | 없음 |
| React · ReactDOM · Babel | unpkg.com | unpkg.com |

그래서 브라우저로 열면 **빈 화면**이 뜬다. 스타일 없는 그림을 찍어 봐야 쓸모가 없다.
**자산을 구하러 다니지 마라. 시안 파일을 고쳐 열리게 만들지도 마라**(읽기 전용이다).

**대조는 사람이 한다.** 찍은 화면을 PR에 붙이면 사람이 시안을 옆에 놓고 본다. 오늘
사달의 원인은 시안을 못 봐서가 아니라 **아무도 앱 화면을 본 적이 없어서**다 — 앱 쪽
한 장이면 그 고리가 끊긴다.

**시안 HTML을 텍스트로 읽는 것은 된다.** 렌더는 안 되지만 마크업과 값(칩 목록 · 높이 ·
색 · 문구)은 그대로 읽힌다. 실제로 이 PR에서 `root/WP-SRCH-검색.dc.html`을 그렇게 읽어
찍은 화면과 대조했다.

`docs/design-handoff/current/png/`도 대신 쓸 수 없다. 이름만 PNG이고 실제로는 909×525
JPEG 한 장에 캔버스 전체가 들어 있다 — 화면 하나를 떼어낼 해상도가 아니다.

## 아는 한계

- **웹 export를 찍는다.** iOS · Android 네이티브가 아니다. 레이아웃 · 간격 · 색 · 문구는
  같은 코드에서 나오지만, 네이티브 전용 동작(안전 영역 · 키보드 · 네이티브 시트)은
  이 그림으로 판정하지 못한다.
- **한 화면만 찍는다.** 스크롤 아래는 `--full`로 본다.
- **움직임은 안 찍힌다.** 로딩 · 전환 · 모션은 멈춘 그림으로 판정하지 않는다.
