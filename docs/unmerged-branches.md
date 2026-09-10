# 원격 브랜치 조사 — 2026-09-10

`origin`에 브랜치가 **112개**(`main` 포함) 있다.

| | 수 |
|---|---|
| 내용이 이미 `main`에 있다 → 지운다 | **17** |
| `main`과 실제로 다르다 → 남긴다 | **94** |
| `main` | 1 |

## 재는 방법 — 얕은 클론에서 재면 전부 틀린다

이 조사를 처음 돌렸을 때 「지워도 되는 브랜치 82개」가 나왔다. **틀린 숫자였다.**
세션이 받은 클론이 얕아서(`git rev-parse --is-shallow-repository` → `true`, 커밋 91개)
78개 브랜치가 `main`과 **공통 조상이 없었고**, `git diff origin/main...<브랜치>`가
`no merge base`로 죽으면서 출력이 비었다. 빈 출력을 「차이 없음」으로 읽으면 살아 있는
브랜치가 삭제 목록에 올라간다.

**재기 전에 반드시 `git fetch --unshallow`한다.** 전체 클론(커밋 537개)에서 다시 세니
82개가 아니라 17개였다.

```
1) git diff --name-only -z origin/main...origin/<브랜치>
   → 브랜치 쪽에서 달라진 파일. 0이면 조상이다

2) 1)에서 나온 파일들을 두 점 비교로 다시 본다
   git diff --name-only origin/<브랜치> origin/main -- <그 파일들>
   → 0이면 스쿼시로 이미 들어간 것이다
```

커밋 수는 믿지 않는다. 이 저장소는 스쿼시 머지를 써서 내용이 이미 들어간 브랜치도
「머지 안 됨」으로 나온다.

**2단계가 0이 아니라고 해서 「가져올 것이 있다」는 뜻은 아니다.** 브랜치가 뒤처졌을 때도
0이 아니다. 그래서 아래 표에 `main 재작업` 칸을 뒀다 — 브랜치의 마지막 커밋 **뒤에**
`main`이 그 파일을 다시 손댔는지 센 것이다. 전부 다시 손댔으면 `main`이 그 자리를 이미
지나갔다는 뜻이고, 하나도 안 손댔으면 그 브랜치에만 있는 것일 가능성이 높다.

## 지워도 되는 17개

내용이 `main`과 한 글자도 다르지 않다.

**아직 한 개도 지워지지 않았다.** 원격 브랜치는 여전히 112개다
(`git ls-remote --heads origin | wc -l`). 컨테이너에서는 `git push origin --delete`가
HTTP 403으로 막힌다 — 같은 자격으로 브랜치 **푸시는 된다**.

지우는 길은 **Actions → 「브랜치 정리」**(`.github/workflows/branch-cleanup.yml`)다. 러너에서는
403이 걸리지 않는다. 돌 때마다 스스로 다시 세므로 아래 목록보다 그쪽이 맞고, 열린 PR의
head와 최근 브랜치도 알아서 걸러낸다. `dry_run`을 켠 채 돌려 목록을 보고, 맞으면 끄고
다시 돌린다.

같은 날 [branch-cleanup-2026-09-10.md](branch-cleanup-2026-09-10.md)가 27개를 「지웠다」고
적었지만 **실제로는 지워지지 않았고, 그중 16개는 차이가 0도 아니었다** — 얕은 클론에서 센
숫자다. 그 파일 맨 위에 정정을 적었다. 그쪽은 되살릴 SHA 기록이고, 이 파일은 지금 상태와
브랜치별 판단이다.

