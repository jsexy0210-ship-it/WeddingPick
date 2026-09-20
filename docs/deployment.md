# 배포 운영 기준

## 2026-09-18: Render 배포 경로 폐기

사용자 요청: Render 배포 관련 경로를 정리한다. 기준 소스는 `24627b0426a81749901508d1852d32c243677c0d`다. 과거 Render 운영 문서와 배포 절차는 당시 기록이며, 현재 배포 지시로 재사용하지 않는다. 이 문서는 배포 범위에서 그 절차를 대체한다.

**Render는 복구 대상이 아니다.** 2026-09-18 사용자 결정으로 Build Pipeline Minutes가 복구돼도 Render에서 다시 빌드·배포하지 않는다. 현재 남은 정적 서비스는 카카오 전환 검증이 끝날 때까지만 임시 공개본으로 취급한다. 서비스 삭제는 별도의 파괴적 변경이므로 전환 검증 뒤 승인받아 진행한다.

## 유효한 API 배포 경로

`main push / 수동 CI 실행 → CI / Deploy → CI 성공 → live API revision 대비 누적 변경 확인 → 필요 시 production 승인 → KakaoCloud API + worker`

- 호출자는 `.github/workflows/main.yml`, 배포 구현은 `.github/workflows/deploy-kakao-api.yml`이다.
- 카카오 VM의 `weddingpick-kakao` 러너를 사용한다. 집·사무실 PC는 일상 배포에 필요하지 않다.
- 운영 환경파일은 `/home/ubuntu/WeddingPick/.env.kakao-prod`에만 둔다. 출력·커밋·아티팩트 업로드를 하지 않는다.
- 대상 API는 `https://210.109.82.212`다. 도메인을 구매하거나 연결하는 작업은 포함하지 않는다.
- 기존 production 승인 규칙, main 제한, 후보 health 검사, 이전 컨테이너 복구를 유지한다.
- DB migration은 이 자동배포에 포함하지 않는다. `.github/workflows/db-migrate.yml` 수동 실행으로 분리돼 있다.
- 운영 API 컨테이너는 `RUN_WORKER_IN_API=false`를 명시적으로 강제하고, 같은 이미지의 별도 `weddingpick-worker`를 함께 갱신한다.
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

## 정적 사이트 전환 상태

| 서비스 | 현재 공개 상태 | Kakao 목표 |
| --- | --- | --- |
| 앱웹 | `https://210.109.82.212/` 공개 확인(#1006) | 443 유지 |
| 관리자 | `https://210.109.82.212/admin` 공개 | **443 고정. 별도 관리자 포트 사용 금지** |
| 웹사이트 | Render 임시 공개본 유지 | `https://210.109.82.212:9443` 외부 포트 허용 후 전환 |

Render 정적 서비스에는 새 변경을 배포하지 않는다. 관리자는 Kakao 443 `/admin`으로 고정됐다. 웹사이트만 Kakao 비표준 포트가 외부에서
열리기 전까지만 기존 공개본을 임시 유지한다. 앱웹은 2026-09-18 #1006에서 Kakao 443의 루트·
`/login`과 같은 origin의 `/health`·`/v1/auth/providers`를 외부 runner에서 확인했다.
OAuth redirect와 실제 로그인 완료는 별도 기능 검증으로 남긴다.

### 카카오 정적 후보 배포

`main.yml`은 앱웹·관리자·웹사이트 산출물을 한 번 빌드한 뒤 `kakao-static-sites`
아티팩트로 묶고, `stage-kakao-static.yml`이 카카오 VM의
`/home/ubuntu/WeddingPick/static-releases/<SHA>`에 후보로 올린다.

- 후보 전달은 **라이브 Nginx 설정을 바꾸지 않는다**.
- 앱과 관리자는 같은 export에서 역할별 산출물을 분리한다.
- 후보 HTML에 미완료 React Suspense 경계(`<!--$!-->`)가 있으면 스테이징을 실패시킨다.
- 웹 빌드는 Render 환경변수 대신 CI가 KakaoCloud API 주소와 공개 법적 고지 날짜를 명시한다.
- 공개 전환은 Nginx·인증서·OAuth redirect·CORS·정책 링크를 함께 검증한 뒤 별도 단계로 한다.


APK 수동 빌드와 health/OG 검사 기본 API 주소는 카카오로 변경한다. 기존 Naver callback `https://weddingpickl-sg.onrender.com/v1/auth/naver/callback`은 인증 제공자 등록값이므로 이 작업에서 바꾸지 않는다. Naver 로그인 사용 여부와 기존 사용자를 확인하기 전에는 그 callback만 보고 Render API를 종료하지 않는다.

## 콘솔에서 별도로 종료해야 하는 트리거

저장소 파일 삭제만으로 외부 콘솔 설정이 바뀌었다고 보고하지 않는다.

1. Render 각 서비스의 Settings에서 Auto-Deploy가 Off인지 확인한다. Blueprint 연결이 있다면 자동 동기화를 중지하거나 연결을 해제한다. 서비스 삭제를 선택하지 않는다.
2. 기존 배포 훅을 더 이상 쓰지 않는 외부 시스템이 있는지 확인하고 폐기한다. GitHub의 `RENDER_API_KEY`, `RENDER_WEB_DEPLOY_HOOK` 시크릿 및 API 서버에 남은 같은 변수는 사용처 확인 후 삭제한다. 새 CI는 이 값을 읽지 않는다.
3. GitHub의 과거 SHA로 이미 생성된 Render 배포 실행은 새 커밋으로 내용이 바뀌지 않는다. 불필요한 대기·진행 실행을 취소하고 과거 실패 건은 재실행하지 않는다. 이력의 빨간 표시를 삭제해서 성공으로 꾸미지 않는다.
4. 정적 사이트 최신 번들, 실제 로그인·업로드·기존 파일 조회, 데이터 이전, IP HTTPS 인증서 자동 갱신을 확인한다.
5. 워커 전환은 저장소 이관·파일 접근 확인 후 따로 진행한다. 현재 마지막 명시 설정은 `RUN_WORKER_IN_API=false`다. 특히 `RETENTION_MODE=automatic` 상태에서 워커를 켜면 파기 작업과 Gemini 호출이 함께 살아날 수 있으므로 런타임 값을 먼저 확인하고 승인 없이 활성화하지 않는다.
6. Object Storage 전체 이전은 NCP `weddingpick-test` → Kakao `weddingpick-prod-media` 방향이다. 카카오 버킷에 이관 이후 생성된 새 객체가 있을 수 있으므로 **`rclone sync`를 금지한다.** 무삭제 `copy --ignore-existing` 후 `check`·객체 수·용량을 대조한다. NCP 원본과 카카오 기존 객체를 삭제하지 않는다. 전체 이전은 NCP 요청·아웃바운드 비용이 생길 수 있어 실행 전 비용 범위를 확인한다.

요금 집계는 배포 키를 받지 않는다. NCP 요금 조회가 필요하면 `NCP_ACCESS_KEY` / `NCP_SECRET_KEY`를 별도로 설정한다. 카카오 S3 키를 NCP 비용 API에 전달하지 않는다.

## 검증 범위

로컬에서는 변경 YAML 파싱·셸 문법, 정책 회귀 시험, 수정 TypeScript/TSX 구문 및 격리된 라우트 시험을 확인한다. 의존성 설치와 전체 앱/API 타입·Jest 검증은 GitHub CI 결과로 확인한다. 실제 production 승인·러너 배포·화면 검증을 대신한 것으로 보고하지 않는다.
