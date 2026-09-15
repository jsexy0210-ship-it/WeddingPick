# 시험 무력화 감시 — test-integrity-audit

이 문서는 「CI가 초록이다」를 의심하는 자리다. 화면·오더·배포 감시가 모두
시험이 제 일을 한다고 믿기 때문에, 초록이 거짓말을 시작하면 나머지가 같이 눈이 먼다.

판정은 **이상 없음 / 무력화 / 못 봤다** 셋뿐이다. 확인하지 못한 것은 「못 봤다」로 적는다.
재는 도구는 `scripts/test-integrity-scan.mjs`다. 손으로 다시 세지 않는다.

---

## 2026-09-15 12:16 KST — 1차 전수 조사

- **소스 커밋**: `aca7b6e8` (main). 조사 중 main이 세 번 움직였고(`ecd114ac` → `8024b047` →
  `d07e8192` → `aca7b6e8`, 커밋 9개) **세 시점 모두에서 다시 세어 값이 같았다.**
- **본 것**: 저장소 전체 시험 수 · `skip`/`only`/`todo` 전수 · `main.yml` 검증 단계 · 생성물 방어 장치 6개 · 최근 60커밋의 시험 증감 · 「전부 초록」 주장
- **판정**: **이상 없음** (아래 「남은 구멍」 3건은 무력화가 아니라 기록해 두는 약점이다)

### 시험 수 — 실제로 돌려서 잰 값

`npm test`(= `npm run test --workspaces --if-present`)를 실제 실행한 결과다. 정적 계수가 아니다.

| 워크스페이스 | suites | tests | DATABASE_URL 없음(로컬) | DATABASE_URL 있음(CI와 같음) |
|---|---|---|---|---|
| `apps/api` | 85 | 1,075 | 258 통과 · **817 건너뜀** (54 suite) | **1,075 통과 · 0 건너뜀** |
| `packages/domain` | 62 | 960 | 960 통과 | 영향 없음 |
| `apps/mobile` | 32 | 348 | 348 통과 | 영향 없음 |
| `apps/web` | 9 | 73 | 73 통과 | 영향 없음 |
| `packages/api-contract` | 2 | 34 | 34 통과 | 영향 없음 |
| `packages/db` | 1 | 79 | **79 건너뜀** (1 suite) | **79 통과** |
| `packages/ui` | 0 | 0 | 시험 스크립트 없음 | 없음 |
| **합계** | **191** | **2,569** | 1,673 돌고 **896 건너뜀(34.9%)** | **2,569 전부 돌고 전부 통과 · 0 건너뜀** |

2026-09-15 기준선(api 85/1,075 · domain 62/960 · mobile 32/348 · web 9/73 · api-contract 2/34)과
**다섯 워크스페이스 모두 정확히 일치한다.** 줄어든 것이 없다.

### ① 시험이 지워지거나 약해진 커밋 — 이상 없음

최근 60커밋 중 시험 파일에서 `it`/`test` 또는 `expect`가 **순감소한 커밋은 0건**이다.
(`git log`로 커밋별 diff의 추가/삭제를 세어 확인. 순감소가 하나도 잡히지 않았다.)

조사 중 main에 들어온 커밋 9개도 각각 봤다.

- `8024b047`·`d07e8192`: 시험 파일·워크플로·jest 설정을 **하나도 건드리지 않았다.**
- `d07e8192..aca7b6e8`(7커밋, 화면 신규 구현): 시험 파일은 **1개만** 바뀌었다 —
  `apps/mobile/.../signup-recovery.test.tsx`에서 `jest.mock('./option-chip')`이
  `jest.mock('./option-row')`로 바뀌고 `jest.mock('./style-grid')`가 빠졌다.
  **시험이 지워진 것이 아니다.** 화면이 그리는 컴포넌트가 바뀌어 mock 목록이 따라간 것이고,
  구간 전체에서 `it`/`test` 순증감 **0**, `expect` 순증감 **0**, 삭제된 시험 파일 **0**이다.
  빠진 `style-grid.tsx`와 `option-chip.tsx`는 지워지지 않고 그대로 있다(다른 자리에서 쓴다).

