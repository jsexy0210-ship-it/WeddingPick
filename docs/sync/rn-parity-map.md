# RN 정본 ↔ 앱 구현 화면 대조표

- **정본 경로**: `docs/design/React_Native/` (React 변환본 v3.29.1, 84개 파일, 한 층으로 풀려 있음). CLAUDE.md ⛔ 절대 지침(2026-09-24)에 따라 앱 화면의 유일한 근거다.
- **생성 시각**: 2026-09-24 KST 작업분 (작성 완료 시각 2026-09-25 02:10 KST 무렵, 기준 커밋 `0992d78c`. 작업 중에 `f7c6188d` → `0992d78c`로 main이 두 번 움직여서 줄 번호는 `0992d78c` 기준으로 다시 뽑았다).
- **방법**
  1. 정본 목록: `runtime-check.json` `groups[]`의 80개 프레임(home 15 · search 11 · pick 5 · note 9 · my 22 · common 18). `components` · `devices`는 기준 보드라서 프레임이 0개이고 이 표에 넣지 않았다.
  2. 정본 위치: `source-map.json`의 보드 · 모델 경로(저장소에서는 `home.jsx` · `home.js`처럼 한 층에 있다). 「보드 줄」은 `*.jsx`에서 해당 `data-design-frame` 줄, 「원본」은 `runtime-check.json`의 `sourceLine`(삭제된 원본 `.dc.html`의 행)이다.
  3. 구현 찾기: WP-ID마다 `grep -rn "<WP-ID>" apps/mobile/src packages/ui/src`, 여기에 `apps/mobile/src/app` 라우트 트리와 `features/**`를 뜻으로 대조했다. **「구현 있음」은 파일을 열어서 그 화면(또는 그 상태)을 그리는 코드인지 확인한 것만 적었다.**
  4. 구현 경로는 `apps/mobile/src/` 기준 상대 경로이고, `packages/ui/src/…`만 따로 표기했다.
- **이 문서는 화면 단위 대조표다. 값(토큰 · px) 대조는 각 세션이 CLAUDE.md 「화면 작업 절차」대로 한다.** 「구현 있음」은 정본과 **일치한다는 뜻이 아니다**. 대응하는 화면이 있다는 뜻일 뿐이다.

## 정본 쪽 결손 · 주의(README · HANDOFF · CONVERSION_REPORT 기준)

- 원본 사진 7종이 없다(`assetOverrides.js`에서 `null`). 스타일 이미지 4종(urban · natural · romantic · glamorous)은 home · search · my 모델과 보드에서 쓰고(보드에 직접 박힌 자리: search frame-004 · 009, my frame-009 · 011 · 013), samples 3종은 components 보드에서 쓴다. 이 자리들은 회색 이미지로 남아 있어서 픽셀 대조가 안 된다.
- 원본에 정의가 없는 스타일(값 없이 렌더됨): home `tagIdWide` · `tagRow` · `tagText`, note `tagRow` · `tagText`, my `decidedNote`. 대부분 보드 번호표나 설명 스타일이고, 픽셀 대조 완료 항목으로 치지 않는다.
- HANDOFF 경고: 이 폴더는 React DOM 디자인 레퍼런스이고 RN 완료본이 아니다. 사이드바 · 휴대전화 바깥 번호 · 캔버스 설명은 제품 UI가 아니다. 약관 탭 전환을 빼면 동작은 시안 표현일 뿐이다.
- CONVERSION_REPORT: 캔버스 설명문과 공통 기준에 예전 용어가 남아 있다(예: common `WP-EMPTY-REC` 「웨딩픽 추천」, `WP-EMPTY-PICK` CTA 「추천 보기」). v3.29 「추천 개념 삭제」와 충돌할 수 있으니 반영 전에 따로 검토한다.
- 보드 안 「정본과 다른 점」 표(home 14 · 16 · 17, search 13 · 14, pick 4, note 6, my 15)는 화면 프레임이 아니고 Figma 대비 차이를 적은 명세다. 화면별 작업 때 함께 읽는다.

## 1. home — 홈 · 로그인 · 온보딩 (15)

| # | frame | 화면 ID | 화면 이름 | 정본(보드·모델·원본 행) | 구현(라우트 · 주 파일:줄) | 상태 | 메모 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | frame-001 | WP-APP-001 | 스플래시 · 시작 | `home.jsx:73` · `home.js` · 원본 54 | (라우트 없음, 루트가 덮어 그림) `features/splash/splash-view.tsx:52`, `app/_layout.tsx:361` | 구현 있음 | 화면이 아니라 컴포넌트다. 주석의 근거가 삭제된 `html/대메뉴_홈…dc.html`로 적혀 있다 |
| 2 | frame-002 | WP-AUTH-001 | 로그인 | `home.jsx:83` · `home.js` · 원본 65 | `/login` `app/login/index.tsx:66` | 구현 있음 | — |
| 3 | frame-003 | WP-AUTH-009 | 만 14세 이용 불가 | `home.jsx:108` · `home.js` · 원본 87 | `/login/age-required` `app/login/age-required.tsx:33` | 구현 있음 | — |
| 4 | frame-004 | WP-AUTH-010 | 약관 동의 · 권한 안내 | `home.jsx:120` · `home.js` · 원본 100 | `/login/consent` `app/login/consent.tsx:49` | 구현 있음 | 서버가 받는 동의는 3종뿐이다(파일 머리말). 화면에는 8항목을 모두 그린다 |
| 5 | frame-005 | WP-AUTH-011 | 약관 상세 | `home.jsx:181` · `home.js` · 원본 150 | (모달) `features/auth/terms-detail-modal.tsx:22`, 호출 `app/login/consent.tsx:197` | 구현 있음 | 로그인 흐름에서만 쓴다. MY 약관은 이 모달을 쓰지 않는다(my frame-021·022 참고) |
| 6 | frame-006 | WP-AUTH-002 | 초기 설정 1/5 예식일 | `home.jsx:214` · `home.js` · 원본 176 | `/setup` `app/setup.tsx:139`(분기 `:458`) · `features/onboarding/date-picker-sheet.tsx` | 구현 있음 | 한 라우트 안의 단계 분기다 |
| 7 | frame-007 | WP-AUTH-003 | 초기 설정 2/5 지역 | `home.jsx:234` · `home.js` · 원본 197 | `/setup` `app/setup.tsx:502` · `features/onboarding/region-picker-sheet.tsx` | 구현 있음 | — |
| 8 | frame-008 | WP-AUTH-004 | 초기 설정 3/5 진행 상황 | `home.jsx:275` · `home.js` · 원본 231 | `/setup` `app/setup.tsx:521` · `features/onboarding/option-row.tsx` | 구현 있음 | — |
| 9 | frame-009 | WP-AUTH-005 | 초기 설정 4/5 예산 | `home.jsx:303` · `home.js` · 원본 256 | `/setup` `app/setup.tsx:537` · `features/onboarding/budget-amount.tsx` | 구현 있음 | — |
| 10 | frame-010 | WP-AUTH-006 | 초기 설정 5/5 스타일 | `home.jsx:329` · `home.js` · 원본 279 | `/setup` `app/setup.tsx:545` · `features/onboarding/inline-toast.tsx`(3번째 선택 토스트) | 구현 있음 | `auth-back-button.tsx:7` 주석이 WP-AUTH-006/007을 「비밀번호 찾기 · 메일 보냈어요」로 적고 있다. 옛 번호다 |
| 11 | frame-011 | WP-AUTH-007 | 초기 설정 완료 | `home.jsx:359` · `home.js` · 원본 307 | `/setup` `app/setup.tsx:386`(`step === 'done'`) | 구현 있음 | — |
| 12 | frame-012 | WP-HOME-001 | Home · 중복 정리 | `home.jsx:393` · `home.js` · 원본 339 | `/`(홈 탭) `app/(tabs)/index.tsx:82` | 구현 있음 | 섹션: `features/home/hero.tsx` · `home-summary.tsx` · `wedding-schedule.tsx` · `prep-groups.ts` |
| 13 | frame-013 | WP-HOME-002 | 홈 · 아무것도 없을 때 | `home.jsx:547` · `home.js` · 원본 487 | `/` `app/(tabs)/index.tsx:82` 상태 분기 · `features/home/prep-groups.ts:142` · `features/home/wedding-schedule.tsx:18`(defaultSchedule) | 구현 있음 | 별도 화면이 아니라 같은 화면의 상태 분기다(`features/home/state.ts` 2층 모델) |
| 14 | frame-014 | WP-HOME-003 | 홈 · 일부 정보가 있을 때 | `home.jsx:629` · `home.js` · 원본 556 | 위와 같음(`prep-groups.ts:142` 「지금은 웨딩홀 차례예요」) | 구현 있음 | 같은 화면의 상태 분기다 |
| 15 | frame-015 | WP-SHT-017 | 혜택 안내 시트 | `home.jsx:733` · `home.js` · 원본 649 | `/` 위 시트 `features/home/benefit-sheet.tsx:41`, 호출 `app/(tabs)/index.tsx:351` | 구현 있음 | CTA 「혜택 보기」가 가는 `/my/rewards`는 정본에 없다(3장 참고) |

