# GitHub 전체 현황 및 최신 코드 조사 — 2026-09-07

## 결론

**최신 main의 CI는 통과했지만, 배포와 운영 기능의 완결성은 확보되지 않았다.** 공공데이터 수집, 실제 배포 확인, 관리자 조작의 영속성, 인증 보안, 로컬/원격 마케팅 구현 충돌을 우선 정리해야 한다.

이 보고서는 이전 로컬 보고서의 최신성 한계를 보완한다. 이전 보고서 기준 로컬 HEAD는 `b31c52e`였고 최신 main은 `0a6e436bb9b1a73b8b099a0fd5b11b44c791972a`다. **73커밋, 300개 파일, +25,845/-4,867줄 차이**가 있었다. 사용자 작업 폴더를 pull/reset하지 않고 임시 clone에서 조사했다.

## 조사 범위와 증거 수준

| 대상 | 조사 결과 |
|---|---|
| PR 목록·본문·상태 | #1~#98 전체 98개 확보. 91 merged, 5 closed/unmerged, 2 open |
| 정식 PR 리뷰 | 98개 PR 각각 조회: 반환된 리뷰 0개 |
| 리뷰 댓글 | 저장소 전체 inline 댓글 0개. 열린 #98/#88의 review thread도 0개 |
| 일반 댓글 | 12개 전부 확인. 과거 실패 원인 정정과 중복 작업 종료 기록 포함 |
| GitHub Issues | PR을 제외한 이슈 0개 |
| 브랜치 | 66개, 다음 페이지가 빈 목록임을 확인 |
| Actions | 최초 수집 시 591개 실행 레코드, 6페이지 전부 확보. 최신·실패 유형별 11개 실행의 job과 8개 job 로그를 상세 확인 |
| 코드 | 최신 main 추적 파일 874개, clone에서 접근 가능한 커밋 428개. 300개 변경 파일의 범위를 확인하고 인증·배포·마케팅·기존 지적 영역 집중 검토 |
| Releases / tags | GitHub Release 0개, clone에 tag 0개 |
| 보호 규칙 | active ruleset 상세 확인. 별도 legacy branch-protection 조회는 integration 권한 403 |
| 의존성 | 최신 package-lock으로 npm audit 실행 |
| 비밀값 패턴 | 현재 텍스트 및 clone main 이력의 지정 텍스트 확장자를 제한된 키 패턴으로 검사, 일치 없음 |

목록 전수 집계와 개별 코드 정밀 검토는 구분한다. **98개 PR의 모든 diff와 591개 실행의 모든 로그를 줄 단위로 검토한 것은 아니다.** 최신 main 및 열린 PR의 핵심 변경을 조사했다. Secret scanning/Dependabot/Code scanning 설정, GitHub Environments·배포 API, 실제 Render 콘솔·DB·스토어 상태는 도구 권한/허용 범위로 직접 확인하지 못했다. 공개 health URL 직접 조회도 실패하여 현재 서비스 가용성은 단정하지 않고 Actions 로그의 확인 시점을 명시했다.

GitHub 원격에는 댓글 작성·merge·재실행·설정 변경을 하지 않았다.

## 최신 PR 판단