### ② skip · only · todo 전수 — 0건

`it.skip` · `describe.skip`(무조건) · `it.only` · `it.todo` · `xit` · `xdescribe`
**저장소 전체에 한 자리도 없다.**

시험을 끄는 장치는 **조건부 skip 55자리**뿐이고, 전부 같은 형태다:

```
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;
```

- `apps/api` 54개 파일 (`src/test/*` 53 + `src/public-data/sync.test.ts` 1)
- `packages/db` 1개 파일 (`src/schema.test.ts`, 변수명만 `connectionString`이고 값은 같은 `process.env.DATABASE_URL`)

**왜 꺼져 있는가**: 진짜 Postgres가 필요한 시험이라 DB 없는 환경에서 통째로 빠진다.

**CI에서도 꺼지는가 — 아니다. CI에서는 돈다.** 근거 둘:

1. `.github/workflows/main.yml:52`가 잡 수준에서
   `DATABASE_URL: postgres://weddingpick:weddingpick@localhost:5432/weddingpick_test`를 설정하고,
   같은 잡의 `services.postgres`가 `postgres:16`을 **같은 자격증명으로** 띄운다
   (`POSTGRES_USER/PASSWORD/DB` 일치, `pg_isready` 헬스체크).
2. 말로 믿지 않고 **직접 재현했다.** 이 조사에서 postgres 16(CI와 같은 major)을 CI와 같은
   자격증명(`weddingpick`/`weddingpick`/`weddingpick_test`)으로 띄우고 `DATABASE_URL`을 준 채 다시 돌렸다.
   - `packages/db`: **79 건너뜀 → 79 통과**
   - `apps/api`: **54 suite·817 건너뜀 → 85 suite 전부 실행, 1,075 통과, 건너뜀 0, 실패 0**

   조건부로 꺼져 있던 **896개가 전부 진짜로 돌고 전부 통과한다.** 껍데기가 아니다.
   CI가 이 896개를 조용히 건너뛰고 있던 것이 아니다.

즉 **로컬 초록과 CI 초록이 갈린다**는 것은 여전히 사실이나, 갈리는 방향이 안전한 쪽이다 —
로컬이 덜 돌고 CI가 더 돈다. CI가 조용히 건너뛰는 것이 아니다.

### ② 초록인데 아무것도 안 지키는 시험 — 0건

단언(`expect`/`assert`/`toThrow`/스냅샷)이 하나도 없는 `it()`: **없다.**
스캐너가 1건(`apps/web/src/site.test.ts:337`)을 올렸으나 **손으로 열어 확인한 결과 오탐**이다
(`expect` 3개가 있다. 본문에 따옴표를 담은 정규식 리터럴이 있어 파서가 본문을 짧게 잘랐다).
이 한계는 스크립트 머리에 적어 뒀다 — 「단언 없음」으로 걸린 자리는 세지 말고 눈으로 확인한다.

**자기가 만든 값을 자기가 확인하는 자리**도 찾아봤다. 생성물 방어 장치 둘을 열어 확인했다:
- `apps/mobile/.../depth-back.test.ts`는 `readdirSync`로 **실제 라우트 디렉터리를 걸어서** 목록과 비교한다.
- `apps/api/src/test/seed-parity.test.ts`는 `packages/ui/src/theme.ts`와
  `node_modules/@seed-design/css/package.json`을 **파일로 읽어서** 비교한다.

둘 다 같은 상수를 양쪽에서 import하는 자기확인이 아니다.

### ③ 생성물을 지키는 장치 — 6개 전부 살아 있다

`main.yml`의 CI 잡과 대조했다. **빠진 것 없음. `continue-on-error`는 `main.yml` 전체에 0건.**

| 장치 | main.yml 연결 | 직접 돌려본 결과 |
|---|---|---|
| `scripts/sync-seed-tokens.mjs --check` | L77 「SEED 토큰」 | exit 0 — `SEED와 같다 (@seed-design/css@2.8.1)` |
| `lint-copy.js spec/strings.ko.json apps packages` | L83 「Copy lint (금지어)」 | exit 0 — `금지어 없음` |
| `seed-parity` · `tokens` · `typography` 시험 | L86 `npm test` 안 | 통과 (api 초록에 포함) |
| `apps/web/src/site.test.ts` | L86 `npm test` 안 | 통과 (web 9/73 초록) |
| `scripts/check-destructive-migrations.js` | L165 · L219 (배포 잡) | exit 0 — `되돌릴 수 없는 구문 없음` |
| `depth-back.test.ts` (라우트 목록) | L86 `npm test` 안 | 통과 (mobile 32/348 초록) |

