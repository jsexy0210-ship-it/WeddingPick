# WeddingPick 프로젝트 상태

## 현재 운영 기준 — 2026-09-20

Source of Truth는 최신 GitHub `main`이다.

### 운영 주소

| 대상 | 주소 |
| --- | --- |
| 사용자 앱 | `https://210.109.82.212/login` |
| 관리자 | `https://210.109.82.212/admin/login` |
| API | `https://210.109.82.212/v1/*` |
| Health | `https://210.109.82.212/health` |

앱과 관리자는 같은 443 origin과 같은 immutable static release SHA를 사용한다. 관리자 별도 포트는 사용하지 않는다.

### 배포

- `main` push → CI → 정적 변경 빌드 → Kakao VM 후보 스테이징 → 앱/관리자 443 자동 cutover.
- 공개 검증 대상은 `/login`, `/admin/login`, `/health`, `/v1/auth/providers`다.
- 후보 SHA가 최신 main과 다르면 공개하지 않는다.
- 공개 검증 실패 시 직전 release/Nginx 설정으로 rollback한다.
- 코드 반영, CI 통과, 후보 스테이징, 화면 공개, 실제 로그인 검증은 각각 구분해서 보고한다.

### 제품·디자인

2026-09-20 병합된 UI 정리에는 로그인 로더, Android root Back 종료 흐름, 공통 DepthHeader, 온보딩 지역 전체값 제거, 취향 4개 선택, 중복 홈 로더 제거, 홈 비교 연결, 검색 헤더/정렬, Pick 탭 3개, 최초 예산 만원 단위 입력이 포함된다.

실기기 Android/iOS 인증·Back·overlay 회귀는 별도 QA 증거가 필요하다.

### 런타임

- 운영 API와 worker는 Kakao VM 기준으로 관리한다.
- 운영 DB는 Neon을 사용한다.
- 운영 파일 저장소는 Kakao Object Storage를 기준으로 한다.
- 앱 출시용 EAS production 빌드는 별도 출시 판단 범위다.
