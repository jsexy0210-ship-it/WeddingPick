# 관리자 화면 전수 조사 — 32화면

2026-09-11 조사. 기준 커밋 `fa331d6`(main). 조사 방법은 **코드 읽기**다 — 화면이 부르는
경로를 뽑고, 서버에 그 경로가 있는지, 있으면 그 핸들러가 실제로 DB를 건드리는지를 봤다.

**라우트가 있는 것과 동작하는 것은 다르다.** 이 조사의 절반은 그 차이였다. 예를 들어
`/v1/admin/faq`는 GET · POST · PUT · PATCH · DELETE 다섯이 다 등록돼 있지만 GET은 빈
배열을 돌려주고 POST는 임의 id를, 나머지는 204만 돌려준다(`routes/admin.ts:995-1009`).
화면은 멀쩡히 그려지고 저장 단추도 눌리는데 아무것도 남지 않는다.

판정은 셋이다.

- **조작** — 운영자가 값을 바꿀 수 있고 그것이 실제로 저장된다
- **조회** — 보기만 된다. 그것이 그 화면의 목적이면 고장이 아니다
- **죽음** — 확인 불가 · 동작 불가 · 안 씀. 근거를 함께 적는다

## 표

| 화면 | 부르는 경로 | 서버에 있는가 | 쓰기 | 판정 |
| --- | --- | --- | --- | --- |
| home | `GET /v1/admin/dashboard` | 있음 · 실제 집계 | 해당 없음 | 대시보드 |
| briefing | `GET /v1/admin/briefing` | 있음 · 실제 집계 | 없음 | 조회 |
| decisions | `GET /v1/admin/decisions/{briefing,open}` | 있음 · 실제 집계 | 없음 | 조회 |
| data-pipeline | `GET /data/pipeline` · `POST /data/pipeline/retry/:id` · `retry-all` | 있음 | 실제 | 조작 |
| queue | `GET /verifications` · `POST /verifications/:id/{review,approve,supplement,reject}` | 있음 | 실제 | 조작 |
| price-stats | `GET /data/price-stats` · `POST /data/price-stats/:vendorId/recalc` | GET 있음 · recalc **가짜** | 없음 | 조회 |
| stats | `GET /v1/admin/price-stats` | 있음 · 실제 집계 | 없음 | 조회 |
| vendors | `GET /vendors` · `PATCH /vendors/:id/{name,status}` · `POST /vendors/:id/merge` | 있음 | 실제 | 조작 |
| images | `GET /data/images` · `POST /data/images/:id/{approve,reject}` | 있음 | 실제(`vendor_images` UPDATE) | 조작 |
| email-matching | `GET /data/email-matching` | 있음 · **고정값** | 없음 | **죽음** |
| users | `GET /users` · `POST /users/:id/withdraw` · `POST /withdrawals/:id/retry` | 있음 | 실제 | 조작 |
| report | `GET /reports?status=` | 있음 · 실제 집계 | 없음 | 조회 |
| rebuttal | `GET /rebuttals` · `POST /rebuttals/:id/{publish,reject}` | 있음 | 실제 | 조작 |
| biz-queue | `GET /biz-queue` · `POST /biz-queue/:id/:action` | GET **고정값** · 쓰기 **없음** | 없음 | **죽음** |
| objections | `GET /objections` · `POST /objections/:id/...` | 있음 | 실제 | 조작 |
| pii-reviews | `GET /pii-reviews` · `POST /pii-reviews/:id/{clean,redact}` | 있음 | 실제 | 조작 |
| marketing | `GET /marketing` · `POST /marketing/:jobId/{retry,simulate}` | 있음 | 실제 | 조작 |
| campaigns | `GET /campaigns` · `POST /campaigns/:id/:action` | 있음 | 실제(pay · block) | 조작 |
| revenue | `GET /revenue` | 있음 · **고정 0** | 없음 | **죽음** |
| ads | `GET /ads` · `PATCH /ads/:id/status` | 있음 | 실제 | 조작 |
| ads-gate | `GET /ads-gate` · `POST /ads-gate/approve` | 있음 | 실제 | 조작 |
| automation | `GET /automation` · `POST /automation/:id/{recover,drain-dlq}` | 있음 | 실제 | 조작 |
| kill-switch | `GET /kill-switches` · `PATCH /kill-switches/:id` | 있음 | 실제 | 조작 |
| rollback | `GET /rollback` · `POST /rollback/:id/{approve,trigger}` | 있음 | 실제 | 조작 |
| faq | `GET·POST /faq` · `PUT·DELETE /faq/:id` | 라우트는 있음 · **다섯 다 가짜** | 없음 | **죽음 → 이번에 구현** |
| terms | `GET /terms` · `POST /terms` · `PUT /terms/:id/clauses/:cid` · `POST /terms/:id/publish` | GET 있음 · 쓰기 셋은 **400 거부** | 없음 | **죽음** |
| og-card | `GET·PUT /site-meta` · `POST /site-meta/publish` | 있음 | 저장 실제 · 반영은 **환경변수 필요** | 조작 |
| ai-usage | `GET /ai-usage` | 있음 · 실제 집계 | 없음 | 조회 |
| policy-engine | `GET·PATCH /policy-engine` | 있음 | 실제 | 조작 |
| audit-log | `GET /audit-log` | 있음 · 실제 집계 | 없음 | 조회 |
| admins | `GET·POST /accounts` · `PATCH /accounts/:id/{role,disabled}` | 있음 | 실제 | 조작 |

