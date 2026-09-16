# 코드에 박힌 「글」 — 전수 조사

**2026-09-16 대표 지시의 절반.** 원문은 「관리자 faq처럼 이미 코드로 등록되어 있는것도 내가
직접 수정 삭제 가능하도록 하라고」이고, FAQ만 고치고 끝내면 같은 지시를 다시 받는다. 그래서
**「사용자나 운영자에게 «글»로 보이는데 코드에 박혀 있어서 배포해야만 바뀌는 것」**을 세어
여기에 적는다.

조사 범위는 `packages/domain/src/` 전체 · `spec/strings.ko.json` · `apps/mobile/src`와
`apps/web/src`의 화면 상수다. 브랜치 `claude/editable-content`에서 main
`f59104b` 기준으로 셌다.

## 가른 기준 — 글이냐 값이냐

**글**은 문구가 바뀌어도 코드 분기가 안 바뀌는 것이다. **값**은 코드가 그 값으로 분기하는
것이고, 표로 옮기면 **코드가 모르는 값이 들어온다.** `AD_TIERS` · `DOCUMENT_TYPES` ·
`VERIFICATION_LEVELS` 같은 타입·enum은 대상이 아니다.

**경계에 있는 것 셋을 따로 적어 둔다.** 한 값이 화면 문구이면서 동시에 분기 기준이다.

| 무엇 | 어디에 | 왜 경계인가 |
| --- | --- | --- |
| `OTHER_REGION = '그 외'` | `packages/domain/src/wedding-region.ts:25` | 화면 칩 문구인데 `regionFilter`가 이 글자로 전국 분기 |
| `PolicyStatus` | `packages/domain/src/policies.ts:12` | 타입 유니온(`'자문 대기' \| '작성 필요' \| '초안 게시'`)이 그대로 화면 표시 문구 |
| `REPORT_STATE_EXCEPTIONS = ['게시됨','종료됨']` | `packages/domain/src/report-state.ts:72` | 한글 문구로 분기 |

**이 셋은 글처럼 보이지만 옮기면 코드가 깨진다.** 옮기려면 키와 라벨을 먼저 갈라야 한다.

## 규모

| 센 것 | 값 |
| --- | --- |
| `apps/*/src` + `packages/ui/src`의 한글 문자열 리터럴(주석 제외) | 319개 파일 · 약 3,967개 |
| 그중 `spec/strings.ko.json`을 실제로 import 하는 파일 | **23개** |
| `spec/strings.ko.json`의 문자열 | 848개(최상위 키 29 · `{치환}` 든 것 74) |

`spec/strings.ko.json`의 `$meta.rule`은 「사용자에게 보이는 모든 문구는 여기서 가져온다」고
선언하지만 **지금 지켜지는 자리는 23개 파일뿐이다.** 나머지는 화면 코드가 직접 들고 있다.
그리고 `strings.ko.json`도 빌드타임에 번들에 박히므로 **고쳐도 재배포해야 반영된다** —
운영자가 직접 못 고치는 것은 도메인 상수와 같다.

---

## 1. 지금 바로 옮길 수 있는 것 — 순수한 글, 분기 없음

값으로 분기하는 자리가 없고 항목 단위가 뚜렷해서 FAQ와 같은 방식(표 + 관리자 화면)으로
옮길 수 있다. **위에 있는 것이 값이 크다** — 사용자가 자주 보고, 문구가 자주 바뀌는 순이다.