## 2. search — 검색 · 업체 상세 (11)

| # | frame | 화면 ID | 화면 이름 | 정본(보드·모델·원본 행) | 구현(라우트 · 주 파일:줄) | 상태 | 메모 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | frame-001 | WP-SRCH-001 | 결과 목록 · 기본 | `search.jsx:60` · `search.js` · 원본 51 | `/search` `app/(tabs)/search/index.tsx:168` | 구현 있음 | — |
| 2 | frame-002 | WP-SRCH-002 | 필터 시트 | `search.jsx:134` · `search.js` · 원본 117 | `/search` 위 시트 `features/search/filter-sheet.tsx:70` | 구현 있음 | `search/index.tsx:103 · :364 · :574` 주석은 WP-SRCH-002를 「자동완성」으로 적고 있다. 정본에서 자동완성은 WP-SRCH-004다 |
| 3 | frame-003 | WP-SRCH-003 | 정렬 드롭다운 · 결과 없음 | `search.jsx:184` · `search.js` · 원본 156 | `/search` 정렬 `features/search/sort-sheet.tsx:31`, 결과 없음 `app/(tabs)/search/index.tsx:755`(renderEmpty) | 구현 있음 | **구조가 다를 수 있다.** 정본 tagDesc는 「정렬은 칩 아래 인라인 패널」인데 구현은 바텀시트(`SortSheet`)다. sort-sheet 주석은 옛 ID WP-SRCH-006을 적고 있다. 정렬 라벨 「추천순」은 v3.29 추천 삭제와 충돌할 수 있다 |
| 4 | frame-004 | WP-VEND-001 | 업체 상세 · 소개 | `search.jsx:245` · `search.js` · 원본 214 | `/search/[vendorId]` `app/(tabs)/search/[vendorId]/index.tsx:154`(탭 `:506`) | 구현 있음 | 스타일 사진 결손 자리가 있다 |
| 5 | frame-005 | WP-VEND-002 | 패키지 | `search.jsx:324` · `search.js` · 원본 280 | 같은 파일 `:624`(`tab === 'price'`, 라벨 「패키지」) | 구현 있음 | 같은 라우트의 탭이다 |
| 6 | frame-006 | WP-VEND-003 | 후기 | `search.jsx:366` · `search.js` · 원본 311 | 같은 파일 `:774`(`tab === 'review'`) | 구현 있음 | 별점 유지(CLAUDE.md 「⚠️ 후기 별점」, 대표님 확인 대기) |
| 7 | frame-007 | WP-VEND-004 | 정보 | `search.jsx:435` · `search.js` · 원본 353 | 같은 파일 `:895`(`tab === 'info'`) | 구현 있음 | — |
| 8 | frame-008 | WP-SRCH-004 | 자동완성 | `search.jsx:488` · `search.js` · 원본 396 | `/search` `app/(tabs)/search/index.tsx:587`(renderAutocomplete) · `features/search/recent-searches.ts` | 구현 있음 | 같은 라우트의 오버레이 상태다 |
| 9 | frame-009 | WP-VEND-006 | 이미지 전체보기 | `search.jsx:523` · `search.js` · 원본 424 | `/search/[vendorId]/images` `app/(tabs)/search/[vendorId]/images.tsx:50` | 구현 있음 | 스타일 사진 결손 자리가 있다 |
| 10 | frame-010 | WP-VEND-007 | 제보 금액 상세 | `search.jsx:541` · `search.js` · 원본 439 | — | **구현 없음** | 정본은 업체 상세 실 제보 블록의 「자세히」에서 들어가 구간 · 건수 · 조건별 분포 · 최근 변화를 보여준다. WP-ID grep 0건, 「조건별 분포」 · 「최근 변화」 grep 0건. 업체 상세 금액 블록(`[vendorId]/index.tsx:453`)에는 상세로 가는 이동이 없다. `price-report.tsx`는 이 화면이 아니다(Pick 인증으로 보내는 리다이렉트) |
| 11 | frame-011 | WP-VEND-008 | 정보 오류 제보 | `search.jsx:571` · `search.js` · 원본 466 | `/search/[vendorId]/fix-report` `app/(tabs)/search/[vendorId]/fix-report.tsx:73` | 구현 있음 | — |

