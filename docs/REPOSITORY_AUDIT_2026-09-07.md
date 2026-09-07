# 저장소 이슈·리스크 점검 — 2026-09-07

> 최신성 정정: 이 문서는 로컬 b31c52e 기준이다. 이후 GitHub main 0a6e436을 조사한 `GITHUB_FULL_AUDIT_2026-09-07.md`가 최신 판정이다. 최신 main CI는 DB 포함 테스트 1,678개와 타입 검사를 통과했고, Render 관리자 중복 등 일부 항목은 수정됐다. 본문을 현재 GitHub 상태로 해석하지 말 것.

## 판단과 범위

**현재 체크아웃은 운영 출시 준비가 끝난 상태로 보기 어렵다.** 관리자 기능의 성공 응답과 실제 동작 사이에 차이가 있으며, 배포 구성·업로드 제한·워커 복구·테스트 DB 보호에 우선 조치가 필요하다.

- 기준 커밋: `b31c52e`. 원격: `jsexy0210-ship-it/WeddingPickl`.
- 추적 파일 751개인 npm 모노레포. API, 모바일, 웹, 도메인, 계약 스키마, DB, UI 패키지 구조를 확인했다.
- 현재 미커밋 마케팅 변경도 검토 범위에 포함했다. `.worktrees/` 내부의 다른 체크아웃은 이번 검토 대상이 아니다.
- 코드·설정 정적 검토, 로컬 타입 검사·린트·테스트·웹 빌드, 독립적인 HTTP 동작 재현을 수행했다. 모든 파일·화면·사용자 흐름의 완전 검증은 아니다.
- GitHub의 실제 Issues/PR/Actions 상태, Render 콘솔, 운영 DB·버킷 설정, 모바일 실기기, 실제 OAuth·AI 호출, 의존성 CVE 및 전체 Git 이력의 비밀값 유출 여부는 검증하지 않았다. 아래 배포 지적은 저장소 구성 기준이며 외부 설정으로 보완됐을 가능성은 별도 확인해야 한다.
- 애플리케이션 코드는 수정하지 않았다. 보고서 및 무시되는 로컬 빌드 산출물만 생성했다.

## 실행 결과

| 항목 | 결과 | 해석 |
|---|---|---|
| `npm run typecheck` | 실패 | 모바일 `confirm.tsx:91` TS2820. 다른 워크스페이스는 통과 |
| `npm run lint` | 통과, 경고 12개 | 실제 lint 스크립트는 모바일에만 존재. 최초 샌드박스 EPERM은 제한 밖 재실행으로 해소 |
| 루트 테스트, DATABASE_URL 제거 | 1,004 통과 / 623 건너뜀 | API 64, 모바일 57, 웹 48, 계약 13, 도메인 822 통과. API 544와 DB 79 미실행 |
| 웹 랜딩 빌드 | 통과 | API URL 없이 정적 빌드. 운영 데이터 연동 성공을 의미하지 않음 |
| PATCH preflight | 문제 재현 | 204이지만 Allow-Methods에 PATCH 없음 |
| 204 응답 JSON 파싱 | 문제 재현 | `Unexpected end of JSON input` |

DB 테스트는 스키마 삭제를 수행한다. 기존 DATABASE_URL을 사용하지 않고 테스트 프로세스에서 제거했다. 운영 데이터에 대한 테스트·마이그레이션은 수행하지 않았다.

## P1 — 출시 전에 해결할 문제

### 1. 긴급 중지 스위치가 실제 기능을 중지하지 않음

- 근거: `apps/api/src/routes/admin.ts:58`, `:798`, `:802`.
- 스위치는 모듈 전역 Map에 저장되고 PATCH는 이 값만 수정한다. 저장소에서 실제 AI·추천·검증 처리 경로가 이 Map을 확인하는 연결은 찾지 못했다.
- 운영자가 중지를 눌러도 실제 처리가 계속될 수 있다. 재시작하면 값이 초기화되고 여러 API 인스턴스끼리 상태도 다르다.
- 조치: 영속 설정과 실제 실행 관문을 연결하고, 변경 감사 기록을 남긴다. 중지 후 새 작업이 차단되는 통합 검증이 필요하다.

### 2. 관리자 쓰기 API들이 저장·실행 없이 성공을 반환

