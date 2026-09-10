# WeddingPick | 웨딩픽

결혼 준비에 필요한 업체 정보와 견적·결제 제보를 비교하는 서비스다. 가격의 적정 여부를 대신 판정하지 않으며, 금액과 함께 구간·제보 건수·기준 기간을 제공한다.

## 작업 시작

1. [AI_START_HERE.md](AI_START_HERE.md): 사용자 지시와 문서의 적용 범위
2. [PROJECT_STATUS.md](PROJECT_STATUS.md): 확인 날짜·커밋이 있는 현재 상태와 미완료 검수
3. [docs/README.md](docs/README.md): 운영 정책·디자인 원본·검수 자료 색인

기준 저장소는 [`jsexy0210-ship-it/WeddingPick`](https://github.com/jsexy0210-ship-it/WeddingPick)이다. 코드가 존재하거나 CI가 통과했다는 사실만으로 화면·기능 완료를 선언하지 않는다.

## 구성

| 경로 | 역할 |
|---|---|
| `apps/mobile/` | Expo 앱, 앱 웹 및 `/admin` 관리자 화면. RN 셸과 하이브리드 전환 대상 |
| `apps/api/` | Fastify API, AI 분석·운영 작업 |
| `apps/web/` | 별도 서비스 웹사이트. 앱 하이브리드 전환 대상에서 제외 |
| `packages/api-contract/` | 앱·서버 공유 API 계약 |
| `packages/db/` | PostgreSQL 스키마·마이그레이션 |
| `packages/domain/`, `packages/ui/` | 공통 도메인 규칙·UI |
| `docs/` | 정책·전달 디자인·검수 기록 |

## 개발

Node.js 22 이상이 필요하다. 저장소 루트에서 실행한다.

```bash
npm ci
npm run mobile
npm run build --workspace @weddingpick/web
```

모바일 환경과 검사 명령은 [apps/mobile/README.md](apps/mobile/README.md)를 참고한다. 운영 DB에 테스트 데이터를 넣거나 초기화하지 않으며, DB 테스트는 분리된 폐기 가능한 환경에서 실행한다.

## 운영 주소

- 앱·관리자: [앱 웹](https://weddingpick-app-web.onrender.com), [관리자](https://weddingpick-app-web.onrender.com/admin)
- 웹사이트: [웨딩픽 웹사이트](https://weddingpick-web.onrender.com)
- API: `https://weddingpickl.onrender.com`

`weddingpick.kr`은 보유한 커스텀 도메인이지만 현재 사용하지 않는다. 폐기·삭제 대상으로 취급하지 않는다.
