# 보존 3건 규칙

2026-09-10 사용자 오더.

> git 저장소, DB, API 기타 등등 최신 자료 또는 정보 3건만 유지한다.
> 오래되거나 불필요한 정보 또는 자료는 흡수 후 정리한다.

한 번 치우고 끝나면 다시 쌓인다. 그래서 규칙을 여기 적고, 쌓이면 알려주는 워크플로를
`.github/workflows/retention-check.yml`에 둔다.

## 무엇에 걸리는가

**같은 것이 판을 바꿔가며 쌓이는 것**에 걸린다.

| 대상 | 남기는 것 |
|---|---|
| 정책 문서 판(`통합정책 v3.x`) | 최신 3판 |
| 디자인 핸드오프 세대 | 최신 3세대 |
| 감사 보고서 · 상태 현황판 · 전환 스냅샷 | 최신 3건 |
| 원격 브랜치 | 내용이 `main`에 없는 것만 |
| DB 수집 이력 · 사용량 기록 | 표별 보존 기간(아래) |
| 같은 일을 하는 워크플로 | 최신 1개 |

## 무엇에 걸리지 않는가 — 지우면 서비스가 사라진다

- **운영 데이터.** 업체 · 사용자 · 세션 · Pick · 제보. 3건으로 줄이라는 뜻이 아니다.
- **마이그레이션**(`packages/db/migrations/*.sql`). 이력처럼 보이지만 스키마를 만드는
  부품이다. 하나라도 빠지면 새 DB를 만들 수 없다. **절대 지우지 않는다.**
- **법적 보존 대상.** `structured.withdrawal_audit_log` ·
  `structured.user_consents` · `structured.document_consents` ·
  `structured.payment_consents`. 보유기간은 개인정보처리방침이 정한다.
- **코드가 인용하는 과거 판.** `docs/archive/통합정책 v3.10`은 판으로는 다섯 번째로
  오래됐지만 코드 16곳이 `v3.10 §…`로 인용한다. 인용을 최신 판으로 옮기기 전에는
  지우지 않는다.

## 지우기 전에 흡수한다

브랜치를 지우면 거기 있던 유일한 개선도 같이 사라진다. 순서는 항상 **흡수 → 정리**다.

0. **`git fetch --unshallow` 먼저.** 세션이 받는 클론은 얕을 수 있고, 얕으면 브랜치와
   `main`에 공통 조상이 없어 `git diff`가 `no merge base`로 죽는다. 그 빈 출력을
   「차이 없음」으로 읽으면 **살아 있는 브랜치가 삭제 목록에 올라간다.** 2026-09-10
   조사에서 실제로 그랬다 — 얕은 클론에서 82개, 전체 클론에서 17개가 나왔다.
   `git rev-parse --is-shallow-repository`가 `false`인지 먼저 확인한다.
1. `git diff origin/main...<브랜치>`로 **실제 차이**를 본다. 커밋 수는 믿지 않는다 —
   이 저장소는 스쿼시 머지를 써서 내용이 이미 `main`에 있어도 커밋은 「머지 안 됨」으로 남는다.
2. 차이가 나온 파일을 `git diff origin/<브랜치> origin/main -- <그 파일들>`로 다시 본다.
   **여기서 0이면 내용이 이미 `main`에 있다** — 지워도 된다.
   0이 아닌 것은 「가져올 것이 있다」가 아니라 「같지 않다」일 뿐이다. 브랜치가 뒤처져도
   0이 아니다. 판단은 한 건씩 열어 보고 한다.
3. 남은 것이 있으면 흡수하고 나서 지운다. 흡수할 때 **마이그레이션 번호가 겹치는지
   먼저 본다.** 겹친 채로 두면 하나가 조용히 빠진다.

## 되돌릴 수 있는가

| 작업 | 되돌릴 수 있나 | 절차 |
|---|---|---|
| 문서 삭제 | 예 — git 이력에 남는다 | 계획 보고 후 진행 |
| 브랜치 삭제 | 예 — SHA를 적어 두면 `git push origin <SHA>:refs/heads/<이름>`로 되살린다 | Actions → 「브랜치 정리」 |
| **DB 행 · 표 삭제** | **아니오** | **계획만 세우고 사용자 승인을 받은 뒤 실행한다** |