| 브랜치 | 팁 SHA | 마지막 커밋 |
|---|---|---|
| `claude/daily-progress-briefing-3k7lez` | `a3ead320` | 2026-09-02 |
| `claude/fix-db-migration-0061` | `856c37b3` | 2026-09-02 |
| `claude/fix-db-migration-0062` | `94feee79` | 2026-09-02 |
| `claude/home-c1` | `b719c880` | 2026-09-01 |
| `claude/marketing-banned-terms` | `fc1d14c4` | 2026-09-09 |
| `claude/payment-proof-count-fix` | `08fce744` | 2026-09-02 |
| `claude/wedding-pick-android-apk-tjo2gg` | `512e6b08` | 2026-09-04 |
| `claude/weddingpick-handoff-link-fix` | `6fb28ccf` | 2026-09-07 |
| `claude/withdrawal-copy-alignment-15037` | `bcbdab8e` | 2026-09-02 |
| `codex/social-login-completion` | `2bf2186b` | 2026-09-03 |
| `codex/web-copy-responsive` | `09615398` | 2026-09-08 |
| `codex/web-open-graph` | `7bcb57de` | 2026-09-04 |
| `fix/monthly-draw-migration-collision` | `0ea99ffb` | 2026-09-02 |
| `fix/stale-policy-status-tests` | `553a79e9` | 2026-09-02 |
| `release/block-system-alert-window` | `79341cdd` | 2026-09-09 |
| `release/enable-google-play-submit` | `fee8f019` | 2026-09-09 |
| `release/play-first-release-checklist` | `6f73f50e` | 2026-09-09 |
되돌리려면 `git branch <이름> <SHA>`.

