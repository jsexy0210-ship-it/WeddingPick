# design-sync 운영 메모

다음 동기화 때 다시 헤매지 않도록, 이 저장소에서 겪은 것들을 적어둔다.

## 이 저장소는 React Native다

`@weddingpick/ui`는 React Native 컴포넌트를 담고, 웹에서는 react-native-web으로
그려진다. 그래서 몇 가지가 보통의 웹 디자인 시스템과 다르다.

- `packages/ui/build.mjs`가 esbuild로 `react-native` → `react-native-web` alias를
  건다. `resolveExtensions`에서 `.web.*`가 먼저 와야 한다 — 안 그러면
  `use-color-scheme.web.ts` 대신 네이티브 파일이 잡히고, 일부 패키지의 깊은 경로
  import가 없는 파일로 remap되어 빌드가 깨진다.
- `packages/ui/package.json`의 조건부 exports가 핵심이다. `react-native` 조건은
  소스(`./src/index.ts`)를 주고(Metro가 직접 컴파일한다), `import` 조건은
  빌드된 `dist/index.mjs`를 준다(웹·디자인 번들용).

## 실행 명령

스크립트들이 인자 형태가 서로 다르다.

```
node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules node_modules --out ds-bundle
DS_CHROMIUM_PATH=/opt/pw-browsers/chromium node .ds-sync/package-capture.mjs --out ds-bundle [--components A,B]
DS_CHROMIUM_PATH=/opt/pw-browsers/chromium node .ds-sync/package-validate.mjs ds-bundle
```

- `package-validate.mjs`는 out 디렉터리를 **위치 인자로** 받는다(`--out` 아니다).
- `package-capture.mjs`는 `--config`를 모른다. 여러 컴포넌트는
  `--components A,B` 형태다.
- 이 환경의 Chromium은 `/opt/pw-browsers/chromium`에 있고 Playwright 기본 경로와
  다르다. `DS_CHROMIUM_PATH`로 넘기지 않으면 "Executable doesn't exist"로 죽는다.

## `[RENDER] root empty` 5건은 오탐이다 — 무시해도 된다

`package-validate.mjs`의 렌더 검사는 이렇게 판정한다.

```js
const roots = document.querySelectorAll('#root, [id^="r"]');
rootEmpty: !roots[0]?.innerHTML?.trim().length
```

react-native-web은 `<style id="react-native-stylesheet">`를 `<head>`에 넣는다.
이 요소가 `[id^="r"]`에 걸리고 문서 순서상 진짜 마운트(`r0`/`r1`/`r2`)보다
앞선다. 그래서 `roots[0]`은 늘 그 빈 `<style>` 태그이고, 카드가 멀쩡히
그려져도 "root empty"가 뜬다.

브라우저로 직접 확인한 결과(2026-08-28):

- `roots[0]` = `<style id="react-native-stylesheet">`, 부모 `HEAD`, innerHTML 길이 0
- 실제 마운트 `r0`(58자)·`r1`(19자)·`r2`(61자) 모두 내용이 차 있음
- `__dsCells` 채워짐, pageerror 없음

`package-capture.mjs`는 이 선택자를 쓰지 않으므로 영향이 없다. 채점은 캡처가
찍은 실제 시트로 하므로 근거가 온전하다. 업로드 전 게이트는
`--no-render-check`로 통과시키되, **캡처 시트 채점은 건너뛰지 말 것** — 그게
이 저장소에서 유일하게 믿을 수 있는 렌더 증거다.

## `[FONT_MISSING] "Apple SD Gothic Neo"`도 그대로 둔다

의도한 대체 글꼴이다. Pretendard가 안 실린 곳에서도 한글이 읽히도록 macOS/iOS의
시스템 한글 글꼴을 스택 뒤에 둔 것이고, 우리가 배포할 파일이 아니다. Pretendard
본체는 92개 @font-face로 실제 실려 나간다.

## 글꼴을 싣는 경로

`packages/ui/src/tokens.css`는 **Pretendard를 직접 부르지 않는다.** 이 파일은
디자인 번들로 그대로 복사되는데, 거기엔 node_modules가 없어 bare specifier가
풀리지 않기 때문이다. 대신 양쪽이 각자 싣는다.

- 앱: `apps/mobile/src/app/_layout.tsx`가 pretendard 패키지를 직접 가져온다
  (그래서 `apps/mobile`의 직접 의존성이다).
- 디자인 번들: `.design-sync/config.json`의 `extraFonts`.

`extraFonts` 경로는 **PKG_DIR 기준 상대경로**이고 PKG_DIR은
`node_modules/@weddingpick/ui`다. 그래서 `../../pretendard/...`가 맞다
(`../../node_modules/pretendard/...`는 틀리다).

## tokens.css 주석에 `@import '…'` 꼴을 쓰지 말 것

검사기가 주석을 가리지 않고 CSS 전체에서 import 문을 찾는다. 설명하려고 써둔
예시 문구가 실제 import로 잡혀 `[CSS_IMPORT_MISSING]`이 떴다. 말로 풀어 쓴다.

## 프리뷰 셀 이름은 PascalCase ASCII여야 한다

하버스가 `/^[A-Z]/.test(k)`로 export를 거른다. 한글 이름은 셀이 0개가 된다.

## 지운 것

- `ScreenPlaceholder` — 앱 어디에서도 쓰지 않는데다,
  `react-native-safe-area-context`의 `SafeAreaView`를 쓰면서 이 저장소엔
  `SafeAreaProvider`가 없어 렌더하면 반드시 터졌다("No safe area value
  available"). 디자인 에이전트에 넘기면 이 부품으로 만든 모든 디자인이 깨진다.
  같이 쓰이지 않게 된 `react-native-safe-area-context` peer/dev 의존성도 뺐다.

## 규약 검증 (2026-08-28)

`conventions.md`가 주장하는 이름 27개를 브라우저에서 실제 export에 대조했다.
`window.WeddingPickUI`의 13개 export, `Colors`의 13개 역할, `Spacing` 7개,
`Radius` 4개가 하나도 빠지거나 남지 않고 일치한다.

그 과정에서 공백을 하나 메웠다. `useTheme`이 export되는데 규약이 그것을 가르치지
않고 있었다. 우리 부품 다섯으로는 입력칸·구분선 같은 것을 그릴 수 없어 에이전트가
직접 그려야 하는데, `useTheme`을 모르면 hex 값을 지어낸다. 앱의 실제 코드
(`my/contact.tsx`의 TextInput)를 예시로 넣었다.

`--config` 없이 `package-build.mjs`만 돌리지 말 것. 규약은 빌드 때 README에
꿰매지므로, 드라이버(`resync.mjs`)로 돌려야 업로드할 빌드가 규약을 싣는다.

```
DS_CHROMIUM_PATH=/opt/pw-browsers/chromium node .ds-sync/resync.mjs \
  --config .design-sync/config.json --node-modules node_modules --out ds-bundle
```

## 아직 못 한 것

**업로드.** 이 세션에서 `DesignSync` 도구가 인가되지 않았다. 도구가 준 안내
그대로: 이 기기의 대화형 Claude Code 세션에서 `/design-login`을 한 번 실행하면
헤드리스·SDK 실행도 그 인가를 재사용한다. claude.ai/code라면 Claude Design의
'Send to Claude Code Web'을 쓰거나 프로젝트 파일을 직접 넘겨야 한다.
아직 프로젝트를 만들지 않았으므로 `config.json`에 `projectId`가 없다.
