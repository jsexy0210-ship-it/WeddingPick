# 배포 운영 기준

## 2026-09-18: Render 배포 경로 폐기

사용자 요청: Render 배포 관련 경로를 정리한다. 기준 소스는 `24627b0426a81749901508d1852d32c243677c0d`다. 과거 Render 운영 문서와 배포 절차는 당시 기록이며, 현재 배포 지시로 재사용하지 않는다. 이 문서는 배포 범위에서 그 절차를 대체한다.

**저장소 정리와 외부 서비스 종료는 다른 작업이다.** 이 변경은 Render의 라이브 서비스, 결제, 버킷, DB, GitHub Secrets, 기존 실행 이력을 삭제하지 않는다. 카카오 배포 성공도 아직 검증하지 않은 정적 사이트·스토리지 이관 성공으로 간주하지 않는다.

## 유효한 API 배포 경로

`main push / 수동 CI 실행 → CI / Deploy → 동일 커밋 CI 성공 → production 승인 → KakaoCloud API`

- 호출자는 `.github/workflows/main.yml`, 배포 구현은 `.github/workflows/deploy-kakao-api.yml`이다.
- 카카오 VM의 `weddingpick-kakao` 러너를 사용한다. 집·사무실 PC는 일상 배포에 필요하지 않다.
- 운영 환경파일은 `/home/ubuntu/WeddingPick/.env.kakao-prod`에만 둔다. 출력·커밋·아티팩트 업로드를 하지 않는다.
- 대상 API는 `https://210.109.82.212`다. 도메인을 구매하거나 연결하는 작업은 포함하지 않는다.
- 기존 production 승인 규칙, main 제한, 후보 health 검사, 이전 컨테이너 복구를 유지한다.
- `RUN_WORKER_IN_API`, 운영 DB 스키마, 기존 Render API 상태는 이번 정리로 변경하지 않는다.
- 공개 저장소의 상주 self-hosted runner에는 잔여 보안 위험이 있다. PR·외부 브랜치 코드를 이 러너에 배정하지 않으며, 승인 규칙만으로 완전한 격리를 보장한다고 간주하지 않는다.

## 제거한 실행 진입점

| 종류 | 제거 경로 |
| --- | --- |
| 환경변수 동기화 | `.github/workflows/render-env-sync.yml`, `scripts/render-env-sync.py` |
| 수동 배포 | `.github/workflows/render-trigger-deploy.yml`, `scripts/render-trigger-deploy.py` |
| 이전 배포 상태 조회 | `.github/workflows/render-deploy-status.yml`, `scripts/render-deploy-status.py` |
| Render 깨우기 | `.github/workflows/keep-warm.yml`의 10분 주기 요청 |
| 폐기된 배포 시험 | `scripts/test-render-env-sync.py`, 기존 CI의 해당 시험 호출 |
| Blueprint 및 동기화 선언 | 루트 `render.yaml`, `infra/render-env.yml` |

삭제한 파일의 원문은 기준 커밋의 Git 이력에 남아 있다. 실행 가능한 사본을 별도 폴더에 다시 만들지 않는다.

`check-render-retired.mjs`가 활성 코드의 Render 배포 API·훅·시크릿 의존 및 이전 API 기본값 재유입을 검사한다. 설명 문서, 시험 fixture, 현재 정적 사이트 주소와 기존 Naver callback은 배포 진입점으로 취급하지 않는다.

## 관리자 설정 저장과 반영

- 링크 미리보기 설정 저장, 공개 조회, 이미지 업로드·삭제는 유지한다.
- 관리자 화면의 `저장 후 반영하기` 버튼과 배포 요청을 제거한다.
- 이전 번들이 `POST /v1/admin/site-meta/publish`를 호출하면 인증 후 `409 conflict`, `reason=deployment_retired`로 응답한다. 외부 배포 훅과 DB의 반영 요청 시각을 건드리지 않는다.
- 저장된 설정은 정적 사이트를 별도로 배포한 뒤 반영된다. 자동 반영·예상 소요시간·배포 성공을 안내하지 않는다.
- API 변경은 카카오 배포 후, 관리자 화면 변경은 관리자 정적 사이트의 새 번들 배포 후 실제 화면에 반영된다.