| 무엇 | 어디에 있나 | 누가 보나 | 표로 옮길 수 있나 | 못 옮기면 왜 |
| --- | --- | --- | --- | --- |
| `ANALYSIS_FACTS` 7개 + `ANALYSIS_DISCLAIMER` — 분석 안내 | `packages/domain/src/analysis-notice.ts:15,20` | 사용자(`my/guide`) · 웹 | **예** | — |
| `SHOOTING_TIPS` 4개 — 「이렇게 찍어주세요」 | `apps/mobile/src/app/(tabs)/my/guide.tsx:10` | 사용자 | **예** | — |
| `SUMMARY` 3문답 — 개인정보 요약 | `apps/mobile/src/app/(tabs)/my/privacy.tsx:38` | 사용자 | **예** | 방침 «본문»이 아니라 앱의 요약 안내다. 본문은 웹사이트 정본 그대로 둔다 |
| 탈퇴 문구 16개(`WITHDRAWAL_*`) | `packages/domain/src/withdrawal.ts:26‑61` | 사용자(`my/withdrawal`) | **예** | — |
| `MISSIONS` 4개(title+description) · `MISSION_HEADLINE` 등 | `packages/domain/src/membership.ts:74,98,136‑138` | 사용자 | **예** | — |
| `REWARD_PAYOUT_COPY` 17키 | `packages/domain/src/reward-payout.ts:33` | 사용자 | **예** | 답 안에 `${amount}` 치환이 둘 있다 — FAQ와 같은 자리표시자 방식이면 된다 |
| `HOW_IT_WORKS` 3개 · `STEPS` 3개 · `SITE` · `GNB_MENU` · `APP_HANDOFF` | `apps/web/src/site-content.ts:18‑93` · `content.ts:8‑33` | 웹사이트 | **예** | 웹은 정적 HTML이라 저장 뒤 재빌드가 필요하다 — `site_meta`의 「저장 후 반영하기」와 같은 구조가 이미 있다 |
| `DOCUMENT_CONSENT_POINTS` 5 · `PAYMENT_PROOF_CONSENT_POINTS` 6 · `VISIT_NOTE_AUDIO_CONSENT_POINTS` 5 | `document.ts:172` · `payment-proof.ts:84` · `visit-note-audio.ts:103` | 사용자(동의 화면) | **예 — 다만 법무 확인 뒤에** | 동의 고지 문구다. 운영자가 자유롭게 고치면 고지 내용이 조용히 바뀐다. **고칠 수 있게 하되 변경 이력을 남겨야 한다** |
| `PARTNER_SHARED` · `PARTNER_NOT_SHARED` · `PARTNER_UNLINK_EFFECTS` 각 3 | `packages/domain/src/partner-link.ts:16,27,34` | 사용자 | **예** | — |
| `AD_RULES` 4 · `KINDS` 5 — 업체 문의 안내 | `apps/mobile/src/app/(tabs)/my/biz/index.tsx:23,32` | 사용자 | **예** | `KINDS`의 route는 값이라 라벨만 옮긴다 |
| `PREPARATION_GROUPS` 4(title) | `packages/domain/src/vendor.ts:92` | 사용자 | **예** | — |
| `BUSINESS_NOTICE_LINES` 3줄 | `packages/domain/src/business.ts:27` | 사용자 · 웹 | **예** | 법정 표시라 값은 `BUSINESS`에서 온다. 문장 틀만 옮긴다 |

## 2. 옮길 수 있지만 대표님 판단이 필요한 것

**CLAUDE.md에 대표님이 따로 정해 두신 규칙이 걸려 있다.** 편집 가능하게 만들면 그 규칙이
조용히 깨진다 — 아무도 「업종 이름이 바뀌었다」를 고장으로 보지 않는다. **이 PR에서는 옮기지
않았다.**

| 무엇 | 어디에 있나 | 누가 보나 | 표로 옮길 수 있나 | 걸리는 규칙 |
| --- | --- | --- | --- | --- |
| **업종 이름 13개**(본식스냅 · 헤어변형 · 결정사 포함) `VENDOR_CATEGORY_LABEL` | `packages/domain/src/vendor.ts:54‑69` · 소비처 **30파일** | 사용자 전역 | 기술적으로 **예**(키는 영문 enum) | CLAUDE.md 「용어 · 단어」 — 세어서 통일한 이름이다. 바꾸면 같은 목록이 두 줄로 뜬다 |
| **지역 짧은 꼴 9개** `WEDDING_REGIONS` | `packages/domain/src/wedding-region.ts:10‑20` | 사용자(온보딩 2/3) | **조건부** | 저장값이 이 문자열 그대로이고 `regionFilter`가 `'그 외'`로 분기한다. 키·라벨을 갈라야 옮길 수 있다. CLAUDE.md 「짧은 꼴 아홉으로 고정」 |
| **스타일 4개** `WEDDING_STYLE_LABEL` | `packages/domain/src/style.ts:19‑24` | 사용자 | 기술적으로 **예**(키는 영문 `WEDDING_STYLES`) | CLAUDE.md v3.24 「스타일은 넷뿐 · 화면 라벨은 도시적인 · 자연스러운 · 로맨틱한 · 화려한」 |
| `TERMS` 23키 — 표준 용어집 | `packages/domain/src/terms.ts:16‑61` · 소비처 **28파일** | 사용자 전역 | **아니오로 권한다** | 「실 제보」 · 「Pick 인증」 같은 정보 체계 3단이 여기 있다. 운영자가 한 단어를 고치면 28개 파일의 말이 한꺼번에 바뀌고, 금지어 규칙(`AI` · `데이터` · `탐색`)이 여기서 무너진다 |
| `POLICY_DOCUMENTS`의 `title` · `status` · `note` | `packages/domain/src/policies.ts:24‑47` | 사용자 · 웹 | **부분적으로** | 본문은 웹사이트 정본이라 대상이 아니다. `status`가 타입 유니온이자 표시 문구라 그대로는 못 옮긴다(위 「경계」) |

