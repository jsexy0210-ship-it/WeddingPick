# CSS → RN 자동 변환 결과 (2026-09-23)

`docs/design/html/*.dc.html`(정본 16개) 안의 CSS 선언을 `css-to-react-native-transform`으로
실행해서 뽑은 RN 스타일 객체다. 생성 스크립트는 `scripts/canon/convert-to-rn.mjs`.

```
node scripts/canon/convert-to-rn.mjs --file "docs/design/html/<파일>.dc.html"
node scripts/canon/convert-to-rn.mjs --all
```

## 이게 뭔지, 뭐가 아닌지

**하는 일**: 정본의 CSS 선언(`padding:4px 9px` 같은 것)을 RN `StyleSheet` 객체
(`{paddingTop:4, paddingRight:9, ...}`)로 기계적으로 바꾼다. 값 변환만 한다.

**안 하는 일 — 두 가지를 착각하면 안 된다**:

1. **HTML 구조 → RN 컴포넌트 변환이 아니다.** `<div>`를 `<View>`로, `<span>`을 `<Text>`로
   바꾸는 것은 별도 작업이다(2026-09-23 대표 지시 — 「HTML 구조의 RN 컴포넌트 변환은
   별도로 수행한다」). 이 폴더의 결과물은 스타일 값 사전일 뿐, 화면 구현이 아니다.
2. **"변환 성공"이 "RN에서 그대로 쓸 수 있다"의 동의어가 아니다.** 아래 "왜 78%가
   자동으로 안 끝나는가"를 반드시 읽는다.

## 파일 구조

파일당 하나(`_index.json`은 전체 요약). 각 파일 안 `results[]`의 항목 하나가 정본에서
나온 **고유 CSS 선언 블록** 하나다(같은 선언이 여러 화면에 반복되면 한 번만 계산하고
`keyPaths`에 나온 자리를 전부 적는다 — 관리자 파일처럼 표 행이 수십 개 반복되는 파일에서
같은 계산을 수십 번 하지 않으려는 것이다).

```json
{
  "raw": "padding:4px 9px;border-radius:6px;...",   // 정본 원문
  "style": { "paddingTop": 4, "paddingRight": 9, "borderRadius": 6 },  // RN에 그대로 쓸 수 있는 것
  "webOnlyOrInvalid": { "cursor": "pointer" },        // 변환은 됐지만 RN 네이티브엔 없는 속성
  "unconverted": [ { "prop": "box-shadow", "error": "...", "alternative": "..." } ], // 변환 자체가 실패
  "keyPaths": ["headerBar", "cardRow[3].badge"],      // 정본 안에서 이 선언을 쓴 자리들
  "occurrences": 2
}
```

## 왜 78%가 자동으로 안 끝나는가

전체 3,118개 고유 선언 중 2,398개(76.9%)가 완전 변환됐다. 나머지 720개(23.1%)는 두
갈래로 갈린다:

- **`webOnlyOrInvalid`** — 라이브러리가 타입은 맞다고 승인했지만 RN 네이티브에 그 속성
  자체가 없다: `cursor` · `transition` · `outline` · `textOverflow` · `whiteSpace` ·
  `backdropFilter` · `WebkitLineClamp` 등. 웹 전용 화면(관리자·랜딩)이면 `react-native-web`
  타겟에서 실제로 동작할 수 있으니 버리지 말고, 네이티브 화면(앱 6종)이면 이 속성이
  하려던 일(줄바꿈 금지, 말줄임 등)을 다른 RN 방식으로 다시 구현해야 한다.
- **`unconverted`(`kind:"FAILED"`)** — 파싱 자체가 실패했다. 주로 `box-shadow`(다중값
  shorthand) · `linear-gradient`/`color-mix()`(CSS 함수) · `transform:translateX(-50%)`
  (퍼센트 단위 transform) · `calc()`. 각 항목의 `alternative`에 대체 구현 방법을 적어
  뒀다(예: box-shadow → `packages/ui/src/theme.ts`의 `Elevation` 토큰, 그라디언트 →
  `expo-linear-gradient`).
- **`unconverted`(`kind:"WARNED"`)** — 변환은 됐지만 라이브러리가 경고를 남긴 것
  (`-webkit-line-clamp`의 단위 경고 등). 숫자는 썼지만 그대로 믿지 말고 한 번 더 본다.

## 이 결과를 실제 화면에 쓸 때

CLAUDE.md의 「화면 작업 절차 — 비교표 제출 전 수정 금지」가 그대로 적용된다. 이 JSON은
그 절차의 비교표에서 "정본 값" 칸을 채우는 재료이지, 표 자체를 대신하지 않는다.

**스타일 코드가 생성됐다는 이유만으로 작업을 완료 처리하지 않는다**(2026-09-23 대표
지시). 실제로 써먹으려면: 해당 WP-ID의 실제 RN 구현에 이 `style` 값을 넣고, 렌더해서
찍고(`scripts/screenshot-screens.mjs`), 정본 스크린샷과 나란히 대조한 뒤에만 "완료"라고
적는다.

## 원본 보존

`docs/design/`의 정본 파일은 이 스크립트가 읽기만 하고 절대 덮어쓰지 않는다. 재생성하고
싶으면 이 폴더를 지우고 `--all`을 다시 돌리면 된다 — 이 폴더 자체가 파생 산출물이라
git 히스토리로 이전 버전을 추적한다.