## 아직 서비스 중인 정적 사이트

| 서비스 | 유지할 공개 주소 | 별도 배포 시 필요한 API 환경변수 |
| --- | --- | --- |
| 앱웹 | `https://weddingpick-app-web.onrender.com` | `EXPO_PUBLIC_API_URL=https://210.109.82.212` |
| 관리자 | `https://weddingpick-admin.onrender.com` | `EXPO_PUBLIC_API_URL=https://210.109.82.212` |
| 웹사이트 | `https://weddingpick-web.onrender.com` | `WEDDINGPICK_API_URL=https://210.109.82.212` |

이 세 서비스의 주소·CORS·개인정보처리방침 링크를 일괄 제거하지 않는다. 기존 `EXPO_PUBLIC_WEB_URL`, OAuth client ID 및 법적 고지 환경변수도 그대로 보존한다. 현재 서비스 환경변수나 실제 라이브 번들이 위 표와 일치하는지는 콘솔·브라우저로 별도 확인해야 한다.

APK 수동 빌드와 health/OG 검사 기본 API 주소는 카카오로 변경한다. 기존 Naver callback `https://weddingpickl-sg.onrender.com/v1/auth/naver/callback`은 인증 제공자 등록값이므로 이 작업에서 바꾸지 않는다. Naver 로그인 사용 여부와 기존 사용자를 확인하기 전에는 그 callback만 보고 Render API를 종료하지 않는다.

## 콘솔에서 별도로 종료해야 하는 트리거

저장소 파일 삭제만으로 외부 콘솔 설정이 바뀌었다고 보고하지 않는다.

1. Render 각 서비스의 Settings에서 Auto-Deploy가 Off인지 확인한다. Blueprint 연결이 있다면 자동 동기화를 중지하거나 연결을 해제한다. 서비스 삭제를 선택하지 않는다.
2. 기존 배포 훅을 더 이상 쓰지 않는 외부 시스템이 있는지 확인하고 폐기한다. GitHub의 `RENDER_API_KEY`, `RENDER_WEB_DEPLOY_HOOK` 시크릿 및 API 서버에 남은 같은 변수는 사용처 확인 후 삭제한다. 새 CI는 이 값을 읽지 않는다.
3. GitHub의 과거 SHA로 이미 생성된 Render 배포 실행은 새 커밋으로 내용이 바뀌지 않는다. 불필요한 대기·진행 실행을 취소하고 과거 실패 건은 재실행하지 않는다. 이력의 빨간 표시를 삭제해서 성공으로 꾸미지 않는다.
4. 정적 사이트 최신 번들, 실제 로그인·업로드·기존 파일 조회, 데이터 이전, IP HTTPS 인증서 자동 갱신을 확인한다.
5. 워커 전환은 저장소 이관·파일 접근 확인 후 따로 진행한다. 이전 워커 중지 확인 후 새 워커를 활성화하여 중복 작업을 막는다. 새 워커 정상 확인 전에는 이전 서비스를 삭제하지 않는다.

요금 집계는 배포 키를 받지 않는다. NCP 요금 조회가 필요하면 `NCP_ACCESS_KEY` / `NCP_SECRET_KEY`를 별도로 설정한다. 카카오 S3 키를 NCP 비용 API에 전달하지 않는다.

## 검증 범위

로컬에서는 변경 YAML 파싱·셸 문법, 정책 회귀 시험, 수정 TypeScript/TSX 구문 및 격리된 라우트 시험을 확인한다. 의존성 설치와 전체 앱/API 타입·Jest 검증은 GitHub CI 결과로 확인한다. 실제 production 승인·러너 배포·화면 검증을 대신한 것으로 보고하지 않는다.