## 3. pick — Pick · 비교 · 상담 예약 (5)

| # | frame | 화면 ID | 화면 이름 | 정본(보드·모델·원본 행) | 구현(라우트 · 주 파일:줄) | 상태 | 메모 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | frame-001 | WP-PICK-001 | 최종 결정 · 상담 연계 | `pick.jsx:56` · `pick.js` · 원본 36 | `/pick` `app/(tabs)/pick/index.tsx:120` | 구현 있음 | 정본 tagDesc는 「카드를 누르면 상담 예약으로 바로 이어집니다」인데, 구현 머리말은 「최종 결정 뒤에만 상담 예약」이다(CLAUDE.md 규칙). 동작 차이로 확인이 필요하다 |
| 2 | frame-002 | WP-PICK-006 | 비교 | `pick.jsx:136` · `pick.js` · 원본 101 | `/search/compare` `app/(tabs)/search/compare.tsx:100` | 구현 있음 | 정본은 Pick 화면군인데 라우트는 search 아래에 있다. 주석에 옛 ID WP-CMP-002가 함께 적혀 있다 |
| 3 | frame-003 | WP-PICK-010 | 상담 예약 완료 | `pick.jsx:186` · `pick.js` · 원본 144 | `/search/[vendorId]/consult-done` `app/(tabs)/search/[vendorId]/consult-done.tsx:40` | 구현 있음 | common `WP-DONE-VEND`와 같은 자리다(common 표 15 참고) |
| 4 | frame-004 | WP-PICK-009 | 상담 예약 | `pick.jsx:213` · `pick.js` · 원본 168 | `/search/[vendorId]/consult`(+ 별칭 `/booking`) `app/(tabs)/search/[vendorId]/consult.tsx:66` | 구현 있음 | 정본 프레임에는 머리(「상담 예약」)가 있는 전체 화면이 그려져 있는데, 구현은 업체 상세 위 바텀시트(DLG-D)다. 구조를 대조해야 한다 |
| 5 | frame-005 | WP-PICK-008 | 삭제 · OS 토스트 안내 | `pick.jsx:262` · `pick.js` · 원본 211 | `/pick` `app/(tabs)/pick/index.tsx:248`(즉시 삭제 + 되돌리기 토스트) · `components/confirm-alert-toast.tsx:35` | 구현 있음 | `pick/[category].tsx`도 같은 패턴이다 |

## 4. note — 웨딩노트 (9)

| # | frame | 화면 ID | 화면 이름 | 정본(보드·모델·원본 행) | 구현(라우트 · 주 파일:줄) | 상태 | 메모 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | frame-001 | WP-NOTE-001 | 캘린더 | `note.jsx:56` · `note.js` · 원본 36 | `/wedding` `app/(tabs)/wedding/index.tsx:84` · `CalendarPanel :433` | 구현 있음 | 탭 라벨은 「웨딩일정」이다(정본 프레임 이름은 「캘린더」) |
| 2 | frame-002 | WP-NOTE-002 | 일정 등록 | `note.jsx:121` · `note.js` · 원본 82 | `/wedding/[id]/events/new` `app/(tabs)/wedding/[id]/events/new.tsx:34` | 구현 있음 | 바텀시트다. 알림 토글 3개는 서버에 `notifyEnabled` 하나뿐이다(파일 머리말) |
| 3 | frame-003 | WP-NOTE-004 | 상담기록 | `note.jsx:169` · `note.js` · 원본 115 | `/wedding?tab=consult` `app/(tabs)/wedding/index.tsx:821`(ConsultPanel) · 업로드 `app/(tabs)/wedding/[id]/consultations/upload.tsx:23` | 구현 있음 | — |
| 4 | frame-004 | WP-NOTE-005 | 정리 결과 | `note.jsx:205` · `note.js` · 원본 140 | `/wedding/[id]/consultations/[recordId]` `app/(tabs)/wedding/[id]/consultations/[recordId].tsx:39` | 구현 있음 | 정본 tagDesc: 「정책 판단이 필요한 신규 기능」. CLAUDE.md는 2026-09-23에 채택했다고 적는다 |
| 5 | frame-005 | WP-NOTE-006 | 예산현황 | `note.jsx:262` · `note.js` · 원본 182 | `/wedding?tab=budget` `app/(tabs)/wedding/index.tsx:689`(BudgetPanel) | 구현 있음 | — |
| 6 | frame-006 | WP-NOTE-007 | 예산 항목 추가 | `note.jsx:313` · `note.js` · 원본 222 | `/wedding/[id]/expenses/add` `app/(tabs)/wedding/[id]/expenses/add.tsx:49` | 불명확 | 파일이 스스로 `DESIGN_UNRESOLVED`라고 적는다(`:33`). 정본은 항목 · 예산 · 낸 금액을 한 화면에서 받고 사진을 올리면 값이 바로 채워지는데, 구현은 「지출 하나 기록」 모델(업체 · 금액 · 날짜 · 카테고리)이다. 대응 여부는 판단이 필요하다 |
| 7 | frame-007 | WP-OUR-014b | 지출 목록 | `note.jsx:351` · `note.js` · 원본 253 | `/wedding/[id]/expenses/list` `app/(tabs)/wedding/[id]/expenses/list.tsx:25` | 구현 있음 | — |
| 8 | frame-008 | WP-OUR-003 | 예약현황 | `note.jsx:377` · `note.js` · 원본 278 | `/wedding/[id]/decided` `app/(tabs)/wedding/[id]/decided.tsx:35` | 구현 있음 | 파일 이름 · 주석은 「결정한 업체」, nav 제목은 「예약현황」이다 |
| 9 | frame-009 | WP-CPL-005 | 변경내역 | `note.jsx:402` · `note.js` · 원본 300 | `/wedding/[id]/changelog` `app/(tabs)/wedding/[id]/changelog.tsx:38` | 구현 있음 | 앱 안에서 이 라우트로 가는 이동을 grep으로 찾지 못했다(`depth-back-rules.ts`에만 등장). 진입점을 확인해야 한다 |

## 5. my — MY · 라운지 · 배우자 (22)