| PR | 상태 | 확인 및 판단 |
|---|---|---|
| [#98](https://github.com/jsexy0210-ship-it/WeddingPickl/pull/98) | open, 최신 head `b93df37` | 조사 중 `1da957f`에서 추가 커밋 발생. 최종 6개 파일 diff 재확인. 카카오 secret 이름 추가, hook/Blueprint 단계 제거, 카카오 오류 로깅 추가. env upsert와 배포 요청 HTTP 201은 확인했지만 OAuth 종단 성공 증거는 아니다. 최신 head CI run 34073976266은 진행 중. 로깅 보완 누락은 G16 |
| [#88](https://github.com/jsexy0210-ship-it/WeddingPickl/pull/88) | open, head `0098823` | secrets를 step if에서 직접 참조한 오류 수정. 코드 검증 job은 통과하나 최신 수집 run은 SBIZ/분류조회에서 연결 타임아웃. YAML 수정과 외부 연결 장애를 분리해 처리해야 한다 |
| [#97](https://github.com/jsexy0210-ship-it/WeddingPickl/pull/97) | closed, unmerged | inputs 컨텍스트 오류라는 최초 진단은 철회됨. main의 기존 코드로 env sync 성공. 이 PR을 다시 적용할 근거 없음 |
| [#96](https://github.com/jsexy0210-ship-it/WeddingPickl/pull/96) | merged, 현재 main | 환경변수 동기화 실행 성공 확인. CORS 원본 값·메일 fallback·재배포 완료 검증에는 아래 잔여 문제 존재 |
| [#95](https://github.com/jsexy0210-ship-it/WeddingPickl/pull/95) | merged | 랜딩을 고정 목업 데이터로 전환. 화면상 예시 표시 없는 확인 건수/가격/가용일 주장은 오해 가능 |
| [#94](https://github.com/jsexy0210-ship-it/WeddingPickl/pull/94) | merged | 심볼 통일·전체 폭 변경. 최신 CI는 통과했으나 실기기·초광폭 화면을 이번 조사에서 검증하지 않음 |
| [#91](https://github.com/jsexy0210-ship-it/WeddingPickl/pull/91) | merged | 이메일 로그인 추가. 기존 검토에 없던 인증·메일·운영자 TTL 리스크가 생김 |

#97 정정은 [작성자 종료 댓글](https://github.com/jsexy0210-ship-it/WeddingPickl/pull/97#issuecomment-5563687068)과 실제 main env sync 성공 로그가 뒷받침한다. 당시 계정 상태가 원인이었다는 설명은 작성자 진술이며, 결제/계정 콘솔을 직접 검사한 결과는 아니다.

#88의 “data.go.kr 전체가 연결되지 않는다”는 과거 댓글은 **최신 실행 전체에 적용되지 않는다**. [run 34028516520](https://github.com/jsexy0210-ship-it/WeddingPickl/actions/runs/34028516520)에서 이천·제천 job은 성공했고, 이천은 6개 수집·6개 승인, databaseApplied:false였다. SBIZ 2개와 업종 조회는 apis.data.go.kr 연결 타임아웃이었다. 근거 없는 업종코드 문제도 실제 유효 코드로 교정 완료된 상태는 아니다.

## 실제 CI·배포·릴리즈 현황

최신 main [CI run 34070804426](https://github.com/jsexy0210-ship-it/WeddingPickl/actions/runs/34070804426)의 최신 attempt는 성공했다. 타입 검사, 린트, DB 포함 테스트, 모바일 웹 번들, 웹 랜딩 빌드 단계가 통과했다.

| 워크스페이스 | 통과 테스트 |
|---|---:|
| API | 655 |
| 모바일 | 57 |
| 웹 | 51 |
| API contract | 13 |
| DB | 79 |
| domain | 823 |
| 합계 | **1,678** |

테스트 중 원본 삭제 실패 등의 로그는 장애 시나리오 테스트에서도 나오므로 그 문구만 보고 운영 장애로 집계하지 않았다.

최초 Actions 목록 스냅샷은 성공 236 / 실패 351 / 취소 3 / 진행 중 1이다. 이는 재실행 attempt 전체 수나 현재 장애율이 아니라 **각 run 레코드의 조회 당시 결론**이다.

| 주요 워크플로 이름 | 실행 수 | 결론 |
|---|---:|---|
| CI / Deploy | 320 | 성공 143, 실패 176, 진행 중 1 |
| .github/workflows/public-data.yml | 116 | 실패 116 |
| Wedding public data | 9 | 성공 3, 실패 6 |
| Render env sync | 5 | 성공 3, 실패 2 |
| Release | 17 | 성공 2, 실패 15 |
| Android APK | 15 | 성공 6, 실패 7, 취소 2 |

파일명으로 표시된 public-data 실행 중 최신 것은 job 목록이 비어 있다. 현재 main에 남은 잘못된 if 표현식과 함께 판단해야 하며, 과거 116개 각각의 근본 원인이 모두 동일하다고 단정하지 않는다.

- main 배포 job 로그(09-07 10:31 KST): 적용할 migration 없음, hook 미설정, Blueprint sync HTTP 404 경고, 기존 API health 200.
- [main env sync](https://github.com/jsexy0210-ship-it/WeddingPickl/actions/runs/34072580155): 4개 서비스에 배포 요청 HTTP 201.
- [카카오 secret 반영 run](https://github.com/jsexy0210-ship-it/WeddingPickl/actions/runs/34073212661): `ok KAKAO_CLIENT_SECRET`와 배포 요청 HTTP 201. 브랜치에서 수동 실행한 기록이다.
- [최신 Release 성공 run](https://github.com/jsexy0210-ship-it/WeddingPickl/actions/runs/33728606291): iOS build 성공, **TestFlight 제출 skipped**, Android build skipped. Release 초록을 스토어 제출 완료로 해석하면 안 된다.
- [최신 Android APK 성공 run](https://github.com/jsexy0210-ship-it/WeddingPickl/actions/runs/33876308658): 최신 인증/랜딩 변경보다 오래된 SHA `6da6942` 대상이다.

## P1 — 우선 해결

### G01. 로컬/원격 0072 migration이 같은 이름으로 서로 다른 스키마를 정의

로컬 미추적 파일은 `structured.marketing_sources(payload jsonb, id uuid, reviewed_by...)`를 만든다. [최신 main의 같은 파일](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/packages/db/migrations/0072_marketing_pipeline.sql#L1)은 스키마 미지정 `marketing_sources(id text, fact_ids text[], reviewed...)`를 만든다.

[migrate](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/packages/db/src/migrate.ts#L23)는 파일명 version만 저장하고 checksum을 비교하지 않는다. 이미 0072가 적용된 DB에 다른 내용의 같은 파일을 가져와도 실행을 건너뛴다. 새 DB와 기존 DB의 구조가 달라지고, 서로 다른 API/store 구현은 다른 테이블을 조회한다.

**조치:** 미커밋 작업을 보존하고 main 기준으로 수렴할 모델을 정한 뒤, 이미 배포된 0072는 변경하지 말고 새 migration으로 명시적으로 이행한다. 운영 DB의 실제 schema_migrations·테이블 형태를 먼저 읽어 확인해야 한다. 단순 pull 또는 파일 덮어쓰기로 해결할 문제가 아니다.

### G02. main ruleset에 PR/CI/리뷰 필수가 없음

[Protect main](https://github.com/jsexy0210-ship-it/WeddingPickl/rules/22058505)은 삭제와 non-fast-forward만 막는다. 조회된 ruleset에는 pull_request, required_status_checks가 없다. PR 98개의 정식 리뷰도 0개였다.

별도 legacy branch-protection은 403이라 전체 보호가 없다고 확정할 수는 없지만, 확인 가능한 규칙만으로는 실패한 변경의 병합을 막지 못한다.

**조치:** 필수 PR, 해당 head의 CI 성공, 대화 해결 및 적절한 리뷰 조건을 확인·설정한다. 자동배포도 동일 통과 조건에 종속돼야 한다.

### G03. 공공데이터 workflow 무효 상태가 main에 남음

[public-data.yml](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/.github/workflows/public-data.yml#L70)이 step if에서 secrets를 직접 참조한다. 최신 파일명 표시 실패 run은 job 0개. #88은 이를 env로 옮긴 수정이지만 아직 미병합이다.

**조치:** workflow 유효성 수정과 SBIZ 네트워크/업종코드 검증을 분리한다. 수집 성공·검증 성공·DB 반영 성공을 각각 관찰해야 한다. 국내망 실행 등 대안은 실제 연결 시험 후 결정한다.

### G04. CORS 원본이 관리자와 커스텀 도메인을 누락

[infra/render-env.yml](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/infra/render-env.yml#L43)의 CORS_ORIGINS는 app-web과 web의 onrender 출처 두 개뿐이다. admin 서비스 출처, admin.weddingpick.kr, weddingpick.kr은 없다. env sync는 이 키를 통째로 덮어쓴다. 동기화 로그에서 CORS_ORIGINS 반영 성공을 확인했다.

또한 [server.ts](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/apps/api/src/server.ts#L47)의 허용 메서드에는 PATCH가 없다.

**조치:** 실제 운영 출처 목록과 PATCH를 함께 반영하고, 각 관리자/웹 출처에서 preflight 및 인증 요청을 검증한다. 도메인이 아직 활성화되지 않았다면 그 부분은 활성화 시점의 차단 위험이다.

### G05. staging이라고 표시한 main job이 운영 대상을 검사

[main.yml](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/.github/workflows/main.yml)의 staging/production job은 같은 DATABASE_URL과 weddingpickl.onrender.com을 사용한다. 반면 [별도 staging migration](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/.github/workflows/db-migrate-staging.yml)은 STAGING_DATABASE_URL을 사용하며, render.yaml은 weddingpick-api를 별도 staging이라고 설명한다.

즉 “DB 분리가 전혀 없다”는 이전 판단은 정정해야 하지만, **일반 main 배포 job의 이름·대상 불일치는 실제로 남아 있다.**

**조치:** 환경별 job, secret, 서비스, health URL을 명시적으로 연결하고 혼동되는 staging 명칭을 고친다.

### G06. CI 성공과 새 버전 배포 완료가 분리돼 있음

Render autoDeploy, main 배포 job, env-sync 재배포가 독립적이다. main에는 배포 concurrency/commit SHA 확인이 없고 env-sync는 POST 201이면 끝난다. 최신 성공 main의 Blueprint sync는 실제 HTTP 404였다.

#98은 실패하는 단계를 제거하지만 production 수동 job에서 실제 배포 요청도 사라지므로, 이름만 보고 배포를 실행했다고 해석할 수 없다. health 200은 해당 SHA가 배포됐다는 증거가 아니다.

**조치:** 배포의 책임 경로를 통일하고 deploy ID의 완료 및 실행 SHA를 확인한다. migration은 직렬화하고 schema 변경 호환성을 검증한다.

### G07. 운영에서 메일 키 누락 시 재설정 토큰이 로그로 출력됨

[config.ts](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/apps/api/src/config.ts#L161)는 resend 설정이 불완전하면 production에서도 console로 fallback한다. [mailer.ts](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/apps/api/src/auth/mailer.ts#L16)는 받는 주소와 재설정 링크 전체를 console.log한다. API는 204를 반환해 사용자는 메일이 전송됐다고 안내받을 수 있다.

이번 env sync 로그에서 RESEND_API_KEY upsert는 성공했으므로 현재 운영에 키가 없다고 단정하지 않는다. 결함은 **키 누락·잘못된 환경에서 작동하는 fallback 설계**다.

**조치:** API 전체는 유지하되 메일 경로를 unavailable로 처리하고, 운영에서는 재설정 bearer token을 로그에 남기지 않는다. 민감값 없이 실패 상태를 관측한다.

### G08. 새 이메일 인증 경로에 호출 제한과 운영자 TTL 공백

[auth.ts](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/apps/api/src/routes/auth.ts#L68)는 이메일 로그인 실패만 메모리 limiter로 센다. 가입·email lookup·password reset 요청/confirm에는 요청 제한이 없다. 가입과 confirm은 요청마다 scrypt를 실행하며, reset은 메일 발송과 토큰 INSERT를 수행한다.

로그인도 allowed → await 비밀번호 검증 → fail 순서라 동시 요청이 같은 허용 상태를 통과할 수 있다. [limiter](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/apps/api/src/auth/attempt-limiter.ts#L25)는 인스턴스별 Map이며, 한 번만 등장한 키의 만료 항목은 자동 순회 정리되지 않는다.

이메일 로그인은 signIn에 operatorSessionTtlDays를 전달하지 않지만 소셜 경로는 전달한다. 이메일 운영자 계정은 설정된 짧은 운영자 TTL 대신 일반 TTL을 받게 된다.

**조치:** IP·계정별 공유 제한 및 원자적 시도 예약, 메일 재요청 간격·해시 작업 용량 제한, 만료 항목 정리, 이메일 경로의 운영자 TTL 연결을 적용한다.

### G09. 웹뷰 옵션을 켜면 장기 세션 토큰을 URL 쿼리로 전송

[WebShellView.tsx:40](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/apps/mobile/src/features/webshell/WebShellView.tsx#L40)는 wp_token에 세션 토큰을 넣고 호스팅 URL을 요청한다. 웹의 replaceState는 응답 이후 실행되므로 최초 요청 URL이 서버/프록시에 도달한 사실을 되돌리지 못한다.

현재 [eas.json](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/apps/mobile/eas.json)에는 webshell 활성 env가 없어 기본 비활성 POC다. **현재 일반 네이티브 사용자가 모두 노출된다는 뜻은 아니며, 이 방식으로 활성화하기 전 차단할 문제**다.

**조치:** 단기 일회용 교환 코드 또는 출처를 검증한 안전한 bridge로 바꾸고, 장기 토큰을 URL에서 제거한다.

## P2 — 최신 변경의 추가 결함

### G10. 마케팅 preview 산출물이 실제로 업로드되지 않음

[main.yml](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/.github/workflows/main.yml#L70)은 workspace 명령에 상대 경로 .marketing-preview를 넘긴다. 생성 위치는 apps/api 아래인데 upload-artifact는 repository root의 .marketing-preview를 찾는다. 숨김 파일 포함 옵션도 없다.

최신 CI 로그는 **No files were found ... No artifacts will be uploaded**이고 해당 run artifacts API도 빈 목록이었다. 16개 문안 생성 성공과 검토 산출물 전달 성공은 다른 상태다.

**조치:** 생성/업로드 경로를 일치시키고 숨김 폴더 처리를 명시한다. 예상 artifact가 없으면 실패시켜야 한다.

### G11. 마케팅 소재 수정이 과거 검토 완료 상태를 유지

[store.ts](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/apps/api/src/marketing/store.ts#L25)의 ON CONFLICT는 fact_ids를 변경하면서 reviewed/reviewed_at은 유지한다. 미검토로 수정하려 해도 이전 reviewed=true가 남을 수 있고, 반대로 false로 등록한 소재는 같은 upsert로 승인 상태가 되지 않는다.

**조치:** 내용 수정과 재검토 상태를 연결하고 승인 작업을 별도로 감사 기록한다. 현재 외부 게시가 없는 dry_run이라 즉시 외부 게시 사고로 확대 해석하지는 않는다.

### G12. 마케팅 대시보드가 운영 DB 오류도 빈 성공으로 숨김

[admin.ts](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/apps/api/src/routes/admin.ts#L1118)의 marketing GET catch는 NODE_ENV 검사 없이 모든 오류를 0건 성공 응답으로 바꾼다. simulate URL의 jobId는 무시되고 전체 예정 작업을 처리하며, retry는 실제 변경이 없어도 ok:true를 반환한다.

**조치:** DB 장애는 명시적 오류로 유지하고, URL이 지정한 대상과 실제 실행 대상을 일치시킨다. retry의 rowCount와 상태를 확인한다.

### G13. 랜딩 목업에 검증된 실데이터처럼 읽히는 문구가 존재

[landing-v4.ts](https://github.com/jsexy0210-ship-it/WeddingPickl/blob/0a6e436bb9b1a73b8b099a0fd5b11b44c791972a/apps/web/src/landing-v4.ts#L33)는 고정 목업인데 확인된 정보 12건·최근 12개월·168만원·원하는 날에 가능 등의 문구를 표시한다. 파일의 출력 문구에서 예시/가상/샘플 표시는 찾지 못했다.

**조치:** 시연 카드임을 같은 화면에 명확히 표시하고 실제 확인·가용성 주장과 구별한다. 법률 위반 여부를 판정한 것은 아니다.

### G14. npm audit — 중간 위험도 영향 항목 14개

최신 lockfile: moderate 14, high/critical 0. **독립 취약점 14개가 아니라 전이 의존성 영향까지 집계한 수치**다.

- [decode-uri-component GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr): malformed URL 디코딩에 따른 CPU 과다 사용. query-string → expo-router 경로.
- [uuid GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): 특정 버전/함수의 buffer 인자 경계 검사 문제. xcode → Expo 빌드 도구 계열 영향.

실제 앱 공격 경로를 재현한 것은 아니다. npm의 fix 제안에는 Expo 46 등 큰 버전 변경이 포함돼 있어 그대로 강제 적용하면 안 된다. 호환되는 상위 패키지/전이 의존성 수정과 회귀 검증이 필요하다. 패키지는 수정하지 않았다.

### G15. Release 성공이 해당 빌드의 제출을 보장하지 않음

최근 성공 Release의 TestFlight 단계는 skipped였고, workflow의 제출 명령은 특정 build ID가 아닌 `eas submit --latest`다. 동시/별도 빌드가 생기면 이 실행에서 만든 빌드와 제출 대상이 달라질 가능성이 있다. validate도 테스트 CI가 아니라 secret/projectId 존재 확인 중심이다.

**조치:** 검증된 SHA와 EAS build ID를 기록·전달해 해당 산출물을 제출한다. 실제 스토어 상태는 별도 확인이 필요하다.

### G16. 최신 PR #98의 오류 로깅이 비활성 로거를 호출

최종 head `b93df37`은 identity-provider의 카카오 오류 상세를 보존하고 routes/auth.ts catch에서 `request.log.warn`을 호출한다. 그러나 PR 변경 파일에 server.ts는 없고 main의 `Fastify({logger:false})`가 유지된다. 따라서 오류 메시지를 더 만들어도 의도한 Fastify 경고 로그는 기록되지 않는다. 추가 테스트는 provider가 KOE010을 담은 예외를 던지는지만 검증해 실제 서버 로깅 여부를 확인하지 않는다.

**조치:** 민감 필드를 마스킹한 로거를 활성화하고, route 수준에서 로그가 실제로 기록되는지 검증한다. 이 항목은 처음 수집한 CSV 이후 추가된 커밋에 대한 최종 점검 결과다.

## 이전 보고서의 재판정

| 이전 항목 | 최신 main 판정 |
|---|---|
| 모바일 typecheck 실패 | **최신 main에서는 통과.** 이전 결과는 오래된 로컬 및 생성 라우트 타입 상태에 한정 |
| DB 테스트 623개 미실행 | **최신 CI에서 DB 포함 1,678개 통과 확인.** 이전 로컬 실행의 한계였음 |
| 관리자 Render 서비스 중복 | **최신 render.yaml에서 중복 제거 확인** |
| API health URL 오기 | #63에서 weddingpickl로 변경됨 |
| staging/production 미분리 | 별도 staging DB workflow는 생김. main 배포 job의 잘못된 연결/명칭은 G05로 유지 |
| CORS 출처 선언 없음 | infra/render-env.yml이 새 원본. 실제 누락은 G04로 갱신 |
| 워커 배포 없음 | 저장소의 Render worker 선언은 여전히 없음. 운영 API가 Blueprint 밖이므로 실제 워커 부재는 외부 확인 필요 |
| 관리자 kill switch Map만 변경 | **잔존**, admin.ts:60/799 부근. 실제 실행 관문 연결 없음 |
| FAQ·광고·정책 등의 허위 성공 | **잔존**. 마케팅은 별도 구현이 생겨 G11/G12로 재평가 |
| 업로드 10MB 제한 미강제 | **잔존**. S3 변경은 signed download URL 추가이며 제한 수정 아님 |
| 관리자 204 JSON 파싱 | **잔존**, admin/_api.ts:19 동일 |
| PATCH CORS 누락 | **잔존**, server.ts:47 |
| logger:false | **잔존**, server.ts:41 |
| DB 테스트 reset 대상 보호 없음 | **잔존**, reset.ts 동일 |
| 오래된 running 분석 복구 없음 | **잔존**, analysis/worker.ts 동일 |
| AI 한도 조회/호출 비원자성 | **잔존**, analysis/pipeline.ts 동일 |
| AsyncStorage 세션 저장 | **잔존**, api/session.ts 동일 |
| migration checksum/직렬화 없음 | **잔존**, G01 및 G06과 연결 |

## 공개 저장소·운영 관리

GitHub metadata의 현재 visibility는 public이다. #97 댓글에는 공개 전환 뒤 Actions가 다시 동작했다는 기록이 있다. 코드뿐 아니라 정책 초안·설계 문서·이력도 공개 범위에 포함되므로 의도한 공개 범위를 확인할 필요가 있다.

검사한 키 패턴(일부 GitHub token, AWS access key, Anthropic key, private-key header)은 현재 텍스트/선택한 확장자의 main 이력에서 일치하지 않았다. **전체 비밀값 유출이 없다는 보증은 아니다.** 바이너리 문서 내용, PR 전용 모든 브랜치 이력, 임의 형식 비밀값 및 GitHub Secret scanning alert는 검사하지 못했다. 공개 OAuth client ID나 단순 key ID는 비밀키 유출로 분류하지 않았다.

Issues 0개이고 formal review도 0개인 반면, 댓글과 PR 본문에는 반복 migration 충돌·중복 구현·실패 진단 번복이 남아 있다. 해결 항목과 미해결 항목을 issue로 추적하고, migration 소유권·동시 변경 관리·검증 완료 기준을 명시할 필요가 있다. 이번에는 이슈를 외부에 생성하지 않았다.

## 실행 우선순위

1. 로컬 작업 보존 → 최신 main과 마케팅 스키마/API 모델 합의 → 새 migration으로 이행.
2. main 필수 검증 및 환경·배포 대상 정리, 공공데이터 YAML 수정, 관리자 CORS 수정.
3. 기존 관리자 허위 성공·kill switch·업로드 제한·워커 복구와 새 이메일 인증 공백 해결.
4. CI artifact 전달·릴리즈 build ID 추적·의존성 교정.
5. 전용 테스트 DB와 실제 브라우저/실기기로 종단 검증 후 출시 판단.

이 조사에 사용한 PR 전체 목록과 Actions 전체 목록은 같은 폴더의 `GITHUB_AUDIT_PRS_2026-09-07.csv`, `GITHUB_AUDIT_RUNS_2026-09-07.csv`에 있다. 목록은 최초 스냅샷이므로 이후 상태 변화는 개별 GitHub 링크에서 확인해야 한다.