## 3. 옮기기 전에 먼저 정리해야 하는 것 — 사본이 여럿이다

**같은 말이 여러 곳에 적혀 있다.** 표로 옮기면 어느 사본을 정본으로 삼을지부터 정해야 하고,
정하지 않고 옮기면 사본 하나가 코드에 남아 조용히 갈린다.

| 무엇 | 사본 자리 |
| --- | --- |
| 업종 이름 | `domain/vendor.ts:54`(정본) · `domain/consultation-category.ts:47`(14개, 소비처 0) · `ui/category-icon.tsx:30` · `ui/default-image.tsx:59` · `domain/expense.ts:49` · `domain/wedding-feed.ts:78` — **5벌** |
| `'아직 정보가 적어요'` | `terms.ts:73` · `disclosure.ts:230` · `reidentification.ts:81` — 3벌 |
| `'아직 비교하기 어려워요'` | `terms.ts:78` · `pick.ts:73` — 2벌 |
| 요일 배열 `WEEKDAYS` | `search/[vendorId]/consult.tsx:79` · `(tabs)/wedding/index.tsx:86` · `(tabs)/index.tsx:493` — 3벌 |
| 지역 목록 | `domain/wedding-region.ts:10`(9개) · `search/expo/index.tsx:26`(7개, 전체/기타 포함) — **두 목록이 어긋난다** |

## 4. 화면이 직접 들고 있는 카피 뭉치 — 34개 파일

`const S = { … }` 꼴로 화면 파일이 자기 문구를 통째로 들고 있다. 전부 사용자 화면이고,
파일 주석은 `strings.ko.json` 키를 가리키는데 **실제로는 하드코딩이다.**

큰 것부터: `my/index.tsx:62`(30키) · `my/rewards/index.tsx:28`(29) · `my/referral.tsx:41`(26) ·
`my/profile.tsx:24`(20) · `capture/payment/register.tsx:53`(20) · `wedding/partner.tsx:34`(19) ·
`wedding/[id]/notes.tsx:41`(17) · `my/wedding-settings.tsx:34`(17) · `my/account.tsx:14`(16) ·
`wedding/join.tsx:25`(16) · `my/display.tsx:20`(15) · `my/support.tsx:12`(14) ·
`my/notification-settings.tsx:11`(13) · `my/reports.tsx:24`(13) ·
`search/[vendorId]/fix-report.tsx:10`(13) · `my/rewards/promotion.tsx:23`(13) ·
`my/reviews.tsx:11`(12) · `capture/index.tsx:17`(12) · `my/taste.tsx:24`(11) — 이하 15개 파일 더.

**옮길 수 있나: 예 — 다만 화면 단위가 아니라 자리 단위로 옮겨야 한다.** 30키를 한 표에
쏟으면 운영자가 어느 줄이 어느 자리인지 알 수 없다. **먼저 `strings.ko.json`으로 모으고,
그다음 그 파일을 표로 바꾸는 순서를 권한다** — 이미 그 규칙이 선언돼 있고 23개 파일이
그렇게 하고 있다.

## 5. 운영자 화면의 라벨 — admin 40여 파일

`apps/mobile/src/app/admin/*.tsx`가 각자 `STATUS_LABEL` · `TYPE_LABEL` · `ROLE_LABEL` ·
`DECISION_LABEL` 같은 Record를 들고 있다(`admins.tsx:72,90` · `expos.tsx:70,86` ·
`ads-gate.tsx:55,61,88` · `users.tsx:58,70` · `audit-log.tsx:50` · `campaigns.tsx:65,71` 등).

**옮길 수 있나: 권하지 않는다.** 상태 코드에 붙인 이름이라 값 쪽에 가깝고, 운영자가 자기
화면의 상태 이름을 바꾸면 같은 상태를 부르는 말이 화면마다 갈린다. **대신 도메인 라벨과
이름만 같고 내용이 갈릴 위험이 있으니 도메인 쪽으로 모으는 것이 먼저다.**

## 6. 정의만 있고 화면이 안 쓰는 사용자 문구 — 먼저 정리할 것