| # | frame | 화면 ID | 화면 이름 | 정본(보드·모델·원본 행) | 구현(라우트 · 주 파일:줄) | 상태 | 메모 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | frame-001 | WP-MY-001 | MY | `my.jsx:56` · `my.js` · 원본 54 | `/my` `app/(tabs)/my/index.tsx:87` | 구현 있음 | — |
| 2 | frame-002 | WP-MY-002 | 프로필 | `my.jsx:113` · `my.js` · 원본 100 | `/my/profile` `app/(tabs)/my/profile.tsx:85` | 구현 있음 | — |
| 3 | frame-003 | WP-MY-003 | 내 웨딩설정 | `my.jsx:167` · `my.js` · 원본 147 | `/my/wedding-settings` `app/(tabs)/my/wedding-settings.tsx:91` | 구현 있음 | 주석(`:82`)이 WP-MY-004를 「취향 다시 고르기」로 적고 있다. 옛 번호다 |
| 4 | frame-004 | WP-MY-004 | Pick 인증내역 | `my.jsx:195` · `my.js` · 원본 172 | `/my/reports` `app/(tabs)/my/reports.tsx:44` | 구현 있음 | 파일이 「미룬 것 둘」을 적고 있다(머리말) |
| 5 | frame-005 | WP-MY-005 | 연결관리 | `my.jsx:232` · `my.js` · 원본 202 | `/wedding/partner`(연결됨 상태) `app/(tabs)/wedding/partner.tsx:290` | 구현 있음 | WP-MY-005 grep 0건이라 뜻으로 대응시켰다(nav 「연결관리」 = `linkedNav`). 정본은 「같이 보는 것 / 각자 보는 것을 **토글**로」인데 구현은 배지 목록이다. 주석은 이 상태를 옛 번호 「WP-MY-014」로 적고 있다 |
| 6 | frame-006 | WP-MY-006 | 내가 쓴 후기 | `my.jsx:282` · `my.js` · 원본 245 | `/my/reviews` `app/(tabs)/my/reviews.tsx:61` | 구현 있음 | — |
| 7 | frame-007 | WP-MY-008 | 문의하기 | `my.jsx:326` · `my.js` · 원본 282 | `/my/contact` `app/(tabs)/my/contact.tsx:56` | 구현 있음 | `withdrawal.tsx` 머리말은 WP-MY-008을 「회원탈퇴」로 적고 있다. 옛 번호다 |
| 8 | frame-008 | WP-LNG-001 | 리얼후기 | `my.jsx:382` · `my.js` · 원본 332 | `/community?tab=review` `app/(tabs)/community/index.tsx:65` · `ReviewList :284` | 구현 있음 | 탭 라벨이 정본 「리얼후기」와 다르게 「후기」(`community.tab.review`)다. 주석 근거가 없는 파일 `screen-inventory.md`로 적혀 있다 |
| 9 | frame-009 | WP-LNG-005 | 후기 쓰기 | `my.jsx:426` · `my.js` · 원본 361 | 시트 `app/(tabs)/search/[vendorId]/write-review.tsx:52`(ReviewWriteSheet), 라운지 호출 `community/index.tsx:262` | 구현 있음 | 정본은 back 헤더가 있는 전체 화면인데 구현은 바텀시트다(CLAUDE.md 「작성은 BottomSheet」). 구조를 대조해야 한다. 스타일 사진 결손 자리가 있다 |
| 10 | frame-010 | WP-LNG-002 | 웨딩정보 | `my.jsx:484` · `my.js` · 원본 408 | `/community?tab=feed` `app/(tabs)/community/index.tsx:509`(FeedList) | 구현 있음 | 탭 라벨 「웨딩정보」. 뜻이 겹치는 `/search/wedding-info`(3장)가 따로 있다 |
| 11 | frame-011 | WP-LNG-004 | 글 상세 | `my.jsx:514` · `my.js` · 원본 431 | `/community/feed/[id]` → `app/(tabs)/(home)/feed/[id].tsx:39` | 구현 있음 | 스크랩 있음. 스타일 사진 결손 자리가 있다 |
| 12 | frame-012 | WP-LNG-003 | 박람회 | `my.jsx:558` · `my.js` · 원본 468 | `/community?tab=expo` `app/(tabs)/community/index.tsx:558`(ExpoList) | 구현 있음 | 뜻이 겹치는 `/search/expo`(3장)가 따로 있다 |
| 13 | frame-013 | WP-LNG-006 | 박람회 상세 | `my.jsx:590` · `my.js` · 원본 498 | `/search/expo/[expoId]` `app/(tabs)/search/expo/[expoId]/index.tsx:60` | 구현 있음 | 사전등록은 `openExternal`(인앱)이다. 주석에 옛 ID WP-EXPO-002가 적혀 있다. 스타일 사진 결손 자리가 있다 |
| 14 | frame-014 | WP-MY-012 | 회원탈퇴 | `my.jsx:634` · `my.js` · 원본 535 | `/my/withdrawal` `app/(tabs)/my/withdrawal.tsx:62` | 구현 있음 | — |
| 15 | frame-015 | WP-MY-013 | FAQ | `my.jsx:677` · `my.js` · 원본 571 | `/my/guide?mode=faq` `app/(tabs)/my/guide.tsx:24` | 구현 있음 | 같은 파일이 촬영 요령 모드도 맡는다. 헤더 「FAQ」 영문 표기는 판단 필요(`my/index.tsx:192` 주석) |
| 16 | frame-016 | WP-MY-014 | 스타일 다시 고르기 | `my.jsx:712` · `my.js` · 원본 595 | `/my/taste` `app/(tabs)/my/taste.tsx:54` | 구현 있음 | — |
| 17 | frame-017 | WP-CPL-001 | 배우자 초대 | `my.jsx:744` · `my.js` · 원본 625 | `/wedding/partner`(혼자 상태) `app/(tabs)/wedding/partner.tsx:318` | 구현 있음 | — |
| 18 | frame-018 | WP-CPL-002 | 초대 수락 | `my.jsx:783` · `my.js` · 원본 661 | `/wedding/join` `app/(tabs)/wedding/join.tsx:163` | 구현 있음 | 파일에 `DESIGN_UNRESOLVED`가 적혀 있다(초대자 이름 · 예식일은 서버가 주지 않는다) |
| 19 | frame-019 | WP-CPL-003 | 연결 완료 | `my.jsx:818` · `my.js` · 원본 693 | `/wedding/join` `app/(tabs)/wedding/join.tsx:96` | 구현 있음 | 같은 라우트의 완료 상태다 |
| 20 | frame-020 | WP-CPL-006 | 연결 해제 | `my.jsx:852` · `my.js` · 원본 724 | `/wedding/partner`(해제 확인 상태) `app/(tabs)/wedding/partner.tsx:248` | 구현 있음 | — |
| 21 | frame-021 | WP-MY-015 | 이용약관 | `my.jsx:892` · `my.js` · 원본 757 | `/my` → `openPolicy('terms')` `app/(tabs)/my/index.tsx:56` → `features/open-external.ts`(인앱 브라우저 · iframe 껍데기) | 불명확 | 정본은 back 헤더에 「이용약관」 원문을 앱 화면으로 그린다. 구현은 웹사이트 원문(`apps/web/src/subpages.ts`)을 인앱 브라우저로 연다(CLAUDE.md 「약관 정본은 웹사이트」 · 「앱 밖으로 나가지 않는다」). 앱 화면 파일이 없어서 헤더 규격을 대조할 수 없다 |
| 22 | frame-022 | WP-MY-015b | 개인정보처리방침 | `my.jsx:912` · `my.js` · 원본 774 | `/my` → `openPolicy('privacy')` `app/(tabs)/my/index.tsx:56` | 불명확 | 위와 같다. `/my/privacy`(요약 화면)는 있지만 앱 안 진입 참조가 grep 0건이다(3장) |