열린 PR 6건(#168 · #164 · #152 · #142 · #135 · #133)의 head 브랜치는 **하나도 이 17개에
없다.** 지워도 닫히는 PR은 없다.

## `main`이 그 파일을 뒤에 손대지 않은 12개 — 흡수 우선

그 브랜치에만 있는 것일 가능성이 높은 쪽이다. 대부분 지금 살아 있는 전담 브랜치다.

| 브랜치 | 마지막 커밋 | 남은 파일 | main 재작업 |
|---|---|---|---|
| `claude/audit-review-2026-09-07` | 2026-09-07 | 1/1 | 0/1 |
| `fix/render-sync-inputs-context` | 2026-09-07 | 1/1 | 0/1 |
| `codex/github-audit-handoff-20260907` | 2026-09-07 | 5/5 | 0/5 |
| `claude/release-audit` | 2026-09-09 | 1/1 | 0/1 |
| `claude/weddingpick-master-bootstrap-6j1c7o` | 2026-09-10 | 3/3 | 0/3 |
| `claude/admin-split` | 2026-09-10 | 5/5 | 0/5 |
| `claude/retention-3` | 2026-09-10 | 5/5 | 0/5 |
| `claude/inapp-browser` | 2026-09-10 | 7/7 | 0/7 |
| `claude/badge-clipping` | 2026-09-10 | 9/9 | 0/9 |
| `claude/webview-design` | 2026-09-10 | 12/12 | 0/12 |
| `claude/admin-accounts` | 2026-09-10 | 15/78 | 0/78 |
| `claude/admin-console` | 2026-09-10 | 18/18 | 0/18 |
전담 브랜치가 아닌 셋은 따로 본다.

| 브랜치 | 무엇이 있나 | 판단 |
|---|---|---|
| `fix/render-sync-inputs-context` | `render-env-sync.yml` (+2 −7) | **가져올 값어치 있음.** `main`에 없는 정리다 |
| `claude/audit-review-2026-09-07` | 감사 보고서 1건 (342줄) | 감사 보고서는 09-07 두 건 · 09-09 한 건으로 3건이라 한도 안이다. 남긴다 |
| `codex/github-audit-handoff-20260907` | 감사 산출물 5건 (1,157줄, CSV 포함) | 위와 같은 세대. 남긴다 |

## 일부만 겹치는 17개 — 판단 필요

| 브랜치 | 마지막 커밋 | 남은 파일 | main 재작업 |
|---|---|---|---|
| `claude/lifecycle-policy-scope` | 2026-09-02 | 2/2 | 1/2 |
| `claude/frontend-development-i1j2aa` | 2026-09-02 | 7/7 | 6/7 |
| `claude/backend-gaps-9xrh1d` | 2026-09-02 | 45/45 | 7/45 |
| `claude/front-dev-start-nrr0jh` | 2026-09-02 | 72/72 | 30/72 |
| `claude/render-migration` | 2026-09-03 | 4/7 | 6/7 |
| `copilot/analyze-code-and-identify-issues` | 2026-09-03 | 5/5 | 4/5 |
| `claude/fe-screens-common-states` | 2026-09-03 | 9/11 | 9/11 |
| `claude/fe-screens-our-my-home` | 2026-09-03 | 11/12 | 11/12 |
| `docs/hybrid-web-policy` | 2026-09-04 | 2/2 | 1/2 |
| `hybrid/qa-home-entry-shared` | 2026-09-04 | 4/4 | 3/4 |
| `codex/wedding-public-data-pipeline` | 2026-09-04 | 16/22 | 21/22 |
| `docs/consolidate-policy-main` | 2026-09-05 | 2/2 | 1/2 |
| `feat/auth-v3.11` | 2026-09-06 | 26/70 | 27/70 |
| `claude/p0-cors-and-smoke` | 2026-09-07 | 6/6 | 4/6 |
| `claude/data-collect-refine-d1d3` | 2026-09-09 | 8/8 | 6/8 |
| `claude/alimtalk-channel` | 2026-09-09 | 13/13 | 1/13 |
| `claude/weddingpick-vendor-monitor` | 2026-09-10 | 5/32 | 31/32 |
`release/public-data-sbiz-key-guard`는 이 표에 없지만 **지우지 않는다** — 0건 수집을 조용히
초록으로 넘기던 것을 막는 작업이고 아직 흡수되지 않았다(`public-data.yml` 1파일).

## `main`이 그 파일을 전부 다시 손댄 65개 — 가장 나중에 본다

`main`이 그 자리를 이미 지나갔다. 지워도 될 가능성이 높지만 **자동으로 판정하지 않는다** —
한 건씩 열어 보고 지운다.

<details>
<summary>65개</summary>

| 브랜치 | 마지막 커밋 | 남은 파일 | main 재작업 |
|---|---|---|---|
| `flyio-new-files` | 2026-09-01 | 1/1 | 1/1 |
| `docs/session-handoff-staging-green` | 2026-09-02 | 1/1 | 1/1 |
| `claude/fix-migration-numbering-collision-260902` | 2026-09-02 | 4/4 | 4/4 |
| `claude/fe-screens-expo` | 2026-09-02 | 5/5 | 5/5 |
| `fix/lint-set-state-in-effect` | 2026-09-02 | 6/6 | 6/6 |
| `claude/backend-gaps-olvj3m` | 2026-09-02 | 11/11 | 11/11 |
| `claude/wedding-events-map-view-260902` | 2026-09-02 | 24/27 | 27/27 |
| `claude/information-gathering-sy6e01` | 2026-09-02 | 25/25 | 25/25 |
| `claude/fe-design-pixel-match` | 2026-09-03 | 2/2 | 2/2 |
| `codex/sync-kakao-p0-handoff` | 2026-09-03 | 2/2 | 2/2 |
| `home/fe-expo-screens` | 2026-09-03 | 5/5 | 5/5 |
| `claude/fe-screens-admin-p0` | 2026-09-03 | 9/9 | 9/9 |
| `claude/fe-screens-cpl-biz-sht-2nd` | 2026-09-03 | 9/9 | 9/9 |
| `claude/web-front-office` | 2026-09-03 | 11/12 | 12/12 |
| `home/fe-p0-gaps` | 2026-09-03 | 78/90 | 90/90 |
| `hybrid/guest-removal` | 2026-09-04 | 6/6 | 6/6 |
| `hybrid/qa-pick` | 2026-09-04 | 6/6 | 6/6 |
| `docs/hybrid-web-qa-checklist` | 2026-09-04 | 7/8 | 8/8 |
| `hybrid/shell-poc` | 2026-09-04 | 7/9 | 9/9 |
| `design/pick-screen` | 2026-09-04 | 12/12 | 12/12 |
| `design/home-screen` | 2026-09-04 | 13/13 | 13/13 |
| `design/wedding-my` | 2026-09-04 | 13/13 | 13/13 |
| `hybrid/qa-my-events` | 2026-09-04 | 15/19 | 19/19 |
| `hybrid/qa-search-vendor` | 2026-09-04 | 15/19 | 19/19 |
| `design/search-vendor` | 2026-09-04 | 16/16 | 16/16 |
| `hybrid/wedding-followups` | 2026-09-04 | 17/18 | 18/18 |
| `design/search-vendor-clean` | 2026-09-04 | 24/24 | 24/24 |
| `claude/session-a4bq31` | 2026-09-05 | 8/11 | 11/11 |
| `feat/login-other-page` | 2026-09-05 | 9/9 | 9/9 |
| `fix/render-blueprint-sync-nonblocking` | 2026-09-06 | 1/1 | 1/1 |
| `fix/web-autofill-input` | 2026-09-06 | 1/2 | 2/2 |
| `fix/oauth-web-redirect` | 2026-09-06 | 2/2 | 2/2 |
| `fix/public-data-workflow-secrets-if` | 2026-09-06 | 4/4 | 4/4 |
| `fix/kakao-authorization-code-flow` | 2026-09-06 | 11/12 | 12/12 |
| `fix/vendor-category-and-login-visuals` | 2026-09-06 | 12/14 | 14/14 |
| `feat/email-login` | 2026-09-06 | 48/54 | 54/54 |
| `claude/point-api-to-migrated-db` | 2026-09-07 | 1/1 | 1/1 |
| `claude/fix-popup-regression` | 2026-09-07 | 1/3 | 3/3 |
| `claude/check-render-deploy-status` | 2026-09-07 | 2/2 | 2/2 |
| `claude/render-manual-deploy` | 2026-09-07 | 2/2 | 2/2 |
| `claude/onboarding-absorb-signup` | 2026-09-07 | 3/5 | 5/5 |
| `feat/render-env-automation` | 2026-09-07 | 3/5 | 5/5 |
| `feat/landing-fixed-vendors` | 2026-09-07 | 4/4 | 4/4 |
| `claude/fix-auth-popup-splash` | 2026-09-07 | 5/6 | 6/6 |
| `claude/stabilize-p0` | 2026-09-07 | 5/7 | 7/7 |
| `claude/onboarding-restore` | 2026-09-07 | 8/10 | 10/10 |
| `claude/weddingpick-repo-cleanup-7n9pzr` | 2026-09-07 | 9/12 | 12/12 |
| `fix/canonical-pick-mark` | 2026-09-07 | 15/16 | 16/16 |
| `be/cors-origins` | 2026-09-09 | 1/1 | 1/1 |
| `be/env-split-1to3` | 2026-09-09 | 1/1 | 1/1 |
| `be/prod-db-url-note` | 2026-09-09 | 1/1 | 1/1 |
| `claude/ci-marketing-preview-path` | 2026-09-09 | 1/1 | 1/1 |
| `release/drop-unused-android-permissions` | 2026-09-09 | 1/1 | 1/1 |
| `release/public-data-apply-in-chunks` | 2026-09-09 | 1/1 | 1/1 |
| `release/public-data-sbiz-key-guard` | 2026-09-09 | 1/1 | 1/1 |
| `be/defect-list-update` | 2026-09-09 | 2/2 | 2/2 |
| `claude/weddingpick-session-routine-cleanup-w48c3t` | 2026-09-09 | 2/2 | 2/2 |
| `fe/web-price-line-sweep` | 2026-09-09 | 2/3 | 3/3 |
| `fe/copy-gate-reads-glossary` | 2026-09-09 | 3/10 | 10/10 |
| `fe/docs-report-path-and-g13-price-line` | 2026-09-09 | 4/5 | 5/5 |
| `be/collection-guards` | 2026-09-09 | 5/5 | 5/5 |
| `be/kill-switches-wired` | 2026-09-09 | 5/9 | 9/9 |
| `claude/weddingpick-data-collection-q72atr` | 2026-09-09 | 9/11 | 11/11 |
| `fix/legal-responsive-review` | 2026-09-10 | 3/8 | 8/8 |
| `claude/weddingpick-admin-uiux` | 2026-09-10 | 5/33 | 33/33 |
</details>

## 규칙

보존 규칙은 [retention-policy.md](retention-policy.md)에 있다. 흡수할 때
**마이그레이션 번호가 겹치는지 먼저 본다** — `vendor-monitor`가 `0098`을, 마스터가 `0098`을
각자 집어 충돌했다. 그대로 두면 하나가 조용히 빠진다.