- 근거: `apps/api/src/routes/admin.ts:814` FAQ, `:965` 광고, `:979` 광고 게이트, `:998` 자동화, `:1020` 캠페인, `:1120` 정책 엔진, `:1133` 약관, `:1254` 가격 통계 재계산.
- 일부 POST는 randomUUID만 반환하고 PATCH/PUT/DELETE는 DB 변경 없이 204를 반환한다. 재계산은 큐에 넣지 않고 `{queued:true}`를 반환한다.
- 운영자가 저장·정책 변경·재계산이 끝났다고 믿게 된다. 매출과 일부 운영 지표도 고정값이라 측정값과 구분해야 한다.
- 조치: 실제 처리와 조회를 연결하거나 미지원 상태를 명시한다. 성공을 반환한다면 새로고침 후 결과와 감사 기록까지 일치해야 한다.

### 3. 문서 10MB 제한이 스토리지에서 강제되지 않음

- 근거: `apps/api/src/storage/s3.ts:36`, `apps/api/src/routes/documents.ts:14`, `apps/api/src/analysis/worker.ts:59`.
- `max-file-size`를 사용자 메타데이터로 붙일 뿐 크기를 제한하는 정책은 없다. documents의 MAX_FILE_SIZE 상수도 검증에 사용되지 않는다.
- 완료 API는 실제 객체 존재·크기 확인 없이 분석을 등록한다. 워커는 모든 페이지를 Promise.all로 전체 메모리에 읽는다. 큰 파일이나 다수 페이지로 메모리·저장 비용이 증가할 수 있다.
- 조치: 저장소가 지원하는 업로드 제한을 적용하고 완료 시 실제 크기·형식·존재를 검증한다. 전체 문서 용량과 다운로드 동시성도 제한한다.
- S3 사용자 메타데이터는 별도 크기 정책이 아니다. [AWS POST 문서](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/RESTObjectPOST.html), [크기 조건 문서](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sigv4-HTTPPOSTConstructPolicy.html). 실제 Ncloud 호환 기능은 적용 전에 확인해야 한다.

### 4. 저장소 배포 구성에 백그라운드 워커가 없음

- 근거: `render.yaml`, `Dockerfile:11`, `apps/api/package.json`, `apps/api/src/worker.ts`.
- Docker는 API start만 실행한다. Render 선언에는 `npm run worker`를 실행하는 서비스가 없다.
- 이 구성만 배포하면 업로드 후 분석, 원본 파기 관련 알림·자동 정리, 탈퇴 완료 처리, 일정 알림이 실행되지 않는다. `/health`의 DB SELECT 1은 이 문제를 감지하지 못한다.
- 조치: 별도 워커 서비스를 선언하고 최근 heartbeat·대기열 지연을 감시한다. 외부에서 수동 운영 중이라면 구성과 복구 절차를 저장소에 반영한다.

### 5. staging과 production의 DB 및 헬스체크 대상이 분리되지 않음

- 근거: `.github/workflows/main.yml:103`, `:131`, `:157`, `:178`.
- 두 배포 job 모두 같은 `secrets.DATABASE_URL`과 같은 health URL을 쓴다. job별 GitHub environment 지정도 없다.
- staging을 의도한 마이그레이션이 production DB에 적용되거나, production 배포가 다른 서버의 건강 상태로 성공 처리될 수 있다.
- 조치: 환경별 DB·배포 대상·health URL을 분리하고 production 접근 제어를 연결한다.

### 6. 배포 순서와 버전 확인이 보장되지 않음

- 근거: `render.yaml:44`, `.github/workflows/main.yml:103`, `:109`, `:126`, `packages/db/src/migrate.ts:15`.
- Render autoDeploy가 켜져 있고 Actions도 별도로 마이그레이션과 deploy hook을 실행한다. 이 저장소 설정에는 Render가 CI·마이그레이션 완료를 기다리도록 하는 연결이 없다.
- 기존 서버가 200을 내면 새 버전 배포 전에도 health check가 성공한다. hook 호출은 `curl -sS`여서 HTTP 오류 자체를 실패로 처리하지 않는다.
- workflow concurrency와 마이그레이션 advisory lock도 없어 연속 배포가 겹치면 같은 migration을 동시에 시도할 수 있다.
- 조치: 배포 트리거를 통일하고 마이그레이션을 직렬화한다. hook 실패를 검사하고 배포된 commit SHA까지 검증한다. 호환 마이그레이션 및 실패 복구 절차를 마련한다.

### 7. DB 테스트가 잘못된 DATABASE_URL의 전체 사용자 스키마를 삭제할 수 있음

