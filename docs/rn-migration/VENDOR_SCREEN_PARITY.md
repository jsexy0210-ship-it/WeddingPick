# 업체 화면 대조표 — Figma 신규(`VendorFlows.tsx`) ↔ `(tabs)/search/[vendorId]/*`

Figma 신규 디자인 저장소(`weddingpick_figma`)의 `src/app/components/VendorFlows.tsx`(824줄)가
그리는 화면과, 이 저장소의 담당 일곱 화면을 1:1로 맞춘 표다.

- 기준은 **최신 `main`**이다(CLAUDE.md 「모든 규칙은 최신 main을 기준으로 한다」).
- 담당 범위: `apps/mobile/src/app/(tabs)/search/[vendorId]/*.tsx` 일곱 개.
- 건드리지 않는 것: `spec/tokens.json` · `packages/ui/src/theme.ts` · `design-tokens.ts`(토큰 세션) ·
  `packages/ui/src/*.tsx` 공용 컴포넌트(컴포넌트 세션) · `FlowScreens.tsx`의 `ContractVerify`(뒤에 적음 —
  `claude/rn-nav-auth` 담당).
- 값은 토큰에서만 가져온다. 하드코딩 금지 — 지금 담당 화면 7개 전부 하드코딩 0건 확인됨.

## 자료 신뢰도 — Figma 저장소

| 등급 | 위치 | 쓰는 법 |
| --- | --- | --- |
| A 픽셀정확 | `src/imports/` 3개 | 담당 화면 관련 자료 없음 |
| B 낮음 | `src/app/components/VendorFlows.tsx` | Figma Make가 LLM으로 만든 근사치. **수치를 시안 값으로 믿지 않는다.** 의도만 참고 |

담당 화면은 **전부 B등급**이다. 정본은 `docs/design-handoff/root/`의
`WP-VEND-업체 상세 하위.dc.html`·`WP-RPT-제보·후기.dc.html`(대표님 직접 원본, 2026-09-11)이고,
Figma는 그 아래 참고 자료다.

## 대조표

판정: **그대로 둔다**(이미 정본·구조 일치) · **확인 필요**(B등급 수치라 토큰화 보류) ·
**만들지 않음**(시안·코드 둘 다 근거 없음, MASTER 결정 완료) · **범위 밖**(다른 세션 담당)

