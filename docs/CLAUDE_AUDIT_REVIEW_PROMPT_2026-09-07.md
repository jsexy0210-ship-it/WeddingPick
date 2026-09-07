# Claude 전달 프롬프트 — GitHub 감사 결과 재검증

아래 내용을 Claude Code의 WeddingPickl 저장소 작업에 전달하세요.

---

WeddingPickl의 GitHub 조사 보고서를 최신 코드·PR·Actions와 대조해 독립적으로 검증해줘.

먼저 이 문서가 들어 있는 `codex/github-audit-handoff-20260907` 브랜치의 아래 파일을 읽어줘. 아직 main에 병합되지 않았다면 해당 브랜치/PR에서 읽어야 한다.

1. `docs/GITHUB_FULL_AUDIT_2026-09-07.md` — 최신 원격 조사 결과와 기존 분석 정정
2. `docs/GITHUB_AUDIT_PRS_2026-09-07.csv` — 조사 당시 PR 98개 목록
3. `docs/GITHUB_AUDIT_RUNS_2026-09-07.csv` — 조사 당시 Actions 591개 목록
4. `docs/REPOSITORY_AUDIT_2026-09-07.md` — 과거 로컬 분석. 최신 판정의 근거로 단독 사용하지 말 것

## 기준과 범위

- 원격 감사 기준 main은 `0a6e436bb9b1a73b8b099a0fd5b11b44c791972a`였다. 당시 로컬은 `b31c52e`라서 73커밋·300개 파일 차이가 있었다.
- 조사 중 PR #98 head가 `1da957f`에서 `b93df37`로 변경됐다. CSV는 최초 스냅샷이고, 보고서 G16이 추가 커밋을 반영한다. 현재 main과 #98/#88 상태를 먼저 새로 조회해줘.
- 기준 main CI는 DB 포함 테스트 1,678개, 타입 검사·빌드를 통과했다. 이를 현재 head의 검증 결과로 재사용하지 말아줘.
- 보고서는 목록 전수 집계와 중요 코드·로그 정밀 검토 결과다. 모든 PR diff와 모든 Actions 로그의 완전 검토 또는 운영 환경 정상 보증은 아니다.
- 이 요청의 범위는 재검증과 검토 결과 작성이다. 기존 작업 파일을 보존하고, 별도 요청 없이 운영 데이터 변경·배포·PR 병합·Secrets 변경을 하지 말아줘.

## 우선 검증할 것

1. **G01 — 같은 0072 migration의 서로 다른 구현**
   - main은 스키마를 지정하지 않은 `marketing_sources(id text, fact_ids text[], reviewed...)`를 생성한다.
   - 감사 당시 로컬 미커밋 파일은 `structured.marketing_sources(id uuid, payload jsonb, reviewed_by...)`를 생성했다.
   - 로컬 미커밋 구현 자체는 이 전달 PR에 포함되지 않았다. 네 환경에 없으면 없다고 명시하고 보고서의 비교 기록을 기준으로 위험을 평가해줘.
   - migrate가 파일명만으로 적용 여부를 판단하므로 기존 0072를 덮어쓰는 해결책을 제시하지 말고, 실제 적용 상태와 새 migration 필요성을 검토해줘.
2. **G02~G06 — GitHub 보호, 공공데이터, CORS, 배포**
   - 확인된 ruleset은 삭제·강제 푸시만 막았고 legacy protection은 권한 부족으로 미확인이었다. 보호가 전혀 없다고 단정하지 말고 현재 규칙을 확인해줘.
   - #88의 workflow 표현식 수정과 SBIZ 연결/업종코드 문제를 구분해줘. 최신 조사 run에서는 이천·제천 성공, SBIZ 타임아웃이었으므로 “data.go.kr 전체 장애”로 묶지 말아줘.
   - CORS_ORIGINS에 관리자/커스텀 도메인이 포함되는지, PATCH가 허용되는지 확인해줘.
   - main staging job과 별도 STAGING_DATABASE_URL workflow의 대상 차이, autoDeploy와 CI·migration 순서, 배포 SHA 검증 여부를 확인해줘.
3. **G07~G09 — 인증·세션**
   - production의 console mail fallback이 재설정 링크를 로그에 남기는지, 메일 실패를 사용자에게 어떻게 처리하는지 검증해줘.
   - 이메일 가입/lookup/reset/confirm 호출 제한, 동시 로그인 시도 제한, 이메일 운영자 세션 TTL 누락을 검증해줘.
   - webshell은 기본 비활성 옵션이었다. 활성화 때 장기 토큰을 wp_token 쿼리로 보내는 위험을 현재 사용자 전체 유출로 확대 해석하지 말아줘.
4. **G10~G16 — 마케팅·랜딩·의존성·릴리즈**
   - CI preview 생성 위치와 upload-artifact 경로, 실제 artifact 존재 여부를 확인해줘.
   - 소재 수정 시 reviewed 유지, DB 오류를 0건 성공으로 숨기는 catch, simulate의 jobId 무시와 retry 결과를 검증해줘.
   - 랜딩 고정 목업의 가격·확인 건수·가용일에 예시 표시가 있는지 확인해줘.
   - npm audit의 14개는 전이 의존성 영향 항목이다. 14개의 독립 취약점으로 쓰지 말고, 실제 영향 경로와 호환 수정안을 검토해줘. `npm audit fix --force`로 Expo를 임의 다운그레이드하지 말아줘.
   - Release 성공과 TestFlight 제출 완료를 구분하고 `eas submit --latest`가 해당 실행의 build를 보장하는지 확인해줘.
   - #98의 request.log.warn 추가가 logger:false 때문에 무효인지 현재 head에서 검증해줘.
5. **기존 잔존 문제**
   - 관리자 kill switch와 실제 실행 관문 연결, 저장 없이 성공하는 관리자 API, S3 업로드 크기 제한, 204 JSON 파싱, running 작업 회수, 테스트 DB 보호, AI 호출 한도 원자성도 다시 확인해줘.

## 검증 방식

- PR 본문/주석/기존 보고서를 사실로 가정하지 말고 현재 코드와 실제 Actions 결과로 확인해줘. #97의 inputs 원인 진단은 작성자가 철회했다.
- 재현은 전용 임시 테스트 DB에서만 수행해줘. 저장소 resetSchema는 DROP SCHEMA CASCADE를 실행하므로 기존 DATABASE_URL을 그대로 사용하지 말아줘.
- Secrets와 재설정/세션 토큰은 출력하거나 문서에 기록하지 말아줘.
- 접근할 수 없는 Render·GitHub 관리 설정·DB·스토어는 “미확인”으로 남기고, 확인할 정확한 항목을 적어줘.

## 원하는 결과

`docs/CLAUDE_AUDIT_REVIEW_2026-09-07.md`를 작성하고 다음을 포함해줘.

- 각 G01~G16 및 기존 잔존 항목: `재현/코드로 확인/이미 수정/오탐/외부 확인 필요` 판정
- 근거 commit SHA, 파일·줄, PR/Actions 링크, 영향 조건, 심각도
- 이전 보고서에서 잘못됐거나 과장된 내용의 명시적 정정
- 현재 출시를 막는 항목과 후속 개선 항목의 구분
- 중복된 열린 PR과 겹치지 않는 수정 단위·권장 순서·각 단위의 검증 기준
- 실행한 검사와 미실행 검사, 현재 환경의 한계

검토 결과를 문서화하는 것으로 완료하고, 코드 수정이나 운영 변경이 필요하면 구체적인 후속 작업으로 정리해줘.