셈: 대시보드 1 · 조작 19 · 조회 6 · 죽음 5(FAQ 포함) + FAQ를 고치면 조작 20 · 죽음 4.

## 「죽음」의 근거

근거 없이 죽었다고 적지 않는다 — 최하단으로 내리는 판단의 근거가 되기 때문이다.

**faq** — `routes/admin.ts:995-1009`. GET이 `{ items: [] }` 리터럴, POST가 `{ id: randomUUID() }`,
PATCH · PUT · DELETE가 `reply.status(204)`. `context.pool`을 부르는 줄이 한 줄도 없다. FAQ 표도
DB에 없다. **대표님이 직접 조작을 요구한 화면이라 이번 작업에서 실제로 만든다.**

**biz-queue** — `routes/admin.ts:1329`. GET이 `{ items: [], total: 0 }` 리터럴. 쓰기 경로
`POST /v1/admin/biz-queue/:id/:action`은 서버에 아예 없다(비슷한 `vendor-claims` 쪽은 따로 있고
화면이 그것을 부르지 않는다). 이미 `READ_ONLY`에 들어 있다.

**terms** — `routes/admin.ts:1724`. 쓰기 셋이 모두 400 「…앱 약관·동의 기록에 연결한 뒤 열려요」로
막혀 있고, 시험(`test/admin-pending-actions.test.ts`)이 그 거부를 지킨다. 이미 `READ_ONLY`에 있다.
**약관 정본은 웹사이트(`apps/web/src/subpages.ts`)다** — 아래 「판단 필요」 참고.

**email-matching** — `routes/admin.ts:1415`. `summary`가 전부 0이고 `items`가 빈 배열인 리터럴.
그 위 주석이 이유를 적어 뒀다 — 업체 회신 메일을 담는 표가 마이그레이션 0001~0121 어디에도 없다.
상태가 없으므로 단추도 없다.

**revenue** — `routes/admin.ts:1225`. `mrr` · `arr` · `activeSubscriptions` · `churnRate`가 0,
`planBreakdown`이 빈 배열인 리터럴. 구독·결제 표가 없다. 화면은 언제나 0을 그린다.

## 부분 고장

**price-stats의 「다시 계산」** — `routes/admin.ts:1829`가 `202 { queued: true }`만 돌려준다.
큐에 넣는 줄이 없고, `stats.price_stats`를 다시 계산하는 함수가 저장소 어디에도 없다
(`0001_init.sql:319`에 표만 있다). 목록 조회는 실제 값이라 화면 전체가 죽은 것은 아니다.
**단추만 잠근다** — 눌러도 아무 일이 없는 것이 가장 나쁘다.

## 화면이 부르지 않는 가짜 라우트

아래는 **어느 화면도 부르지 않아** 지금 피해가 없다. 다만 성공을 돌려주면서 아무것도 하지
않으므로, 나중에 누가 이것을 믿고 화면을 붙이면 조용히 실패한다. 이번 작업에서 건드리지
않고 여기 적어 둔다.