배포가 시험을 건너뛸 수 있는지도 봤다. `deploy-staging`·`deploy-production` **둘 다 `needs: [ci]`**라
CI가 빨가면 배포가 시작되지 않는다.

### ⑤ 보고와 실제 — 1건 기록

`docs/rn-migration/VENDOR_SCREEN_PARITY.md:157`

> 검증: typecheck·lint·`lint-copy`·jest(mobile 332 · api-contract 26) 전부 초록.

「전부 초록」이라 적었지만 괄호가 밝히듯 **6개 워크스페이스 중 2개만 돌았다.**
`api`(1,075) · `domain`(960) · `web`(73) · `db`(79)는 그 실행에 없었다.
괄호가 범위를 밝히고 있어 허위는 아니나, 「전부」라는 낱말이 실제보다 넓다.
숫자(332 · 26)는 현재(348 · 34)보다 작아 그 시점의 값으로 보이며, 시험이 줄어든 흔적은 아니다.

### 이 조사 PR의 CI 결과 — 초록, 그러나 **몇 개가 돌았는지는 못 봤다**

PR #242 (head `15b0a352`) CI: **success**. 16단계 전부 성공했다.
`Initialize containers`(postgres 서비스)·`SEED 토큰`·`Copy lint (금지어)`·`Test`·
`API health validator test`·`Render deploy orchestration test` 모두 초록.
`Deploy → Staging`·`Deploy → Production`은 **skipped** — PR이라 `if:` 조건에 걸리지 않았다. 정상이다.

경고 4건은 전부 기존 것이다(Node 20 deprecation · `Import in body of module` ×2 ·
`useEffect` 의존성). 내가 넣은 두 파일은 마크다운 문서와 루트 `scripts/`의 `.mjs`이고,
`npm run lint`는 워크스페이스(`apps/*`·`packages/*`)만 보므로 **둘 다 린트 범위 밖**이다. 내 것이 아니다.

**못 봤다 — CI에서 실제로 몇 개의 시험이 돌았는지.**
GitHub 작업 로그는 `productionresultssa3.blob.core.windows.net`으로 리다이렉트되는데
이 환경의 조직 네트워크 정책이 그 호스트를 막는다(`connect_rejected`, 403).
우회하지 않았다. 그래서 **CI 쪽 실측 수치는 이 조사에 없다.**

내가 세운 「CI에서 2,569개가 전부 돈다」는 **추론이지 관측이 아니다.** 근거는
① `main.yml:52`가 `DATABASE_URL`을 설정하고 같은 잡의 postgres 서비스가 떴다는 것
(`Initialize containers` 성공), ② 같은 major·같은 자격증명으로 내가 로컬에서 재현해
2,569개가 전부 돌고 전부 통과한 것. **CI 로그로 확인한 것이 아니다.**

---

## 남은 구멍 — 무력화는 아니나 적어 둔다

1. **`packages/ui`에 시험 스크립트가 없다.** `npm test`는 `--if-present`라
   시험 스크립트가 없는 워크스페이스를 **아무 말 없이 건너뛴다.** 지금 `packages/ui`에는
   시험 파일이 0개라 잃는 것이 없다. 그러나 여기에 시험을 하나 넣으면 **CI에서 영영 돌지 않는다.**
   초록인 채로. 이 저장소에서 「조용히 빠지는」 사고가 나기 가장 쉬운 자리다.

2. **기준선이 `packages/db`를 빠뜨리고 있다.** 2026-09-15 기준선은 다섯 워크스페이스만 센다
   (api·domain·mobile·web·api-contract). `packages/db`의 1 suite / **79 tests**가 목록에 없어
   전체를 2,490으로 과소 계상한다. 실제는 **191 suites / 2,569 tests**다.
   이 79개가 통째로 사라져도 기준선 대조로는 잡히지 않는다.

