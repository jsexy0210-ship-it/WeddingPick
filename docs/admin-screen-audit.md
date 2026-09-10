# 관리자 화면 대조 · ADMIN.md ↔ 코드 라우트

기준
- 목록: `docs/design-handoff/current/ADMIN.md` (v3.27 · 26화면)
- 코드: `apps/mobile/src/app/admin/*.tsx`
- 대조 시점: `main` @ `bf69c03` (PR #167 로그인 미머지 상태)

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

## 판단이 필요한 것

1. 코드에만 있는 3화면 — ADMIN.md에 넣을지, 라우트를 뺄지
2. 이름이 어긋나는 6개 — 영문 라벨(`Kill Switch` · `Policy Engine` · `Revenue`)을 ADMIN.md 한글 이름으로 맞출지
3. 사이드바 그룹 8개 ↔ ADMIN.md 분류 6개
