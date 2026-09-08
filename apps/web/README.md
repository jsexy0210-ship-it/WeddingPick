# @weddingpick/web

웨딩픽의 정적 서비스 웹사이트입니다. 메인은 서비스 소개와 앱 출시 안내를 담당합니다.

```bash
npm ci
npm run typecheck --workspace @weddingpick/web
npm test --workspace @weddingpick/web -- --runInBand
npm run build --workspace @weddingpick/web
```

산출물은 `apps/web/dist/`에 생성됩니다. 클라이언트 프레임워크와 웹폰트는 사용하지 않습니다.

| 경로 | 역할 |
|---|---|
| `/` | 서비스 이해 → 찾기·비교·Pick → 일정 관리 → 출처 → FAQ → 출시 안내 |
| `/intro.html` | 서비스 소개 |
| `/faq.html` | 키보드로 열고 닫을 수 있는 질문·답변 |
| `/support.html` | 메일 앱을 통한 문의 안내 |
| `/terms.html`, `/privacy.html` | 약관과 개인정보처리방침 |
| `/search.html`, `/v/<id>.html` | API를 바탕으로 빌드하는 공개 업체 정보 |
| `/about.html` | 앱 정책에서 참조하는 기존 분석 안내 문서 |

## 수정 위치

- `src/landing.ts`: 메인 랜딩과 공개 페이지 공통 헤더·푸터
- `src/landing-v4.ts`: 기존 import 경로 호환용 내보내기
- `src/subpages.ts`: 소개·FAQ·고객지원·약관·개인정보처리방침
- `spec/strings.ko.json`의 `webLanding`: 랜딩 및 소개 페이지 문구
- `spec/tokens.json`의 `webLanding`: 랜딩의 반응형 크기와 시각 토큰
- `src/social-meta.ts`: 검색·공유 메타 정보

## 출시와 정보 표시

현재 앱은 출시 준비 상태로 안내합니다. 실제 스토어 링크가 없으므로 다운로드 버튼이나 QR을 표시하지 않습니다. 공개 후 실제 스토어 주소와 출시 문구를 함께 변경해야 합니다.

랜딩의 업체·금액·건수는 기능 설명용 예시이며 각 예시 옆에 표시합니다. 실제 업체 정보는 `site-data.ts`가 API에서 받습니다. 두 정보 경로를 섞지 않습니다.

공개된 업체 안내와 Pick 인증 자료의 차이, 금액 구간의 한계, 출시 시점에 안내할 요금을 구분합니다. 정해지지 않은 답변 시간이나 제공 기능을 약속하지 않습니다.

## 환경변수

| 변수 | 동작 |
|---|---|
| `WEDDINGPICK_CONTACT_EMAIL` | 실제 문의 주소. 없으면 문의 채널 준비 안내를 표시합니다. |
| `WEDDINGPICK_API_URL` | 검색·업체 정보의 빌드 시점 API. 없으면 실제 정보를 임의로 채우지 않습니다. |
| `WEDDINGPICK_WEB_VENDOR_IDS` | 미리 생성할 업체 상세 ID를 쉼표로 지정합니다. |

## 검증

웹 테스트는 출시 상태, 예시 표시, 공유 아이콘, 도메인 정보 규칙을 검증합니다. 공개 페이지 6종은 320·390·768·1024·1440px에서 가로 넘침, 기능 설명 순서, 내부 링크와 FAQ 키보드 조작을 브라우저로 확인합니다.

Render의 `weddingpick-web` 정적 서비스가 이 산출물을 배포합니다. 배포 요청 성공과 운영 화면 반영은 별도로 확인해야 합니다.
