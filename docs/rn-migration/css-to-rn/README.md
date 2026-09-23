# CSS → RN 자동 변환 결과 (2026-09-23)

`docs/design/html/*.dc.html` 안의 CSS 선언을 `css-to-react-native-transform` + 규칙 기반
2차 변환으로 RN 스타일 객체로 바꾼 결과다. 생성 스크립트는
`scripts/canon/convert-to-rn.mjs`.

```
node scripts/canon/convert-to-rn.mjs --app                       # 앱 화면 6개(이 폴더의 범위)
node scripts/canon/convert-to-rn.mjs --file "docs/design/html/<파일>.dc.html"
```

## 범위 — 앱 화면 6개만

**관리자·랜딩 사이트는 변환하지 않는다**(2026-09-23 대표 지시 — 「관리자, 랜딩 사이트는
변환 필요없다. 앱화면만 변환하면 된다」). `docs/design/README.md`의 "사용자 화면 (앱)"
표에 있는 6개만 다룬다:

```
대메뉴_홈(로그인, 온보딩).dc.html
대메뉴_검색.dc.html
대메뉴_Pick.dc.html
대메뉴_웨딩노트.dc.html
대메뉴_MY.dc.html
공통_다이얼로그 빈상태 로더.dc.html
```

관리자 2개·랜딩 2개·약관방침·전체IA·컴포넌트시트·사용자흐름·스토어이미지·디바이스대응
(웹/문서류 10개)은 대상이 아니다. 이전에 16개 전부 돌렸던 결과물은 지웠다.

## 이게 뭔지, 뭐가 아닌지

**하는 일**: 정본의 CSS 선언(`padding:4px 9px` 같은 것)을 RN `StyleSheet` 객체로
기계적으로 바꾼다. 값 변환만 한다.

**안 하는 일**:

1. **HTML 구조 → RN 컴포넌트 변환이 아니다.** `<div>`를 `<View>`로, `<span>`을 `<Text>`로
   바꾸는 것은 별도 작업이다. 이 폴더의 결과물은 스타일 값 사전이지, 화면 구현이 아니다.
2. **"변환됐다"가 "그대로 믿고 쓸 수 있다"의 동의어가 아니다.** 특히 그림자·중앙정렬·
   그라디언트 계산값은 사람이 화면에서 눈으로 한 번 봐야 한다(아래 "2차 변환" 참고).

## 결과: 1,692개 전부 해결(자동 1,692 = 완전변환, 그중 460개는 규칙으로 추가 해결)

| 파일 | 고유 선언 | 완전 변환 | 규칙 2차 변환 적용 |
|---|---|---|---|
| 대메뉴_홈(로그인, 온보딩) | 381 | 381 | 110 |
| 대메뉴_검색 | 293 | 293 | 76 |
| 대메뉴_Pick | 262 | 262 | 68 |
| 대메뉴_웨딩노트 | 253 | 253 | 62 |
| 대메뉴_MY | 234 | 234 | 56 |
| 공통_다이얼로그 빈상태 로더 | 269 | 269 | 68 |

"완전 변환"은 `css-to-react-native-transform`이 바로 처리했거나, 아래 규칙이 대신
풀어서 더 이상 `unconverted`/`webOnlyOrInvalid`에 남지 않은 것 둘 다 포함한다.
**"아직 열림"(`stillOpen`) 0개** — app 6개 화면 안에서는 사람이 값을 새로 지어내야
하는 항목이 남지 않았다. 단, 아래 규칙으로 푼 460개는 **값을 새로 계산해서 채운
것**이라 원본 CSS 그대로 복사한 게 아니다 — 실제 화면 검증이 더 필요하다.

## 파일 구조

파일당 하나(`_index.json`은 요약). `results[]`의 항목 하나가 정본에서 나온 **고유 CSS
선언 블록** 하나다(같은 선언이 여러 화면에 반복되면 한 번만 계산하고 `keyPaths`에 나온
자리를 전부 적는다).

```json
{
  "raw": "box-shadow:0 -8px 32px rgba(0,27,55,.16);...",
  "style": { "shadowColor": "rgb(0, 27, 55)", "shadowOffset": {"width":0,"height":-8}, "shadowOpacity":0.16, "shadowRadius":16, "elevation":16 },
  "webOnlyOrInvalid": {},
  "unconverted": [],
  "resolvedIdioms": [ { "kind": "BOX_SHADOW", "props": ["box-shadow"], "style": {...}, "componentNote": "iOS는 shadow*로 정확하고, Android elevation은..." } ],
  "keyPaths": ["cardSheet"],
  "occurrences": 1
}
```

- **`style`** — RN에 그대로 쓸 수 있는 값(자동 변환 + 규칙 변환 둘 다 여기 합쳐진다).
- **`resolvedIdioms`** — 아래 "2차 변환 규칙"이 적용된 항목. `style`이 있으면 스타일이고,
  없으면 `componentNote`만 있다(= 스타일이 아니라 컴포넌트 prop·구조로 처리해야 함).
