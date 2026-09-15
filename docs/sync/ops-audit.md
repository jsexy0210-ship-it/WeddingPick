# 배포 · DB · 비용 감시 기록

저장소 **밖에서 실제로 일어난 일**을 적는 자리다. CI가 초록인 것과 운영이 멀쩡한 것은 다르다.

판정은 **정상 · 이상 · 못 봤다** 셋뿐이다. 애매모호 표현은 쓰지 않는다.
시각은 사람에게 말하는 자리라 KST로 적는다(저장값 · cron은 UTC 그대로).

---

## 2026-09-15 11:54 KST — 1회차

기준 커밋: `main` `ecd114ac` (2026-09-15 11:42 KST)

### 이 회차에서 못 본 것부터 적는다

이 세션의 조직 egress 정책이 **`weddingpickl-sg.onrender.com`과 `api.github.com`을 막는다.**
프록시가 CONNECT에 403을 돌려준다(2026-09-15 11:52 KST 기록, `__agentproxy/status`
`recentRelayFailures`). 정책 거부라 우회하지 않고 적어 둔다.

그래서 **다음 넷은 이번 회차에 「못 봤다」다.**

| 항목 | 판정 | 이유 |
| --- | --- | --- |
| ① `/health` 본문의 applied/expected · 0330 · 0340 적용 여부 | **못 봤다** | 운영 호스트 차단 |
| ② `main.yml` 실행 기록(승인 대기로 잊힌 것 · 실패 방치) | **못 봤다** | GitHub API 차단 |
| ③ Render 다섯 서비스가 든 커밋 | **못 봤다** | Render · GitHub API 차단 |
| ④ `structured.wedding_feed_runs` · AI 사용 기록 표의 호출 수 · 비용 | **못 봤다** | 운영 DB 접근 없음 |

**이 넷이 이 감시의 핵심이다.** 저장소 안만 보는 것은 다른 세션이 이미 한다.
대표님께 드리는 요청은 이 문서 맨 아래 「대표님 결정이 필요한 것」에 적었다.

### 저장소 안에서 본 것

#### 마이그레이션 번호 전수 — 117개

**겹친 번호 둘.** `0047` · `0102`.

```
0047_monthly_draw.sql        0102_admin_roles.sql
0047_vendor_data_quality.sql 0102_age_verified_via.sql
```

**판정: 정상.** 러너(`packages/db/src/migrate.ts`)가 키로 쓰는 것은 번호가 아니라
**파일명 전체**다(`file.replace(/\.sql$/, '')`). 네 파일의 이름이 서로 달라 넷 다
각각 적용된다 — 2026-09-10에 0102가 겹쳐 시험 셋이 깨진 「적용 기록만 남고 DDL이
조용히 빠지는」 꼴은 지금 이 넷에 해당하지 않는다.

**다만 같은 번호끼리의 순서는 이름이 정한다**(`0047_monthly_draw` → `0047_vendor_data_quality`).
의도가 아니라 사전순이다. 뒤엣것이 앞엣것에 기대는 DDL이면 이름을 잘못 지은 순간
깨진다. 번호를 갈라 주는 자리에서 겹치지 않게 하는 편이 낫다.

**빈 번호: `0052` 하나.** 없어진 것이 아니라 정리된 것이다 —
`c55767c2`에서 들어왔고 `4be7da78`(2026-09-02, PR #25 「마이그레이션 충돌 및 번호 중복
해소」)에서 빠졌다. **운영 DB에는 `0052_...` 행이 남아 있을 수 있다** — 그러면
`schemaState`의 `unknown`에 뜨고 `applied > expected`가 된다.
`scripts/check-api-health.mjs:25`가 그 경우를 통과시키도록 이미 적혀 있다.
**실제로 남아 있는지는 `/health`를 못 봐서 확인하지 못했다.**

0103 위쪽의 큰 번호대 건너뜀(0110 · 0120 · 0130 · 0150 · 0160 · 0210 · 0230 · 0330 · 0340)은
CLAUDE.md의 「배정하는 쪽이 번호대를 미리 갈라준다」 그대로다. 빠진 것이 아니다.