**표로 옮기기 전에 지울지 이을지부터 정해야 한다.** 쓰지 않는 문구를 표에 담으면 운영자가
고쳐도 아무 데도 안 나가고, 그것을 「반영이 안 된다」로 읽는다.

`COMPARISON_AXES`(comparison-axes.ts:47, 8자리) · `AXIS_KIND_NOTE`(:125) ·
`REVIEW_ASPECTS`(review.ts:38, 9업종) · `REVIEW_CHECKLIST`(review-checklist.ts:44) ·
`VENDOR_FACT_FIELDS`(vendor-fact.ts:51, 12) · `WEDDING_PHASE_LABEL`·`COMPLETED_ACTIONS`
(wedding-phase.ts) · lifecycle 무드·노트 7(lifecycle.ts:55‑65) · `REFERRAL_NOTICE` ·
`PROMOTION_NOTICE` · `MISSION_REWARD_NOTICE`(reward.ts:270‑276) · `agency-price.ts` 전부 ·
`CONSULTATION_NOTICE`·`CONSULTATION_CATEGORY_LABEL`(consultation-category.ts) ·
`WEDDING_STYLE_NOTE`(style.ts:27) · `DISCLOSURE_LIMIT_LABEL`(policy-engine.ts:54) ·
`REPORT_STATE_LABEL`(report-state.ts:49) · `PICK_VERIFICATION`(pick-verification.ts:25).

**화면이 같은 말을 따로 적고 있을 가능성이 높다.** 4번의 카피 뭉치와 겹쳐 본 뒤에 정한다.

---

## 목록에서 뺀 것

- **웨딩피드 탭 · 카테고리** — `claude/feed-taxonomy-admin`이 잡고 있다
  (`packages/domain/src/wedding-feed.ts`의 `WEDDING_FEED_TOPICS` · `*_STATUS_LABEL` 등).
- **약관 · 방침 본문** — 웹사이트가 정본이다(2026-09-11 대표 지시).
  `apps/web/src/subpages.ts:287 TERMS_ARTICLES`(21) · `:356 PRIVACY_SECTIONS`(13)이 그 본문이고
  `build.ts`가 정적 HTML로 굽는다. **다만 `my/privacy.tsx`의 요약 3문답은 본문이 아니라 앱의
  안내라 1번에 넣었다.**
- **`packages/domain/src/faq.ts`의 FAQ 일곱** — 이 PR에서 표로 옮겼다.
- **타입 · enum** — `AD_TIERS` · `AD_SURFACES` · `DOCUMENT_TYPES` · `DISCLOSURE_STAGES` ·
  `DISCLOSURE_THRESHOLDS`(3/5/10, 6개 파일이 분기) · `VERIFICATION_LEVELS` ·
  `VENDOR_CATEGORIES` · `WEDDING_STYLES` · `REWARD_*S` · `NOTIFICATION_KINDS` ·
  `INQUIRY_CATEGORIES` · `TASK_STATES` 등. 코드가 이 값으로 분기한다.
- **빌드타임 검사값** — `copy-rules.ts`의 금지어·애매어 목록 · `release-gate.ts` ·
  `FORBIDDEN_PAYMENT_WORDS`. 사람이 읽는 화면 글이 아니라 규칙이다.
- **LLM 프롬프트** — `apps/api/src/analysis/consultation-spec.ts`(한글 243개). 사용자에게
  안 보인다.

## 다음에 잡을 것 — 값이 큰 순서

1. **`ANALYSIS_FACTS` + `SHOOTING_TIPS` + `my/privacy.tsx`의 요약 3문답.** FAQ와 같은 성격이고
   같은 화면(`my/guide` · `my/privacy`)에 있다. FAQ가 만든 표·라우트·관리자 탭을 그대로 쓴다.
2. **탈퇴 문구 16개.** 한 화면에 모여 있어 옮기는 단위가 뚜렷하다.
3. **웹사이트 랜딩 문구**(`site-content.ts` · `content.ts`). 마케팅 카피라 가장 자주 바뀌는데
   지금은 배포해야 바뀐다. `site_meta`의 「저장 후 반영하기」 구조가 이미 있다.
4. **3번의 사본 정리.** 옮기기 전에 정본을 정하지 않으면 옮긴 뒤에 갈린다.

**관리자 화면을 어디에 붙일지는 MASTER에게 물어야 한다.** 사이드바는 아홉으로 줄여 둔
상태이고 늘리는 것은 그 결정을 되돌리는 일이다. FAQ가 있는 「사이트·기록」 탭 묶음에 넣는
것이 가장 가깝다.