- 근거: `apps/api/src/test/helpers.ts:82`, `packages/db/src/reset.ts:19`, `packages/db/src/schema.test.ts:6`.
- 테스트 DB 여부를 검사하지 않고 시스템 스키마를 제외한 스키마와 public을 DROP CASCADE한다. 테스트 실행 여부는 DATABASE_URL 존재로 결정된다.
- 개발자가 운영 연결 문자열이 설정된 터미널에서 npm test를 실행하면 연결 계정 권한 범위에서 데이터가 삭제될 수 있다.
- 조치: 전용 TEST_DATABASE_URL, 명시적 테스트 DB 식별 검사, 권한이 제한된 테스트 역할을 사용한다. 허용된 테스트 DB 외에는 reset을 거부해야 한다.

### 8. 워커 강제 종료 후 running 작업 복구 경로가 없음

- 근거: `apps/api/src/analysis/worker.ts:32`, `:39`, `:152`.
- claim 후 status가 running이 되며 다음 claim은 pending만 선택한다. 예외 catch는 있지만 프로세스 종료·OOM에서는 실행되지 않는다.
- 처리 도중 배포·장애가 발생하면 해당 분석이 영구 running으로 남을 수 있다. 오래된 running을 회수하는 코드는 검색 범위에서 확인되지 않았다.
- 조치: lease/heartbeat와 만료 작업 회수, 재시도 횟수 및 중복 결과 저장 방지를 함께 구현한다.

## P2 — 기능 오류와 운영 리스크

### 9. 관리자 API 클라이언트가 성공한 204를 오류로 처리

- 근거: `apps/mobile/src/app/admin/_api.ts:19`, `apps/mobile/src/app/admin/faq.tsx:86`, `:103`.
- 모든 성공 응답에 res.json()을 호출한다. 서버의 204에는 JSON이 없으므로 예외가 난다. 빈 204 Response로 재현했다.
- 조치: 204 및 빈 본문을 처리한다. 실제 저장이 수행되는 API에서는 성공 후 실패 안내·중복 재시도까지 유발할 수 있다.

### 10. PATCH 요청이 CORS 허용 메서드에서 빠짐

- 근거: `apps/api/src/server.ts:46`.
- 별도 출처에서 호출하는 웹 관리자의 PATCH가 preflight에 의해 차단된다. 실제 inject 결과는 `GET, HEAD, POST, PUT, DELETE`였다.
- 조치: 실제 사용하는 PATCH를 허용하고 브라우저 통합 검증을 추가한다. 아울러 render.yaml에 CORS_ORIGINS 선언이 없어 외부 설정 여부도 확인해야 한다.

### 11. 모바일 타입 검사 실패 — 생성 라우트 타입 점검 필요

- 근거: `apps/mobile/src/app/(tabs)/pick/confirm.tsx:91`, `apps/mobile/tsconfig.json`.
- `/(tabs)/pick/done`을 라우트 타입이 허용하지 않아 TS2820 발생. 다만 done.tsx 파일은 실제 존재하므로 화면 누락으로 단정하면 안 된다. 로컬 `.expo/types` 생성물의 낡은 상태일 가능성도 있다.
- 조치: 동일 버전 Expo의 라우트 타입 생성 과정을 거친 뒤 깨끗한 환경에서 다시 typecheck한다. CI는 typecheck가 export보다 먼저라 생성 과정의 재현성도 검증해야 한다.

### 12. API 내부 오류 로그가 비활성화됨

- 근거: `apps/api/src/server.ts:40`, `:80`.
- logger:false로 만든 Fastify에서 app.log.error를 호출한다. 일반 내부 오류가 500으로 반환돼도 이 경로로는 오류 로그가 남지 않는다.
- 조치: 민감값을 마스킹하는 로거를 활성화하고 request ID·오류율·처리시간을 기록한다.

### 13. AI 호출 한도가 병렬 실행에 원자적으로 적용되지 않음

- 근거: `apps/api/src/analysis/pipeline.ts:117`, `:129`, `:131`; `apps/api/src/config.ts:65`.
- 사용량 조회 후 AI 호출, 호출 완료 후 사용량 기록 순서다. 여러 워커가 마지막 남은 한도를 동시에 읽으면 모두 호출할 수 있다. 일일 한도 기본값은 미설정이다.
- 조치: 사용자별 호출 슬롯을 원자적으로 예약하고, 비용은 예산 예약·정산 방식으로 관리한다. 실제 운영 일일 한도와 월 예산 설정도 확인해야 한다.

