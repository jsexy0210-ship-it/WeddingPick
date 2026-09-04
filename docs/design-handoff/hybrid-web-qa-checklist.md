# 하이브리드 웹뷰 QA 체크리스트

> 배경: `docs/AI_HANDOFF.md`의 "🔴 2026-09-04 정책 변경 — 하이브리드 웹뷰 전환" 참고.
> RN 화면(`apps/mobile/src/app/`)이 `expo export -p web`으로 빌드돼 네이티브 앱의
> WebView 안에서 그대로 보여진다. 이 화면들이 브라우저에서 정상 렌더링되는지 점검한다.

## 점검 방법

```
cd apps/mobile && npm run web
```

로 Expo 웹 dev 서버를 띄우고, 브라우저 창 폭을 모바일(~375px)부터 데스크톱(~1280px)까지
바꿔가며 화면을 직접 확인한다. 스크린샷만으로 판단하지 않는다 — 실제로 클릭·입력해본다.

## 점검 기준 (5개)

1. **반응형 레이아웃** — 가로 스크롤이 생기지 않는다. 모바일 폭에서 데스크톱 폭까지
   내용이 잘리거나 겹치지 않는다.
2. **터치 전용 인터랙션의 웹 대체** — 스와이프·롱프레스 등 터치 전용 제스처에 기대는
   기능이 마우스 클릭/키보드로도 동작한다(대체 UI 없이 막혀있지 않다).
3. **한글 텍스트 무결성** — 인코딩 깨짐, 줄바꿈 위치, 말줄임(ellipsis) 처리가 모바일
   앱과 동일하게 보인다.
4. **상태 완전성** — 로딩·에러·빈 상태가 각각 구현돼 있고 웹에서도 정상 표시된다
   (네이티브 전용 API를 쓰는 화면은 웹에서 조건부 대체 문구가 있어야 한다 — 예:
   `apps/mobile/src/features/search/vendor-map.tsx`의 `Platform.OS === 'web'` 처리 참고).
5. **디자인 토큰 준수** — 색·타이포·간격이 `packages/ui/src/theme.ts` /
   `packages/ui/src/tokens.css` 값을 그대로 쓴다. 하드코딩된 색상·픽셀값, Pick Mark
   변형, mock/demo API 호출이 없다.

## 문제를 찾으면

해당 RN 화면 소스(`apps/mobile/src/`)를 직접 고친다. `apps/web`(정적 랜딩 1장)은 이
전환과 무관하니 건드리지 않는다.

## 커밋 전 확인

- `npm run typecheck --workspace @weddingpick/mobile`
- `npx expo lint` (`apps/mobile`에서)
- 위 두 명령이 통과했을 때만 커밋한다.