## 6. common — 공통 UI · 빈 상태 · 로더 (18)

`runtime-check.json`에서 frame-001~015의 label은 모두 「1 · 다이얼로그」라서 WP-ID가 없다. 보드(`common.jsx:75`의 `screens` 반복 8개, `:169`의 `escreens` 반복 7개)의 DOM 순서를 모델 배열 순서와 맞춰서 ID를 정했다(`common.js:582~621` `screens`, `:434~472` `escreens`).

| # | frame | 화면 ID | 화면 이름 | 정본(보드·모델·원본 행) | 구현(라우트 · 주 파일:줄) | 상태 | 메모 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | frame-001 | WP-DLG-A | 알림 | `common.jsx:75` · `common.js:582` · 원본 68 | (공용) `components/confirmation-dialog-host.tsx:98`(버튼 1개 분기), 진입 `components/confirm-alert.ts` | 구현 있음 | 정본의 상태 아이콘(ok)은 구현에 없다. WP-DLG-* grep은 0건이고 코드에는 「DLG-B」 · 「DLG-F」처럼 접두어 없이 적혀 있다 |
| 2 | frame-002 | WP-DLG-B | 확인 | `common.jsx:75` · `common.js:588` · 원본 68 | `components/confirmation-dialog-host.tsx:98`(취소 + 실행) | 구현 있음 | — |
| 3 | frame-003 | WP-DLG-C | 되돌릴 수 없음 | `common.jsx:75` · `common.js:594` · 원본 68 | `components/confirmation-dialog-host.tsx:98`(destructive → 배경 탭 닫힘 없음, 빨간 실행) | 구현 있음 | 정본은 「사라지는 것」을 항목 목록으로 보여주는데 구현 대화상자에는 목록 칸이 없다(메시지 한 줄). 정본 예시(연결 끊기)는 `wedding/partner.tsx:248`이 전체 화면으로 따로 그린다 |
| 4 | frame-004 | WP-DLG-D | 바텀시트 | `common.jsx:75` · `common.js:600` · 원본 68 | `features/common/bottom-sheet.tsx:55` · `SheetPanel :254` | 구현 있음 | 공용 껍데기다. 정본 예시 문구 「비교할 곳을 골라주세요」는 `spec/strings.ko.json` `selectTitle`에 있다 |
| 5 | frame-005 | WP-DLG-E | 행동 목록 | `common.jsx:75` · `common.js:607` · 원본 68 | `components/confirmation-dialog-host.tsx:47`(실행 버튼 2개 이상 → BottomSheet, 위험 동작은 맨 아래) | 구현 있음 | 정본 예시(후기 → 도움돼요 · 링크 복사 · 신고하기)는 구현 후기 화면에서 인라인 버튼이다(`search/[vendorId]/reviews.tsx` 「신고하기」) |
| 6 | frame-006 | WP-DLG-F | 토스트 | `common.jsx:75` · `common.js:613` · 원본 68 | `components/confirm-alert-toast.tsx:35`(DialogToast) · `features/navigation/result-toast-host.tsx` | 구현 있음 | 되돌리기 사용처: `pick/index.tsx:248` |
| 7 | frame-007 | WP-DLG-F | 토스트 · 제한 안내 | `common.jsx:75` · `common.js:617` · 원본 68 | `features/onboarding/inline-toast.tsx:31`(사용 `setup.tsx` · `my/taste.tsx`) | 구현 있음 | WP-ID가 frame-006과 같다 |
| 8 | frame-008 | WP-DLG-B | 확인 · 작성 중 이탈 | `common.jsx:75` · `common.js:621` · 원본 68 | `features/common/dirty-sheet-close.ts:7` | 구현 있음 | WP-ID가 frame-002와 같다. 문구가 다르다: 정본 「쓰던 내용은 저장되지 않아요」 · 「이어서 쓰기 / 그만두기」, 구현 「입력한 내용은 저장되지 않아요」 · 「계속 작성 / 그만두기」 |
| 9 | frame-009 | WP-EMPTY-HOME | 홈 · 처음 | `common.jsx:169` · `common.js:434` · 원본 140 | `/`(홈) `app/(tabs)/index.tsx:82`는 WP-HOME-002 방식(기본 일정 5줄 등)으로 빈 상태를 그린다 | 불명확 | 정본 문구 「아직 등록한 일정이 없어요」 · 「예산을 정하지 않았어요」는 grep 0건이다. 정본 안에서 home WP-HOME-002와 common WP-EMPTY-HOME이 서로 다른 빈 홈을 그리고 있다. 어느 쪽을 따를지 판단이 필요하다 |
| 10 | frame-010 | WP-EMPTY-PICK | Pick · 처음 | `common.jsx:169` · `common.js:440` · 원본 140 | `/pick` `app/(tabs)/pick/index.tsx:666`(Empty), 문구 `:93~95` | 구현 있음 | CTA 「추천 보기」는 정본 문구 그대로인데 v3.29 추천 삭제와 충돌할 수 있다 |
| 11 | frame-011 | WP-EMPTY-NOTE | 웨딩노트 · 처음 | `common.jsx:169` · `common.js:445` · 원본 140 | `/wedding` 탭별 부분 빈 상태만 있다(상담기록 업로드 카드 `wedding/index.tsx:821` 안) | 불명확 | 세 탭이 모두 비었을 때 「가장 먼저 할 것만 크게」 보여주는 통합 빈 화면이 없다. 문구 「예식일만 넣어두면…」 grep 0건 |
| 12 | frame-012 | WP-EMPTY-LNG | 라운지 · 처음 | `common.jsx:169` · `common.js:451` · 원본 140 | `/community` `app/(tabs)/community/index.tsx:633`(Empty), 후기 빈 상태 · 박람회 빈 상태 | 구현 있음 | 정본은 후기 · 박람회 두 섹션을 한 화면에 둔다. 구현은 탭별이다. 문구가 다르다(정본 「이 지역 첫 후기를 남겨보세요」 / 구현 「아직 후기가 없어요」) |
| 13 | frame-013 | WP-EMPTY-REC | 추천 · 조건 부족 | `common.jsx:169` · `common.js:457` · 원본 140 | — | **구현 없음** | 「조건을 조금만 더 알려주세요 / 지역 정하기」 상태가 없다. `(home)/recommendations.tsx`의 빈 상태는 「정보 수집 중」(조건 부족이 아니다). 화면 자체가 v3.29 추천 삭제와 충돌할 수 있어서 만들기 전에 판단이 필요하다 |
| 14 | frame-014 | WP-DONE-RPT | Pick 인증 완료 | `common.jsx:169` · `common.js:462` · 원본 140 | 비슷한 곳: `/capture/payment/register` 제출 완료 `app/(tabs)/capture/payment/register.tsx:173`, 반영 상태 `/capture/verify-status/[requestId]` | 불명확 | 정본은 「인증이 반영됐어요」(반영 결과 · 실 제보 건수 변화 · 다음 카드 · 후기 쓰기)이고, 구현 완료 화면은 「제보 접수됐어요」(접수 단계)다. 반영 완료 전용 화면은 없다. 문구 grep 0건 |
| 15 | frame-015 | WP-DONE-VEND | 상담 예약 완료 | `common.jsx:169` · `common.js:472` · 원본 140 | `/search/[vendorId]/consult-done` `app/(tabs)/search/[vendorId]/consult-done.tsx:40` | 불명확 | 구현은 pick WP-PICK-010(「연락을 기다려주세요」)을 따른다. 정본 WP-DONE-VEND는 확정 시각형(「9월 20일 오후 2시로 잡았어요」 · 웨딩노트 반영 항목)이다. 같은 화면을 정본 두 곳이 다르게 그린다 |
| 16 | frame-016 | WP-LOAD-001 | 업종 순회 로딩 | `common.jsx:276` · `common.js` · 원본 229 | `features/loading/delayed-loader.tsx:74` · `packages/ui/src/circle-loader.tsx` | 불명확 | 정본은 「원형 스피너를 쓰지 않아요 — 업종 아이콘 순회」인데 구현은 원형 로더다. 파일 주석이 `DESIGN_UNRESOLVED`(2026-09-15 대표 결정과 충돌, openQuestions 추가 제안)를 적고 있다. WP-LOAD-002 · 003은 기준 보드라서 프레임 목록에 없다 |
| 17 | frame-017 | WP-LOAD-004 | 목록 뼈대 | `common.jsx:384` · `common.js` · 원본 324 | `packages/ui/src/list-skeleton.tsx:26` | 구현 있음 | — |
| 18 | frame-018 | WP-LOAD-005 | 처리 중 · 단계 표시 | `common.jsx:414` · `common.js` · 원본 351 | `packages/ui/src/status-view.tsx:186`(RecommendingBody) · `packages/ui/src/step-list.tsx:22` | 구현 있음 | 정본 하단 버튼(`Ldock`)은 없다. 주석에 `DESIGN_UNRESOLVED`가 적혀 있다 |