DB는 지우기 전에 `SELECT count(*)`로 실제 건수를 세어 계획서 숫자와 맞는지 확인한다.
숫자가 다르면 실행하지 않고 다시 보고한다.

**브랜치는 세션에서 지울 수 없다.** 컨테이너에서 `git push --delete`가 403으로 막힌다.
`.github/workflows/branch-cleanup.yml`(Actions → 「브랜치 정리」)로 지운다 — 러너에서는
막히지 않고, 돌 때마다 스스로 다시 세며, 열린 PR의 head와 최근 브랜치를 걸러낸다.
403을 「지웠다」로 적지 않는다: 2026-09-10에 실제로 그렇게 적혀서 27개가 지워진 줄 알았다.

## 지우지 않는 브랜치

```
main
claude/weddingpick-master-bootstrap-6j1c7o   MASTER
claude/admin-console       claude/webview-design     claude/inapp-browser
claude/admin-accounts      claude/admin-split        claude/badge-clipping
claude/retention-3
release/public-data-sbiz-key-guard           흡수 전 (0건 수집을 초록으로 넘기는 것을 막는다)
```

살아 있는 전담 브랜치와 열린 PR의 head 브랜치는 지우지 않는다. 브랜치를 지우면 그
브랜치를 head로 하는 열린 PR이 닫힌다 — 지우기 전에 열린 PR 목록을 확인한다.

현재 상태와 한 건씩의 판단은 [unmerged-branches.md](unmerged-branches.md)에 있다.

## DB 보존 계획 — 승인 대기

**아직 한 건도 지우지 않았다.** 대상은 전부 **수집·사용량 이력**이고 운영 데이터가 아니다.

### 먼저 센다 — Actions → 「DB Inventory (읽기 전용)」

`scripts/db-inventory.ts`가 아래 여덟 줄을 함께 찍는다(「보존 대상 이력」 절).
**세기만 하고 아무것도 바꾸지 않는다.** 건수와 함께 가장 오래된 것 · 가장 최근 것의
시각을 찍는 것은, 건수만으로는 「90일 보존」이 몇 건을 지우게 되는지 알 수 없기 때문이다.

| 표 | 성격 | 제안 보존 |
|---|---|---|
| `structured.import_runs` | 수집 실행 이력 | 출처별 최근 3회 + 90일 |
| `structured.import_errors` | 실행별 오류 | 남은 `import_runs`에 딸린 것만(FK가 `ON DELETE CASCADE`라 함께 지워진다) |
| `structured.vendor_source_records` | 출처 원본 행 | 업체별 최신 1건 |
| `structured.ai_usage` | 모델 사용량 기록 | 90일(월별 집계는 남긴다) |
| `structured.infra_costs` | 요금 수집 스냅샷 | 월별 최신 1건 |
| `ads.launch_reports` | 광고 개시 보고서 | 최근 3건 |

`structured.vendor_change_log`는 **판단 필요**라 지우는 대상에 넣지 않았지만 건수는 함께
찍는다 — 이력이지만 업체 정보가 언제 왜 바뀌었는지를 되짚는 유일한 기록이고, 관리자
화면이 읽는다.

### 그다음에 승인을 받는다

나온 숫자를 계획서에 적어 사용자에게 올리고, 승인을 받은 뒤에 실행한다. 실행 직전에
다시 세어 계획서 숫자와 맞는지 확인한다. 다르면 **실행하지 않고 다시 보고한다.**

## 판단 필요 — 지우지 않고 올린다

| 대상 | 왜 애매한가 |
|---|---|
| `docs/archive/통합정책 v3.10` (688K) | 판으로는 오래됐으나 코드 16곳이 인용 중 |
| `docs/design-handoff/archive-toss-v7-README.md` | 세 세대 중 가장 오래됐지만 `README.md` 두 곳이 「역사적 맥락용」으로 의도해 남김 |
| `scripts/gen-icons.js` · `scripts/gen-store-screenshots.js` | 참조 0건이나 사람이 손으로 돌리는 자산 생성기 |
| `structured.vendor_change_log` | 위 참조 |
