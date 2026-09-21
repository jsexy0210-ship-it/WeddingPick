# 전체 페이지·상태 전수 점검 대장

작성: 2026-09-21 (UTC)

기준: `main 19e649cb800980f9156e0832b7f0376664aacce8`

상위 실행 지침: [UX_UI_REFRESH_HANDOFF.md](UX_UI_REFRESH_HANDOFF.md)

## 대장의 의미

- 대상 누락을 막는 **출발 목록**이다. 전수 화면을 직접 열어 검수했다는 보고가 아니다.
- 208개 디자인 ID와 143개 앱 화면 파일은 서로 다른 집합이다. 시트·공통 컴포넌트·상태·별칭·제외 화면을 따로 취급한다.
- 아래 코드는 기준 main의 Git 객체에서 읽었다. Codex 로컬 구현 초안을 기준으로 집계하지 않았다.
- 라우트 목록은 `apps/mobile/src/app`의 추적된 TSX에서 `_layout`, `+*`를 제외하고 route group과 index를 정규화했다.
- 로딩 표기는 파일 안의 JSX 직접 참조만 검색한 결과다. 하위 컴포넌트·별칭 대상·상위 인증 gate에서 처리하는 로딩은 해당 파일에 표시되지 않을 수 있다.
- “직접 참조 없음”은 “로딩 없음”, “빈 상태 있음”은 “검수 통과”를 뜻하지 않는다.
- 각 활성 ID에 `loading / ready / empty / error / refreshing / submitting / 권한 / 복귀`를 검증하고, 없는 상태는 근거와 함께 N/A로 기록한다.
- 전수 대장의 현재 상태는 **대조 대기**다. 구현 완료·운영 배포 완료 수치를 산출하지 않는다.

## 1. 전체 화면군

| 그룹 | 범위 | 정본 ID 수 | 이번 문서의 판정 |
| --- | --- | ---: | --- |
| APP | 앱 진입·인증 | 26 | 전체 대상, 개별 검수 대기 |
| NAV | 내비게이션 | 6 | 전체 대상, 개별 검수 대기 |
| HOME | 홈 | 9 | 전체 대상, 개별 검수 대기 |
| SRCH | 검색 | 8 | 전체 대상, 개별 검수 대기 |
| VEND | 업체 상세 | 6 | 전체 대상, 개별 검수 대기 |
| CMP | 비교 | 4 | 전체 대상, 개별 검수 대기 |
| PICK | Pick | 8 | 전체 대상, 개별 검수 대기 |
| OUR | 웨딩노트 | 13 | 전체 대상, 개별 검수 대기 |
| RPT | 제보·인증 | 11 | 전체 대상, 개별 검수 대기 |
| REV | 후기 | 7 | 전체 대상, 개별 검수 대기 |
| EXPO | 박람회 | 5 | 전체 대상, 개별 검수 대기 |
| EVT | 혜택·이벤트 | 7 | 전체 대상, 개별 검수 대기 |
| NOTI | 알림 | 3 | 전체 대상, 개별 검수 대기 |
| MY | MY | 10 | 전체 대상, 개별 검수 대기 |
| CPL | 커플 | 6 | 전체 대상, 개별 검수 대기 |
| BIZ | 업체 관계자 | 8 | 전체 대상, 개별 검수 대기 |
| FAQ | 지원·정책 | 4 | 전체 대상, 개별 검수 대기 |
| SHT | 시트 | 17 | 전체 대상, 개별 검수 대기 |
| ST | 공통 상태 | 16 | 전체 대상, 개별 검수 대기 |
| WEB | 웹 | 8 | 전체 대상, 개별 검수 대기 |
| ADM | 관리자 | 26 | 전체 대상, 개별 검수 대기 |
| 합계 | 실제 고유 ID | **208** | 선언된 옛 합계 대신 실제 ID 사용 |

기존 `design-screen-map.json` 분류: route 123, component 34, state 1, system 1, excluded 19, unmapped 30. **이 분류는 구현 완료율이 아니다.**

