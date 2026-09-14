# 개편 전(Before) 기준선 — 2026-09-14

`main`(개편 시작 전) 기준. `node scripts/screenshot-screens.mjs`로 렌더해 찍었다.
`--build` 커밋: `main` `24ba645f04de9c8681b0acc70ed9fea22d53523f`(2026-09-13 14:44 KST).

## 찍은 화면 — 16 / 21

| 파일 | 화면 | 비고 |
| --- | --- | --- |
| `01-home.png` | 홈 | |
| `02-search.png` | 검색 | |
| `03-pick-list.png` | Pick 목록 | |
| `04-pick-compare.png` | Pick 비교 | 빈 상태(Pick한 곳 없음) |
| `05-wedding-plan.png` | 웨딩플랜 | |
| `06-wedding-calendar.png` | 웨딩플랜 · 전체 일정 | |
| `07-wedding-budget.png` | 웨딩플랜 · 예산현황 | `scripts/fixtures/api.cjs`에 지출 fixture 추가 후 찍음(아래 참고) |
| `08-my.png` | MY | |
| `11-vendor-detail.png` | 업체 상세 | **에러 화면**(아래 참고) — 실제 앱 동작 그대로 |
| `14-contract-cert.png` | 계약 인증(Pick 인증) | 「지출 넣고 인증하기」 화면. 지출 fixture 추가 후 찍음 |
| `15-login.png` | 로그인 | 토큰 없이(로그아웃 상태) 찍음 |
| `16-onboarding.png` | 온보딩 | |
| `17-withdrawal.png` | 회원탈퇴 | |
| `18-age-required.png` | 연령 확인(WP-AUTH-009 이용 불가 안내) | 로그아웃 상태로 찍음 |
| `19-policies.png` | 약관 진입(WP-MY-010) | |
| `20-spouse-connect.png` | 배우자 연결 | |

## 못 찍은 화면 — 5 / 21 (MASTER 확인 — 정상)

- **라운지 · 라운지 상세 · 상담 신청** — 이번 개편에서 새로 생기는 화면이고 서버가
  아직 없어 「조회만」으로 잠글 예정(MASTER 확인). before가 없는 게 정상이다.
- **후기 상세** — 별도 화면을 만들지 않기로 정해져 있다(MASTER 확인, 시안·코드 어디에도
  근거 없음). before가 없는 게 정상이다.
- **업체 상세(`11-vendor-detail.png`)는 찍었지만 에러 화면이다** — `GET /v1/vendors/:vendorId`
  fixture가 없어서다. 이건 「안 찍은 화면」이 아니라 「에러가 찍힌 화면」이다 — 목록에 남겨둔다.

## 고친 것 — 캡처 도구(`scripts/screenshot-screens.mjs`)의 버그 — 완료

`installFixtures()`가 `url.pathname.startsWith('/v1/')`로 fixture 응답 대상을 골랐는데,
`EXPO_PUBLIC_API_URL`을 `http://127.0.0.1:1/capture`로 주기 때문에 실제 요청 경로는
`/capture/v1/...`였다. `/v1/`로 시작하지 않으니 이 조건이 한 번도 참이 되지 않아 모든
`/v1/**` 요청이 fixture로 안 잡히고 진짜 네트워크(port 1, Chromium이 막는 unsafe port)로
나가 `net::ERR_UNSAFE_PORT`로 죽었다 — 무엇을 찍든 예외 없이 전면 오류(「연결이
불안정해요」)만 나왔다. **MASTER 승인으로 이 브랜치에서 고쳤다** — `url.pathname`에서
`/v1/`가 나오는 자리를 찾아 그 뒤만 잘라 매칭한다. `main` HEAD로 다시 빌드해 홈 화면을
찍어 실제 콘텐츠가 나오는 것으로 검증했다. 제품 코드(`apps/`·`packages/`)는 건드리지
않았다 — `scripts/screenshot-screens.mjs` 한 파일, 한 조건문만 고쳤다.

## 고친 것 — fixture 추가(MASTER 승인)

`GET /v1/weddings/:weddingId/events` · `.../tasks` · `.../expenses`가 `scripts/fixtures/api.cjs`에
없어 웨딩플랜의 「지출」 섹션·「예산현황 전체 보기」·「Pick 인증하기」 진입 버튼이 아예
안 그려졌다. 셋 다 추가했다(지출은 예산 400만원 · 결제 320만원 · 웨딩홀 계약금 한 줄 —
화면이 실제로 무엇을 보여주는지 알아볼 수 있게 값을 채웠다). `packages/api-contract/src/capture-fixtures.test.ts`에
계약 셋도 같이 추가하고 `npx jest --config packages/api-contract/jest.config.js --rootDir packages/api-contract capture-fixtures`로
통과 확인했다(`docs/screen-capture.md`가 요구하는 절차).

## 그 밖에 본 것(참고용) — 아직 안 고침

- `GET /v1/me/monthly-draw`, `GET /v1/me/reports`, `GET /v1/me/rewards`,
  `GET /v1/me/withdrawal`, `GET /v1/weddings/:id/invites` fixture도 없다 — 화면은
  대체로 graceful하게 빈 상태로 넘어간다(깨지지 않는다). 건드리지 않았다.
- 업체 상세(`GET /v1/vendors/:vendorId`)와 그 하위(conditions·images·reviews) fixture가
  전부 없어서 업체 상세는 「잠시 문제가 생겼어요 / 서버와 통신하지 못했습니다」로
  뜬다(`11-vendor-detail.png`). 검색 목록(`02`)에서 업체 카드 자체는 정상이다. 후기 상세를
  만들지 않기로 한 것과 별개로, 업체 상세 자체의 fixture는 아직 없다 — 필요해지면 추가한다.
