# 인계 — 홈·검색·Pick

MASTER의 「하나로 합친다」 지시(2026-09-14 14:47 발신 라우틴)로 이 세션은 여기서 멈춘다.
`claude/rn-screens-core`는 HEAD `bdcb2f88`까지 전부 커밋·푸시돼 있고, 이 문서를 더한 커밋이
마지막이다. **이 시점의 워킹 트리는 깨끗하다** — 얹을 미커밋 변경이 없다.

## 한 것

- `apps/mobile/src/app/(tabs)/index.tsx` — 홈 히어로를 카드 면(배경 `tint`) + D-day(`onTint`)
  구조로 교체. 코랄 다섯째 자리(D-day) 근거 주석 갱신.
- `apps/mobile/src/features/home/recommendation.tsx` — 비교 대상 있을 때 "비교하기" pill 추가.
- `apps/mobile/src/app/(tabs)/search/compare.tsx` — 세로 나열 → 고정 라벨열 + 가로 스크롤
  표(BEST 배지)로 재구성. "표를 쓰지 않는다" 옛 주석은 지우지 않고 반전 사유를 덧붙였다.
- `apps/mobile/src/app/(tabs)/search/index.tsx` — 결과 카드 세로 → 가로형(이미지 좌·정보 우),
  검색바 옆 필터 아이콘 버튼 추가.
- `apps/mobile/src/app/(tabs)/pick/index.tsx` — 헤더 "N개 저장" 배지(서브카피 없음), 가격 제보
  링크, 2곳 이상일 때 비교 배너(토큰색 `tintSubtle`, 검정 아님) 추가.
- `scripts/fixtures/api.cjs` + `packages/api-contract/src/capture-fixtures.test.ts` — 화면 캡처용
  fixture에 배우자 연결·후보 2곳·`GET /v1/vendors/compare` 응답을 더했다(계약 시험 통과).
- 위 화면 4장(홈 히어로·검색 카드·Pick 목록·Pick 비교표)을 `screenshot-screens.mjs`로 실제
  렌더해 확인. 홈 "비교하기" pill과 Pick 비교 배너는 fixture 자료 부족/스크롤 제약으로 캡처
  못 했고 코드 리뷰·typecheck로만 확인했다.