## 7. 정본에 없는 앱 화면 후보

아래는 `apps/mobile/src/app` 사용자 라우트 가운데 위 80개 어디에도 대응시키지 못한 것이다. **CLAUDE.md 「정본에 없는 기능은 제거」의 검토 후보일 뿐 판정이 아니다.** 지우기 전에 공용 여부, 다른 화면군의 사용, 예외 규정을 먼저 확인한다. 「진입 0」은 `router.push` · `href` · `pathname` 문자열을 grep해서 앱 안 이동 참조를 찾지 못했다는 뜻이다(`depth-back-rules.ts` · `depth-header.tsx` 등록은 빼고 셌고, 알림 경로 표 `my/notifications.tsx`도 확인했다). 근사치이니 삭제 근거로 쓰기 전에 다시 확인한다.

### 7-1. 2026-09-25 삭제됨(Pick 인증 포함) — 52개 라우트 파일

**아래 52개 파일은 2026-09-25 대표 지시(「Pick인증 포함 다 삭제한다」)로 전부 지웠다**(브랜치 `claude/remove-noncanon-screens`). 이 주소로 들어오면 공용 `app/+not-found.tsx`(「찾을 수 없어요」 · 홈으로 돌아가기)가 뜬다. 표는 무엇이 있었는지 남기려고 둔다 — 되살리지 않는다.

