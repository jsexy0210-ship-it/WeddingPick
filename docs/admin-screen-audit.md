# 관리자 화면 대조 · ADMIN.md ↔ 코드 라우트

기준
- 목록: `docs/design-handoff/current/ADMIN.md` (v3.27 · 26화면)
- 코드: `apps/mobile/src/app/admin/*.tsx`
- 대조 시점: `main` @ `bf69c03` (PR #167 로그인 미머지 상태)

## 시안을 다시 센 결과 (v3.27)

`CHANGELOG.md` 맨 위는 **v3.27 · 2026-09-10**입니다. 그 기준으로 `screens.json`과 `html/`을 직접 셌습니다.

| 원본 | 수 |
|---|---|
| `screens.json`의 고유 `WP-ADM-` ID | **26** |
| `ADMIN.md` 표의 화면 행 | **26** |
| `html/22-admin-ops.dc.html` 아트보드 | 11 |
| `html/21-admin.dc.html` 아트보드 | **16** |

**시안 화면 수는 26입니다.** 32가 아닙니다 — 32는 머지 전 `apps/mobile/src/app/admin/` 아래 파일 수였습니다(부품·리다이렉트 포함).

### md끼리 어긋나는 곳 셋

1. **`ADMIN.md`는 21시안을 「기존 15화면」이라 적었는데 실제 아트보드는 16개입니다.** 남는 둘은 `알림 · 공지 발송`과 `이용 통계`로, 26개 ID 어디에도 없습니다.
2. **`WP-ADM-010 제보 처리 현황`은 두 시안 어디에도 아트보드가 없습니다.** `ADMIN.md`와 `screens.json`에는 있습니다.
3. **`html/20-admin.dc.html`은 `21-admin.dc.html`과 바이트가 같습니다**(md5 `1e8ae57c…`). `ADMIN.md`의 「시안 파일」 블록은 21과 22만 적고 있어, 20은 지워야 할 옛 파일로 보입니다.

셋 다 코드로 판단할 일이 아니라 md를 고쳐야 하는 자리라 그대로 두고 보고합니다.

## 요약

| 항목 | 수 |
|---|---|
| ADMIN.md 화면 | 26 |
| 코드 라우트 화면 | 29 |
| 1:1로 맞는 것 | 26 |
| 코드에만 있는 것 | 3 |
| 목록에만 있는 것 | 0 |
| 이름이 어긋나는 것 | 6 |

`apps/mobile/src/app/admin/` 아래 파일은 32개지만 화면은 29개입니다. 나머지 셋은 화면이 아닙니다 — `_layout.tsx`(사이드바 · 인증 게이트) · `_api.ts`(호출 래퍼) · `index.tsx`(`/admin/queue`로 보내는 리다이렉트).

## 1:1 대조

| ID | ADMIN.md 화면 | 라우트 | 사이드바 라벨 | 본문 제목 | 맞음 |
|---|---|---|---|---|---|
| WP-ADM-001 | 관리자 홈 | `home.tsx` | 관리자 홈 | 관리자 홈 | O |
| WP-ADM-002 | 일일 브리핑 | `briefing.tsx` | 일일 브리핑 | 일일 브리핑 | O |
| WP-ADM-010 | 제보 처리 현황 | `data-pipeline.tsx` | 제보 처리 현황 | 데이터 · 제보 처리 현황 | O |
| WP-ADM-011 | 확인 필요 목록 | `queue.tsx` | 확인 필요 큐 | 확인 필요 큐 | 이름 |
| WP-ADM-012 | 가격 통계 | `price-stats.tsx` | 가격 통계 | 데이터 · 가격통계 | 이름 |
| WP-ADM-013 | 이상치 · 조작 탐지 | `stats.tsx` | 이상치 · 조작 탐지 | 이상치 · 조작 탐지 | O |
| WP-ADM-014 | 업체 관리 | `vendors.tsx` | 업체 관리 | 데이터 · 업체 관리 | O |
| WP-ADM-015 | 이미지 자동 수급 | `images.tsx` | 이미지 자동수급 | 데이터 · 이미지 자동수급 | 이름 |
| WP-ADM-016 | 이메일 회신 자동 매칭 | `email-matching.tsx` | 이메일 자동매칭 | 데이터 · 이메일 회신 자동매칭 | 이름 |
| WP-ADM-020 | 사용자 계정 관리 | `users.tsx` | 계정 관리 | 사용자 · 계정 | O |
| WP-ADM-021 | 고객 의견 · 문의 관리 | `report.tsx` | VOC | VOC · 신고 접수 | 이름 |
| WP-ADM-022 | 후기 · 반론 관리 | `rebuttal.tsx` | 후기 · 반론 | 후기 · 반론 | O |
| WP-ADM-023 | 업체 문의 처리 목록 | `biz-queue.tsx` | 업체 문의 큐 | 사용자 · 업체 문의 큐 | O |
| WP-ADM-030 | 마케팅 자동화 | `marketing.tsx` | 마케팅 자동화 | 성장 · 마케팅 자동화 | O |
| WP-ADM-031 | 캠페인 · 보상 관리 | `campaigns.tsx` | 캠페인 · 보상 | 성장 · 캠페인 · 보상 | O |
| WP-ADM-032 | 수익 현황 | `revenue.tsx` | Revenue | 성장 · Revenue | 이름 |
| WP-ADM-033 | 광고 집행 관리 | `ads.tsx` | 광고 집행 관리 | 성장 · 광고 집행 관리 | O |
| WP-ADM-034 | 광고 실운영 전환 조건 관리 | `ads-gate.tsx` | 광고 실운영 게이트 | 성장 · 광고 실운영 전환 게이트 | O |
| WP-ADM-035 | 자주 묻는 질문 관리 | `faq.tsx` | FAQ 관리 | FAQ 관리 | O |
| WP-ADM-036 | 약관 · 방침 관리 | `terms.tsx` | 약관 · 방침 | 약관 · 방침 관리 | O |
| WP-ADM-040 | 자동화 상태 | `automation.tsx` | 자동화 상태 | 운영 · 자동화 상태 | O |
| WP-ADM-041 | 긴급 중지 | `kill-switch.tsx` | Kill Switch | Kill Switch | 이름 |
| WP-ADM-042 | 변경 복구 관리 | `rollback.tsx` | 롤백 관리 | 롤백 관리 | 이름 |
| WP-ADM-050 | 인공지능 사용량 · 비용 | `ai-usage.tsx` | AI 사용량 · 비용 | AI 사용량 · 비용 | O |
| WP-ADM-051 | 정책 규칙 관리 | `policy-engine.tsx` | Policy Engine | Policy Engine | 이름 |
| WP-ADM-052 | 감사 기록 | `audit-log.tsx` | 감사 로그 | 감사 로그 | 이름 |

빠진 ID는 없습니다. ADMIN.md의 26개가 모두 라우트를 가지고 있습니다.

## 코드에만 있는 것 · 3

ADMIN.md에 항목이 없는데 라우트와 사이드바 메뉴가 있고 API도 따로 붙어 있는 화면입니다.

| 라우트 | 사이드바 라벨 | 본문 제목 | API | 사이드바 그룹 |
|---|---|---|---|---|
| `decisions.tsx` | 자동 결정 현황 | 자동 결정 현황 | `/v1/admin/decisions/briefing` · `/v1/admin/decisions/open` | 대시보드 |
| `objections.tsx` | 후기 이의제기 | 후기 이의제기 | `/v1/admin/objections` | 검토해요 |
| `pii-reviews.tsx` | 개인정보 검토 | 개인정보 검토 | `/v1/admin/pii-reviews` | 검토해요 |

셋 다 다른 화면과 API가 겹치지 않습니다. `objections`(`/v1/admin/objections`)는 WP-ADM-022 `rebuttal`(`/v1/admin/rebuttals`)과 다른 엔드포인트입니다.

## 목록에만 있는 것 · 0

없습니다.

## 사이드바 그룹 ↔ ADMIN.md 분류

ADMIN.md는 6분류(홈 · 데이터 · 사용자 · 성장 · 운영 · 시스템), 사이드바는 8그룹입니다.

| 사이드바 그룹 | 항목 | ADMIN.md 분류 |
|---|---|---|
| 대시보드 | home · briefing · decisions | 홈 (+ decisions는 목록 밖) |
| 검토해요 | queue · rebuttal · objections · pii-reviews | 데이터 011 · 사용자 022 (+ objections · pii-reviews는 목록 밖) |
| 데이터 | data-pipeline · price-stats · vendors · images · email-matching | 데이터 |
| 지표를 봐요 | stats | 데이터 013 |
| 사용자 | users · biz-queue · report | 사용자 |
| 성장 · 광고 | marketing · campaigns · revenue · ads · ads-gate | 성장 |
| 콘텐츠 | faq · terms | 시스템 035 · 036 |
| 운영 | automation · kill-switch · rollback | 운영 |
| 시스템 | ai-usage · policy-engine · audit-log | 시스템 050 · 051 · 052 |

ADMIN.md에서 `WP-ADM-011`(확인 필요 목록)은 데이터, `WP-ADM-022`(후기 · 반론 관리)는 사용자로 묶여 있지만 사이드바는 둘을 「검토해요」로 함께 둡니다. `WP-ADM-013`(이상치 · 조작 탐지)도 ADMIN.md에서는 데이터인데 사이드바는 「지표를 봐요」에 혼자 둡니다. `WP-ADM-035` · `WP-ADM-036`은 ADMIN.md 시스템, 사이드바는 「콘텐츠」입니다.

## 대조 뒤 처리한 것

**이름 어긋남 6개 · 사이드바 그룹 — ADMIN.md 쪽으로 맞췄습니다.** CLAUDE.md의 「최신 핸드오프 md가 코드보다 우선」에 따라 묻지 않고 md를 따랐습니다. `_layout.tsx`의 메뉴 이름은 이제 ADMIN.md의 화면 이름이고, 묶음은 v3.27 시안 `22-admin-ops.dc.html`의 NAV와 같은 여섯(보고 · 데이터 · 사용자 · 성장 · 운영 · 시스템)입니다.

| 옛 라벨 | 새 라벨 |
|---|---|
| 확인 필요 큐 | 확인 필요 목록 |
| VOC | 고객 의견 · 문의 관리 |
| Revenue | 수익 현황 |
| Kill Switch | 긴급 중지 |
| 롤백 관리 | 변경 복구 관리 |
| Policy Engine | 정책 규칙 관리 |
| 감사 로그 | 감사 기록 |
| FAQ 관리 | 자주 묻는 질문 관리 |

**코드에만 있는 3화면은 그대로 뒀습니다.** API가 따로 붙어 있고 지우면 기능이 사라집니다. 사이드바에는 남기되 ADMIN.md 목록 밖이라는 주석을 달았습니다.

## 아직 남은 판단

1. 코드에만 있는 3화면(`자동 결정 현황` · `후기 이의제기` · `개인정보 검토`)을 ADMIN.md 26화면 목록에 넣을지 — 넣으면 27~29화면이 됩니다

## 대조하며 같이 발견한 것

화면 대조와 별개로, 코드가 부르는데 서버에 없는 엔드포인트가 있습니다.

| 화면 | 부르던 것 | 서버 |
|---|---|---|
| 이메일 회신 자동 매칭 | `POST /v1/admin/data/email-matching/:id/apply` · `/retry` | 없음 (GET 하나뿐) |
| 자동화 상태 | `POST /v1/admin/automation/:id/recover` · `/drain-dlq` | 없음 |

그리고 `/v1/admin/automation` · `/v1/admin/policy-engine` · `/v1/admin/rollback`은 빈 배열을 돌려주는 자리이고, 화면은 그것과 다른 모양(`overall` · `workflows` · `items`)을 기대하고 있었습니다. 화면 쪽은 빈 응답을 견디도록 고쳤고, 없는 엔드포인트를 부르던 버튼은 없앴습니다 — 서버는 이 세션의 범위가 아닙니다.
