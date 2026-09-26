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
| `--viewport WxH` | 창 크기. 기본은 경로를 보고 정한다 — 아래 |
| `--file <경로>` | 파일 · 카메라 입력이 열리면 이 파일을 넣는다 — OS 선택 창 뒤 화면(예산 추가 «자동 등록» 결과 · 상담 녹음 올리기)을 찍을 때. 열렸는지와 `accept` · `capture` 값을 같이 적는다 |
| `--storage 키=값` | 페이지가 뜨기 전에 localStorage에 심는다. 여러 번 줄 수 있다 — 아래 |

## 눌러야 나오는 화면

바텀시트 · 펼침처럼 **경로만으로는 닿지 않는 화면**이 있다. `--tap`이 찍기 전에 눌러 준다.
이름은 `accessibilityLabel`을 먼저 보고, 없으면 화면에 그대로 적힌 글자로 찾는다.

```bash
node scripts/screenshot-screens.mjs --route "/(tabs)/my/wedding-settings" --tap "예식일"
```

쳐야 나오는 화면(검색 시트)은 `--tap "fill:<입력칸 이름>=<글자>"`로 글자를 넣는다. 누르기와
섞어 준 순서대로 한다.

```bash
FIXTURE_SETUP_COMPLETE=false node scripts/screenshot-screens.mjs --route "/setup" \
  --tap "아직 정하지 않았어요" --tap "다음" --tap "지역 선택" --tap "확인" --tap "다음" \
  --tap "웨딩홀. 예식장 · 식대 · 대관" --tap "fill:업체 이름 검색=웨딩홀"
```

온보딩 «완료» 뒤 Pick 담은 곳까지 한 번에 찍으려면 같은 실행 안에서 끝까지 누른다 —
fixture는 `POST /v1/me/setup`에 보낸 업체를 **그 실행 안에서만** 기억한다. 5/5는
fixture 사용자에게 «도시적인»이 미리 골라져 있어 누르면 도리어 꺼진다(누르지 않는다).

```bash
FIXTURE_SETUP_COMPLETE=false node scripts/screenshot-screens.mjs --route "/setup" \
  --tap "아직 정하지 않았어요" --tap "다음" --tap "지역 선택" --tap "확인" --tap "다음" \
  --tap "웨딩홀. 예식장 · 식대 · 대관" --tap "fill:업체 이름 검색=강남" --tap "강남 A 웨딩홀" \
  --tap "다음" --tap "다음" --tap "다음" --tap "웨딩픽 시작하기" --tap "Pick"
```

직접 입력(목록에 없는 곳)은 검색어를 넣고 결과 아래 «직접 입력» 줄을 누른 뒤 «이 이름으로
정하기»를 누른다. fixture는 검색어를 보지 않고 카드 업종의 업체를 다 돌려주므로 «결과가
없을 때»는 fixture 업체가 없는 «본식» 카드로 찍는다.

```bash
FIXTURE_SETUP_COMPLETE=false node scripts/screenshot-screens.mjs --route "/setup" \
  --tap "아직 정하지 않았어요" --tap "다음" --tap "지역 선택" --tap "확인" --tap "다음" \
  --tap "웨딩홀. 예식장 · 식대 · 대관" --tap "fill:업체 이름 검색=우리동네 웨딩컨벤션" \
  --tap "직접 입력" --tap "이 이름으로 정하기"
```

**못 찾으면 멈춘다.** 조용히 넘어가지 않는 쪽으로 만들었다 — 「눌렀다고 치고」 찍은 그림은
안 찍은 것보다 나쁘다. 시트가 안 열린 화면을 시트라고 믿게 된다.

같은 화면이 여러 경로에 걸려 있으면 **닿는 쪽**으로 찍는다. 날짜 시트가 그 예다 —
`/setup`은 온보딩을 이미 마친 fixture 사용자라 홈으로 튕기고, `/(tabs)/my/wedding-settings`로
들어가면 같은 시트가 열린다.

## 기기에 적힌 상태로만 닿는 화면

온보딩 완료 요약(WP-AUTH-007)은 서버가 아니라 **기기에 적어 둔 다섯 답**이 있어야 선다.
`--storage`로 그 답을 심고, 온보딩을 안 마친 사용자(`FIXTURE_SETUP_COMPLETE=false`)로 찍는다.
다섯 답이 다 있으면 마지막 질문(5/5)이 열리므로 «다음»을 한 번 눌러 요약으로 간다.

```bash
FIXTURE_SETUP_COMPLETE=false node scripts/screenshot-screens.mjs --route "/setup" \
  --storage 'weddingpick.onboardingAnswers.v1={"date":{"value":null},"region":{"region":"서울","district":null},"prep":{"categories":[]},"budget":{"amount":null},"style":["URBAN"]}' \
  --tap "다음" --viewport 320x568
```

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

## 피그마 시안은 찍는다 — `scripts/screenshot-figma.mjs`

**2026-09-14에 뒤집혔다.** 대표님이 앱을 열어 보시고 「피그마랑 아예 다르다」고 하셨고,
그때까지 우리는 「시안은 못 찍는다」를 전제로 사람 눈에 대조를 맡기고 있었다. 그 전제가
`docs/design/handoff/`의 `.dc.html`에 대해서는 맞지만(아래) **피그마 저장소에는 틀리다** —
`docs/design/figma-export`는 그냥 도는 Vite 앱이라 빌드해서 찍힌다. 못 찍는 줄 알고 넘기는 동안
홈 · 검색 · Pick이 통째로 어긋나 있었다.

처음 한 번 받아서 빌드한다.

```
git clone --depth 1 https://github.com/jsexy0210-ship-it/docs/design/figma-export \
  /home/user/jsexy0210-ship-it/docs/design/figma-export
cd /home/user/jsexy0210-ship-it/docs/design/figma-export && npm install && npx vite build
```

그다음부터는 한 줄이다.

```
node scripts/screenshot-figma.mjs --out /tmp/figma
node scripts/screenshot-figma.mjs --route /search
```

**앱과 시안을 같은 폭으로 찍어 나란히 놓는다.** 피그마 셸이 `max-w-[430px]`이라 시안 쪽
기본이 430이다. 390으로 찍은 앱 화면과 나란히 놓으면 폭이 달라 **없는 차이가 보이고 있는
차이가 묻힌다.** 앱 쪽도 `--viewport 430x932`로 맞춰 찍는다.

## 핸드오프 `.dc.html`은 여전히 찍지 않는다

`docs/design/handoff/`의 `.dc.html`은 **이 도구가 찍지 않는다.** 자산이 저장소에
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

`docs/design/handoff/png/`도 대신 쓸 수 없다. 이름만 PNG이고 실제로는 909×525
JPEG 한 장에 캔버스 전체가 들어 있다 — 화면 하나를 떼어낼 해상도가 아니다.

## 아는 한계

- **웹 export를 찍는다.** iOS · Android 네이티브가 아니다. 레이아웃 · 간격 · 색 · 문구는
  같은 코드에서 나오지만, 네이티브 전용 동작(안전 영역 · 키보드 · 네이티브 시트)은
  이 그림으로 판정하지 못한다.
- **한 화면만 찍는다.** 스크롤 아래는 `--full`로 본다.
- **움직임은 안 찍힌다.** 로딩 · 전환 · 모션은 멈춘 그림으로 판정하지 않는다.
