# 인계 — 업체 상세·이미지·후기·제보

**이 인계문을 쓰는 시점에 작업은 미완성이 아니라 완료 상태로 푸시돼 있다.** 「동결」 지시가
오기 전에 탭 넷 반영·검증·캡처까지 끝내고 이미 커밋·푸시한 뒤였다. 아래는 그 상태를
그대로 적은 것이지, 완성하려고 더 손댄 것이 아니다.

## 한 것

- `apps/mobile/src/app/(tabs)/search/[vendorId]/index.tsx` — 소개·가격·후기·정보 탭 넷으로
  재구성 완료(커밋 `d4f677b1`). 매핑은 `docs/rn-migration/VENDOR_SCREEN_PARITY.md`
  「탭 배치 — 실제 반영」 표에 이미 있다. 요약:
  - 탭 밖 상단 고정: identity(배지·업체명·핵심조건)
  - 소개: 추천 이유
  - 가격(Figma 원문 「패키지」에서 이름 바꿈 — 확인 필요): 실 제보 + 업체 안내(guidePrice) + 현재 혜택
  - 후기: 이용한 사람들의 경험 + 후기(업체 반론 인라인)
  - 정보: 공식정보(지역·확인일·지도·정보 오류 제보)
  - 탭 밖 하단 고정(footer): Pick + 비교. Primary는 Pick 하나만 — Figma의 상담예약 버튼은 안 가져옴
- `images.tsx`·`reviews.tsx`·`write-review.tsx`·`edit-review.tsx`·`price-report.tsx`·
  `fix-report.tsx`는 대조만 하고 코드는 안 건드림 — 전부 root 정본과 이미 일치.
- 캡처 인프라 결함 2건을 같이 고침(내 화면을 실제로 찍어 보려다 발견함):
  - `scripts/fixtures/api.cjs`에 업체 상세·이미지·조건·후기 fixture 자체가 없었다. 실제
    스키마대로 채워 추가하고 `packages/api-contract/src/capture-fixtures.test.ts`에 계약
    검증 4건 추가.
  - `scripts/screenshot-screens.mjs`의 더미 `EXPO_PUBLIC_API_URL`에 `/capture` 경로가 붙어
    있어서 `client.ts`의 문자열 접합 방식과 만나 모든 fetch 기반 화면의 캡처가
    `ERR_UNSAFE_PORT`로 막혀 있었다. `/capture` 경로를 뺐다.
- 검증: typecheck·lint·`node lint-copy.js`·jest(mobile 332/332 · api-contract 26/26) 전부
  초록. `scripts/screenshot-screens.mjs --build`로 탭 4개 전부 실제 렌더 확인(사용자에게
  스크린샷 전송함) — 새 팔레트(#E7898D)가 Pick 버튼·활성 탭·별점·스타일 칩에 반영됨.

## 하다 만 것

없음. 위 「한 것」이 이 브랜치에서 담당 화면에 대해 계획한 작업의 끝이다.

## 손도 못 댄 것

- `claude/rn-components` 병합 — `rn-tokens` 최신판 이전 기준이라 직접 머지하면 `theme.ts`·
  `spec/tokens.json`에서 충돌 난다(둘 다 토큰 세션 소유라 내가 충돌을 풀지 않고
  `merge --abort` 했음). 병합되면 `Card`·`SegmentedTabs` 같은 새 공용 컴포넌트로 지금의
  임시 탭바(직접 짠 `Pressable` 행)를 갈아 끼울 여지가 있음 — 지금 탭바는 새 컴포넌트
  없이 기존 원시 요소로만 짰다.
- `ContractVerify`(`FlowScreens.tsx` 124행) — 애초에 범위 밖(`claude/rn-nav-auth` 담당).

## 함정

- **`send()`의 URL 접합 버그를 화면 코드로 착각하지 마라.** `client.ts`가
  `${baseUrl}${path}`를 단순 문자열로 잇는다(URL 재해석 아님). 캡처용 `EXPO_PUBLIC_API_URL`에
  아주 짧은 경로 하나만 붙어도 fixture 매칭이 깨지고 포트 1로 나가 막힌다 — 화면이 잘못
  짜인 것처럼 보이지만 실은 캡처 설정 문제였다. 지금은 고쳐서 `http://127.0.0.1:1`(경로 없음)만
  쓴다.
- **캡처 인프라가 최근까지 실질적으로 고장 상태였다.** 위 두 결함(fixture 부재 + URL 버그)
  때문에, 이 수정 이전에 다른 세션이 「찍어서 확인했다」고 적은 보고가 있다면 실제로는
  fetch가 필요한 화면에서 에러 화면(「연결이 불안정해요」)을 찍었을 가능성이 있다. 합칠 때
  그 보고들을 재확인하는 편이 안전하다.
- **`(tabs)/vendor/`·`(tabs)/report/` 폴더는 없다.** MASTER가 한 번 지어냈던 경로다 — 실제
  화면은 전부 `(tabs)/search/[vendorId]/` 아래에 있다.
- **`계약 인증`은 오용어다.** 정본은 `Pick 인증`이다 — root `WP-RPT-제보·후기.dc.html` #12d
  (L294·L348)에서 실제로 확인함. Figma `ReviewDetailPage`(689행대)의 `계약 인증` 배지 표기를
  그대로 옮기면 안 됨.
- **상담 예약(`ConsultPage`/`BookingPage`)과 후기 상세(`ReviewDetailPage`)는 만들지 않기로
  했다** — 시안(root 36장·`spec/screens.json`)에도 서버 스키마에도 근거가 없어서다. 「서버에
  없어서 못 만드는 목록」이 `VENDOR_SCREEN_PARITY.md`에 있고, 대표님이 이 목록을 보고
  신규 여부를 갈라 정하실 예정이었다 — 합칠 때 그 결정이 이미 났는지 먼저 확인.

## 푸시 SHA

`claude/rn-screens-vendor` = `d4f677b1` (직전 커밋 `b2f60be3`는 대조표, `d4f677b1`가 탭 반영 +
캡처 인프라 수리). 이 브랜치에서 직접 머지·PR 생성 안 했다.
