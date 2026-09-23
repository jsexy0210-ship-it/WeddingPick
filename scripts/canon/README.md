# 정본 자동 대조 도구

2026-09-23 사고(웨딩노트 탭이 정본과 완전히 다른 스타일이었는데 아무도 못 잡음)의 원인은
"코드와 시안을 읽고 판단"이 실제로는 `.dc.html`의 `<script>` 안에 문자열 결합으로 박힌
값(`'flex:1;...' + (on.a ? '...' + INK : '...')`)을 손으로 안 풀어본 것이었다. 이 도구는
그 값을 **실행해서** 뽑는다 — 손으로 안 읽는다.

## 1. 정본 값 뽑기 — `extract-style.mjs`

`.dc.html`의 `renderVals()`는 순수 함수(this. 참조 없음)라 그대로 실행할 수 있다.

```bash
# 이 파일에 어떤 화면ID가 있는지부터 본다
node scripts/canon/extract-style.mjs --file "docs/design/html/대메뉴_웨딩노트.dc.html" --list-wp

# 그 화면ID가 실제로 참조하는 스타일을 전부 실행해서 뽑는다
node scripts/canon/extract-style.mjs --file "docs/design/html/대메뉴_웨딩노트.dc.html" --wp WP-NOTE-001

# 화면ID를 몰라도 키 이름만 알면 바로 뽑을 수 있다
node scripts/canon/extract-style.mjs --file "...dc.html" --key tabNav --json
```

`box-shadow:inset 0 -1px 0 #eaebee` 같은 값도 변수(`BORDER` 등)까지 전부 풀려서 나온다 —
더 이상 `INK`가 뭔지 파일 위쪽 스크롤해서 찾을 필요 없다.

## 2. 구현 값 뽑기 — `extract-rn-style.mjs`

구현 코드의 `StyleSheet.create({...})`도 마찬가지로 실행해서 뽑되, `Layout.cardPadding`
같은 토큰 참조는 `packages/ui`의 실제 값으로 자동 치환한다.

```bash
node scripts/canon/extract-rn-style.mjs \
  --file "apps/mobile/src/app/(tabs)/wedding/index.tsx" \
  --key tabs --key tab --key tabActive
```

`theme.text`처럼 런타임 훅 값(스킨·다크모드에 따라 바뀌는 색)은 자동으로 못 푼다 —
그런 키가 있으면 경고로 알려주니 `resolve-tokens.mjs --token Colors.light.text`로 따로 본다.

## 3. 토큰 조회 — `resolve-tokens.mjs`

`packages/ui/src/theme.ts`·`typography.ts`의 토큰을 단독으로 조회한다.

```bash
node scripts/canon/resolve-tokens.mjs --token Layout.cardPadding
node scripts/canon/resolve-tokens.mjs --group Spacing
node scripts/canon/resolve-tokens.mjs --all --json > /tmp/tokens.json
```

**이름이 같다고 값이 같지 않다.** `FontSize.tab`(12, 하단 루트 탭바 라벨)과
`LineHeight.tab`(16)은 둘 다 "tab"이라는 이름이지만 서로 다른 그룹의 서로 다른 값이고,
`ThemedText type="tab"`은 이 둘을 합쳐 **12px/700**을 만든다 — "16px일 것"이라고
추측하면 안 된다(2026-09-23에 실제로 이 착각으로 오류가 하나 났다 — 이 도구를 만드는
과정에서 스스로 잡았다). 확실하지 않으면 `resolve-tokens.mjs`로 직접 찍어봐라.

## 알려진 한계

- `--list-wp`/`--wp`는 `WP-XXX-000` 꼴만 화면ID로 본다. 관리자(`웨딩픽 관리자.dc.html`)와
  컴포넌트 시트는 이 패턴을 안 쓰거나(확인 필요), 본문 예시 데이터(광고 집행 표의
  `AD-052` 같은 값)에 비슷하게 생긴 문자열이 섞여 있어 넓게 잡으면 오탐이 난다. 이런
  파일은 `--wp` 대신 실제 스타일 키 이름을 알아내서(파일을 직접 한 번 읽어서) `--key`로
  바로 뽑는다.

## 이 도구가 «안» 하는 것

- 정본 값과 구현 값을 자동으로 "일치/불일치" 판정하지 않는다. `box-shadow:inset 0 -1px 0`이
  `borderBottomWidth:1`과 같은 뜻인지는 **사람이 판단한다** — CSS와 RN StyleSheet는 속성
  체계가 달라서, 기계적으로 같다/다르다를 판정하면 오히려 잘못된 확신을 준다.
- `ThemedText type="..."` 프리셋을 자동으로 못 찾는다(themed-text.tsx의 프리셋 맵은
  모듈 로컬이라 파일 밖에서 안 보인다) — `resolve-tokens.mjs`로 FontSize·LineHeight
  낱개를 찾아서 프리셋 정의(`packages/ui/src/themed-text.tsx`의 `styles` 객체)와
  직접 대조해라.
- 이 도구로 값을 뽑는 것 자체가 "대조 완료"가 아니다. CLAUDE.md의 "화면 작업 절차 —
  비교표 제출 전 수정 금지"에 따라 비교표에 값을 채우고, 실제 화면을 렌더해서
  스크린샷까지 찍어야 완료다.