- **`webOnlyOrInvalid` / `unconverted`** — 이 6개 파일에서는 전부 비었다.

## 2차 변환 규칙 — 무엇을, 어떻게 풀었나

CLAUDE.md 절차대로 **아무것도 지우거나 추측하지 않았다** — 아래는 전부 코드로 값을
계산한 결정적 규칙이고, 판단이 필요한 자리는 `componentNote`에 이유를 남겼다.

| 원본 패턴 | 규칙 | 예 |
|---|---|---|
| `box-shadow:inset 0 -1px 0 #eaebee` | 오프셋만 있고 blur·spread가 0이면 테두리로 정확히 옮긴다(이 코드베이스의 box-shadow 15개 고유값을 전수 확인한 결과, 전부 테두리·링 대용이었지 진짜 확산 그림자가 아니었다) | `borderBottomWidth:1, borderBottomColor:'#eaebee'` |
| `box-shadow:0 -8px 32px rgba(...)` | blur>0인 진짜 그림자는 iOS shadow*(정확) + Android elevation(색·오프셋 없는 근사치)으로 분리 | `shadowColor/shadowOffset/shadowOpacity/shadowRadius/elevation` |
| `box-shadow:inset 0 0 0 1.5px #ff6f61` | 오프셋 0·spread>0 = 사방 링 | `borderWidth:1.5, borderColor:'#ff6f61'` |
| `background:linear-gradient(...)` | 방향(to top/bottom/left/right)과 색상 정지점을 파싱해 `expo-linear-gradient`의 `<LinearGradient colors/locations/start/end>` props로 제시(각도(deg) 그라디언트는 좌표 자동계산 없이 `unconverted`로 남긴다 — 이번 6개엔 없었다) | `colors:["#fff","rgba(255,255,255,0)"], locations:[0.3,null]` |
| `white-space:nowrap;overflow:hidden;text-overflow:ellipsis` (세 개가 같이) | 스타일이 아니라 컴포넌트 prop | `<Text numberOfLines={1} ellipsizeMode="tail">` |
| `-webkit-line-clamp:N` (+ `-webkit-box-orient:vertical`) | 위와 같은 이유 | `<Text numberOfLines={N}>` |
| `transform:translate(-50%,-50%)` | 같은 선언 블록에 고정 px `width`/`height`가 있으면 `marginLeft/marginTop`으로 정확히 계산, 없으면 공식만 안내 | `marginLeft:-16, marginTop:-16` (width/height 32px 기준) |
| `white-space:nowrap` (단독) | RN Text는 기본이 줄바꿈이라 대응은 style이 아니라 `numberOfLines` | `<Text numberOfLines={1}>` |
| `cursor` / `box-sizing` / `overflow-x`·`-y` / `word-break` / `pointer-events` / `order` | 값과 무관하게 결론이 같은 것들 — RN에 없거나(cursor·box-sizing) 축별 제어가 없거나(overflow-x/y) 컴포넌트 레벨(pointer-events·order)이라 개별 `componentNote`로 안내 | — |
| `font-family:-apple-system,...` | RN `fontFamily`는 웹처럼 폴백 목록을 못 받는다 — 네이티브는 Pretendard 단일(`packages/ui/src/theme.ts`) | `fontFamily:'Pretendard'` |

## 이 결과를 실제 화면에 쓸 때

CLAUDE.md의 「화면 작업 절차 — 비교표 제출 전 수정 금지」가 그대로 적용된다. 이 JSON은
그 절차의 비교표에서 "정본 값" 칸을 채우는 재료이지, 표 자체를 대신하지 않는다.

**스타일 코드가 생성됐다는 이유만으로 작업을 완료 처리하지 않는다**(2026-09-23 대표
지시). 특히 아래 셋은 계산값이라 실기기·실화면에서 반드시 눈으로 확인한다:

- **Android `elevation`** — blur를 2로 나눈 근사치다. 정확한 색·방향 제어가 안 된다.
- **`marginLeft`/`marginTop` 중앙정렬** — 같은 블록의 `width`/`height`를 근거로 계산했다.
  그 값이 실제 컴포넌트의 렌더 크기와 같은지 확인한다(패딩·보더가 섞이면 어긋난다).
- **그라디언트 `locations`가 `null`인 자리** — 원본에 퍼센트가 없어 "균등 분배"를 뜻한다.
  `expo-linear-gradient`가 `null`을 그대로 받는지 버전별로 확인한다.

실제로 써먹으려면: 해당 WP-ID의 실제 RN 구현에 이 값을 넣고, 렌더해서
찍고(`scripts/screenshot-screens.mjs`), 정본 스크린샷과 나란히 대조한 뒤에만 "완료"라고
적는다.

## 원본 보존

`docs/design/`의 정본 파일은 이 스크립트가 읽기만 하고 절대 덮어쓰지 않는다. 재생성하고
싶으면 이 폴더를 지우고 `--app`을 다시 돌리면 된다.