### 14. 세션 토큰을 암호화되지 않는 AsyncStorage에 보관

- 근거: `apps/mobile/src/api/session.ts:1`, `apps/api/src/config.ts:10`.
- 일반 세션 기본 유효기간은 30일이고 운영자 TTL도 미설정 시 일반 TTL을 따른다. 토큰 저장소 접근이 발생했을 때 세션 탈취 영향이 커진다. 실제 유출을 발견했다는 뜻은 아니다.
- 조치: 네이티브는 OS 보안 저장소를 사용하고 운영자 세션 정책을 분리한다. [AsyncStorage 공식 저장소](https://github.com/react-native-async-storage/async-storage)는 비암호화 저장소임을 명시한다.

### 15. 배포 명세의 관리자 서비스 중복과 정적 파일 경로 불일치

- 근거: `render.yaml:15`, `:27`; `apps/api/src/server.ts:149`; `.dockerignore`; `Dockerfile`.
- weddingpick-admin이 같은 이름으로 두 번 선언돼 배포 의도가 모호하다. 실제 Blueprint 검증은 미실행했다.
- API 정적 파일 경로는 cwd에 apps/web/dist를 붙인다. npm workspace start의 cwd는 apps/api이므로 잘못된 경로가 된다. Docker에서는 dist를 제외하고 웹 빌드도 하지 않는다.
- 조치: 중복 서비스를 제거하고 정적 사이트/API 제공 책임을 명확히 한다. API가 파일을 제공한다면 이미지에 산출물을 넣고 cwd와 무관한 경로를 사용한다. 별도 Render 정적 사이트에는 API 경로 문제가 직접 적용되지는 않는다.

## P3 — 검증·유지보수 문제

### 16. 테스트 성공이 DB 핵심 흐름 검증을 의미하지 않음

- 로컬 테스트 623개가 DB 부재로 생략됐다. CI에는 PostgreSQL 서비스가 있지만 실제 최신 Actions 결과는 확인하지 않았다.
- lint는 모바일만 실행한다. API·DB·웹에는 lint 스크립트가 없다.
- 조치: 전용 임시 DB에서 마이그레이션·권한·관리자 영속성·동시성·탈퇴/파기를 검증하고, CI에서 예상치 못한 DB 테스트 skip은 실패로 처리한다. 모바일 E2E와 운영 구성 검증도 별도로 필요하다.

### 17. 상태 문서가 구현과 어긋나고 미완성 범위를 숨김

- 근거: README의 '남은 것은 코드가 아니라 바깥에서 와야 하는 값', 원본 보관 일수·문의처 설명. 실제 코드에는 보관 정책·지원 이메일과 함께 미구현 관리자 API도 존재한다.
- npm을 사용하면서 package-lock.json과 pnpm-lock.yaml이 함께 있고, 현재 새 마케팅 라우트·계약·migration은 미추적 파일이다. 변경된 추적 파일만 커밋하면 의존 파일이 빠질 수 있다.
- 조치: 구현 완료/화면만 구현/외부 설정 필요를 분리해 상태 문서를 갱신하고, 패키지 매니저와 lockfile 기준을 통일한다. 마케팅 변경은 migration·라우트·계약·테스트·CI를 함께 검토한다. 현재 dry_run은 명시돼 있어 실제 게시 기능이 없다는 점 자체를 결함으로 세지는 않았다.

## 권장 처리 순서

1. 테스트 DB 보호, 실제 긴급 중지, 허위 성공 API 차단, 업로드 용량 검증.
2. staging/production 분리, 워커 배포, 배포 직렬화·버전 확인, running 작업 회수.
3. 관리자 204/CORS 수정, 라우트 타입 재생성 검증, 오류 로깅·보안 저장소·AI 한도 보완.
4. 임시 PostgreSQL 통합 검사 및 실제 브라우저/실기기 흐름 확인 후 상태 문서 갱신.

검토한 코드에는 긍정적인 기반도 있다. 일반/가입 전/운영자 인증 분리, 가입 동의 관문, 원본 소유권 검사, Zod 요청 검증, 트랜잭션 및 분석 claim의 SKIP LOCKED가 존재한다. 다만 이런 개별 장치가 실제 배포·관리자 UI·장애 복구까지 연결되는지는 별도 검증이 필요하다.
