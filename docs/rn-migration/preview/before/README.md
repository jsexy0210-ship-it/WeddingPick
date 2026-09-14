# 개편 전(Before) 기준선 — 2026-09-14

`main`(개편 시작 전) 기준. `node scripts/screenshot-screens.mjs`로 렌더해 찍었다.
`--build` 커밋: `main` `24ba645f04de9c8681b0acc70ed9fea22d53523f`(2026-09-13 14:44 KST).

## 찍은 화면 — 14 / 21

| 파일 | 화면 | 비고 |
| --- | --- | --- |
| `01-home.png` | 홈 | |
| `02-search.png` | 검색 | |
| `03-pick-list.png` | Pick 목록 | |
| `04-pick-compare.png` | Pick 비교 | 빈 상태(Pick한 곳 없음) |
| `05-wedding-plan.png` | 웨딩플랜 | |
| `06-wedding-calendar.png` | 웨딩플랜 · 전체 일정 | `05`와 사실상 같음 — 아래 「못 찍은 화면」 참고 |
| `08-my.png` | MY | |
| `11-vendor-detail.png` | 업체 상세 | **에러 화면**(아래 참고) — 실제 앱 동작 그대로 |
| `15-login.png` | 로그인 | 토큰 없이(로그아웃 상태) 다시 찍음 |
| `16-onboarding.png` | 온보딩 | |
| `17-withdrawal.png` | 회원탈퇴 | |
| `18-age-required.png` | 연령 확인(WP-AUTH-009 이용 불가 안내) | 로그아웃 상태로 찍음 |
| `19-policies.png` | 약관 진입(WP-MY-010) | |
| `20-spouse-connect.png` | 배우자 연결 | |

## 못 찍은 화면 — 7 / 21

- **라운지 · 라운지 상세** — 저장소에 라운지 기능이 아예 없다. 라우트 · 컴포넌트 ·
  `docs/design-handoff/root/README.md`의 화면 목록 어디에도 「라운지」가 없다.
  개편에서 새로 생기는 화면으로 보인다 — 만들어 찍지 않았다.
- **상담 신청** — 위와 같다. 코드·핸드오프 어디에도 없다.
- **후기 상세** — 업체 상세에서 후기로 들어가는 경로(`/search/[vendorId]/reviews`)는
  있지만, `scripts/fixtures/api.cjs`에 `GET /v1/vendors/:vendorId/reviews`가 없어
  업체 상세부터 막힌다(아래 참고). fixture를 새로 추가하지 않았다 — 캡처 세션이 할 일이
  아니라고 판단했다.
- **웨딩플랜 · 예산현황 탭** — `GET /v1/weddings/:weddingId/expenses` fixture가 없어
  지출 카드 자체가 안 그려진다(빈 섹션 제목만 남음). 「예산현황 전체 보기」 버튼이
  없으니 탭으로도 못 들어간다.
- **계약 인증(Pick 인증)** — 코드를 보면 「지출 입력과 Pick 인증은 한 화면」
  (`apps/mobile/src/app/(tabs)/wedding/index.tsx` 주석, v3.22 SPEC 13.10)이라
  `/wedding/:id/expenses/add`로 간다. 그런데 그 진입 버튼(「Pick 인증하기」)도
  `data.expenses`가 있어야 그려지는데, 위와 같은 이유로 안 뜬다.

두 항목(예산현황·계약 인증)은 같은 원인 — `GET /v1/weddings/:weddingId/expenses`
fixture 없음 — 이다. events · tasks도 같이 없어서 웨딩플랜 화면(`05`)도 「다음 일정」
「지출」 섹션이 비어 있다(그 자체가 화면 상태이므로 그대로 찍었다).

## 치명적 발견 — 캡처 도구(`scripts/screenshot-screens.mjs`)의 버그

`installFixtures()`가 `url.pathname.startsWith('/v1/')`로 fixture 응답 대상을 고르는데,
`EXPO_PUBLIC_API_URL`을 `http://127.0.0.1:1/capture`로 주기 때문에 실제 요청 경로는
`/capture/v1/...`다. **`/v1/`로 시작하지 않으므로 이 조건이 한 번도 참이 되지 않는다.**
그 결과 모든 `/v1/**` 요청이 fixture로 가로채지지 않고 진짜 네트워크로 나가버리고,
port 1은 Chromium이 막는 「unsafe port」라 `net::ERR_UNSAFE_PORT`로 즉시 실패한다.
화면은 무엇을 찍든 예외 없이 전면 오류(「연결이 불안정해요」)만 보여준다 — 홈조차도.

재현: `main` HEAD에서 `node scripts/screenshot-screens.mjs` 그대로 실행하면 모든 화면이
이 전면 오류로 찍힌다. **PR #212 · #217이 실제로 스크린샷을 성공시켰던 적이 있다면,
그 뒤 어딘가에서 `url.pathname` 매칭 조건이 이렇게 바뀌었거나, 애초에 이 문제를
못 보고 넘겼을 가능성이 있다** — 지금 이 저장소·이 컨테이너에서는 100% 재현된다.

**고치는 법 (한 줄):** `url.pathname.startsWith('/v1/')` 대신 `/capture` 접두어를 벗기고
비교하거나(`url.pathname.replace(/^\/capture/, '')`), `url.pathname.indexOf('/v1/')`로
어디에 있든 찾아서 그 뒤를 잘라 쓴다. 이 캡처 세션은 제품 코드도 `scripts/`의 공유
도구도 고치지 않았다 — 스크래치패드에만 있는 별도 래퍼 스크립트로 우회해서 위
화면들을 찍었다. **`scripts/screenshot-screens.mjs` 자체를 고치는 건 승인받아야 한다** —
7개 개편 세션이 전부 이 도구로 After를 찍을 텐데, 지금 상태로는 전부 같은 전면
오류만 찍게 된다.

## 그 밖에 본 것(참고용)

- `GET /v1/me/monthly-draw`, `GET /v1/me/reports`, `GET /v1/me/rewards`,
  `GET /v1/me/withdrawal`, `GET /v1/weddings/:id/invites` fixture도 없다 — 화면은
  대체로 graceful하게 빈 상태로 넘어간다(깨지지 않는다).
- 업체 상세(`GET /v1/vendors/:vendorId`)와 그 하위(conditions·images·reviews) fixture가
  전부 없어서 업체 상세는 「잠시 문제가 생겼어요 / 서버와 통신하지 못했습니다」로
  뜬다. 검색 목록(`02`)에서 업체 카드 자체는 정상이다.
