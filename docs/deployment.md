# KakaoCloud 배포 운영 기준

## 운영 주소

| 대상 | 정본 주소 |
| --- | --- |
| 사용자 로그인 | `https://210.109.82.212/login` |
| 관리자 로그인 | `https://210.109.82.212/admin/login` |
| API | `https://210.109.82.212/v1/*` · `/health` |
| 웹사이트·약관 | 같은 443의 `/website.html` · `/privacy.html` · `/terms.html` |

공개 주소에 별도 포트를 붙이지 않는다. 앱·관리자·웹사이트·API는 KakaoCloud VM의
같은 HTTPS 443에서 경로로 나눈다.

## API 배포

`main push / 수동 CI 실행 → CI / Deploy → 검증 → 운영 revision 비교 → 필요 시 KakaoCloud API + worker 배포`

- 호출자는 `.github/workflows/main.yml`, 구현은 `.github/workflows/deploy-kakao-api.yml`이다.
- 카카오 VM의 `weddingpick-kakao` self-hosted runner를 사용한다.
- 운영 환경파일은 `/home/ubuntu/WeddingPick/.env.kakao-prod`에만 두며 출력·커밋·아티팩트 업로드를 금지한다.
- DB migration은 `.github/workflows/db-migrate.yml`의 별도 승인 작업이다.
- API와 worker는 같은 image revision을 쓰고 API 컨테이너는 `RUN_WORKER_IN_API=false`를 강제한다.
- PR이나 외부 브랜치 코드를 운영 self-hosted runner에서 실행하지 않는다.

## 정적 사이트 배포

`main.yml`이 앱·관리자·웹사이트를 한 번 빌드하고 `package-kakao-static.mjs`가 역할별
후보를 만든다. `stage-kakao-static.yml`은 후보를 VM의
`/home/ubuntu/WeddingPick/static-releases/<SHA>`에 올리지만 공개 설정은 바꾸지 않는다.

공개 전환은 `cutover-kakao-app-web.yml` 하나가 앱과 관리자를 같은 immutable release로
전환한다. 전환 검사는 다음을 모두 만족해야 한다.

- `/login`이 사용자 앱 HTML을 반환한다.
- `/admin/login`이 관리자 export와 같은 HTML을 반환하고 `/_expo/static/js/web/` 번들을 포함한다.
- 관리자 응답에 별도 포트나 이전 주소 안내문이 없다.
- `/health`의 `ok`와 `database`가 정상이고 `/v1/auth/providers`가 JSON을 반환한다.
- 외부 검증 실패 시 직전 Nginx 설정과 release marker로 자동 복구한다.

## 관리자 설정 반영

- 링크 미리보기 설정 저장·공개 조회·이미지 업로드·삭제는 API 기능으로 유지한다.
- 저장과 정적 배포는 분리한다. 저장 성공을 화면 배포 성공으로 안내하지 않는다.
- API 변경은 API 배포 후, 관리자 화면 변경은 새 정적 release 전환 후 실제 주소에서 확인한다.

## 파일 저장소

운영 파일은 KakaoCloud Object Storage `weddingpick-prod-media`를 사용한다. 이전 저장소에서
복사할 때는 기존 객체를 삭제하지 않는 `copy --ignore-existing` 방식으로 수행하고, 객체 수와
용량을 대조한다. `sync`처럼 대상 객체를 삭제할 수 있는 명령은 사용하지 않는다.

## 검증 범위

로컬에서는 변경 YAML 파싱·셸 문법·정책 회귀 시험·관련 TypeScript 시험을 먼저 확인한다.
운영 완료는 GitHub Actions 성공만으로 선언하지 않고 위 정본 주소의 응답 본문, API health,
실제 기능 동작을 각각 확인한다.