#### 파괴적 구문 — 117개 전수

`node scripts/check-destructive-migrations.js` 실행. **되돌릴 수 없는 구문 없음(exit 0).**

허용 표시(`-- allow-destructive:`)가 붙은 다섯: `0003_document_pages` ·
`0018_retention_after_verification` · `0047_monthly_draw` ·
`0081_drop_planner_agency_vendors` · `0089_taste_category`.

**판정: 정상.**

#### ⑤ 되돌릴 수 없는 것 — 승인하면 운영 DB에 무엇이 들어가는가

`main`에 올라와 있고 **아직 승인 전이면 다음 승인 때 함께 나가는** 스키마 변경 둘이다.
(나갔는지는 `/health`를 못 봐서 확인하지 못했다.)

| 파일 | main 진입 | 무엇이 적용되나 |
| --- | --- | --- |
| `0330_consultation_records.sql` | `8b7fa0dd` 2026-09-15 04:25 KST | `CREATE TABLE structured.consultation_records` + 인덱스 2 (`_wedding_idx` · `_pending_delete_idx`) |
| `0340_wedding_feed.sql` | `777dba52` 2026-09-15 10:12 KST | `CREATE TABLE structured.wedding_feed_posts` + 인덱스 2, `CREATE TABLE structured.wedding_feed_runs` + 인덱스 1 |

**둘 다 더하기만 한다.** `DROP` · `DELETE` · `TRUNCATE` · `ALTER … DROP` 없음.
기존 표를 건드리지 않으므로 이 둘이 적용돼도 되돌릴 것이 생기지 않는다.

**판정: 정상.**

#### ④ 비용 분기 — 1차 0.4원 / 2차 48원

`apps/api/src/analysis/audio-clip.ts` · `apps/api/src/analysis/consultation-reader.ts`

- **`assertFfmpeg()`가 살아 있다.** `clipForClassification()`의 첫 줄이고
  (`audio-clip.ts:118`), ffmpeg가 없으면 던진다. **부르는 쪽이 잡지 않는다** —
  `consultation-reader.ts:194`가 `await`만 하고 `try`로 감싸지 않아, ffmpeg가 없으면
  Gemini를 한 번도 부르지 않고 멈춘다. 「그럼 전체를 보내자」로 넘어가는 길이 없다.
- **길이는 `ffprobe`가 잰다.** `probeSeconds()`가 파일이 도착한 뒤 재고(`audio-clip.ts:126`),
  그 값으로 `checkVisitNoteAudio()`가 다시 막는다(`:137`). 앱이 보낸 `seconds`는
  쓰지 않는다 — 두 시간짜리를 60초라고 적어 보내도 통과하지 않는다.
- **2차는 `analyze`일 때만 부른다.** `consultation-reader.ts:202`가
  `decision.kind !== 'analyze'`에서 반환한다.
- 조각 규격: 앞 180초 + 뒤 120초, 300초 이하는 통째(`CLIP_SKIP_UNDER_SECONDS`).

**판정: 정상.** 다만 이것은 **코드가 그렇게 적혀 있다**는 뜻이고,
**실제 호출 수와 청구액은 못 봤다**(위 ④).

#### ③ 파기 워커 — `manual` 모드에서도 도는가

`apps/api/src/worker-loops.ts:93-173` · `apps/api/src/index.ts:119`

- 워커 루프는 API 프로세스 안에서 돈다. `RUN_WORKER_IN_API !== 'false'`면 켜진다.
- **상담 녹음 파기(`sweepExpiredConsultationAudio`)는 `retentionMode`를 보지 않는다** —
  `worker-loops.ts:113`에서 모드 분기 **밖에** 있다. `manual`에서도 돈다.
- 문서 파기(`sweepExpiredDocuments`)만 `automatic`일 때 돈다(`:101`).
- 주기 10분(`RETENTION_SWEEP_MS`).

**판정: 정상.** 처리방침 제2항의 「24시간을 넘겨 보관하지 않습니다」가 조건 없는 약속이고,
코드가 그 조건 없음을 지킨다.

