# 웹뷰 시안 ↔ 구현 전수 대조 (2026-09-10)

대상은 `weddingpick-app-web`(`apps/mobile/src/`)이다. `apps/mobile/src/app/admin/`과
`apps/web/`은 다른 세션 소관이라 제외했다.

> **2026-09-10 재확인** — `origin/main`(`af698bd`, PR #167)을 이 브랜치에 머지한 뒤
> 다시 봤다. 그 PR이 손댄 사용자 화면 파일은 둘뿐이다 —
> `features/auth/providers.ts`(카카오 `age_range` scope 추가)와
> `features/navigation/depth-back-rules.ts`(관리자 라우트 2개 등록). 색·타이포
> 토큰화는 `color.status.*`의 `boxBg`·`border`와 `color.adminChrome` 추가로
> 관리자 전용이었다. **아래 대조 결과는 그대로 유효하다.** `features/verification/levels.ts`의
> L0~L4 5색도 여전히 `spec/tokens.json`에 없다.
>
> 덧붙여 `providers.ts`의 새 주석은 「age_range가 선택 동의로 내려가면 판정이
> 체크박스 하나로 떨어진다」고 적었는데, 그 체크박스는 핸드오프 v3.24가 삭제한
> 것이라 §7에서 걷어냈다. 지금 나이 판정은 서버 한 곳뿐이다 — 그 전제를 다시
> 확인해야 한다.

## 대조 방법

1. `docs/design-handoff/current/html/*.dc.html`의 **마크업과 `<script type="text/x-dc">`
   데이터 블록을 같이 읽어** 실제 픽셀값·문구를 뽑았다. 스타일이 `{{ name }}` 참조라
   마크업만 보면 값이 안 보인다.
2. 각 값을 `spec/tokens.json` · `spec/strings.ko.json` · `spec/glossary.json`과 맞춰보고,
   그다음 코드와 맞췄다.
3. 기존 감사 메모(`docs/padding-audit-2026-09-09.md`)는 근거로 쓰지 않았다. 값은 전부
   시안 원본에서 다시 읽었다.

**우선순위** — CHANGELOG 맨 위 > SPEC.md > screens.json > 개별 아트보드 > 코드.
CHANGELOG가 폐기했다고 적은 화면은 아트보드에 그림이 남아 있어도 폐기로 봤다.

### 시안 중 폐기·대체된 것

| 파일 | 상태 | 근거 |
|---|---|---|
| `03-home.dc.html` (홈 C-1 6상태) | **폐기** — `03-home-states.dc.html`이 대체 | CHANGELOG.md:240-249 |
| `03b-home-options.dc.html` (홈 5안) | 참고용 | PROJECT_RULES.md 「진행 상태」 |
| `01a-login.dc.html` (만 14세 체크박스 포함) | 체크박스 부분 폐기 — `27-login.dc.html`이 최신 | CHANGELOG.md:96-100 |
| `11-report-review.dc.html` 중 확인·업체확인·묶기·가격제보 | **폐기** | CHANGELOG.md:71-83 (v3.24) |
| `17-sheets-states.dc.html` WP-SHT-001 · 원형 스피너 | **폐기** | CHANGELOG.md:65-67, :266-285 |

## 대조한 범위

| 항목 | 수 |
|---|---|
| 아트보드 파일 | 30 (사용자 화면 시안 전부. `00-ia` · `21-device` · `21-store` · `22-flow`는 화면이 아니라 다이어그램·자산 보드라 제외) |
| screens.json 등록 앱 화면(보류·폐기 제외) | 159 |
| 그중 코드에 화면번호 표기가 있는 것 | 102 |
| 코드에 화면번호 표기가 없는 것 | 57 |
| 라우트 파일(관리자 제외) | 111 |
| 이 문서에 적은 어긋난 항목 | **154** (높음 45 · 중간 90 · 낮음 19) |
| 오탐·의도적 편차로 판정해 제외한 것 | 12 |
| 결정이 필요한 것(md끼리 충돌) | 2 |

### 통과한 전역 게이트

- `node lint-copy.js spec/strings.ko.json apps packages` — 금지어 0건.
  `AI` · `데이터` · `탐색` · `관심업체` · `확인된 제보/정보/금액` · `실제로 낸 금액` ·
  `실제 결제` · `네이버페이 포인트` · `우리 준비` · `오늘의 Pick` · 애매 표현 66개
  전부 glossary에 등재돼 있고 사용자 노출 문구에 잔존 0.
- `npm run typecheck --workspace @weddingpick/mobile` · `npm test --workspace @weddingpick/mobile` ·
  `npm run lint` — 대조 시작 시점(main `bf69c03`) 전부 통과.
- Root 5탭 라벨·순서(홈 · 검색 · Pick · 웨딩일정 · MY)는 `spec/screens.json` `navigation.root`와 일치.
- 좌우 Gutter 24는 전 화면이 지키고 있다.
- Pick Mark SVG는 `spec/tokens.json` `symbol`과 같다.

---

## 1. 심각도 높음 (45)

문구·구조·정책이 어긋나 사용자가 다른 화면을 보는 것.

### 1.1 폐기된 화면이 코드에 살아 있다

| 화면ID | 항목 | 시안/정책 값 | 코드 값 | 
|---|---|---|---|
| WP-RPT-010 | 가격 제보 화면 존속 | 증빙 없는 수동 가격 입력 폐기 · 모든 금액은 사진 한 장에서만 (CHANGELOG.md:75) | `search/[vendorId]/price-report.tsx:1-239` |
| WP-RPT-010 | 제보 홈 진입점 잔존 | 위와 같음 | `capture/index.tsx:21-22, 69` (2번째 카드 «가격 제보 · 증빙 없이 들은 금액만 알려주는 방법이에요») |
| WP-RPT-010 | 진입점 오라벨 | Pick 인증 = 사진 흐름 (CHANGELOG.md:81) | 「Pick 인증」 버튼이 `/price-report`로 감 — `search/[vendorId]/index.tsx:525-528` |
| WP-RPT-004 | 자동 입력 결과 확인 화면 존속 | 확인 화면 폐기 (CHANGELOG.md:77) | `capture/payment/register.tsx:382-501` |
| WP-RPT-004 | 같은 화면 두 번째 구현 | 위와 같음 | `capture/result/[quoteId].tsx:44-61, 73` |
| WP-RPT-004 | 확인 필드 자유 편집 | 재입력 경로는 다시 찍기/올리기뿐 (CHANGELOG.md:83) | 4필드 편집 + «이 값이 맞아요» — `features/quotes/quote-result-view.tsx:225-236` |
| WP-RPT-006 | 분할 결제 묶기 존속 | 분할 묶기 폐기 (CHANGELOG.md:77) | `features/quotes/quote-result-view.tsx:356-374` |
| WP-RPT-002 | 사진 없이 직접 입력 경로 | 모든 금액은 사진 한 장에서만 (CHANGELOG.md:75) | ghost «사진 없이 직접 적기» — `capture/payment/register.tsx:363` |
| WP-APP-003 | 「보류 · 실 앱개발 제외」 화면을 구현 | `01-onboarding.dc.html:75` · screens.json `excluded` | `app/onboarding.tsx:26-101` |

### 1.2 별점을 쓰고 있다 (SPEC §6.1 「별점을 쓰지 않습니다」)

| 화면ID | 항목 | 시안 값 | 코드 값 |
|---|---|---|---|
| WP-REV-002 | 전체 만족도 별점 | 별점 없음 (SPEC.md:427 · screens.json WP-REV-002) | `RatingPicker` — `search/[vendorId]/write-review.tsx:209-210` |
| WP-REV-002 | 항목별 별점 | 위와 같음 | `RatingPicker` — `write-review.tsx:250-261` |
| WP-REV-002 | 3축 3지선다 없음 | 진행 / 결과물 / 추가 비용 안내 × 3지선다 (SPEC.md:429-435) | 서버 `checklist`/`aspects`로 대체 — `write-review.tsx:217-263` |
| WP-REV-001 | 후기 카드 별점 | 별점 없음 (SPEC.md:427) | `RatingStars` — `search/[vendorId]/reviews.tsx:207` |
| WP-REV-006 | 평점 숫자 노출 | **「평점 숫자를 만들지 않습니다」** (SPEC.md:439) | `usageScore.average.toFixed(1)` — `reviews.tsx:131` |
| WP-VEND-001 | 업체 상세 ⑧ 경험 섹션 별점 | 막대 그래프만 (09-core-loop.dc.html:158-171) | `RatingStars` — `search/[vendorId]/index.tsx:642` |

### 1.3 로그인 · 온보딩

| 화면ID | 항목 | 시안 값 | 코드 값 |
|---|---|---|---|
| WP-AUTH-001 | 만 14세 체크박스 잔존 | 카카오가 출생연도를 필수 동의로 넘겨 서버가 판정 · **별도 체크박스를 두지 않음** (27-login.dc.html:309 · CHANGELOG.md:96-100) | `AgeConsentCheckbox` — `app/login/index.tsx:83, 191, 319-355` |
| WP-AUTH-001 | 미체크 시 카카오 CTA 흐림 | 흐림 상태 없음 (27-login.dc.html:66, 449) | `opacity: ageChecked ? 1 : 0.4` — `login/index.tsx:194` |
| WP-AUTH-009 | 진입 조건 | 카카오 출생연도가 만 14세 미달일 때 (27-login.dc.html:309) | 체크박스 미체크 + 카카오 탭 — `login/index.tsx:207` |
| WP-APP-020 5/5 | 질문 제목 | 「남은 준비는 / 어떤 분위기가 좋으세요?」 (20-onboarding-v2.dc.html:460) | `['어떤 스타일을', '좋아하세요?']` — `features/onboarding/flow.ts:79` |
| WP-APP-020 5/5 | CTA 단위 | **«N장 선택»** (SPEC.md:948 · 20-onboarding-v2.dc.html:469) | `${count}개 선택` — `features/onboarding/flow.ts:107` |
| WP-APP-022 | 완료 화면 제목 | 「이제 필요한 것만 / 보여드릴게요」 (20-onboarding-v2.dc.html:472 · SPEC.md:986) | `['가입이', '완료됐어요']` — `flow.ts:90` |
| WP-APP-003 | 장수 | 3장 (01-onboarding.dc.html:90) | 5장 — `features/onboarding/steps.ts:23-72` |
| WP-APP-003 | 1장 제목·본문 | 「실제로 얼마 냈는지 / 먼저 보세요」 (01-onboarding.dc.html:91-92) | 「같은 업체도 / 금액은 달라요」 — `steps.ts:25-26` |

### 1.4 업체 상세 · Pick · 비교

| 화면ID | 항목 | 시안 값 | 코드 값 |
|---|---|---|---|
| WP-VEND-001 | ② 상단 배지 문구 | «영업중» (09-core-loop.dc.html:67) | «공공기관 확인» — `search/[vendorId]/index.tsx:380` |
| WP-VEND-001 | ⑥ 업체 안내 「포함 항목」 4행 없음 | 촬영 시간 · 원본 · 보정 · 앨범 (09-core-loop.dc.html:120-129, 479-484) | 「시작 금액 / 출처」 2행뿐 — `index.tsx:572-591` |
| WP-VEND-001 | ⑥ 「별도로 확인할 비용」 블록 누락 | 소제목 + 3행 (09-core-loop.dc.html:130-141, 485-489) | 없음 — `index.tsx:564-594` |
| WP-VEND-003 | 제보 금액 상세 화면 없음 | 금액 32/43 + 조건 막대 3 + 시기별 변화 (09b-vendor-sub.dc.html:296-316) | 라우트 없음 |
| WP-VEND-004 | 업체 안내 화면 없음 | 포함 5 · 별도 4 · 진행 방식 3 (09b-vendor-sub.dc.html:317-343) | 라우트 없음 |
| WP-VEND-005 | 공식 정보 화면 없음 | 3그룹 + CTA «정보 오류 제보» (09b-vendor-sub.dc.html:344-367) | 라우트 없음 |
| WP-PICK-001 | 둘 다 고른 곳 행에 금액·건수 없음 | 금액 16/700 + «실 제보 21건» (07-pick.dc.html:92, 418-419) | 「지역 · 업종」 — `pick/index.tsx:478-481` (api-contract `candidates.ts`가 건수·금액을 안 실어 보냄 — 계약 확장이 선행돼야 함) |
| WP-PICK-002 | 카드에 금액·제보 건수 없음 | 금액 + «실 제보 12건 · 최근 12개월» (09-core-loop.dc.html:320-321, 523) | 지역 한 줄 — `pick/[category].tsx:381-384` |
| WP-PICK-004 | 배우자 공동 결정 화면 없음 | 의견 카드 3 + dock (07-pick.dc.html:148-189) | 라우트 없음 |
| WP-PICK-007 | Hero 총액 줄 누락 | «2,140만원을 정했어요» 26/35 (07-pick.dc.html:240) | Hero 없이 목록 — `pick/history.tsx:128-140` |
| WP-HOME-004 | 금액 한 줄을 손으로 조립 | 금액 한 줄은 **어느 화면이든** `priceLine(paidPrice, guidePrice)` (CLAUDE.md:26-27) | `{manwon(low)}~{manwon(high)}` — `(home)/top3.tsx:181` (`Top3Item.guidePrice`가 있는데도 안 씀 — `api-contract/src/recommendations.ts:43`) |

### 1.5 검색 · 제보 상태 · FAQ · 약관 · 업체 문의

| 화면ID | 항목 | 시안 값 | 코드 값 |
|---|---|---|---|
| WP-SRCH-002 | 업체 행이 결과로 감 | **업체명 행은 결과를 건너뛰고 상세로 직행** (06-search.dc.html:105 · SPEC.md:1314) | `selectQuery(vendor.name)` → 결과 — `search/autocomplete.tsx:190` |
| WP-SRCH-005 | 하단 CTA 문구 | «{n}곳 보기» (`spec/strings.ko.json` `search.filter.apply`) | «필터 적용» — `search/filter.tsx:272` |
| WP-SRCH-005 | 필터 그룹 구성 | 지역 · 예산 · 촬영일 · 조건 (06-search.dc.html:436-451) | 지역 · 카테고리 · 가격구간 · 정렬 — `filter.tsx:188, 208, 224, 254` |
| WP-RPT-008 | 처리 상태 4종 → 3종 | 반영됨 · 확인 중 · 보완 필요 · 반려 (`strings.ko.json` `report.state.*`) | 반영됨 · 반영 전 · 후기 — `my/reports.tsx:29-31, 102-104` |
| WP-FAQ-001 | FAQ 홈 구조 | 검색창 + 카테고리 8칸 그리드 + 「많이 찾는 질문」 (16-faq.dc.html:53-61, 335-344) | 평면 리스트 «자주 묻는 것» — `my/guide.tsx:25, 31-40` |
| WP-LEGAL-002 | 보유기간 표 10행 | 16b-legal.dc.html:124-136, 334-345 | 요약 3항목 — `my/privacy.tsx:38-62` |
| WP-LEGAL-002 | 「맡겨서 처리하는 일」 수탁사 6행 | 16b-legal.dc.html:139-151, 346-353 | 없음 — `my/privacy.tsx:38-62` |
| WP-BIZ-005 | 사진 업로드 그리드 + 상태 배지 | 18-biz.dc.html:100-110, 400-404 | 텍스트 폼만 — `my/biz/data.tsx:106-120` |
| WP-BIZ-005 | 권리 확인 체크 3항목 | 18-biz.dc.html:113-124, 405-409 | 없음 — `my/biz/data.tsx:80-138` |
| WP-BIZ-006 | 종료일 필수 | 기간 없으면 접수 불가 (18-biz.dc.html:165-170, 412) | «제공 기간 (선택)» — `my/biz/benefit.tsx:163, 39-42` |
| WP-MY-008 | 완료 화면 CTA | «앱 닫기» (`strings.ko.json` `withdraw.closeApp` · 13b-withdrawal.dc.html:203) | «확인» — `my/withdrawal.tsx:44, 94` |

---

## 2. 심각도 중간 (90)

값·라벨·구성이 어긋나지만 흐름은 같은 것. 표는 화면 그룹별로 묶었다.

### 2.1 홈 · 검색

| 화면ID | 항목 | 시안 값 | 코드 값 |
|---|---|---|---|
| WP-HOME-001 | 웨딩 정보 섹션 제목 | «두 분을 위한 웨딩 정보» (03-home.dc.html:357 · `strings.ko.json`) | 배우자 미연결 시 «웨딩 정보» — `(tabs)/index.tsx:378` |
| WP-HOME-001 | 다음 준비 메타 | «스튜디오와 같은 팀으로 하면 편해요» (03-home-states.dc.html:389) | «후보 N곳» / «시작 전» — `features/home/state.ts:453` |
| WP-HOME-001 | 조건 칩 높이·패딩 하드코딩 | 30 / 0 11 (03-home-states.dc.html:249) | `height: 30, paddingHorizontal: 11` — `features/home/recommendation.tsx:208-209` |
| WP-HOME-007 | 홈 편집 진입 위치 | 홈 우상단 (screens.json:1088) | 맨 아래 텍스트 링크 — `(tabs)/index.tsx:239-246` |
| WP-HOME-004 | 화면 제목 크기 | Hero 26 (screens.json:1045) | `t4`(20) — `(home)/top3.tsx:68` |
| WP-HOME-004 | 서브카피 추가 | 레이아웃에 없음 (screens.json:1044-1049) | «Pick 인증 기반 추천이에요…» — `top3.tsx:70` |
| WP-HOME-004 | 순위 행 구조 | 순위 22 + 썸네일 52 4행 (screens.json:1047) | 이미지 168 카드 + 배지 28 — `top3.tsx:130-150, 216-218` |
| WP-HOME-004 | 금액 라벨 용어 | 제보 금액 (screens.json:1047) | «Pick 가격대» — `top3.tsx:172` |
| WP-HOME-006 | 업종 칩 4 누락 | screens.json:1076 | 칩 없음 — `(home)/feed.tsx:50-66` |
| WP-SRCH-001 | 업종 카드 메타 «실 제보 N건» 누락 | 06-search.dc.html:68, 388 | 업종명 한 줄 — `search/index.tsx:531-535` |
| WP-SRCH-001 | 업종 카드 radius | 10 (06-search.dc.html:355) | `Radius.input`(6) — `search/index.tsx:1238` |
| WP-SRCH-002 | 업체 그룹 제목 | «업체 · 바로 상세로» (SPEC.md:1314) | «업체» — `autocomplete.tsx:184` |
| WP-SRCH-002 | «이 말로 검색» 꼬리 | 그룹 제목 + «결과 14곳» (06-search.dc.html:413-414) | «{q} (으)로 검색» 한 줄 — `autocomplete.tsx:237-241` |
| WP-SRCH-002 | 상단 바 | 활성 검색창 + «취소» (06-search.dc.html:109-112) | `BackBar` — `autocomplete.tsx:172` |
| WP-SRCH-004 | 기본 정렬 라벨 | «추천순» (`strings.ko.json` `search.sort.recommended`) | «실 제보 많은 순» — `search/index.tsx:943` · `features/search/sort-sheet.tsx:26` |
| WP-SRCH-005 | 화면 형태 | 바텀시트 + 그래버 + dock (06-search.dc.html:184-205) | 전체 화면 + `BackBar` — `filter.tsx:153` |
| WP-SRCH-005 | «실 제보가 있는 곳만» 토글 누락 | 06-search.dc.html:197-200 · `strings.ko.json` `search.filter.onlyVerified` | 없음 — `filter.tsx:150-270` |
| WP-SRCH-005 | 예산 입력 방식 | 구간 칩 4개 (06-search.dc.html:441-444) | 만원 숫자 입력 2칸 — `filter.tsx:224-247` |
| WP-SRCH-008 | «비슷한 곳» 섹션 누락 | 06-search.dc.html:256-273 · `strings.ko.json` `search.empty.similar` | 없음 — `search/index.tsx:844-880` |
| WP-SRCH-008 | 조건 풀기 문구 | «예산 조건을 풀면 6곳이 나와요» / «예산 조건 풀기» (06-search.dc.html:253-255) | 지역·업종 기준 — `search/index.tsx:840, 855` |

### 2.2 업체 상세 · 비교 · Pick

| 화면ID | 항목 | 시안 값 | 코드 값 |
|---|---|---|---|
| WP-VEND-001 | ② 핵심 조건 한 줄 | «강남 · 인물 중심 · 5월 주말 예약 가능» (09-core-loop.dc.html:69) | 「업종 · 지역」만 — `index.tsx:382-384` |
| WP-VEND-001 | ④ Pick 인증 안내 문구 | «Pick 인증하면 조건이 비슷한 사례 4건을 볼 수 있어요» (09-core-loop.dc.html:105) | «…마치시면 …함께 보실 수 있어요» — `packages/domain/src/disclosure.ts:241-242` |
| WP-VEND-001 | ⑩ 공식정보 행 구성 | 주소 · 연락처 · 영업상태 · 마지막 확인 (09-core-loop.dc.html:496-501) | 지역 · 마지막 확인 · 출처 · 지도 — `index.tsx:736-776` |
| WP-VEND-001 | 섹션 제목 하드코딩 | `strings.ko.json` `vendor.section.*` | `'공식정보'`(`index.tsx:734`) · `'추천 이유'`(`index.tsx:395`) |
| WP-VEND-001 | 문구 하드코딩 | `vendor.section.benefit` · `vendor.official.lastCheck` · `vendor.reportError` | `index.tsx:87, 90, 91` |
| WP-VEND-002 | 진입 화면 형태 | 다크 전체보기 뷰어가 첫 화면 (09b-vendor-sub.dc.html:53-73) | 밝은 그리드 목록, 뷰어는 모달 — `images.tsx:74-113` |
| WP-VEND-002 | 「업체 제공 8 / 제보 사진 4」 탭 없음 | 09b-vendor-sub.dc.html:59-61, 289 | 탭 없음 — `images.tsx:37-41, 92-101` |
| WP-VEND-002 | 상단 nav 구성 | X 닫기 + «3 / 12» (09b-vendor-sub.dc.html:55-56) | «돌아가기» + «사진 N장» — `images.tsx:78-86` |
| WP-CMP-002 | 「현재 혜택」 블록 누락 | 09-core-loop.dc.html:515 · `strings.ko.json` `compare.row.benefit` | 없음 — `search/compare.tsx:151-189` |
| WP-CMP-002 | 시안에 없는 블록 2개 | 8블록 모두 상품 속성 (09-core-loop.dc.html:507-516) | 「업종 · 지역」 · 「업체 정보 출처」 — `compare.tsx:175-188` |
| WP-CMP-002 | 웨딩픽 요약 앞 표시 | A·B·C 키 칩 22 (09-core-loop.dc.html:276, 517-521) | 코랄 점 불릿 — `compare.tsx:254` |
| WP-CMP-002 | 문구 하드코딩 | `compare.summary` · `compare.row.verified` · `compare.row.median` | `compare.tsx:58-64` |
| WP-PICK-001 | 헤더 우측 구성 | 아바타 2개 겹침 (07-pick.dc.html:60, 381-382) | 아바타 1 + «준호님과 함께» — `pick/index.tsx:195-206` |
| WP-PICK-001 | 문구 하드코딩 | `pick.bothPickedSection` · `pick.heroProgress` | `pick/index.tsx:227, 426` |
| WP-PICK-002 | dock CTA 높이 | 56 (09-core-loop.dc.html:335 · `tokens.json` `size.ctaPick`) | `Layout.controlXLarge`(52) — `pick/[category].tsx:494` |
| WP-PICK-006 | 좌상단 뒤로가기 추가 | 뒤로 없음 (07-pick.dc.html:194-197) | `<BackBar />` — `pick/done.tsx:167` (같은 파일 38행 주석과도 모순) |
| WP-PICK-006 | 반영 항목 3건 → 2건 | 웨딩일정 · 일정 · 지출 (07-pick.dc.html:446-450) | 웨딩일정 · 지출 — `done.tsx:149-162` |
| WP-PICK-007 | 「결정 취소」 액션 누락 | 07-pick.dc.html:253-256 | 없음 — `history.tsx:157-181` |
| WP-PICK-007 | 섹션 제목 | «아직 안 정한 것» (07-pick.dc.html:262) | «후보» — `history.tsx:29, 189` |
| WP-PICK-007 | 결정 카드 썸네일 52 · 금액 누락 | 07-pick.dc.html:245-250, 452-453 | 이름 + 날짜만 — `history.tsx:167-181` |

### 2.3 제보 · 후기

| 화면ID | 항목 | 시안 값 | 코드 값 |
|---|---|---|---|
| WP-RPT-001 | 카드 개수 | 3장 (11-report-review.dc.html:516-520) | 4장 — 「견적서 정리」 추가 — `capture/index.tsx:75-84` |
| WP-RPT-001 | 제보 내역 배지 | 반영됨 · 확인 중 (11-report-review.dc.html:522-524) | 반영됨 · 확인 필요 · 반영 전 — `capture/index.tsx:34-37` |
| WP-RPT-001 | 문구 하드코딩 | `strings.ko.json` `report.kind.*` | `capture/index.tsx:15-30` |
| WP-RPT-002 | dock CTA | primary «1장으로 계속하기» (11-report-review.dc.html:131) | primary 없음 — `capture/payment/register.tsx:363` |
| WP-RPT-002 | 문구 하드코딩 | `report.upload.*` | `capture/payment/register.tsx:53-80` |
| WP-RPT-008 | 「보완 필요」 행동 버튼 | screens.json WP-RPT-008 · 11-report-review.dc.html:556 «날짜 입력하기» | 「후기 지우기」뿐 — `my/reports.tsx:123-132` |
| WP-RPT-008 | 「반영된 곳」 항목 | 금액 구간 · 웨딩일정 지출 · 내 상태 (12b-remaining.dc.html:343-347) | 자료 확인 단계 · 다른 사람의 비교 — `capture/verify-status/[requestId].tsx:76-84` |
| WP-RPT-004 | 용어 | 실 제보 · 기준금액 (CLAUDE.md v3.18) | «실제 계약과 비교» · «실제 계약 기준금액» · «인증된 계약 N건» — `features/quotes/quote-result-view.tsx:271, 279, 284` |
| WP-REV-002 | 본문 500자 상한 | SPEC.md:437 · 카운터 «47 / 500» (11-report-review.dc.html:377) | 상한 없음 — `write-review.tsx:280-296` |
| WP-REV-002 | 한 줄 제목 필드 | 시안에 없음 (11-report-review.dc.html:354-385) | 필수 입력 — `write-review.tsx:265-275` |
| WP-REV-002 | 사진 첨부 72×72 | SPEC.md:437 · 11-report-review.dc.html:380-385 | 없음 |
| WP-REV-001 | 필터 칩 3 | 전체 · Pick 인증만 · 사진 있는 후기 (11-report-review.dc.html:570-574) | 없음 — `reviews.tsx:182-197` |
| WP-REV-001 | «도움돼요 N» | 11-report-review.dc.html:423 · `strings.ko.json` `review.helpful` | 없음 — `reviews.tsx:230-303` |
| WP-REV-005 | 후기 신고 전용 화면 | 인용 박스 · 사유 5 · danger CTA (12-closing.dc.html:137-172) | 화면 없음, 목록 안 칩 — `reviews.tsx:247-259` |
| WP-REV-006 | 항목별 막대 | SPEC.md:439 · 11-report-review.dc.html:580-585 | 텍스트 한 줄씩 — `reviews.tsx:135-139` |
| WP-REV-006 | «많이 나온 말» 칩 | 11-report-review.dc.html:587-592 | 없음 — `reviews.tsx:125-172` |
| WP-REV-006 | 용어 | 실 제보 (CLAUDE.md v3.18) | «확인된 후기 {n}건» — `reviews.tsx:133` |
| WP-REV-003 | 후기 고치기 축 | 답변 3축 (12b-remaining.dc.html:389-393) | 별점 하나 + 라벨이 WP-REV-006 화면명 — `edit-review.tsx:100-101` |

### 2.4 웨딩일정 · MY · 업체 문의

| 화면ID | 항목 | 시안 값 | 코드 값 |
|---|---|---|---|
| WP-MY-005 | 어두운 화면 꼬리값 | «자동» + chevron (13-my-sub.dc.html:370) | «기기 설정», chevron 없음 — `my/display.tsx:33, 140` |
| WP-MY-005 | 글자 크기 꼬리값 | «보통» + chevron, 메타 없음 (13-my-sub.dc.html:371) | «기기 설정» + 메타 — `display.tsx:30, 141` |
| WP-MY-005 | 애니메이션 줄이기 컨트롤 | 토글 52×32 (13-my-sub.dc.html:372, 180) | 값 표시 행 — `display.tsx:142` |
| WP-MY-007 | 알림 수신 항목 | 서비스 · 마케팅 · 야간 수신 3행 (13-my-sub.dc.html:326-328) | 서비스 · 가격 변동 2행 — `my/account.tsx:20-23` |
| WP-MY-006 | 공유 섹션 라벨 | «같이 보는 것» / «각자 보는 것» (13-my-sub.dc.html:298, 304) | «같이 보고 있어요» / «각자 남아요» — `wedding/partner.tsx:246, 41` |
| WP-MY-006 | 항목별 공유 토글 | 토글 (13-my-sub.dc.html:299-306) | 읽기 전용 배지 — `partner.tsx:248, 253` |
| WP-MY-006 | 변경 내역 보기 행 | 13-my-sub.dc.html:309 | 없음 — `partner.tsx:246-255` |
| WP-OUR-005 | 알림 3행 | 하루 전 · 두 시간 전 · 캘린더 (08-schedule-sub.dc.html:310-312) | 하루 전 1행 — `wedding/[id]/events/[eventId].tsx:261-269` |
| WP-OUR-006 | «두 시간 전에 알려주기» | 08-schedule-sub.dc.html:333 | 없음 — `events/new.tsx:123-136` |
| WP-OUR-008 | 남은 업종 예상 그룹 | 3행 (08-schedule-sub.dc.html:351-355) | 없음 — `wedding/[id]/expenses/index.tsx:73` |
| WP-BIZ-001 | 히어로 | «어떤 일로 / 오셨나요?» (08c-schedule-my.dc.html:312) | «업체 관계자시면 / 여기서 접수해요» — `my/biz/index.tsx:8` |
| WP-BIZ-001 | 문의 유형 5행 구성 | 08c-schedule-my.dc.html:572-577 | 다른 5행 — `my/biz/index.tsx:24-28` |
| WP-BIZ-001 | 광고 독립성 섹션 제목 | «광고는 추천에 섞이지 않아요» (08c-schedule-my.dc.html:331) | «광고 독립성» — `my/biz/index.tsx:11` |
| WP-BIZ-001 | «광고» 라벨 고지 한 줄 | 08c-schedule-my.dc.html:343 | 없음 — `my/biz/index.tsx:13-14` |
| WP-BIZ-006 | 입력 항목 구성 | 혜택 내용 · 시작일 · 종료일 · 조건 (18-biz.dc.html:410-414) | 다른 5항목 — `my/biz/benefit.tsx:117-190` |
| WP-BIZ-006 | 「사용자에게 이렇게 보여요」 미리보기 | 18-biz.dc.html:157-161 | 없음 |
| WP-BIZ-007 | 광고 독립성 가능/불가 대조 | 18-biz.dc.html:267-268, 437-448 | 4행 요약뿐 — `my/biz/index.tsx:32` |
| WP-LEGAL-001 | 약관 본문 인앱 표시 | 조문 목록 + 원문 (16b-legal.dc.html:78-107) | 외부 웹으로만 이동 — `my/policies.tsx:37` |
| WP-MY-010 | 서비스 정보 메뉴 | 6행 (16b-legal.dc.html:308-315) | 3행 — `packages/domain/src/policies.ts:24-47` |
| WP-CPL-004 | dock 두 버전 선택 | «내 것으로» / «준호님 것으로» (14-couple.dc.html:205) | «그만두기» / «저장된 내용 보기» — `wedding/[id]/conflict.tsx:98-99` |
| WP-CPL-005 | 작성자 아바타 32 · 「되돌리기」 | 14-couple.dc.html:223, 228 | 둘 다 없음 — `wedding/[id]/changelog.tsx:106-115` |
| WP-EVT-002 | 완료 미션 «8월 21일 완료» | 15-events.dc.html:241-242 | 날짜 없음 — `my/rewards/missions.tsx:76` |
| WP-ST-001 | 세션 만료 시트 | «다시 로그인해주세요» · «카카오로 계속하기» (17-sheets-states.dc.html:248) | «로그인하면 저장돼요» · «3초 만에 시작» — `components/states/guest-gate-sheet.tsx:16, 35, 43` |
| WP-SHT-002 | 시트 CTA 라벨 | «카카오로 계속하기» (`strings.ko.json`) | «카카오로 시작하기» — `features/auth/login-sheet.tsx:93` |
| WP-SHT-002 | 시트 보조 버튼 | «나중에 할게요» (`strings.ko.json`) | «나중에 하기» — `login-sheet.tsx:112` |
| — | 로그인 실패 시트 제목 | «잠시 후 다시 해볼까요?» (`strings.ko.json`) | «로그인을 마치지 못했어요.\n다시 시도해주세요.» — `features/auth/login-failure-sheet.tsx:34` |
| WP-APP-020 1/5~4/5 | 제목·설명 4쌍 | 20-onboarding-v2.dc.html:434, 440, 447, 453 (= CHANGELOG.md:464-472) | `features/onboarding/flow.ts:75-78, 94-97` |
| WP-APP-003 | «1 / 3» 단계 라벨 누락 | 01-onboarding.dc.html:90 | 없음 — `app/onboarding.tsx:59-89` |
| WP-APP-003 | 진행 점 위치 | 하단 CTA 위 dock 안 (01-onboarding.dc.html:100-103) | 스크롤 위 상단 — `onboarding.tsx:45-57` |
| WP-APP-003 | 활성 점 너비 · 간격 | 20×6 · gap 6 (01-onboarding.dc.html:100-101) | 22 · `Spacing.one`(4) — `onboarding.tsx:52, 109` |
| WP-APP-003 | 하단 CTA 높이 미지정 | 01-onboarding.dc.html:105 | `size` 미지정 → auto — `onboarding.tsx:92-96` |
| WP-APP-003 | «건너뛰기»가 회색 버튼 | 텍스트 16/22/700 #868B94 (01-onboarding.dc.html:86) | `ActionButton` secondary — `onboarding.tsx:41` |

---

## 3. 심각도 낮음 (19줄 · 대표만)

토큰 위생과 미세한 값 차이. **같은 성격(간격·색 하드코딩)이 수십 곳에서 반복돼
대표 줄로 묶었다** — 하드코딩 색 56번처럼 묶은 것은 줄 하나로 셌다.

| 화면ID | 항목 | 시안 값 | 코드 값 |
|---|---|---|---|
| 공통 | 간격 하드코딩 | `spacing` 토큰만 (CLAUDE.md:5-6) | `gap: 7`(`features/home/board.tsx:84`) · `gap: 3`(`board.tsx:94`) · `paddingTop: 14`(`(tabs)/index.tsx:618`) · `height: 180`(`recommendation.tsx:216`) |
| 공통 | 색 하드코딩 (토큰에 있는 값) | `spec/tokens.json` `color.*` | `apps/mobile/src`에서 hex를 직접 적은 곳 56번 중 50번 — `#4D5159`(9) · `#868B94`(8) · `#EAEBEE`(7) · `#212124`(6) 등 |
| 공통 | 색 하드코딩 (토큰에 **없는** 값) | 시안·spec 어디에도 없음 | 나머지 6번 — `features/verification/levels.ts:9-13` L0~L4 5색 · `capture/sample.tsx:59` `#7A4DD1`. 시안·`spec/tokens.json` 어디에도 없다(서비스정책서 출처) |
| 공통 | 스킨 id 표기 | `darkgray` (`tokens.json` `color.skin.options`) | `darkGray` — `packages/ui/src/theme.ts:161` |
| WP-AUTH-001/008 | 문구 하드코딩 | `strings.ko.json` `onboarding.auth.login.*` | `login/index.tsx:36-40, 43, 127-129, 179, 200, 213, 293` |
| WP-SRCH-001 | 많이 본 곳 행 gap | 12 (06-search.dc.html:87) | `Layout.sectionHeadGap`(14) — `search/index.tsx:1278` |
| WP-SRCH-002 | 행 제목 크기 | 18/24 700 (06-search.dc.html:122, 373) | `t6`(16) — `autocomplete.tsx:194` |
| WP-SRCH-005 | 시트 제목 · 초기화 · 그룹 제목 크기 | 24/32 · 16/700 #4D5159 · 16/22 700 (06-search.dc.html:186-190) | `t4`(20) · `t7`(14) 코랄 · `t5`(18) — `filter.tsx:155, 161, 188` |
| WP-VEND-006 | 체크 마크 크기 | 24 (`tokens.json` `size.checkbox`) | `Layout.iconRow`(20) — `fix-report.tsx:137` |
| WP-VEND-006 | note 본문 | «보통 하루 안에 확인하고…» (09b-vendor-sub.dc.html:385) | «사람이 직접 확인하고…» — `fix-report.tsx:24` |
| WP-MY-005 | 스와치 선택 링 | 3px (13-my-sub.dc.html:190) | `Border.focus`(2) — `display.tsx:189` |
| WP-CPL-004 | 상대 변경 카드 테두리 | 1.5px coral (14-couple.dc.html:377) | `borderWidth: 1` — `conflict.tsx:111` |
| WP-CPL-006 | 섹션 제목 | «각자 남는 것» (14-couple.dc.html:267) | «각자에게 남아요» — `partner.tsx:221` |
| WP-FAQ-003 | nav · 배지 · 피드백 제목 · 버튼 라벨 · 관련 질문 제목 | 16-faq.dc.html:75, 86, 103, 105, 111 | `my/faq/[faqKey].tsx:48, 49, 73, 80, 58` |
| WP-EVT-001/003/005/007 | 문구·구성 | 15-events.dc.html:228-230, 252, 254-260, 282, 318 | `my/rewards/index.tsx:35` · `my/referral.tsx:45, 57, 138` · `my/rewards/fund.tsx:52` · `my/rewards/history.tsx:25` |
| WP-RPT-003 | 분석 단계 라벨 | «글자 읽는 중» 등 (11-report-review.dc.html:531-534) | «글자 읽기» 등 — `capture/analysis/[id].tsx:88-91` |
| WP-PICK-001 | 진행바 우측 라벨 | «1/4» (07-pick.dc.html:65) | «1/4 결정» — `pick/index.tsx:232` |
| WP-PICK-001 | 비교 CTA 라벨 | «웨딩홀 3곳 비교» (07-pick.dc.html:99) | «…비교하기» — `pick/index.tsx:435` |
| WP-PICK-002 | 중복 화면 | 한 화면 | `pick/[category].tsx`와 `pick/category.tsx` 둘 다 WP-PICK-002를 주장 — `pick/category.tsx:28-30` |

---

## 4. 오탐·의도적 편차로 판정해 제외한 것 (12)

시안과 다르지만 **더 뒤의 근거가 있어 코드가 맞다.** 고치지 않는다.

| 자리 | 코드 값 | 코드가 맞는 근거 |
|---|---|---|
| WP-MY-008 탈퇴 히어로 | «웨딩픽을 탈퇴할까요?» | `packages/domain/src/withdrawal.ts:20-22` — 카카오 심사가 「탈퇴 경로를 확인할 수 없다」고 반려한 자리. 시안 문구는 화면이 무엇인지 스스로 말하지 않음 |
| WP-MY-008 분리 안내 | «나를 알아볼 수 없도록 분리해…» | `withdrawal.ts:45` — 통합정책 v3.15 §J-3 문구 |
| WP-BIZ-007 광고·제휴 화면 없음 | 진입 행 삭제 | CLAUDE.md:79 「광고 실운영 전환은 사용자 오더 대기」 |
| WP-MY-001 업체·플래너 본문에서 «광고 제휴» 제거 | 위와 같음 | 위와 같음 |
| WP-HOME-001 준비 현황 섹션 제목 | «준비 현황» | 시안 `03-home-states.dc.html:81`의 «웨딩일정»이 오기 — 같은 파일 432행 규칙 카드 · CHANGELOG v3.20 · screens.json:952가 모두 «준비 현황» |
| WP-SHT 공통 그래버 폭 | 40 | `spec/tokens.json` `component.sheet.grabber`가 40. 시안(36)과 토큰이 다르고 토큰이 원본 |
| WP-APP-020 5/5 스타일 4종·최대 2개·토스트 | 4종 | CHANGELOG.md:38-56 (v3.26)이 시안 6칸보다 뒤 |
| WP-RPT-005 업체 확인 화면 없음 | 없음 | CHANGELOG.md:73 폐기 — 시안·`strings.ko.json` `report.vendorPick.*`가 낡음 |
| WP-ST-012 원형 스피너 없음 | 아이콘 순회 로더 | CHANGELOG.md:266-285 `motion.spinner` 삭제 |
| WP-AUTH-009 안내 둘째 줄 | «연령대는 삭제했어요.» | `app/login/age-required.tsx:30-31` — 나이 판정을 연령대로 확정한 2026-09-10 사용자 지시. 출생 연도는 아예 받지 않으므로 시안 문구가 사실과 다르다 |
| WP-HOME-004 금액 라벨 | «Pick 가격대» | `packages/domain/src/copy-rules.ts:67` `PREFERRED_PHRASES`에 등재된 권장어다. 용어 위반이 아니다 |
| WP-PICK-001 둘 다 고른 곳 금액·건수 | 지역 · 업종 | `api-contract/src/candidates.ts`가 건수·금액을 안 실어 보낸다. 화면만으로는 못 고치고 계약 확장이 선행돼야 한다 — §1에 남겨두되 «화면 버그»는 아니다 |

`docs/padding-audit-2026-09-09.md`가 「101건은 오탐」이라 적어둔 항목들은 이번에 근거로
쓰지 않았다. 위 12건은 이번 대조에서 새로 판정한 것이다.

---

## 5. md끼리 어긋나 결정이 필요한 것 (2)

### 5-1. 글자 크기 15px · 17px

시안 다수가 **폰 화면 안에서** 15px과 17px을 쓴다. 그런데 `spec/tokens.json`
`typography.scale`은 8단(32 · 26 · 24 · 20 · 18 · 16 · 14 · 13)이고
`$forbidden`이 「이 8단계 밖의 크기를 만들지 않는다」고 못박는다.
`packages/ui/src/typography.ts:5`도 「15 · 17 · 19 · 22px은 금지」다.

15px을 쓰는 자리 (아트보드 원본):

| 자리 | 시안 |
|---|---|
| 홈 D-day | `03-home-states.dc.html` `ddayChip` 15/20 700 — screens.json WP-HOME-001 «D-day 15 coral», **SPEC.md:1509가 2026-09-09 사용자 오더로 이 값을 확정** |
| 홈 준비 현황 값 | `03-home-states.dc.html` `valStyle` 15/20 700 |
| 홈 2·3위 카드 업체명 | `03-home-states.dc.html` `subName` 15/20 700 |
| 시트·상태 본문 | `17-sheets-states.dc.html` `shBody` · `stBody` 15/22 |
| 온보딩 답 줄 | `20-onboarding-v2.dc.html` `answeredK` · `pickedDday` 15/22 |
| 로그인 «비밀번호를 잊었어요» | `27-login.dc.html` `forgotLine` 15/22 |
| 탈퇴 · 약관 행 | `13b-withdrawal.dc.html` `t15g` · `16b-legal.dc.html` `artNo` 15/21·15/24 |

17px: `20-onboarding-v2` `selVal`/`pickerLead`, `27-login` `fieldText`/`fieldDots`,
`12b-remaining` `t17clamp`, `03-home-states` `sheetGhost`.

코드는 전부 16(t6) 또는 14(t7)로 내려서 쓰고 있고 그 사실을 주석에 적어뒀다
(`(tabs)/index.tsx:413`, `features/home/board.tsx:36`).

**두 갈래다.** ⓐ `spec/tokens.json`에 15/20·17/24 단을 추가하고 시안이 부르는 자리에
전부 적용한다(운영 규칙 「시안에 있는 값이 spec에 없으면 spec에 먼저 넣고 쓴다」를 따르는 쪽).
ⓑ 8단 금지 규칙을 지키고 시안 쪽을 8단으로 고친다.
CHANGELOG에 15·17px을 다룬 항목이 없어 CHANGELOG 최상단 규칙으로는 갈리지 않는다.
다만 D-day 하나만은 SPEC.md:1509가 사용자 오더로 15를 확정해 두었다.

### 5-2. Primary CTA 높이 52 vs 56

`02-design-system.dc.html:598` 「Primary CTA 높이 56」인데 `spec/tokens.json`
`size.ctaPrimary`는 52이고, 대부분의 아트보드 CTA도 `height:52px`다.
`size.ctaPick` 56은 업체 상세·비교 전용으로 이미 갈라 두었다.
코드는 52를 쓴다. 컴포넌트 시트 쪽이 낡은 것으로 보이나 확정이 필요하다.

---

## 6. 추가로 확인된 것 — 폐기된 지연 로그인 시트

`WP-SHT-001`(다른 방법으로 시작)과 구 지연 로그인 시트는 CHANGELOG.md:65-67에서
둘 다 폐기 등록됐고, 비회원 이용도 v3.12에서 폐기돼 로그아웃이면 WP-AUTH-001로
보내게 돼 있다. 그런데 `features/auth/login-sheet.tsx`가 그대로 있고 세 화면이
쓰고 있다 — `search/index.tsx:1062` · `search/[vendorId]/index.tsx:805` ·
`search/compare.tsx:295`. 시트 라벨도 `strings.ko.json`과 다르다
(«카카오로 시작하기» / «나중에 하기» ↔ «카카오로 계속하기» / «나중에 할게요»).
시트를 걷어낼지 라벨만 맞출지는 비회원 진입 정책을 어디까지 되돌릴지에 달려 있어
이번에 손대지 않았다. **심각도 높음.**

---

## 7. 이번에 고친 것 (5)

시안·CHANGELOG가 한 가지 값만 가리키고, 서버 계약이나 제품 결정을 건드리지 않는
것만 골랐다.

| 화면ID | 고친 것 | 근거 |
|---|---|---|
| WP-HOME-004 | 금액 한 줄을 `priceLine(paidPrice, guidePrice)`로 만든다 | CLAUDE.md:26-27. `manwon(low)~manwon(high)` 직접 조립이라 정보 0층(«업체 안내 150만원~»)이 빠지고 있었다. `Top3Item.guidePrice`는 이미 계약에 있다 |
| WP-AUTH-001 | 만 14세 체크박스 · 카카오 CTA 흐림 처리 삭제 | CHANGELOG.md:96-100 · 27-login.dc.html:309. 나이는 카카오 출생연도로 서버가 판정하고, 미달이면 `use-sign-in.ts`가 WP-AUTH-009으로 보낸다 — 그 경로는 그대로 살아 있다 |
| WP-APP-020 5/5 | CTA 단위 «N개 선택» → «N장 선택» | SPEC.md:948 · 20-onboarding-v2.dc.html:469. `spec/strings.ko.json` `onboarding.taste.cta`도 «{n}곳 선택» → «{n}장 선택»으로 맞췄다 — 세는 것이 이미지 장수라 «곳»(업체를 세는 말)이 맞지 않는다 |
| WP-REV-006 | «확인된 후기 N건» → «N명이 답했어요» | screens.json WP-REV-006 · CLAUDE.md v3.18(«확인된 ~» 폐기). 업체 상세(`index.tsx:93`)가 이미 쓰던 말과 통일 |
| WP-PICK-002 | dock CTA 높이 52 → `Layout.ctaPick`(56) | 09-core-loop.dc.html 10c «2곳 비교하기» height 56 · `tokens.json` `size.$note`가 이 버튼을 이름으로 지목 |

검증 — `npm run typecheck --workspace @weddingpick/mobile` · `npm test`(전 워크스페이스
1287건) · `npm run lint` · `node lint-copy.js spec/strings.ko.json apps packages` 전부 통과.
lint 경고 2건은 대조 시작 시점에도 있던 것이다.

## 8. 아직 안 고친 것

§1~§3의 나머지 149건이다. 큰 덩어리는 넷이다.

1. **폐기 화면 4종 철거**(WP-RPT-004 · 006 · 010, 지연 로그인 시트) — 서버 라우트와
   `api-contract`가 함께 걸려 있어 화면만 지우면 죽은 계약이 남는다.
2. **별점 걷어내기**(WP-REV-001 · 002 · 006 · WP-VEND-001) — 작성 화면의
   `RatingPicker`가 서버로 점수를 보내고, 집계가 그 점수의 평균을 돌려준다.
   3축 3지선다로 바꾸려면 앱·계약·서버를 같이 옮겨야 한다.
3. **없는 화면 만들기**(WP-VEND-003 · 004 · 005 · WP-PICK-004 · WP-REV-005) — 대조가
   아니라 신규 구현이다.
4. **§5의 결정 두 가지**(15/17px 단 · Primary CTA 52 vs 56) — md끼리 어긋나 있어
   사용자 결정이 필요하다.