| 라우트 | 파일 | 한 줄 설명 |
| --- | --- | --- |
| `/feed` | `app/(tabs)/(home)/feed.tsx` | 개인화 웨딩피드 목록(주석 WP-HOME-006). 라운지 웨딩정보 탭(WP-LNG-002)과 뜻이 겹친다 |
| `/progress` | `app/(tabs)/(home)/progress.tsx` | 준비 현황 전체(주석 WP-HOME-009). 진입 0(주석은 「MY > 함께 준비하기」에서 들어온다고 적는다) |
| `/recommendations` | `app/(tabs)/(home)/recommendations.tsx` | 추천 전체(주석 근거가 폐기된 `figma-export`다). `/pick?section=recommendations`가 이 파일의 `RecommendationsContent`를 다시 쓴다. v3.29 추천 삭제와 충돌할 수 있다 |
| `/capture/payment/consent` | `app/(tabs)/capture/payment/consent.tsx` | Pick 인증 수집 동의(최초 1회) |
| `/capture/payment/register` | `app/(tabs)/capture/payment/register.tsx` | Pick 인증 자료 선택 → 제출 완료(WP-RPT-002/007) |
| `/capture/camera` | `app/(tabs)/capture/camera.tsx` | 문서 촬영(Pick 인증 · 견적서 공용) |
| `/capture/quote/consent` | `app/(tabs)/capture/quote/consent.tsx` | 견적서 정리 동의 |
| `/capture/review` | `app/(tabs)/capture/review.tsx` | 촬영 문서 확인(장 단위로 다시 찍기 · 빼기) |
| `/capture/sample` | `app/(tabs)/capture/sample.tsx` | 견적 정리 결과 샘플 미리보기 |
| `/capture/analysis/[id]` | `app/(tabs)/capture/analysis/[id].tsx` | 분석 중(WP-RPT-003) |
| `/capture/result/[quoteId]` | `app/(tabs)/capture/result/[quoteId].tsx` | 분석 결과 · 확인 단계 · 가격 비교(WP-RPT-004) |
| `/capture/verify/[quoteId]` | `app/(tabs)/capture/verify/[quoteId].tsx` | 자료 확인 신청 |
| `/capture/verify-status/[requestId]` | `app/(tabs)/capture/verify-status/[requestId].tsx` | 인증 결과 5상태(WP-RPT-008). common WP-DONE-RPT와 뜻이 일부 겹친다 |
| `/my/biz` | `app/(tabs)/my/biz/index.tsx` | 업체 관계자 메뉴 |
| `/my/biz/claim` | `app/(tabs)/my/biz/claim.tsx` | 소속 확인 요청(WP-BIZ-002) |
| `/my/biz/data` | `app/(tabs)/my/biz/data.tsx` | 업체 자료 제공(WP-BIZ-003) |
| `/my/biz/benefit` | `app/(tabs)/my/biz/benefit.tsx` | 업체 혜택 등록(WP-BIZ-004) |
| `/my/faq/[faqKey]` | `app/(tabs)/my/faq/[faqKey].tsx` | FAQ 답변 상세(WP-FAQ-003). 정본 FAQ(WP-MY-013)는 펼침형 목록이다 |
| `/my/notifications` | `app/(tabs)/my/notifications.tsx` | 알림 목록 |
| `/my/privacy` | `app/(tabs)/my/privacy.tsx` | 개인정보처리방침 요약 + 전문 링크. 진입 0 |
| `/my/rebuttals` | `app/(tabs)/my/rebuttals/index.tsx` | 내가 낸 업체 반론 |
| `/my/rebuttals/[reviewId]` | `app/(tabs)/my/rebuttals/[reviewId].tsx` | 업체 반론 등록 · 수정 |
| `/my/referral` | `app/(tabs)/my/referral.tsx` | 친구 초대(WP-EVT-003) |
| `/my/rewards` | `app/(tabs)/my/rewards/index.tsx` | 혜택 모아보기(WP-EVT-001). 홈 혜택 안내 시트(WP-SHT-017) CTA가 가는 곳 |
| `/my/rewards/fund` | `app/(tabs)/my/rewards/fund.tsx` | 월간 웨딩지원금(WP-EVT-005) |
| `/my/rewards/history` | `app/(tabs)/my/rewards/history.tsx` | 참여 · 지급 내역(WP-EVT-007) |
| `/my/rewards/missions` | `app/(tabs)/my/rewards/missions.tsx` | 미션 4개(WP-EVT-002) |
| `/my/rewards/npay` | `app/(tabs)/my/rewards/npay.tsx` | Npay 리워드 수령(WP-EVT-006) |
| `/my/rewards/promotion` | `app/(tabs)/my/rewards/promotion.tsx` | 홍보 인증(WP-EVT-004) |
| `/my/scraps` | `app/(tabs)/my/scraps.tsx` | 스크랩 목록. 진입 0 |
| `/my/vendor-claims` | `app/(tabs)/my/vendor-claims/index.tsx` | 내가 낸 업체 관계자 인증 |
| `/my/vendor-claims/[vendorId]` | `app/(tabs)/my/vendor-claims/[vendorId].tsx` | 업체 관계자 인증 신청 |
| `/pick/[category]` | `app/(tabs)/pick/[category].tsx` | 업종별 Pick 목록. 파일이 「다른 화면군이 같이 쓰는 라우트라 단독 대조로 지우지 않는다」고 적는다 |
| ~~`/pick/confirm`~~ | ~~`app/(tabs)/pick/confirm.tsx`~~ | 2026-09-25 삭제(대표 결정 안 A) — 최종 결정 확인 시트(WP-SHT-005)를 지우고 Pick 카드 «상담 예약»이 결정 없이 Pick 후보에게 바로 열린다 |
| `/search/[vendorId]/reviews` | `app/(tabs)/search/[vendorId]/reviews.tsx` | 업체 후기 전체 목록(신고 · 반론 진입) |
| `/search/[vendorId]/review/[reviewId]` | `app/(tabs)/search/[vendorId]/review/[reviewId].tsx` | 후기 상세(Figma `ReviewDetailPage` 근거) |
| `/search/[vendorId]/edit-review` | `app/(tabs)/search/[vendorId]/edit-review.tsx` | 후기 수정 시트(후기 목록 위) |
| `/search/expo` | `app/(tabs)/search/expo/index.tsx` | 박람회 목록(주석 WP-EXPO-001). 진입 0이고 라운지 박람회 탭(WP-LNG-003)과 겹친다 |
| `/search/wedding-info` | `app/(tabs)/search/wedding-info/index.tsx` | 웨딩 정보 목록(주석 WP-EXPO-003). 진입 0이고 WP-LNG-002와 겹친다 |
| `/search/wedding-info/[infoId]` | `app/(tabs)/search/wedding-info/[infoId]/index.tsx` | 웨딩 정보 상세(주석 WP-EXPO-004). 위 목록에서만 들어오고 WP-LNG-004와 겹친다 |
| `/wedding/[id]` | `app/(tabs)/wedding/[id]/index.tsx` | 견적 묶음 상세(A-12) |
| `/wedding/[id]/candidates` | `app/(tabs)/wedding/[id]/candidates.tsx` | 내 웨딩 후보 업체 목록. 진입 0 |
| `/wedding/[id]/complete` | `app/(tabs)/wedding/[id]/complete.tsx` | 예식 완료(WP-OUR-013). 본문은 `features/wedding/complete-view.tsx`이고 웨딩일정 탭도 쓴다 |
| `/wedding/[id]/conflict` | `app/(tabs)/wedding/[id]/conflict.tsx` | 공동 편집 충돌(WP-CPL-004) |
| `/wedding/[id]/events/[eventId]` | `app/(tabs)/wedding/[id]/events/[eventId].tsx` | 일정 상세(WP-OUR-005) |
| `/wedding/[id]/expenses/[expenseId]` | `app/(tabs)/wedding/[id]/expenses/[expenseId].tsx` | 지출 상세(WP-OUR-010) |
| `/wedding/[id]/notes` | `app/(tabs)/wedding/[id]/notes.tsx` | 메모(WP-OUR-011). 진입 0 |
| `/wedding/[id]/quotes` | `app/(tabs)/wedding/[id]/quotes.tsx` | 견적 · 계약서 읽은 결과 목록 |
| `/wedding/[id]/tasks` | `app/(tabs)/wedding/[id]/tasks.tsx` | 웨딩 스케줄(기본 14개 항목) |
| `/wedding/[id]/timeline` | `app/(tabs)/wedding/[id]/timeline.tsx` | 준비 타임라인(WP-OUR-012) |
| `/wedding/[id]/verify` | `app/(tabs)/wedding/[id]/verify.tsx` | 확인 단계 안내 |
| `/wedding/[id]/visit-notes` | `app/(tabs)/wedding/[id]/visit-notes.tsx` | 방문노트. 진입 0. CLAUDE.md는 이 파일을 「상담 녹음 → 자동 정리」의 기반으로 적고 있어서 삭제 대상으로 보기 전에 확인한다 |

### 7-2. CLAUDE.md가 이미 예외로 정한 것(외부 앱 연결, 삭제 검토 대상 아님)