**`render.yaml`의 `weddingpick-api`에는 `RETENTION_MODE` 선언이 없다** →
`apps/api/src/config.ts:33`의 기본값 `manual`로 돈다. 위 구조 때문에 상담 녹음은
그래도 지워진다. `weddingpick-worker`(`render.yaml:264`)만 `RETENTION_MODE=automatic`을
들고 있는데, 같은 파일 주석이 「Blueprint 동기화가 깨져 있어 이 선언만으로는 서비스가
생기지 않는다」고 적는다. **그 서비스가 실제로 떠 있는지는 못 봤다**(Render 접근 차단).
떠 있다면 문서 파기도 자동으로 돌고, 안 떠 있으면 문서 파기는 사람 몫이다.

#### ② 배포 구조 — 저장소 쪽만 재확인

`render.yaml` 다섯 서비스 전부 `autoDeploy: false`
(`weddingpick-web` · `-app-web` · `-admin` · `-api` · `-worker`).
**그래도 배포는 나간다** — `.github/workflows/main.yml:181`이 `REDEPLOY: 'true'`로
`scripts/render-env-sync.py`를 부른다. 두 파일을 같이 읽어야 한다.

`deploy-staging`은 `push` to `main`에서 돈다(`main.yml:121-123`). `environment: production`이
걸려 있어 승인 앞에서 멈춘다. `deploy-production`은 `workflow_dispatch`로만 돈다(`:195`) —
푸시에서 매번 skipped인 것은 이쪽이다.

**승인 뒤 순서**: 자동 배포 커밋 최신 여부 → DB 상태(적용 전) → 파괴적 구문 확인 →
DB Migrate(운영 DB) → Render 배포 → Health check.

**「자동 배포 커밋 최신 여부」는 승인 게이트 뒤에 있다**(`main.yml:145`). GitHub는
잡 전체를 승인 앞에서 막으므로, `main`이 움직인 뒤 뒤늦게 승인된 옛 실행은
**승인한 직후 이 단계에서 `exit 1`로 죽는다.** 승인한 사람에게는 실패로 보인다 —
이것은 고장이 아니라 설계다. 다만 **그렇게 멈춰 잊힌 실행이 지금 몇 개인지는
못 봤다.**

`check-api-health.mjs`는 상태 코드만 보지 않는다 — `schema.ok` · `schema.pending` 빈 배열 ·
`schema.applied` · `schema.expected`를 본문에서 읽고, `--migrations-dir`로 준 파일 수와
`schema.expected`가 다르면 실패시킨다(`:22`). **판정: 정상.**

---

### 대표님 결정이 필요한 것

**이 세션은 지금 운영을 볼 수 없다.** 저장소만 본다면 다른 감시 세션과 겹치고,
이 세션을 만든 이유가 사라진다. 아래 중 하나가 있어야 ① ② ③ ④를 볼 수 있다.

1. 이 세션의 egress 정책에 `weddingpickl-sg.onrender.com`과 `api.github.com` 허용
2. 또는 운영 DB 읽기 전용 접속 정보

**그리고 이 세션은 푸시가 막혀 있다.** 저장소가 조직에 대해 Claude GitHub App이
붙어 있지 않아 `claude/ops-audit` 브랜치를 올리지 못한다. 이 문서는 지금 로컬
커밋으로만 있다. 푸시를 열려면 <https://github.com/apps/claude/installations/select_target>
에서 앱을 설치하거나 claude.ai 설정에서 GitHub를 다시 연결해야 한다.

### 다음 회차에 볼 것

- ① `/health` 본문 — `applied` · `expected` · `pending` · `unknown`. `0330` · `0340` 적용 여부
- ② `main.yml` 실행 — 승인 대기로 잊힌 것 · 실패 방치된 것
- ③ Render 다섯 서비스의 커밋이 `main`과 같은가 · `weddingpick-worker`가 떠 있는가
- ④ `structured.wedding_feed_runs` · AI 사용 기록 표의 호출 수와 비용
- ⑤ `packages/db/migrations/`에 새 파일이 들어오면 무엇이 적용될지 먼저 적는다
