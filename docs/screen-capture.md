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
| `--design <파일>` | 시안도 찍어 나란히 붙인다 — **지금은 열리지 않는다**(아래) |

## PR에 붙인다

**찍은 PNG를 저장소에 커밋하지 않는다.** 이미지가 쌓이면 저장소가 부푼다. 기본 저장
자리가 저장소 밖인 것도 그래서다. PR에 넣을 때는 GitHub 본문에 끌어다 올린다.

본문에는 **무엇을 찍었는지**도 적는다 — 어느 경로를, 어느 커밋으로 만든 dist에서.
「찍었다」만 적힌 그림은 다음 사람이 다시 찍어야 한다.

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

## 시안 쪽은 왜 안 되는가

`--design`으로 `.dc.html`을 찍어 `[시안 | 실제]`로 붙이게 해 뒀지만 **지금 이
컨테이너에서는 열리지 않는다.** 정본인 `docs/design-handoff/root/`도, `current/html/`도
마찬가지다. 확인한 것은 이렇다.

| 없는 것 | `root/` | `current/html/` |
| --- | --- | --- |
| `support.js` · `image-slot.js` (템플릿을 그리는 실행기) | 없음 | 있음 |
| `_ds/seed-design-system-karrot-…/` (토큰 CSS 8 · 컴포넌트 CSS 6 · `_ds_bundle.js`) | 없음 | 없음 |
| React · ReactDOM · Babel | unpkg.com | unpkg.com |

앞의 둘은 전달 ZIP에서 빠졌고 저장소 어디에도 없다. 셋째는 `support.js`가 CDN에서
받아야 하는데 이 컨테이너의 프록시가 unpkg를 막는다(CONNECT 403). SRI가 걸려 있어
다른 파일로 바꿔치기할 수도 없다.

그래서 시안은 **빈 화면**으로 뜬다. `--design`은 그 사실과 못 받은 파일 목록을 적고
빈손으로 돌아간다 — **시안 파일을 고쳐 되살리지 않는다. `docs/design-handoff/`는
읽기 전용이다.**

`docs/design-handoff/current/png/`의 그림도 대신 쓸 수 없다. 이름만 PNG이고 실제로는
909×525 JPEG 한 장에 캔버스 전체가 들어 있다 — 화면 하나를 떼어 나란히 놓을 해상도가
아니다.

**둘 중 하나가 풀리면 시안 쪽도 된다.** `_ds/` 번들과 `support.js`를 저장소에
넣거나(대표님께 원본 ZIP의 그 폴더를 다시 받아야 한다), unpkg 대신 쓸 React·Babel을
저장소에 두거나. 어느 쪽이든 이 문서와 `--design` 안내를 같이 고친다.

그때까지는 **실제 화면만 찍고 시안은 사람이 연다.** 절반이라도 있는 것이 지금보다
낫다 — 지금은 아무도 화면을 본 적이 없다.

## 아는 한계

- **웹 export를 찍는다.** iOS · Android 네이티브가 아니다. 레이아웃 · 간격 · 색 · 문구는
  같은 코드에서 나오지만, 네이티브 전용 동작(안전 영역 · 키보드 · 네이티브 시트)은
  이 그림으로 판정하지 못한다.
- **한 화면만 찍는다.** 스크롤 아래는 `--full`로 본다.
- **움직임은 안 찍힌다.** 로딩 · 전환 · 모션은 멈춘 그림으로 판정하지 않는다.