- PR #226 본문을 이번 변경 요약으로 갱신(멈추기 전 마지막 갱신 — 그 뒤 지시는 반영 안 됨).
- `origin/claude/rn-screens-core`(#225 브랜드 키컬러 2색·Pretendard, 다른 세션 작업)와
  `origin/main`(#227 피그마 분석 문서)을 순서대로 머지 — 충돌 없음, 머지 후 재검증 통과.
- 검증: `apps/mobile` typecheck·eslint(0 errors) 통과, `lint-copy.js` 금지어 0,
  `apps/mobile` jest 332/332, `packages/api-contract` capture-fixtures 10/10.

## 하다 만 것 — MASTER의 나중 답변(14:25 라우틴)이 있는데 아직 반영 안 함

이 세션이 앞서 올린 「판단 필요」 3건 중 다음 답이 이미 나왔다. **구현은 시작 안 했다** —
14:47 라우틴이 그 전에 도착해 멈췄다.

- **비교 최대 3 → 5 확정.** `packages/domain`의 `MAX_COMPARED_VENDORS`, `packages/api-contract`의
  `vendorComparisonResponseSchema.max()`, `apps/api/src/routes/vendors.ts:424`의 서버 하드
  리젝션, `spec/strings.ko.json`의 "2~3곳"/"3곳 비교" 카피, `apps/mobile`의
  `pick/compare.tsx`·`pick/[category].tsx` 로컬 `MAX_COMPARE = 3` 두 곳까지 **여섯 자리를 한
  PR에서 같이 고쳐야 한다.** 하나만 고치면 계약 시험이나 서버가 즉시 어긋난다.
- **Pick 비교 — 후보 선택 단계(`pick/compare.tsx`) 건너뛰기.** Pick 목록의 비교 배너 →
  바로 `search/compare.tsx` 표로 보낸다. **`pick/compare.tsx` 라우트 파일 자체는 지우지
  마라** — 먼저 그 경로를 부르는 자리가 딥링크·다른 화면에 남아 있는지 전수 확인부터.
  없으면 그때 삭제 여부를 대표님께 묻는다. 이번에는 동선(라우팅)만 바꾼다.
- **검색 필터는 바텀시트 유지, 피그마 인라인 패널은 쓰지 않는다.** 근거: 피그마 패널은
  B등급 웹 프로토타입 모양이고, 폰 화면에서는 조건 바꿀 때마다 결과가 밀려난다. 이미 있는
  `FilterSheet`를 그대로 쓴다. **단, 검색바 옆 필터 아이콘 버튼(승인 #10)은 이미 이 브랜치에
  구현돼 있다** — 그 버튼이 여는 대상만 시트로 두면 된다(현재 구현이 이미 그렇다. 인라인
  패널을 새로 만들지 않았으니 추가 작업 없음 — 확인만 필요).

## 손도 못 댄 것

없다. 승인받은 19개 판정 중 구현 가능한 항목은 이 브랜치에 전부 반영했다(위 "하다 만 것"의
세 건은 그 뒤 나온 추가 답변이라 별도).

## 함정

- **route 표기 실수** — 홈 탭은 `(tabs)/(home)/`가 아니라 `(tabs)/index.tsx` = 경로
  `/(tabs)/`다. `(home)` 그룹은 `feed`·`progress`·`top3`처럼 **다른** 화면들이다. 캡처할 때
  틀린 경로를 주면 `not found` PNG를 찍어 놓고 "화면이 비어 있다"로 오판하기 쉽다.
- **`screenshot-screens.mjs`의 `--full`은 RN Web `ScrollView` 내부 스크롤을 못 찍는다** — 그
  컴포넌트는 브라우저 문서 스크롤이 아니라 자체 overflow라, 화면 아래쪽(Pick 비교 배너 등)은
  뷰포트 안에 들어오는 카테고리 수를 줄이거나 다른 방법이 필요하다. `--tap`은 누르기만
  하고 스크롤은 못 한다.
- **`GET /v1/vendors/compare` fixture는 원래 없었다.** 추가할 때 `ids`가 빈 채로 불리는
  계약 시험 기본 호출(no-op searchParams) 대비 **기본값(웨딩홀 두 곳)을 넣어야** `vendors`
  최소 2 제약을 통과한다 — 빈 배열을 기본으로 두면 시험이 항상 빨개진다.
- **`search/[vendorId]/price-report.tsx`는 v3.24에서 폐기돼 `/capture/payment/consent`로
  리다이렉트만 하는 스텁이다.** "가격 제보 링크"를 이 경로로 걸면 한 번 더 리다이렉트를
  거친다 — 최종 목적지(`/capture/payment/consent`)로 바로 보내는 쪽이 맞다. 이 화면은 특정
  vendorId가 필요 없는 전역 진입(Pick 인증 동의)이다.
- **이 브랜치는 같은 시간대에 다른 세션(#225 브랜드색·Pretendard)이 같은 브랜치에 푸시하고
  있었다.** 로컬 HEAD가 원격보다 15커밋 뒤처진 채로 작업하고 있었던 것을 늦게 발견했다 —
  푸시 전에 `git fetch` + `git log HEAD..origin/<branch>`로 원격이 앞서 있는지부터 반드시
  확인해라. 이번엔 충돌 없이 머지됐지만 다음엔 아닐 수 있다.
- **MASTER의 14:25 라우틴과 14:47 라우틴이 큐에 동시에 밀려 있다가 한 번에 배달됐다** —
  이 세션은 그 사이 시간에 두 메시지를 못 보고 계속 일했다(그래서 위 "하다 만 것" 세 건이
  구현 없이 남았다). 알림은 쌓여서 오지, 실시간으로 오지 않을 수 있다는 뜻이다.
