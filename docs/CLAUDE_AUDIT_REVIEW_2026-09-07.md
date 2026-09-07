# 감사 결과 재검증 — 2026-09-07

`codex/github-audit-handoff-20260907`(PR #99)의 `docs/GITHUB_FULL_AUDIT_2026-09-07.md`를
현재 main·PR·Actions와 대조해 독립 검증한 결과다.

## 검증 기준

| 항목 | 값 |
|---|---|
| 감사 기준 main | `0a6e436` |
| **재검증 시점 main** | **`6b9ff57`** (#98 병합, 감사 이후 1커밋) |
| 열린 PR | #88(`0098823`), #99(`7bc5540`), #100(`e7389e8`) |
| 참조 실행 | [34074570844](https://github.com/jsexy0210-ship-it/WeddingPickl/actions/runs/34074570844) (main CI/Deploy, 성공) |

감사 이후 **#98이 병합**되어 G06·G16의 전제가 바뀌었다. 아래 판정은 전부 `6b9ff57`
기준으로 다시 확인한 것이며, 보고서 서술을 사실로 전제하지 않았다.

---

## 요약 — 판정 분포

| 판정 | 항목 |
|---|---|
| **코드로 확인 (실제 문제)** | G02 · G03 · G04 · G05 · G08 · G10 · G11 · G12 · G13 · G16 · 잔존 6건 |
| **이미 수정** | 없음 — G16이 #100으로 수정 진행 중(미병합) |
| **오탐 / 과장** | 없음. 단, G04·G14·업로드 제한은 **정도(severity)를 정정**해야 한다 |
| **외부 확인 필요** | G01 · G06 · G07 · G09 · G15 · 워커 부재 |

**감사 보고서의 지적은 대체로 정확했다.** 오탐으로 판정한 항목은 없다. 다만 세 건에서
심각도를 조정했고(아래 «정정»), 감사가 잡지 못한 **출시 차단 결함 1건을 새로 발견**했다.

---

## 🔴 신규 발견 — 감사에 없는 출시 차단 결함

### N01. 운영 카카오 로그인이 500으로 실패 (현재 진행형)

브라우저 콘솔에서 `POST https://weddingpickl.onrender.com/v1/auth/sessions → 500`.
`/v1/me`·`/v1/me/signup`의 401은 세션 없음에 따른 정상 응답이다.

**500이라는 점이 위치를 특정한다.** `apps/api/src/errors.ts:6`이 `unauthenticated → 401`로
매핑하므로, 카카오 검증 실패는 반드시 401로 나간다. 500은 `routes/auth.ts:129`의
try/catch **바깥**에서 처리되지 않은 예외가 났다는 뜻이고, 그 위치는 하나뿐이다.

```ts
// apps/api/src/routes/auth.ts:130
const session = await signIn(context.pool, identity, ...);   // ← 여기
```

즉 **카카오 OAuth는 통과했고 `signIn()`의 DB 작업에서 터진다.** `signIn`의 SQL은
파라미터 12개 / 컬럼 12개로 일치하므로 코드 문제가 아니라 실행 환경 문제다.

원인 특정이 **G16 때문에 불가능한 상태**다 — 로거가 꺼져 있어 스택이 남지 않는다.
#100 병합 후 재현하면 잡힌다.

- 심각도: **출시 차단**. 로그인 없이는 앱을 쓸 수 없다(CLAUDE.md 2026-09-04 «비회원 진입 삭제»).
- 후속: #100 병합 → 재현 → 로그의 SQL 오류로 원인 확정.

---

## P0 — 출시 차단

### G16. `logger: false`로 오류 로깅이 전부 무효 — **확인, 수정 진행 중**

`apps/api/src/server.ts:41`(main `6b9ff57`)이 `Fastify({ logger: false })`다.
따라서 오류 처리기의 `app.log.error(error)`(`server.ts:96`)도, #98이 추가한
`request.log.warn(...)`(`routes/auth.ts:126`)도 **조용히 아무 일도 하지 않는다.**

감사의 G16 판정이 정확하다. 나는 이것을 독립적으로 재발견했고, #98 본문에
"이유가 서버 로그에 남는다"고 쓴 것은 **내 오류다** — 로거가 꺼진 것을 확인하지 않았다.

- 증거: Render 런타임 로그에 배포 생명주기 메시지 외 **요청 로그·오류 로그가 0건**.
- 수정: **PR #100** — 로거 활성(`level: warn`, `authorization`·`cookie` redact),
  오류 처리기를 `request.log`로 전환, `logger.test.ts` 회귀 테스트 추가.
  되돌려서 실제로 실패하는 것을 확인했다(`Expected: "warn"` / `Received: undefined`).
- **이 항목은 N01의 원인 규명을 막는 선행 조건이라 최우선이다.**

### G04. CORS 출처·메서드 누락 — **확인. 심각도 상향**

두 결함이 겹친다.

1. `infra/render-env.yml:47` — `CORS_ORIGINS`가 app-web·web의 onrender 출처 2개뿐.
   **admin 서비스 출처와 커스텀 도메인이 없다.**
2. `apps/api/src/server.ts:47` — `methods: ['GET','HEAD','POST','PUT','DELETE']`.
   **PATCH가 없다.**

**PATCH 누락은 이론이 아니라 실제 차단이다.** API에 PATCH 라우트가 실재하고
(`routes/admin.ts:982` ads-gate, `:1001` automation, `:1242` policy-engine),
관리자 화면이 실제로 PATCH를 보낸다(`app/admin/kill-switch.tsx:53`,
`policy-engine.tsx:70`, `users.tsx:81`, `vendors.tsx:85`·`:103`, `ads.tsx:80`,
`home.tsx:77`, `api/client.ts:564`·`607`·`659`). 브라우저 preflight에서 전부 막힌다.

> **정정 —** 감사는 "도메인이 아직 활성화되지 않았다면 활성화 시점의 차단 위험"이라고
> 유보했다. **도메인은 이미 활성이다.** run 34074570844의 Custom domains 단계가
> `weddingpick.kr` / `admin.weddingpick.kr` 둘 다 *"This domain is in use on your
> service"* 를 반환했다. 미래 위험이 아니라 **현재 차단**이다.

- 심각도: **출시 차단**(관리자 콘솔이 브라우저에서 동작하지 않음).
- 검증 기준: 각 출처에서 PATCH preflight가 204/200을 받고 실제 요청이 통과.

### G02. main 보호 규칙에 PR·CI·리뷰 필수 없음 — **확인. 근거 보강**

`GET /repos/.../rules/branches/main`(적용 규칙 집계)이 **2개만** 반환한다.

```
deletion         | ruleset 22058505
non_fast_forward | ruleset 22058505
```

`required_status_checks`도 `pull_request`도 없다. legacy branch-protection API는
나에게도 403이라 미확인이지만, **행동 증거가 있다**: 오늘 내가 #98을 **정식 리뷰 0개로
머지에 성공**했다. (관리자 우회 가능성은 배제하지 못하므로 단정하지는 않는다.)

- 심각도: **출시 차단**(프로세스). 실패한 변경의 병합을 막는 장치가 없다.

---

## P1 — 출시 전 처리

### G03. `public-data.yml`이 step `if`에서 secrets 직접 참조 — **확인**

main `6b9ff57`에 그대로 남아 있다.

```yaml
# .github/workflows/public-data.yml:70
if: ${{ !matrix.needs_sbiz_key || secrets.SBIZ_API_KEY != '' }}
# :76 도 동일
```

`secrets` 컨텍스트는 step 수준 `if`에서 쓸 수 없다. #88이 이를 env로 옮기는 수정이나
**미병합**이다. 감사의 «수집 실패와 YAML 무효를 분리하라»는 지적이 타당하다 —
YAML 수정 없이는 수집 성공 여부를 관측할 수조차 없다.

### G05. staging 이름의 job이 운영 대상을 검사 — **확인**

`main.yml`(현재 main)에서 두 job이 같은 값을 쓴다.

| | Deploy → Staging | Deploy → Production |
|---|---|---|
| DB | `secrets.DATABASE_URL` (:108) | `secrets.DATABASE_URL` (:177) |
| health | `weddingpickl.onrender.com` (:148) | `weddingpickl.onrender.com` (:184) |

별도 `db-migrate-staging.yml`만 `STAGING_DATABASE_URL`을 쓴다. 감사의
«DB 분리가 전혀 없다는 이전 판단은 정정하되 명칭·대상 불일치는 실재» 판단이 정확하다.

**추가 사실:** run 34074570844의 DB Migrate가 **「적용할 마이그레이션 없음」**을 출력했다.
즉 GitHub `DATABASE_URL`이 가리키는 DB는 스키마가 최신이다. 이것이 운영
`WeddingPickl` 서비스의 DB와 같은지는 **외부 확인 필요**이며, N01의 원인 후보와 직결된다.

### G08. 이메일 인증 경로의 호출 제한·운영자 TTL 공백 — **확인**

**운영자 TTL:** `routes/auth.ts`에서 소셜 경로(:130)만 `operatorSessionTtlDays`를
넘긴다. 이메일 로그인(:88)과 이메일 계정 생성(:167)은 넘기지 않는다.
→ 이메일 운영자 계정이 짧은 운영자 TTL 대신 일반 TTL을 받는다.

**호출 제한:** `passwordAttempts`가 등장하는 줄은 :68 `allowed` / :76 `fail` /
:79 `failCount` / :86 `reset` 뿐 — **전부 이메일 로그인 하나에만 있다.**
`/v1/auth/email/lookup`(:145), `/accounts`(:153), `/password-reset`(:179),
`/password-reset/confirm`(:202)에는 제한이 없다. 가입·confirm은 요청마다 scrypt를 돈다.

- 심각도: **높음**(계정 열거·자원 소모).

### G10. 마케팅 preview artifact가 업로드되지 않음 — **확인**

`npm run marketing --workspace @weddingpick/api`는 cwd가 `apps/api`이므로
`apps/api/.marketing-preview`에 생긴다(`marketing/cli.ts:21`·`:58`의 `mkdir(outDir)`).
`main.yml`의 upload-artifact는 저장소 루트의 `.marketing-preview/`를 본다.

**실측:** run 34074570844의 artifacts API가 `total_count: 0`. 두 단계 모두 초록인데
산출물이 없다. 게다가 `.`으로 시작해 upload-artifact v4의 숨김파일 기본 제외에도 걸려,
경로만 고쳐도 `include-hidden-files: true`가 필요하다.

### 잔존-A. 관리자 kill switch가 아무것도 끄지 않음 — **확인. 심각**

`routes/admin.ts:60`의 `const killSwitches = new Map<string, KillSwitch>([...])`.
`admin.ts` **바깥에서 `killSwitch`를 조회하는 코드가 0건**이다(전 소스 검색).

즉 `ai-recommendations`·`reward-payout`·`auto-publish`를 꺼도 **해당 기능은 계속 돈다.**
프로세스 재시작 시 상태도 사라진다. 안전 장치가 동작하지 않는다.

- 심각도: **높음**. 사고 시 멈출 수단이 없다.

---

## P2 — 후속 개선

### G11. 소재 수정이 과거 검토 완료 상태를 유지 — **확인**

`marketing/store.ts`의 `ON CONFLICT (id) DO UPDATE SET`이 `fact_ids`·`expires_at`·
`next_verify_at`·`active`·`note`·`updated_at`을 갱신하면서 **`reviewed`·`reviewed_at`은
제외**한다. 내용을 바꿔도 이전 승인 상태가 남는다.

### G12. 마케팅 대시보드가 DB 오류를 0건 성공으로 숨김 — **확인**

`routes/admin.ts:1118` 부근:

```ts
} catch {
  // DB 없을 때 빈 응답 (개발 환경)
  return { summary: { generated: 0, simulated: 0, failed: 0, failRate: 0 }, items: [] };
}
```

주석은 «개발 환경»이라 적었지만 **`NODE_ENV` 검사가 없다.** 운영 DB 장애도 0건 성공으로 보인다.

### G13. 랜딩 목업에 시연 표시가 없음 — **확인**

`apps/web/src/landing-v4.ts`에 `예시`·`샘플`·`가상`·`시연` 표기가 **0건**이면서
`:38 '152~184만원'`, `:39 '확인된 정보 12건 · 최근 12개월 · 기준금액 168만원'`,
`:140 '168만원'`을 표시한다.

**CLAUDE.md §3 «금액 표기 (고정)»이 바로 그 형식을 실데이터 표기로 규정**하므로,
같은 형식을 고정 목업에 쓰면 검증된 실데이터로 읽힌다. 정책 충돌이다.

### 잔존-B. 관리자 클라이언트가 204에 `res.json()` — **확인**

`app/admin/_api.ts:19`가 상태 구분 없이 `return res.json()`. 204를 반환하는 관리자
라우트가 실재한다(예: `admin.ts`의 `reply.status(204).send()`). 파싱 예외가 난다.

### 잔존-C. AI 호출 한도가 원자적이지 않음 — **확인**

`analysis/pipeline.ts`에서 `callsToday()`의 `SELECT count(*)`(:63)와
`recordUsage()`의 `INSERT`(:83)가 별도 트랜잭션이다. 동시 요청이 같은 허용 상태를
통과한다.

### 잔존-D. 죽은 워커의 `running` 작업이 회수되지 않음 — **확인**

`analysis/worker.ts:36`의 `claim()`이 `WHERE status = 'pending'`만 집는다.
프로세스가 중간에 죽으면 `running`으로 남고 **아무도 다시 집지 않는다**
(:152 주석의 «running으로 남겨두지 않는다»는 처리된 실패에만 해당).
회수 로직(reaper)이 없다.

### 잔존-E. 업로드 크기 제한 — **확인. 심각도 하향**

> **정정 —** «10MB 제한 미강제»는 절반만 맞다.

- `routes/documents.ts:14`의 `MAX_FILE_SIZE`는 **선언만 되고 파일 안에서 한 번도
  참조되지 않는다**(참조 1건 = 선언 그 자체). 죽은 상수다.
- 그러나 `storage/s3.ts:48`이 presigned POST 정책에 `'max-file-size'`를 넣으므로
  **S3 드라이버에서는 오브젝트 스토리지가 강제한다.**
- 운영은 `NODE_ENV=production`에서 `STORAGE_DRIVER=s3`를 강제하므로(`config.ts`),
  실질 노출은 로컬 드라이버 환경에 한정된다.

→ 출시 차단이 아니라 **죽은 상수 정리 + 로컬 드라이버 보강** 수준이다.

### 잔존-F. 테스트 DB reset 보호 없음 — **확인**

`packages/db/src/reset.ts:35`·`:45`가 `DROP SCHEMA ... CASCADE`를 실행한다.
대상 DB가 테스트용인지 확인하는 가드가 없다.

---

## 외부 확인 필요 (내 환경에서 확인 불가)

이 세션의 egress 프록시가 `*.onrender.com`과 `api.render.com`을 차단한다(`CONNECT 403`).
GitHub Actions secrets API도 403이다. 따라서 아래는 **미확인**으로 남긴다.

| 항목 | 확인해야 할 정확한 것 | 관련 |
|---|---|---|
| 운영 DB 동일성 | Render `WeddingPickl` 서비스의 `DATABASE_URL`이 GitHub `DATABASE_URL`과 같은 DB인가 | **N01**, G01, G05 |
| 운영 스키마 실물 | 운영 DB의 `schema_migrations` 목록과 `identity.identities` 컬럼 | **N01**, G01 |
| 로컬 미커밋 0072 | `structured.marketing_sources` 변형은 **내 작업 트리에 없다.** main의 `marketing_sources(id text, fact_ids text[])`만 존재 | G01 |
| 메일 fallback 실태 | 운영이 resend인지 console인지 — env sync는 `ok`였으나 실제 드라이버 미확인 | G07 |
| 워커 서비스 | Render에 분석 워커 서비스가 실제로 있는가 (저장소에 선언 없음) | 잔존 |
| 스토어 제출 | TestFlight/Play 실제 제출·심사 상태 | G15 |
| legacy branch protection | `branches/main/protection` (나에게 403) | G02 |

**G01 주의:** 감사 지적대로 `migrate.ts`는 파일명 version만 보고 checksum을 비교하지
않는다. 기존 0072를 덮어쓰는 해결책은 쓰면 안 되고, 운영 DB의 실제 형태를 먼저 읽은 뒤
**새 migration으로 이행**해야 한다. 다만 로컬 변형 자체를 내가 볼 수 없으므로
위험 평가는 보고서의 비교 기록에 의존한다.

**G07·G09·G15**는 감사의 유보가 타당하다. G09(webshell `wp_token`)는 `eas.json`에
활성 env가 없어 기본 비활성이며, 감사도 «현재 전체 노출이 아니다»라고 정확히 한정했다.

---

## 정정 목록

| 대상 | 정정 |
|---|---|
| **내 PR #98 본문** | "이유가 서버 로그에 남는다" → **틀림.** `logger: false`라 기록되지 않는다. #100이 선행돼야 한다 |
| **G04 심각도** | 감사의 "활성화 시점의 위험" → **이미 활성.** 현재 차단 |
| **잔존 «10MB 미강제»** | 앱 코드에선 죽은 상수이나 **S3 정책이 강제**. 로컬 드라이버 한정 문제로 하향 |
| **G14 (npm audit 14건)** | 감사가 이미 «독립 취약점 14개가 아님»으로 정확히 한정. 이번에 재검증하지 않음(미실행) |
| **#97 진단** | 작성자(나)가 철회한 것이 맞다. `inputs` 컨텍스트가 아니라 계정 차원 Actions 중단이었고, 저장소 공개 전환 후 해소됐다 |

---

## 권장 수정 순서 (열린 PR과 겹치지 않는 단위)

| 순서 | 단위 | 항목 | 검증 기준 |
|---|---|---|---|
| 1 | **#100 병합** | G16 | Render 로그에 요청/오류 줄이 실제로 남는다 |
| 2 | **N01 원인 규명** | N01 | 로그인 재현 → 로그의 SQL 오류로 원인 확정 → 수정 |
| 3 | **CORS 수정** | G04 | admin 출처·커스텀 도메인 추가 + PATCH 허용. 각 출처에서 PATCH preflight 통과 |
| 4 | **#88 병합** | G03 | public-data run의 job이 0개가 아니고 수집/검증/DB반영이 각각 관측됨 |
| 5 | main 보호 규칙 | G02 | 필수 PR + 해당 head CI 성공 없이는 병합 불가함을 실제로 확인 |
| 6 | 이메일 인증 보강 | G08 | lookup/가입/reset/confirm 제한, 이메일 경로 운영자 TTL 연결 |
| 7 | kill switch 연결 | 잔존-A | 끈 기능이 실제로 멈추고 재시작 후에도 유지됨 |
| 8 | job 명칭·대상 정리 | G05·G06 | 환경별 secret·서비스·health URL이 1:1로 대응 |
| 9 | artifact 경로 | G10 | artifacts API가 비어 있지 않고, 없으면 실패 |
| 10 | 마케팅·랜딩·잔존 | G11·G12·G13·잔존-B~F | 각 항목의 단위 테스트 추가 |

1~3은 **출시 차단**이다. 4~5는 프로세스 차단, 6~10은 출시 전 처리.

---

## 이번에 실행한 검사 / 실행하지 않은 검사

**실행함**
- `6b9ff57`의 `server.ts`·`routes/auth.ts`·`admin.ts`·`store.ts`·`pipeline.ts`·
  `worker.ts`·`documents.ts`·`s3.ts`·`landing-v4.ts`·`main.yml`·`public-data.yml`·
  `infra/render-env.yml` 직접 확인
- run 34074570844의 job·step·로그·artifacts API 조회
- `rules/branches/main` 조회(G02)
- PATCH 라우트/호출부 전수 grep(G04)
- `npm test --workspace @weddingpick/api`(87 passed), `tsc --noEmit -p apps/api`
- `logger.test.ts` 회귀 확인(고의로 되돌려 실패 재현)

**실행하지 않음**
- 98개 PR의 전체 diff, 591개 실행의 전체 로그 (감사와 동일한 한계)
- `npm audit` 재실행(G14)
- 전용 테스트 DB에서의 migration 재현 — 프롬프트 지시대로 기존 `DATABASE_URL`을 쓰지 않았고,
  별도 테스트 DB가 이 환경에 없다
- 실기기·초광폭 화면 검증
- Render·스토어 콘솔 (접근 차단)

**환경 한계**
- egress 프록시가 `*.onrender.com`·`api.render.com` 차단 → 배포된 산출물·운영 API를
  직접 조회할 수 없다
- GitHub Actions secrets API 403 → secret 값·존재 여부를 직접 확인할 수 없다
- 운영 DB 접속 수단 없음

---

## 운영 변경 여부

이 재검증에서 운영 데이터·Secrets를 변경하지 않았다. 다만 이 문서 작성 **이전에**
사용자의 별도 지시로 수행한 작업이 있어 밝혀 둔다 — #98 병합, `render-env-sync` 실행
(카카오 키 반영), #100 생성. 감사 프롬프트의 «별도 요청 없이 하지 말 것» 범위 밖의
선행 작업이다.