| # | Figma(`VendorFlows.tsx`) | 우리(`[vendorId]/*.tsx`) | 근거 등급 | 차이 | 판정 |
| --- | --- | --- | --- | --- | --- |
| 1 | `VendorDetailPage`(169-517) 전체 — 탭 4개(소개·패키지·후기·정보) | `index.tsx` — WP-VEND-001 섹션 순서 고정형(히어로→identity→추천이유→실 제보→업체안내→위치→경험/후기→공식정보→action→Pick인증 권유) | B | 구조가 다르다: Figma는 탭형, 우리는 스크롤 단일형(root 시안 WP-VEND-001 그대로). CTA도 Figma는 Pick+상담예약 2개 동시 노출(화면당 Primary 1개 위반), 우리는 Pick 1개 | **그대로 둔다** — root 시안·CLAUDE.md(Primary CTA 1개)가 이미 이긴다 |
| 2 | 218 `{STUDIO.category}` 배지, 232 `가격 제보 {N}건`, 289 `VERIFIED PRICE RANGE`, 295 `실제 가격 제보와 업체 공식 견적을 함께 반영` | `index.tsx` `priceLine()` 결과(`실 제보 N건 · 최근 12개월 · 기준금액 168만원` 형) | B | 용어 불일치 — `가격 제보`·`VERIFIED PRICE RANGE`·`실제 가격 제보`는 CLAUDE.md 금지/미채택 표현. 정본은 `실 제보`·`제보 금액`·`priceLine()` | **그대로 둔다** — CLAUDE.md 용어가 이긴다(문구는 안 옮김) |
| 3 | 261-273 포트폴리오 가로 스크롤 갤러리, 496-514 대표이미지 위 사진탭 없음 | `images.tsx` — WP-VEND-002 전체화면 뷰어(다크 배경 고정·페이지 인디케이터·출처+확인일 캡션·썸네일 스트립) | B | Figma는 "업체 제공/사용자 제공" 탭 구분이 없고 그냥 갤러리. 우리는 root 시안(WP-VEND-002)의 탭 요구를 알고도 **의도적으로 뺐음** — `vendor_images` 스키마에 업로드 주체를 가르는 축이 없어서(코드 주석에 근거 명시) | **그대로 둔다** — 없는 데이터축으로 탭을 지어낼 수 없음. 데이터축 생기면 재검토 |
| 4 | 316-340 FAQ 아코디언(`STUDIO.faq`) | 없음 | B | Figma에만 있는 섹션 | **만들지 않음** — `spec/screens.json`·root 시안 WP-VEND-001에 FAQ 섹션 자체가 없음. 서버 스키마(`vendorDetailSchema`)에도 FAQ 필드 없음 |
| 5 | 344-397 「패키지」 탭 — 상품 카드 3종 + 「이 패키지로 상담 예약」 버튼(384) | `index.tsx` 「업체 안내」 섹션(`vendor.prices.products` 카드 — 상품명·중앙값·확인된 계약 건수·P25~P75) | B | Figma는 마케팅형 패키지 카드(인기 배지·촬영시간/컷/보정본 스펙 그리드), 우리는 통계형 카드. 우리 쪽이 root 시안(WP-VEND-004 「업체 안내」) 그대로 | **그대로 둔다** |
| 6 | 399-468 「후기」 탭 — 별점 요약 + 리스트, 438 `가격 제보` 인증배지, 450 개별 후기 클릭 시 `/vendor/:id/reviews/:reviewId`로 이동 | `index.tsx` 미리보기 3건 + 「후기 보기」→`reviews.tsx`(WP-REV-001/006 전체 목록·이용점수·업체 반론 인라인) | B | Figma는 후기 한 건을 별도 상세 페이지로 열지만(#7 참고), 우리는 목록 화면 안에서 전부 보여줌(카드 펼침형) | **그대로 둔다** — 아래 #7 판정과 동일 근거 |
| 7 | `ReviewDetailPage`(689-824) — 좋아요(740-746)·댓글 스레드(783-821)·별점 4축 분해(753-769)·718 `계약 인증` 배지 | 없음(대응 라우트 없음) | B | (a) `/vendor/:id/reviews/:reviewId` 자체가 시안(`spec/screens.json` 23개)에도, root 시안에도 없음. (b) 좋아요·댓글은 `Review` 도메인 타입(`packages/api-contract`)에 필드가 없어 API 계약 변경 없이는 구현 불가(금지 사항). (c) 718행 `계약 인증` 배지는 **오용어** — 정본은 `Pick 인증`(root `WP-RPT-제보·후기.dc.html` #12d L294·348에서 실제로 `Pick 인증` 사용 확인) | **만들지 않음** — MASTER 결정 완료(시안·코드 둘 다 근거 없음). 후기는 `reviews.tsx` 카드 안에 이미 다 나옴(업체 반론 인라인 포함) |
| 8 | `ConsultPage`(533-669, 671에서 `BookingPage`로 별칭 export — `/booking`과 `/consult`가 같은 컴포넌트라는 근거) | 없음(대응 라우트 없음) | B | 담당자 카드(558-574)·날짜 선택(576-603)·시간 선택(605-626)·메모(628-637)·「커플 캘린더 자동 공유」(639-648) 전부 Figma에만 있음 | **만들지 않음** — MASTER 결정 완료. Figma 신규 IA에도, `spec/screens.json` 23개에도, root 시안에도 상담 예약 화면 자체가 없다. 서버에도 상담원 배정·시간대·캘린더 공유 개념이 없어(도메인·API 스키마 grep 0건) 지어낼 근거가 없음. `write-review.tsx`·`edit-review.tsx`·`price-report.tsx`가 진입하는 CTA 중 「상담」으로 가는 것도 없어 잠글 자리도 없음(애초에 진입점이 없음) |
| 9 | `price-report.tsx`에 대응하는 Figma 화면 없음(FlowScreens.tsx의 `ContractVerify`가 근접하지만 다른 파일) | `price-report.tsx` — WP-RPT-010 폐기 후 `/capture/payment/consent`로 리다이렉트하는 스텁 | — | `ContractVerify`(영수증 사진 인식·업체 확인·계약 금액 추출)는 `FlowScreens.tsx` 소속이고 `capture/verify/*`·`capture/payment/*` 플로우에 대응 — **`claude/rn-nav-auth` 담당**(MASTER 확정, 2026-09-14) | **범위 밖** — 이 표에서는 대조만 남기고 손대지 않음 |
| 10 | `fix-report.tsx`에 대응하는 Figma 화면 없음 | `fix-report.tsx` — WP-VEND-006, root 시안(항목 라디오 5·올바른 정보·근거 링크·note·CTA)과 1:1 | — | Figma `VendorFlows.tsx`엔 정보 오류 제보 화면이 아예 없음. 우리 구현이 root 시안 그대로 | **그대로 둔다** |
| 11 | 후기 작성 화면 없음(Figma `VendorFlows.tsx` 전체에 write-review 대응 없음) | `write-review.tsx`·`edit-review.tsx` — root 시안 WP-REV-002(후기 쓰기: 축별 평가·자유 텍스트·사진 첨부) | — | Figma에 대응 화면 자체가 없어 비교 대상 없음. 하드코딩·금지어 grep 0건 확인 | **그대로 둔다** |

**그대로 둔다 7 · 만들지 않음 2 · 범위 밖 1 · (11행 중 값 이관 대상 0).**

## B등급 수치 — 토큰화 후보 없음

`VendorFlows.tsx`에서 나온 px·rem 수치(예: 히어로 `h-72`, 별점 `52px` 등)는 **하나도 토큰에 올리지
않았다.** 담당 화면 7개가 이미 root 시안(대표님 직접 원본, A급 취급)과 `spec/tokens.json` 기존 값으로
전부 맞춰져 있어, Figma의 B등급 근사치 수치를 끌어올 필요 자체가 없었다. 새로 필요한 값이 생기면
이 표에 「B등급 · 확인 필요」로 남기고 MASTER에 먼저 보고한다 — 지금은 그 줄이 없다.

## 요약

- 코드 변경은 0건이다. 담당 화면 7개가 이미 root 시안(정본)과 CLAUDE.md 용어 규칙을 그대로
  따르고 있고, Figma `VendorFlows.tsx`가 그리는 화면 중 우리와 실제로 갈라지는 자리는 전부
  **정본이 이미 이긴 자리**(탭 구조, 가격 용어, CTA 개수, FAQ, 상담 예약, 후기 상세)였다.
- `ContractVerify`(FlowScreens.tsx)는 `claude/rn-nav-auth` 담당이라 이 표에서 대조만 남기고
  구현 판단은 넘긴다.
- 색·서체는 `claude/rn-tokens`를 직접 머지해 받았다(충돌 없음, main 대비 8커밋 — 전부 토큰 세션
  소유, 담당 화면 파일 자체는 diff 0줄). `claude/rn-components`는 아직 `rn-tokens` 최신판 기준으로
  재정렬되지 않아 직접 머지 시 `theme.ts`·`tokens.json` 충돌이 나 보류 중이다.