3. **`apps/mobile/jest.config.js`가 `testTimeout`을 두 번 선언한다.**
   같은 객체 리터럴 안에서 **L20 `testTimeout: 30000`** 과 **L42 `testTimeout: 20_000`** 이 둘 다 있다.
   자바스크립트는 뒤엣것이 이기므로 **실효값은 20초**다 — `node -e "require(...).testTimeout"`으로
   실행해 확인했다(`20000`).
   L1–18의 긴 근거(「30초는 실측 최악 6.4초의 다섯 배」)는 **죽은 글**이고,
   그 파일 머리만 읽는 사람은 30초라고 믿게 된다.
   시험을 끄는 것이 아니고 20초도 실측 최악(6.8초)의 세 배라 **무력화로 판정하지 않는다.**
   다만 「글이 말하는 것과 코드가 하는 것이 갈린 자리」라 적어 둔다. 고치는 것은 이 세션 일이 아니다.

4. **CI가 시험 수를 어디에도 남기지 않는다 — 이것이 이 감시의 가장 큰 사각지대다.**
   `main.yml`에 `$GITHUB_STEP_SUMMARY`를 쓰는 곳이 **0곳**이고, 시험 결과 아티팩트도 없다
   (올라가는 아티팩트는 `marketing-preview` 984바이트 하나뿐).
   그래서 **⑤ 「보고와 실제 대조」를 CI 실행에 대해서는 수행할 수 없다.**
   누가 「전부 초록」이라 적었을 때 그 실행에서 몇 개가 돌았는지 맞춰 볼 근거가 로그밖에 없는데,
   그 로그를 이 세션이 읽지 못한다. 시험이 조용히 줄어도 **CI 쪽에서는 잡히지 않는다.**
   고치는 것은 이 세션 일이 아니나, 대표님께 올린다 — `Test` 단계가 jest 요약
   (`Tests: N passed, M skipped, T total`)을 `$GITHUB_STEP_SUMMARY`에 한 줄 적어 주기만 해도
   체크런 API로 읽혀 이 사각지대가 사라진다.

5. **루트 `scripts/`가 린트·타입검사 범위 밖이다.**
   `npm run lint`·`npm run typecheck` 모두 `--workspaces`라 `apps/*`·`packages/*`만 본다.
   그런데 CI 방어 장치 셋(`sync-seed-tokens.mjs` · `check-destructive-migrations.js` ·
   `check-api-health.mjs`)이 바로 거기 있다. 그중 시험이 있는 것은 `check-api-health`
   (`check-api-health.test.mjs`)와 `render-env-sync`(`test-render-env-sync.py`) 둘뿐이다.
   **`sync-seed-tokens.mjs`와 `check-destructive-migrations.js`는 지키는 쪽인데 자기를 지키는 시험이 없다.**

6. **jest 6개 워크스페이스 전부 `--forceExit`다.** 실패를 숨기지는 않지만,
   닫히지 않은 핸들을 덮어 버린다. 시험을 끄는 장치는 아니므로 판정에 넣지 않고 기록만 한다.

## 다음 주기에 볼 것

- 기준선을 **191 suites / 2,569 tests**로 갱신할지 대표님 판단을 받는다 (`packages/db` 포함 여부).
- `packages/ui`에 시험 파일이 생기는지 지켜본다. 생기면 1번 구멍이 바로 사고가 된다.
- `main.yml`에 `continue-on-error`가 붙거나 위 6개 장치가 빠지는지 매번 대조한다.
- **CI 로그 접근이 막혀 있는 한 ⑤는 반쪽이다.** 위 4번이 해결되기 전까지, 「CI에서 몇 개가 돌았다」는
  이 문서에 적지 않는다. 적을 수 있는 것은 「CI가 success였다」까지다.
- 시험별 타임아웃이 더 올라가는지 본다. 현재: api 60초 · db 60초 · mobile **20초(실효)** ·
  web·domain·api-contract는 jest 기본 5초. 개별 시험에 3번째 인자로 타임아웃을 준 자리는 0건이다.