| 라우트 | 파일 | 한 줄 설명 |
| --- | --- | --- |
| `/wedding/[id]/map` | `app/(tabs)/wedding/[id]/map.tsx` · `map.web.tsx`(플랫폼별 변형) | Pick 업체 지도 → 카카오맵 외부 연결. 진입 0 |
| `/search/expo/[expoId]/calendar` | `app/(tabs)/search/expo/[expoId]/calendar.tsx` | 박람회 달력 넣기(.ics) 선택 시트 |

### 7-3. 리다이렉트 · 별칭용(화면을 따로 그리지 않음)

| 라우트 | 파일 | 한 줄 설명 |
| --- | --- | --- |
| ~~`/capture`~~ | ~~`app/(tabs)/capture/index.tsx`~~ | 2026-09-25 삭제(보내던 곳이 삭제됨) |
| ~~`/my/membership`~~ | ~~`app/(tabs)/my/membership.tsx`~~ | 2026-09-25 삭제(보내던 곳이 삭제됨) |
| ~~`/search/[vendorId]/price-report`~~ | ~~`app/(tabs)/search/[vendorId]/price-report.tsx`~~ | 2026-09-25 삭제(보내던 곳이 삭제됨) |
| `/search/[vendorId]/booking` | `app/(tabs)/search/[vendorId]/booking.tsx` | `consult`를 그대로 다시 내보낸다(WP-PICK-009 별칭) |
| `/community/review/write` | `app/(tabs)/community/review/write.tsx` | 라운지 후기 URL로 보낸다 |
| `/community/feed/[id]` | `app/(tabs)/community/feed/[id].tsx` | `(home)/feed/[id]`를 다시 내보낸다. WP-LNG-004로 대응시켰다 |

### 7-4. 공용 · 레이아웃 · 관리자(대조 범위 밖)

- 레이아웃 · 문서 틀: `app/_layout.tsx` · `app/+html.tsx` · `app/(tabs)/_layout.tsx` · 각 폴더 `_layout.tsx`(login · (home) · community · my · pick · search · wedding — capture는 2026-09-25 폴더째 삭제) · `app/+not-found.tsx`(2026-09-25 신설 공용 「찾을 수 없어요」).
- 관리자: `app/admin/` 라우트 37개(admins · ads-gate · ads · ai-usage · audit-log · automation · biz-queue · briefing · campaigns · data-pipeline · decisions · email-matching · expos · faq · home · images · index · inquiries · kill-switch · login · marketing · objections · og-card · pii-reviews · policy-engine · price-stats · queue · rebuttal · report · revenue · rollback · stats · terms · user-detail · users · vendors · wedding-feed) + 보조 `_api.ts` · `_session.ts` · `_ui.tsx`. 관리자 정본은 `docs/design/html/`이라서 이 표의 대상이 아니다.

## 8. 코드 주석의 옛 WP-ID · 옛 근거(정본과 뜻이 다른 것)

화면 대조와는 따로, grep하다가 걸린 것들이다. 다음 세션이 주석을 근거로 잘못 읽지 않도록 적어 둔다.

| 위치 | 주석 | 정본(React_Native)에서 그 ID의 뜻 |
| --- | --- | --- |
| `app/(tabs)/my/withdrawal.tsx` 머리말 | 「회원탈퇴 · WP-MY-008」 | WP-MY-008 = 문의하기. 회원탈퇴는 WP-MY-012 |
| `app/(tabs)/my/wedding-settings.tsx` 머리말 | 「취향 다시 고르기(WP-MY-004)」 | WP-MY-004 = Pick 인증내역. 스타일 다시 고르기는 WP-MY-014 |
| `app/(tabs)/wedding/partner.tsx` 머리말 · 연결됨 분기 | 「WP-MY-014(연결관리)」 | WP-MY-014 = 스타일 다시 고르기. 연결관리는 WP-MY-005 |
| `app/(tabs)/search/index.tsx:103 · :364 · :574` | 「자동완성 · WP-SRCH-002」 | WP-SRCH-002 = 필터 시트. 자동완성은 WP-SRCH-004 |
| `features/search/sort-sheet.tsx` 머리말 | 「WP-SRCH-006」 | 정본에 없다(정렬은 WP-SRCH-003) |
| `features/auth/auth-back-button.tsx:4 · :7` | 「이메일 로그인 화면들(WP-AUTH-002~007)」 · 「비밀번호 찾기(WP-AUTH-006/007)」 | WP-AUTH-002~007 = 초기 설정 5단계 + 완료 |

- `apps/mobile/src` · `packages/ui/src`에서 **34개 파일**(시험 파일 제외)이 2026-09-24에 삭제된 `docs/design/html/대메뉴_*.dc.html` · `공통_다이얼로그 빈상태 로더.dc.html`을 정본으로 적고 있다. 이제 앱 정본은 `docs/design/React_Native/`다.
- 없는 파일 `docs/design/screen-inventory.md`를 근거로 적는 주석이 있다(예: `community/index.tsx`).

## 9. 요약

| 화면군 | frame 수 | 구현 있음 | 구현 없음 | 불명확 |
| --- | ---: | ---: | ---: | ---: |
| home | 15 | 15 | 0 | 0 |
| search | 11 | 10 | 1 | 0 |
| pick | 5 | 5 | 0 | 0 |
| note | 9 | 8 | 0 | 1 |
| my | 22 | 20 | 0 | 2 |
| common | 18 | 12 | 1 | 5 |
| **합계** | **80** | **70** | **2** | **8** |

- 구현 없음(2): search WP-VEND-007 제보 금액 상세 · common WP-EMPTY-REC 추천 · 조건 부족.
- 불명확(8): note WP-NOTE-007 · my WP-MY-015 · WP-MY-015b · common WP-EMPTY-HOME · WP-EMPTY-NOTE · WP-DONE-RPT · WP-DONE-VEND · WP-LOAD-001.
- 정본에 없는 앱 화면 후보: 52개(7-1). 따로 둔 것은 예외 2개(7-2), 리다이렉트 · 별칭 6개(7-3), 관리자 37개(7-4).
- WP-ID 중복: 화면군 사이의 중복은 없다. common 안에서 WP-DLG-B(frame-002 · 008)와 WP-DLG-F(frame-006 · 007)가 두 번씩 쓰인다. 뜻으로는 pick WP-PICK-010과 common WP-DONE-VEND가 같은 「상담 예약 완료」를 서로 다르게 그린다.
- WP-ID가 없는 label: common frame-001~015(`runtime-check.json` label이 모두 「1 · 다이얼로그」). 이 표에서는 `common.js`의 `screens` · `escreens` 배열 순서로 ID를 정했다.