## 2. 직접 로딩 호출부 요약

- skeleton 계열(`SkeletonView / ListSkeleton / Skeleton`) 직접 참조 화면: **29개**.
- `DelayedLoadingView` 직접 참조 화면: **31개**.
- 그 밖의 화면 내 로더·공통 컴포넌트·진입 gate는 아래 표와 각 소스를 함께 확인한다.
- 범용 `SkeletonView`를 모두 다른 범용 컴포넌트 이름으로 치환하는 것은 해결이 아니다. 실제 shell/본문/상태와 맞는지 확인한다.

## 3. 실제 앱 라우트 전체

상태는 전 행 “미검수”이며, 마지막 열은 **점검 방향**이다. 관리자 포함, 웹사이트 `apps/web` 제외.

| Route | 소스 파일 | 직접 로딩 표시 | 우선 점검 |
| --- | --- | --- | --- |
| `/` | `(tabs)/index.tsx` | `DelayedRecommendingView`, `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/admin` | `admin/index.tsx` | 직접 참조 없음 | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/_ui` | `admin/_ui.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/admin/admins` | `admin/admins.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/ads` | `admin/ads.tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/admin/ads-gate` | `admin/ads-gate.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/ai-usage` | `admin/ai-usage.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/audit-log` | `admin/audit-log.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/automation` | `admin/automation.tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/admin/biz-queue` | `admin/biz-queue.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/briefing` | `admin/briefing.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인; null 초기화 시 기존 내용 제거 여부 확인 |
| `/admin/campaigns` | `admin/campaigns.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/data-pipeline` | `admin/data-pipeline.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/decisions` | `admin/decisions.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/email-matching` | `admin/email-matching.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/expos` | `admin/expos.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/faq` | `admin/faq.tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/admin/home` | `admin/home.tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/admin/images` | `admin/images.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/kill-switch` | `admin/kill-switch.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/login` | `admin/login.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/admin/marketing` | `admin/marketing.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/objections` | `admin/objections.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/og-card` | `admin/og-card.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/pii-reviews` | `admin/pii-reviews.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/policy-engine` | `admin/policy-engine.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/price-stats` | `admin/price-stats.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/queue` | `admin/queue.tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/admin/rebuttal` | `admin/rebuttal.tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/admin/report` | `admin/report.tsx` | 직접 참조 없음 | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/revenue` | `admin/revenue.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인; null 초기화 시 기존 내용 제거 여부 확인 |
| `/admin/rollback` | `admin/rollback.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/stats` | `admin/stats.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/admin/terms` | `admin/terms.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/admin/users` | `admin/users.tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/admin/vendors` | `admin/vendors.tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/admin/wedding-feed` | `admin/wedding-feed.tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/capture` | `(tabs)/capture/index.tsx` | 직접 참조 없음 | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/capture/analysis/[id]` | `(tabs)/capture/analysis/[id].tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/capture/camera` | `(tabs)/capture/camera.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/capture/payment/consent` | `(tabs)/capture/payment/consent.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/capture/payment/register` | `(tabs)/capture/payment/register.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/capture/quote/consent` | `(tabs)/capture/quote/consent.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/capture/result/[quoteId]` | `(tabs)/capture/result/[quoteId].tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/capture/review` | `(tabs)/capture/review.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/capture/sample` | `(tabs)/capture/sample.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/capture/verify-status/[requestId]` | `(tabs)/capture/verify-status/[requestId].tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/capture/verify/[quoteId]` | `(tabs)/capture/verify/[quoteId].tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/community` | `(tabs)/community/index.tsx` | `DelayedLoadingView`, `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/community/feed/[id]` | `(tabs)/community/feed/[id].tsx` | 직접 참조 없음 | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/community/review/write` | `(tabs)/community/review/write.tsx` | `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인; null 초기화 시 기존 내용 제거 여부 확인 |
| `/feed` | `(tabs)/(home)/feed.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/feed/[id]` | `(tabs)/(home)/feed/[id].tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/login` | `login/index.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/login/age-required` | `login/age-required.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/my` | `(tabs)/my/index.tsx` | `DelayedLoadingView`, `DelayedLoader` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/my/account` | `(tabs)/my/account.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/biz` | `(tabs)/my/biz/index.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/my/biz/benefit` | `(tabs)/my/biz/benefit.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/my/biz/claim` | `(tabs)/my/biz/claim.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/my/biz/data` | `(tabs)/my/biz/data.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/my/contact` | `(tabs)/my/contact.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/my/display` | `(tabs)/my/display.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/my/faq/[faqKey]` | `(tabs)/my/faq/[faqKey].tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/my/guide` | `(tabs)/my/guide.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/my/membership` | `(tabs)/my/membership.tsx` | `DelayedLoadingView` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/my/notification-settings` | `(tabs)/my/notification-settings.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/notifications` | `(tabs)/my/notifications.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/privacy` | `(tabs)/my/privacy.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/my/profile` | `(tabs)/my/profile.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/rebuttals` | `(tabs)/my/rebuttals/index.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/my/rebuttals/[reviewId]` | `(tabs)/my/rebuttals/[reviewId].tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/my/referral` | `(tabs)/my/referral.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/reports` | `(tabs)/my/reports.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/reviews` | `(tabs)/my/reviews.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/rewards` | `(tabs)/my/rewards/index.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/rewards/fund` | `(tabs)/my/rewards/fund.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/rewards/history` | `(tabs)/my/rewards/history.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/rewards/missions` | `(tabs)/my/rewards/missions.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/rewards/npay` | `(tabs)/my/rewards/npay.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/rewards/promotion` | `(tabs)/my/rewards/promotion.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/scraps` | `(tabs)/my/scraps.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/settings` | `(tabs)/my/settings.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/support` | `(tabs)/my/support.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/my/taste` | `(tabs)/my/taste.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/vendor-claims` | `(tabs)/my/vendor-claims/index.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/my/vendor-claims/[vendorId]` | `(tabs)/my/vendor-claims/[vendorId].tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/my/wedding-settings` | `(tabs)/my/wedding-settings.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/my/withdrawal` | `(tabs)/my/withdrawal.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/pick` | `(tabs)/pick/index.tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/pick/[category]` | `(tabs)/pick/[category].tsx` | `Skeleton` | 개별 뼈대의 크기·행/열·CTA 대조 |
| `/pick/category` | `(tabs)/pick/category.tsx` | `ListSkeleton` | 실제 목록 카드와 공통 52 썸네일 구조 대조 |
| `/pick/compare` | `(tabs)/pick/compare.tsx` | `Skeleton` | 개별 뼈대의 크기·행/열·CTA 대조 |
| `/pick/confirm` | `(tabs)/pick/confirm.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/pick/done` | `(tabs)/pick/done.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/pick/history` | `(tabs)/pick/history.tsx` | `Skeleton` | 개별 뼈대의 크기·행/열·CTA 대조; null 초기화 시 기존 내용 제거 여부 확인 |
| `/pick/removed` | `(tabs)/pick/removed.tsx` | `Skeleton` | 개별 뼈대의 크기·행/열·CTA 대조 |
| `/progress` | `(tabs)/(home)/progress.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인; null 초기화 시 기존 내용 제거 여부 확인 |
| `/recommendations` | `(tabs)/(home)/recommendations.tsx` | `SkeletonView` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인; null 초기화 시 기존 내용 제거 여부 확인 |
| `/search` | `(tabs)/search/index.tsx` | `DelayedLoader`, `ListSkeleton` | 실제 목록 카드와 공통 52 썸네일 구조 대조; null 초기화 시 기존 내용 제거 여부 확인 |
| `/search/[vendorId]` | `(tabs)/search/[vendorId]/index.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/search/[vendorId]/booking` | `(tabs)/search/[vendorId]/booking.tsx` | 직접 참조 없음 | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/search/[vendorId]/consult` | `(tabs)/search/[vendorId]/consult.tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/search/[vendorId]/edit-review` | `(tabs)/search/[vendorId]/edit-review.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/search/[vendorId]/fix-report` | `(tabs)/search/[vendorId]/fix-report.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/search/[vendorId]/images` | `(tabs)/search/[vendorId]/images.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/search/[vendorId]/price-report` | `(tabs)/search/[vendorId]/price-report.tsx` | `DelayedLoadingView` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/search/[vendorId]/review/[reviewId]` | `(tabs)/search/[vendorId]/review/[reviewId].tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/search/[vendorId]/reviews` | `(tabs)/search/[vendorId]/reviews.tsx` | `ListSkeleton` | 실제 목록 카드와 공통 52 썸네일 구조 대조 |
| `/search/[vendorId]/write-review` | `(tabs)/search/[vendorId]/write-review.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/search/autocomplete` | `(tabs)/search/autocomplete.tsx` | `Skeleton` | 개별 뼈대의 크기·행/열·CTA 대조 |
| `/search/compare` | `(tabs)/search/compare.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/search/expo` | `(tabs)/search/expo/index.tsx` | `Skeleton` | 개별 뼈대의 크기·행/열·CTA 대조 |
| `/search/expo/[expoId]` | `(tabs)/search/expo/[expoId]/index.tsx` | `Skeleton` | 개별 뼈대의 크기·행/열·CTA 대조 |
| `/search/expo/[expoId]/calendar` | `(tabs)/search/expo/[expoId]/calendar.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/search/wedding-info` | `(tabs)/search/wedding-info/index.tsx` | `Skeleton` | 개별 뼈대의 크기·행/열·CTA 대조; null 초기화 시 기존 내용 제거 여부 확인 |
| `/search/wedding-info/[infoId]` | `(tabs)/search/wedding-info/[infoId]/index.tsx` | `Skeleton` | 개별 뼈대의 크기·행/열·CTA 대조 |
| `/setup` | `setup.tsx` | `DelayedRecommendingView` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/top3` | `(tabs)/(home)/top3.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인; null 초기화 시 기존 내용 제거 여부 확인 |
| `/wedding` | `(tabs)/wedding/index.tsx` | `DelayedLoadingView` | 리다이렉트/별칭 여부와 대상 화면·query·인증 확인 |
| `/wedding/[id]` | `(tabs)/wedding/[id]/index.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/wedding/[id]/candidates` | `(tabs)/wedding/[id]/candidates.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/wedding/[id]/changelog` | `(tabs)/wedding/[id]/changelog.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/wedding/[id]/complete` | `(tabs)/wedding/[id]/complete.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/wedding/[id]/conflict` | `(tabs)/wedding/[id]/conflict.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/wedding/[id]/consultations/[recordId]` | `(tabs)/wedding/[id]/consultations/[recordId].tsx` | `DelayedLoader` | 로더의 소유 영역·초기/재조회/저장 분리 |
| `/wedding/[id]/consultations/upload` | `(tabs)/wedding/[id]/consultations/upload.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/wedding/[id]/decided` | `(tabs)/wedding/[id]/decided.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/wedding/[id]/events/[eventId]` | `(tabs)/wedding/[id]/events/[eventId].tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/wedding/[id]/events/new` | `(tabs)/wedding/[id]/events/new.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/wedding/[id]/expenses/[expenseId]` | `(tabs)/wedding/[id]/expenses/[expenseId].tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/wedding/[id]/expenses/add` | `(tabs)/wedding/[id]/expenses/add.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/wedding/[id]/expenses/list` | `(tabs)/wedding/[id]/expenses/list.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/wedding/[id]/map` | `(tabs)/wedding/[id]/map.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |
| `/wedding/[id]/map.web` | `(tabs)/wedding/[id]/map.web.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/wedding/[id]/notes` | `(tabs)/wedding/[id]/notes.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/wedding/[id]/quotes` | `(tabs)/wedding/[id]/quotes.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/wedding/[id]/tasks` | `(tabs)/wedding/[id]/tasks.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/wedding/[id]/timeline` | `(tabs)/wedding/[id]/timeline.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/wedding/[id]/verify` | `(tabs)/wedding/[id]/verify.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/wedding/[id]/visit-notes` | `(tabs)/wedding/[id]/visit-notes.tsx` | `SkeletonView` | 범용 전체 뼈대와 실제 shell/본문 불일치 확인 |
| `/wedding/join` | `(tabs)/wedding/join.tsx` | 직접 참조 없음 | 공통 컴포넌트·동기/폼/빈/오류 상태 추가 확인 |
| `/wedding/partner` | `(tabs)/wedding/partner.tsx` | `DelayedLoadingView` | 전체 화면 대기 중 shell·Back 유지, 데이터 자리표시 검토 |

파일 경로의 기준 디렉터리: `apps/mobile/src/app/`.

## 4. 정본의 고유 ID 전체

이 목록은 기존 대장의 분류를 그대로 인용한다. `excluded`는 다시 구현하라는 뜻이 아니다. 미매핑은 화면 부재와 동의어가 아니다. 실제로 알림/후기/웹 등 구현 파일이 존재하지만 연결이 미완인 항목이 있으므로 수동 대조가 필요하다.

| 화면 ID | 한글명 | 화면군 | 기존 매핑 분류 | Claude 후속 작업 |
| --- | --- | --- | --- | --- |
| WP-APP-001 | 앱 아이콘 | APP | 시스템 | OS/플랫폼 조건 확인, 앱 캡처와 구분 |
| WP-APP-002 | 시작 로딩 화면 | APP | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-APP-003 | 최초 실행 소개 · 보류 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-AUTH-001 | 로그인 | APP | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-AUTH-002 | 이메일 입력 · 보류 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-AUTH-003 | 비밀번호 입력 · 보류 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-AUTH-004 | 비밀번호 만들기 · 보류 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-AUTH-005 | 입력 오류 · 보류 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-AUTH-006 | 비밀번호 찾기 · 보류 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-AUTH-007 | 메일 보냈어요 · 보류 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-AUTH-008 | 로그인 유지 | APP | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-AUTH-009 | 나이 확인 · 폐기 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-AUTH-010 | 이용 불가 안내 | APP | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-APP-004 | 시작 · 폐기 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-APP-005 | 재실행 · 로그인 상태 복원 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-APP-006 | 앱 진입 오류 안내 | APP | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-APP-007 | 권한 요청 | APP | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-APP-020 | 초기 설정 · 5개 질문 | APP | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-APP-023 | 날짜 선택 시트 | APP | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-APP-021 | 스타일 선택 · WP-APP-020 5/5에 통합 | APP | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-APP-022 | 초기 설정 완료 | APP | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-APP-008 | 초기 설정 — 예식일 · 보류 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-APP-009 | 초기 설정 — 지역 · 보류 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-APP-010 | 초기 설정 — 총예산 · 보류 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-APP-011 | 초기 설정 — 스타일 선택 · 보류 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-APP-012 | 초기 설정 완료 · 보류 | APP | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-NAV-001 | 홈 탭 | NAV | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-NAV-002 | 검색 탭 | NAV | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-NAV-003 | 픽 탭 | NAV | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-NAV-004 | 웨딩일정 탭 | NAV | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-NAV-005 | 마이페이지 탭 | NAV | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-NAV-006 | 상황별 제보 진입점 | NAV | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-HOME-001 | 홈 | HOME | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-HOME-002 | 우선순위별 홈 콘텐츠 분기 | HOME | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-HOME-003 | 오늘의 픽 | HOME | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-HOME-004 | 추천 상위 3곳 전체보기 | HOME | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-HOME-005 | 다음 준비 | HOME | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-HOME-006 | 개인화 웨딩 소식 | HOME | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-HOME-007 | 홈 편집 | HOME | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-HOME-008 | 비회원 홈 · 폐기 | HOME | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-HOME-009 | 준비 현황 전체 | HOME | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SRCH-001 | 검색 홈 | SRCH | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SRCH-002 | 검색어 입력 · 자동완성 | SRCH | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SRCH-003 | 업종별 탐색 · 진입점 없음 | SRCH | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-SRCH-004 | 검색 결과 | SRCH | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SRCH-005 | 검색 필터 | SRCH | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SRCH-006 | 검색 결과 정렬 | SRCH | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SRCH-007 | 지도 보기 | SRCH | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-SRCH-008 | 검색 결과 없음 · 오류 | SRCH | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-VEND-001 | 업체 상세 | VEND | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-VEND-002 | 이미지 전체보기 | VEND | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-VEND-003 | 제보 금액 상세 | VEND | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-VEND-004 | 업체 안내 | VEND | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-VEND-005 | 공식 정보 | VEND | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-VEND-006 | 정보 오류 제보 | VEND | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-CMP-001 | 비교 후보 선택 | CMP | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-CMP-002 | 비교 결과 | CMP | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-CMP-003 | 비교 요약 | CMP | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-CMP-004 | 비교 화면에서 픽하기 | CMP | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-PICK-001 | 픽 홈 | PICK | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-PICK-002 | 업종별 픽 | PICK | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-PICK-003 | 후보 비교 | PICK | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-PICK-004 | 배우자 공동 결정 | PICK | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-PICK-005 | 최종 결정 확인 | PICK | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-PICK-006 | 결정 완료 | PICK | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-PICK-007 | 결정 내역 | PICK | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-PICK-008 | 픽 해제 | PICK | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-OUR-001 | 웨딩일정 홈 | OUR | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-OUR-003 | 결정한 업체 | OUR | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-OUR-004 | 일정 목록 | OUR | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-OUR-005 | 일정 상세 | OUR | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-OUR-006 | 일정 추가 | OUR | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-OUR-007 | 준비 체크리스트 | OUR | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-OUR-008 | 지출 요약 | OUR | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-OUR-009 | 지출 내역 | OUR | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-OUR-010 | 지출 상세 | OUR | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-OUR-011 | 메모 | OUR | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-OUR-012 | 준비 타임라인 | OUR | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-OUR-013 | 예식 완료 | OUR | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-OUR-014 | 지출 추가 · Pick 인증 통합 | OUR | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-RPT-001 | 제보 홈 | RPT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-RPT-002 | 이미지 선택 | RPT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-RPT-003 | 문서 분석 중 | RPT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-RPT-004 | 자동 입력 결과 확인 | RPT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-RPT-005 | 업체 확인 | RPT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-RPT-006 | 분할 결제 연결 | RPT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-RPT-007 | 제출 완료 | RPT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-RPT-008 | 처리 결과 | RPT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-RPT-009 | 내 제보 내역 | RPT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-RPT-010 | 가격 제보 | RPT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-RPT-011 | 업체 정보 제보 | RPT | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-REV-001 | 후기 목록 | REV | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-REV-002 | 후기 작성 | REV | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-REV-003 | 후기 상세 | REV | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-REV-004 | 내 후기 | REV | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-REV-005 | 후기 신고 | REV | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-REV-006 | 이용자 경험 | REV | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-REV-007 | 업체 반론 표시 | REV | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-EXPO-001 | 박람회 목록 | EXPO | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-EXPO-002 | 박람회 상세 | EXPO | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-EXPO-003 | 웨딩 정보 목록 | EXPO | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-EXPO-004 | 웨딩 정보 상세 | EXPO | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-EXPO-005 | 외부 달력에 일정 등록 | EXPO | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-EVT-001 | 혜택 모아보기 | EVT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-EVT-002 | 미션 4개 | EVT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-EVT-003 | 친구 초대 | EVT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-EVT-004 | 홍보 인증 | EVT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-EVT-005 | 월간 웨딩지원금 | EVT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-EVT-006 | 네이버페이 보상 수령 | EVT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-EVT-007 | 참여 · 지급 내역 | EVT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-NOTI-001 | 알림센터 | NOTI | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-NOTI-002 | 알림 유형별 연결 | NOTI | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-NOTI-003 | 알림 설정 | NOTI | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-MY-001 | 마이페이지 홈 | MY | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-MY-002 | 프로필 | MY | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-MY-003 | 내 웨딩 설정 | MY | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-MY-004 | 스타일 다시 고르기 | MY | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-MY-005 | 화면 설정 | MY | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-MY-006 | 배우자 연결 관리 | MY | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-MY-007 | 계정 관리 | MY | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-MY-008 | 회원 탈퇴 | MY | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-MY-009 | 고객지원 | MY | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-MY-010 | 서비스 정보 | MY | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-CPL-001 | 배우자 초대 | CPL | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-CPL-002 | 초대 수락 | CPL | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-CPL-003 | 연결 완료 | CPL | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-CPL-004 | 공동 편집 충돌 해결 | CPL | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-CPL-005 | 변경 내역 | CPL | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-CPL-006 | 연결 해제 | CPL | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-BIZ-001 | 문의 유형 선택 | BIZ | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-BIZ-002 | 소속 확인 | BIZ | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-BIZ-003 | 문의 내역 | BIZ | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-BIZ-004 | 반론 등록 | BIZ | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-BIZ-005 | 자료 제공 | BIZ | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-BIZ-006 | 혜택 등록 | BIZ | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-BIZ-007 | 광고 · 제휴 문의 | BIZ | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-BIZ-008 | 웹 하단 업체 문의 진입 | BIZ | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-FAQ-001 | 자주 묻는 질문 홈 | FAQ | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-FAQ-003 | 질문 답변 상세 | FAQ | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-LEGAL-001 | 이용약관 본문 | FAQ | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-LEGAL-002 | 개인정보처리방침 본문 | FAQ | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-SHT-001 | 다른 방법으로 시작 · 폐기 | SHT | 제외/보류 | 제외 근거·링크만 확인, 임의 복구 금지 |
| WP-SHT-002 | 픽 완료 | SHT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-003 | 픽 해제 확인 | SHT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-004 | 비교 후보 선택 | SHT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-005 | 최종 결정 확인 | SHT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-006 | 예식일 입력 | SHT | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-007 | 지역 선택 | SHT | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-008 | 예산 입력 | SHT | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-009 | 스타일 선택 | SHT | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-010 | 배우자 초대 | SHT | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-011 | 공유 | SHT | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-012 | 달력에 일정 등록 | SHT | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-013 | 신고 | SHT | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-014 | 데이터 설명 | SHT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-015 | 기준금액 설명 | SHT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-016 | 권한 요청 설명 | SHT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-SHT-017 | 혜택 안내 시트 | SHT | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-001 | 세션 만료 | ST | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-002 | 배우자 연결 상태 | ST | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-003 | 픽 상태 | ST | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-004 | 이미지 상태 | ST | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-005 | 데이터 상태 | ST | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-006 | 혜택 상태 | ST | 상태 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-007 | 불러오는 중 | ST | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-008 | 콘텐츠 없음 | ST | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-009 | 오류 | ST | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-010 | 네트워크 오류 | ST | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-011 | 권한 거부 | ST | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-012 | 처리 중 | ST | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-013 | 긴 콘텐츠 표시 | ST | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-014 | 점검 · 업데이트 안내 | ST | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-015 | 업종 순회 로딩 | ST | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ST-016 | 로더 아이콘 세트 · 12업종 | ST | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-LAND-001 | 랜딩 | WEB | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-LAND-002 | 서비스 소개 | WEB | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-LAND-003 | 자주 묻는 질문 | WEB | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-LAND-004 | 고객지원 | WEB | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-LAND-005 | 이용약관 | WEB | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-LAND-006 | 개인정보처리방침 | WEB | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-WEB-001 | 웹 홈 | WEB | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-WEB-003 | 웹 업체 상세 | WEB | 컴포넌트 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-001 | 관리자 홈 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-002 | 일일 브리핑 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-010 | 제보 처리 현황 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-011 | 확인 필요 목록 | ADM | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-ADM-012 | 가격 통계 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-013 | 이상치 · 조작 탐지 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-014 | 업체 관리 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-015 | 이미지 자동 수급 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-016 | 이메일 회신 자동 매칭 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-020 | 사용자 계정 관리 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-021 | 고객 의견 · 문의 관리 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-022 | 후기 · 반론 관리 | ADM | 미매핑 | 실제 라우트/컴포넌트/통합·삭제 여부 판정 후 연결 |
| WP-ADM-023 | 업체 문의 처리 목록 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-030 | 마케팅 자동화 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-031 | 캠페인 · 보상 관리 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-032 | 수익 현황 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-033 | 광고 집행 관리 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-034 | 광고 실운영 전환 조건 관리 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-035 | 자주 묻는 질문 관리 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-036 | 약관 · 방침 관리 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-040 | 자동화 상태 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-041 | 긴급 중지 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-042 | 변경 복구 관리 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-050 | 인공지능 사용량 · 비용 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-051 | 정책 규칙 관리 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |
| WP-ADM-052 | 감사 기록 | ADM | 라우트 매핑 | 기준 시안 위치·실제 상태·390×844 대조 증거 연결 |

## 5. 30개 미매핑 항목의 처리 기준

- `WP-HOME-002/003/005`, `WP-CMP-003/004`, `WP-PICK-004/008`처럼 하위 상태/행동인 항목을 독립 라우트로 억지 생성하지 않는다.
- `WP-SRCH-003`처럼 진입점 없음이 명시된 항목은 활성화 승인 여부를 먼저 확인한다.
- `WP-NOTI-001`은 `my/notifications.tsx`, `WP-REV-001`은 `search/[vendorId]/reviews.tsx` 등을 후보 연결점으로 대조한다. 파일 이름이 맞는 것만으로 디자인 일치를 확정하지 않는다.
- WEB 항목은 `apps/mobile`에 route가 없다고 누락 구현으로 판정하지 않는다. `apps/web/src/landing*.ts`, `subpages.ts`, build/router 역할을 확인한다.
- 개인정보처리방침 전문은 기존 웹 정본을 유지한다. 앱 안에 별도 전문 사본을 만들지 않는다.
- 관리자 확인 필요/후기·반론은 운영 기능과 메뉴 노출 정책을 함께 확인한다. 빈 껍데기 메뉴를 검수 편의로 다시 노출하지 않는다.
- 판정 근거를 `docs/sync/design-screen-map.json`에 연결하되 원래 208개 ID를 삭제하거나 새 합계를 지어내지 않는다.

## 6. 각 행의 검수 기록 양식

아래 상세 양식을 ID별/변경 묶음별로 추가하거나 기존 매핑 대장에 링크한다. 표 전체의 상태를 한꺼번에 “완료”로 바꾸지 않는다.

```text
화면 ID / route:
소유 담당 / PR:
코드 기준 SHA / 운영 SHA:
기준 HTML과 프레임 / 적용 토큰:
확정 사용자 예외:
loading:
ready:
empty:
error / retry:
refreshing:
submitting / double-submit:
세션 / 권한 / 직접 링크:
Back / 탭 / 필터 / 스크롤 복원:
390×844 정본 캡처:
390×844 실제 캡처:
시각 차이 / 조치:
넓은 웹 / 네이티브 / 접근성:
미확인 / N/A 사유:
반영 단계:
```

## 7. 예약 순서 공통 회귀

**최종 Pick 완료 → 상담 예약**은 확정 요구다. 다음 경로를 하나의 여정으로 묶어 검수한다.

- 업체 상세 → 최종 Pick 확인 → 저장 성공 → 완료 → 상담 예약.
- 추천/비교/나의 Pick에서 같은 업체의 최종 Pick을 마친 후 예약.
- `/search/[vendorId]/consult`, `/booking` 직접 접근.
- 미Pick/후보만 Pick/최종 Pick 저장 실패/다른 업체로 결정 변경.
- 예약 입력 중 결정 해제, 앱 재실행, 다른 기기, 중복 제출.
- 개인 일정 등록 성공과 업체 예약 확정을 혼동하지 않음.
