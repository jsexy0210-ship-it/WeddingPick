# 443 cutover transaction verification — 2026-09-18

## 기준

- 이슈: #299
- 작업 브랜치: `chatgpt/cutover-transaction-verification-20260918-2`
- 착수 기준 main: `c4c8327bbb04624b26745b1e1013fddfb2724fc5`
- 운영 서버·운영 DB·production environment에는 접근하거나 쓰지 않았다.
- 기존 workflow/배포 스크립트는 수정하지 않았다.
- 새 자동 CI 트리거를 추가하지 않았다.

## 충돌 검사

착수 시 열린 PR의 변경 경로를 확인했다.

- #273: 모바일/디자인/API 일부
- #294: 관리자 법적 문서/웹 빌드
- #311: preview/probe workflow
- #312: 공개 후기 API
- #319: `.github/workflows/main.yml`

이 작업의 소유 경로인 아래 두 파일과 교집합은 0이다.

- `scripts/verification/cutover-transaction.test.mjs`
- `docs/sync/cutover-transaction-verification-2026-09-18.md`

`cutover`, `transaction`, `299`, `verification` 이름의 전용 작업 브랜치도 착수 시 없었다. Issue #299에 배정된 Copilot 세션은 GitHub AI Credits 부족으로 시작 실패한 상태였고 코드 산출물은 없었다.

## 코드 판정

### P1 — 앱웹 443 로컬 smoke 실패 시 내부 rollback trap이 덮어써진다

`scripts/install-kakao-app-web.sh`는 먼저 다음 실패 복구 trap을 등록한다.

```sh
trap rollback_on_error EXIT
```

그 뒤 임시 Nginx 파일을 만들고 아래 trap을 다시 등록한다.

```sh
trap 'rm -f "$tmp"' EXIT
```

Bash에서 같은 signal의 두 번째 `trap`은 앞 trap을 대체한다. 따라서 Nginx 설정 교체·reload 이후 `/health`, `/login`, `/v1/auth/providers` 로컬 smoke 중 실패하면 `rollback_on_error`가 실행되지 않는다.

외부 workflow도 이 구간을 보완하지 못한다. `.github/workflows/cutover-kakao-app-web.yml`의 rollback job 조건은:

```text
needs.cutover.result == 'success' && needs.verify.result != 'success'
```

이므로 install script 내부 smoke가 실패해 cutover job 자체가 실패하면 외부 rollback job은 실행되지 않는다.

영향: 실패 지점에 따라 기존 API-only 443 설정 대신 실패한 app-web Nginx 설정이 남을 수 있다.

### 최소 수정안 — 기존 인프라 담당 인계

기존 배포 스크립트는 이 작업 범위에서 직접 수정하지 않는다. 최소 수정 방향은 둘 중 하나다.

1. 단일 `EXIT` handler에서 임시파일 정리와 실패 rollback을 함께 처리한다.
2. 임시파일 정리는 `EXIT`가 아닌 별도 cleanup 호출로 바꾸고 `rollback_on_error EXIT`를 끝까지 유지한다.

핵심은 성공 직전의 `trap - EXIT`까지 실패 rollback handler가 살아 있어야 한다는 점이다.

## 신규 회귀 테스트

`scripts/verification/cutover-transaction.test.mjs`는 운영 서버 대신 임시 디렉터리와 command mock을 사용하되, 저장소의 실제 `install-kakao-app-web.sh` / `rollback-kakao-app-web.sh` 원문을 읽어 런타임 경로만 임시 경로로 치환해 실행한다.

검증 시나리오:

1. 후보 준비 실패: 기존 443 설정 불변.
2. `nginx -t` 실패: 백업으로 복구.
3. 로컬 public smoke 실패: 기존 443 설정으로 복구해야 함.
4. 이미 app-web 443 상태에서 재실행: 최초 API-only backup 유지.
5. 성공 후 EXIT: rollback 없이 app-web 설정 유지.
6. 명시적 rollback 2회: 같은 baseline으로 반복 복구.
7. cutover workflow: 내부 실패 rollback과 public verify 실패 rollback의 소유 조건 확인.
8. preview route workflow: 내부 failure rollback과 외부 verify rollback 분리 확인.

현재 코드에서는 **3번 테스트가 실패해야 정상적인 재현**이다. 이 실패를 skip/todo로 숨기지 않는다. 기존 인프라 담당이 trap 중복 등록을 수정하면 같은 테스트가 초록으로 바뀌어야 한다.

## 실행

이 채팅의 GitHub 연결은 저장소 읽기/쓰기와 PR 작업은 가능하지만 임의 shell command 실행 기능은 제공하지 않는다. 따라서 이 세션에서 `node --test`를 실행했다고 주장하지 않는다.

실행 명령:

```bash
node --test scripts/verification/cutover-transaction.test.mjs
```

예상 현행 결과:

- 7개 시나리오 통과
- `local public smoke failure restores the previous 443 config` 1개 실패
- 실패 원인: 두 번째 `EXIT` trap이 `rollback_on_error`를 대체

실제 실행 결과는 기존 인프라 담당 또는 명령 실행 가능한 검증 환경에서 확인해야 한다. 예상 결과와 다르면 실제 로그를 우선한다.

## 미검증

- 운영 VM의 실제 sudo/nginx/systemctl/docker 동작
- GitHub-hosted runner에서 실제 public 443 네트워크 장애를 주입한 rollback
- production environment 승인 흐름
- #311의 production gate 병합 이후 workflow 상태
- #319의 CI runner repair 순서 변경 이후 main 통합 상태

이 항목들은 이 PR에서 운영 실행으로 검증하지 않는다.
