# WeddingPick AI Handoff

## Source of Truth

1. 최신 GitHub `main`
2. Open PR / Issue
3. 최신 Actions
4. `docs/design/figma-export/`
5. `docs/design/handoff/`
6. 최신 운영 문서

과거 SHA·완료 보고보다 현재 GitHub 상태가 우선한다.

## 운영 주소

- 사용자 앱: `https://210.109.82.212/login`
- 관리자: `https://210.109.82.212/admin/login`
- API: `https://210.109.82.212/v1/*`
- Health: `https://210.109.82.212/health`

앱과 관리자는 같은 443 origin과 같은 static release SHA를 사용한다.

## 배포

`main` push만 운영 배포를 시작한다. CI 성공 후 정적 변경은 자동으로 Kakao VM에 stage되고 앱/관리자 443으로 cutover된다. 후보 SHA가 최신 main과 다르면 공개하지 않는다. 공개 검증 실패 시 직전 release로 rollback한다.

API는 같은 VM의 127.0.0.1:3001을 Nginx가 proxy한다. 운영 DB는 Neon, 운영 파일 저장소는 Kakao Object Storage를 기준으로 한다.

## 제품 규칙

- 등록·추가·작성은 원칙적으로 BottomSheet/공통 Overlay.
- Android Back에서 인증 사용자가 login/setup으로 역진입하지 않는다.
- root/no-history Back은 1회 토스트, 2회 앱 종료.
- 2Depth 이상 헤더는 공통 DepthHeader, subtitle 없음.
- 온보딩 취향 4종 모두 선택 가능.
- 앱 탭: 홈 / 검색 / Pick / 우리웨딩 / MY.
- 최신 디자인 정본은 `docs/design/figma-export/` + `docs/design/handoff/`.

## 보고

코드 반영 / CI 통과 / 후보 스테이징 / 운영 공개 / 실제 기능 검증을 구분해서 적는다.
