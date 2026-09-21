# 웨딩픽 · 현재 디자인 핸드오프

작업은 [상위 README](../README.md)에서 시작한다. 최신 사용자 지시·개선 범위는 [실행 핸드오프](../UX_UI_REFRESH_HANDOFF.md), 전수 검수는 [PAGE_STATE_AUDIT.md](../PAGE_STATE_AUDIT.md)를 따른다.

## 읽을 파일

| 파일 | 역할 |
| --- | --- |
| [SPEC.md](SPEC.md) | 현재 기능·상태·상호작용 명세 |
| [PROJECT_RULES.md](PROJECT_RULES.md) | 공통 디자인·심볼·용어 |
| [ADMIN.md](ADMIN.md) | 관리자 26개 명세 ID와 운영 UI |
| [IMAGES.md](IMAGES.md) | 온보딩·MY 공용 스타일 이미지 기준 |
| [tokens.json](tokens.json) | 디자인 수치 |
| [screens.json](screens.json) | 고유 ID 208개의 원본 화면 목록 |
| [html/](html/) · [png/](png/) | 원본 시안과 비교 이미지 |

`screens.json`의 선언 합계나 파일명에 적힌 옛 숫자로 범위를 판단하지 않는다. 실제 route·통합·제외 여부는 전수 대장과 최신 main에서 확인한다.

## 적용 기준

- Root 탭은 홈 · 검색 · Pick · 웨딩노트 · MY다. 새 탭명은 미확정이다.
- 카카오 단일 로그인, 시스템 서체, 코랄 `#FF6F61`, 좌우 여백 24가 현재 전달 기준이다.
- Pick Mark는 [PROJECT_RULES.md](PROJECT_RULES.md)의 두 path를 그대로 사용한다.
- 앱은 390×844, 관리자는 1920×1080을 기준으로 동일 상태의 정본과 실제 화면을 비교한다. WEB은 해당 시안 크기를 따른다.
- 섹션·필드가 비어도 정상 내용과 shell은 유지한다. 상태 원인·표시 범위·유효한 행동을 구분한다.
- HTML의 `support.js`·`image-slot.js`는 미리보기 도구다. 제품 코드에 복사하지 않는다.
- 원본 ZIP은 보존하고 활성 MD는 현재 규칙만 유지한다. 버전 이력은 Git에서 확인한다.