```
POST   /v1/admin/ads          → { id: randomUUID() }
PATCH  /v1/admin/ads/:id      → 204
DELETE /v1/admin/ads/:id      → 204
PATCH  /v1/admin/ads-gate     → 204
PATCH  /v1/admin/automation   → 204
POST   /v1/admin/campaigns    → { id: randomUUID() }
POST   /v1/admin/marketing/sources → 값을 쓰지 않는다
```

## 공유 미리보기 — 실제로 도는가

**웹 홈 · 하위 페이지**는 태그를 낸다. `site-chrome.ts:168` · `subpages.ts:226`이
`socialMeta()`를 넣고, 빌드가 `/v1/site-meta`를 한 번 읽어(`build.ts:57`) 관리자가 고친 문구를
덮는다. 관리자가 손대지 않은 항목은 spec 값이 그대로 나간다.

**업체 상세**도 같은 `siteDocument()`를 쓰므로 태그 자체는 나간다. 문제는 **페이지가 생기는지**다.

- `build.ts:79`가 `vendorIdsToBuild()`로 id를 받고, 그 값은 `WEDDINGPICK_WEB_VENDOR_IDS`
  환경변수다(`site-data.ts:212`). 비면 `/v/*.html`이 **한 장도 생기지 않는다.**
- 그런데 홈은 목록에 실린 **모든** 업체를 `/v/<id>.html`로 건다(`home-page.ts:146`).
- 즉 **링크를 만드는 쪽과 페이지를 만드는 쪽이 서로 다른 출처**다. 환경변수가 비었거나
  일부만 차 있으면 홈의 카드가 없는 페이지를 가리키고, 공유해도 미리보기가 뜰 자리가 없다.
- `render.yaml:30`의 그 키는 `sync: false`라 값이 저장소에 없다. 지금 차 있는지는
  **확인 필요** — 다만 위 어긋남은 값과 무관한 구조 문제라 값을 몰라도 고칠 수 있다.

**「저장 후 반영하기」** — `routes/site-meta.ts:69`가 `RENDER_WEB_DEPLOY_HOOK`이 없으면 거부한다.
그 키는 **`render.yaml`에 선언조차 없다.** Render 대시보드에 손으로 넣어 두지 않았다면 이 단추는
언제 눌러도 실패한다. 넣어 뒀는지는 **확인 필요**.

**앱 공유** — 지금 앱이 공유하는 것은 추천 코드 글자(`referral.shareText`)와 짝 초대
링크(`partner-link.ts:93`)뿐이다. 초대 링크는 `weddingpick://join?code=…` 커스텀 스킴이라
카카오톡에서 링크로 잡히지 않고 미리보기가 뜰 여지가 없으며, 앱이 없는 사람에게는 열리지도
않는다. **https 대체 링크가 없다.** 이것은 사용자 화면과 도메인 규칙이 함께 걸리는 문제라
이번 작업에서 바꾸지 않고 판단을 올린다.

## 약관·방침의 「직접 조작」 — main의 규칙이 이미 답했다

조사 중에는 판단이 필요하다고 적었는데, **최신 `main`이 이미 정해 두었다**(PR #207 ·
`CLAUDE.md`) — 「약관과 개인정보처리방침의 정본은 웹사이트다. 본문은
`apps/web/src/subpages.ts` 하나이고, 앱·문서·관리자는 사본을 들지 않는다.」

그래서 관리자에 편집 화면을 만들지 않는다. 같은 문서를 두 벌 들면 한 벌이 낡고,
낡은 쪽을 사용자가 본다. `admin/terms`는 조회로 남기고 안내를 「약관 정본은
웹사이트에 있어요」로 고쳤다 — 예전 문구는 「앱 약관과 동의 기록 연결을 준비하고
있어요」였는데, 그것은 이 화면이 곧 편집 화면이 된다는 뜻으로 읽힌다.

**대표님이 관리자에서 약관을 고치기를 원하신다면** 그것은 정본을 웹에서 DB로
옮기는 일이고, `subpages.ts`의 본문 이전과 웹 빌드의 조문 조회가 함께 필요하다.
지금 그 파일은 다른 세션(`claude/region-legal`)이 만지는 중이라 이 작업에서
건드리지 않았다.
