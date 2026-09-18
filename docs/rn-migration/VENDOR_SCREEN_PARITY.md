# 업체 화면 대조표 — Figma 신규(`VendorFlows.tsx`) ↔ `(tabs)/search/[vendorId]/*`

Figma 신규 디자인 저장소(`docs/design/figma-export`)의 `src/app/components/VendorFlows.tsx`(824줄)가
그리는 화면과, 이 저장소의 담당 일곱 화면을 1:1로 맞춘 표다.

- 기준은 **최신 `main`**이다(CLAUDE.md 「모든 규칙은 최신 main을 기준으로 한다」).
- 담당 범위: `apps/mobile/src/app/(tabs)/search/[vendorId]/*.tsx` 일곱 개.
- 건드리지 않는 것: `spec/tokens.json` · `packages/ui/src/theme.ts` · `design-tokens.ts`(토큰 세션) ·
  `packages/ui/src/*.tsx` 공용 컴포넌트(컴포넌트 세션) · `FlowScreens.tsx`의 `ContractVerify`(뒤에 적음 —
  `claude/rn-nav-auth` 담당).
- 값은 토큰에서만 가져온다. 하드코딩 금지 — 지금 담당 화면 7개 전부 하드코딩 0건 확인됨.

## 우선순위 — 어느 쪽이 이기나(2026-09-14 MASTER 확정)

「root가 정본이고 Figma는 그 아래 참고 자료다」는 더 이상 전체 규칙이 아니다. 대표님이
같은 날 나중에 「피그마 기준 전면 개편」을 지시했고, **대표님 지시끼리 부딪히면 늦은 것이
이긴다.** 실제 순서는 다음 4단이다.

```
①  대표님 직접 지시            늦은 지시가 이긴다
②  Figma가 그린 화면·구조      Figma가 그린 자리는 여기서 이긴다(레이아웃·탭 배치만 — 아래 §「가져오는 것」)
③  root 시안(36장)             Figma가 안 그린 화면·자리는 여전히 이 표의 정본
④  CLAUDE.md 용어·금지어·데이터 규칙   위 셋을 전부 뚫고 항상 이긴다
```

**가져오는 것 — 화면 구성.** 어떤 섹션이 몇 개 탭으로 나뉘는지, 탭이 몇 개인지.
**안 가져오는 것 — 값.** px 수치·색·서체·문구·데이터. 안의 내용은 우리 것 그대로다
(§「탭 배치 — 실제 반영」).

## 자료 신뢰도 — Figma 저장소

| 등급 | 위치 | 쓰는 법 |
| --- | --- | --- |
| A 픽셀정확 | `src/imports/` 3개 | 담당 화면 관련 자료 없음 |
| B 낮음 | `src/app/components/VendorFlows.tsx` | Figma Make가 LLM으로 만든 근사치. **수치를 시안 값으로 믿지 않는다.** 의도만 참고 |

담당 화면은 **전부 B등급**이다. 정본은 `docs/design/figma-export/`의
`WP-VEND-업체 상세 하위.dc.html`·`WP-RPT-제보·후기.dc.html`(대표님 직접 원본, 2026-09-11)이고,
Figma는 그 아래 참고 자료다.

## 교차검증 — `claude/rn-migration-plan`(PR #227)

1단계 설계 세션의 `docs/rn-migration/FIGMA_SCREEN_INVENTORY.md`·`FIGMA_DESIGN_SYSTEM.md`(같은 날
실측)와 줄 번호·별칭 관계를 대조했다. 일치:

- F13 업체 상세 = `VendorDetailPage`(169행) · F14 상담 신청 = `ConsultPage`(533행,
  `/vendor/:id/booking`은 671행 `export { ConsultPage as BookingPage }` 별칭 — 두 화면 아님) ·
  F15 후기 상세 = `ReviewDetailPage`(689행). 전부 이 표의 줄 번호와 같다.
- F18 계약 인증 = `FlowScreens.tsx`의 `ContractVerify`(124행) — `VendorFlows.tsx` 밖이라 이 표
  9번 행처럼 범위 밖으로 남긴다(`claude/rn-nav-auth`).
- 「Figma 시안에는 로딩·빈·오류 상태가 사실상 없다 — 프로토타입 성격일 뿐 없어도 된다는 뜻이
  아니다. 상태 정본은 `spec/screens.json`의 `stateSets`이고 기존 구현을 그대로 쓴다」(§4) — 이
  표의 화면들이 이미 가진 스켈레톤·에러뷰(`ErrorView`·`SkeletonView`·`ListSkeleton` 등)를 걷어내지
  않는 이유가 이것이다.
- 색·서체 결정 출처는 `FIGMA_DESIGN_SYSTEM.md` §0·§1·§2가 정리한 대로 `theme.css`(대표 확정
  `#E7898D`/`#ECA0A3`)와 「Pretendard 단일」 결정이지, `VendorFlows.tsx`의 B등급 px·색 수치가
  아니다. 담당 화면 7개는 그 px·색을 애초에 참조하지 않으므로(하드코딩 0건) 영향 없음.

**F13/F14/F15가 "Figma가 그린 화면 16개" 목록에 있다는 것과, 이 표의 "만들지 않음" 판정은
모순이 아니다.** #227은 Figma가 무엇을 그렸는지의 **인벤토리**이고, 무엇을 실제로 만들지는
root 정본·서버 스키마·MASTER 결정이 따로 정한다 — 아래 7·8행의 판정 근거는 Figma 유무가 아니라
root 시안(36장)·`spec/screens.json`(23개)·API 계약에 그 화면이 없다는 것이다.

## 대조표

판정: **그대로 둔다**(이미 정본·구조 일치) · **확인 필요**(B등급 수치라 토큰화 보류) ·
**만들지 않음**(시안·코드 둘 다 근거 없음, MASTER 결정 완료) · **범위 밖**(다른 세션 담당)

| # | Figma(`VendorFlows.tsx`) | 우리(`[vendorId]/*.tsx`) | 근거 등급 | 차이 | 판정 |
| --- | --- | --- | --- | --- | --- |
| 1 | `VendorDetailPage`(169-517) 전체 — 탭 4개(소개·패키지·후기·정보) | `index.tsx` — 탭 넷(소개·가격·후기·정보)으로 재구성함 | B(구조만) | Figma는 탭형, 기존 우리 화면은 스크롤 단일형이었다. CTA는 Figma가 Pick+상담예약 2개 동시 노출(화면당 Primary 1개 위반) | **피그마 탭 배치로 바꿨다**(§「우선순위」② — 대표님 늦은 지시가 이김). CTA는 Pick 1개만 유지 — 자세한 반영은 §「탭 배치 — 실제 반영」 |
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

**피그마 탭 배치 반영 1 · 그대로 둔다 6 · 만들지 않음 2 · 범위 밖 1 · (11행 중 값 이관 대상 0).**

## 탭 배치 — 실제 반영 (`index.tsx`)

`VendorDetailPage`의 탭 넷(소개·패키지·후기·정보) 배치를 가져오되, 안의 내용은 기존
섹션(WP-VEND-001 순서: 히어로→identity→추천이유→실 제보→업체안내→현재 혜택→경험→후기→
공식정보→Pick·비교)을 그대로 옮겼다. 라벨 「패키지」는 Figma 원문 그대로 두지 않고
**「가격」으로 바꿨다** — 그 탭 안 내용이 우리 스키마에서는 마케팅 패키지 카드가 아니라
통계형 실 제보·업체안내·현재혜택이라, 「패키지」라는 이름을 쓰면 없는 것을 있다고 말하게
된다. 이 이름 선택은 MASTER 확인 대상이다.

| 탭 | 담당 화면 섹션(WP-VEND-001 번호) | 비고 |
| --- | --- | --- |
| (탭 밖, 상단 고정) | ② identity(배지·업체명·핵심조건) | 탭 전환과 무관하게 항상 보임. Figma도 탭 위에 header+hero+identity를 두고 탭만 스크롤 대상으로 삼는다 |
| 소개 | ③ 추천 이유 | 첫 진입 탭(기본값) — 검색·TOP3에서 넘어온 추천 근거를 가장 먼저 보여준다 |
| 가격 | ④ 실 제보(금액 카드 + 조건별 행) · ⑥ 업체 안내(guidePrice) · ⑦ 현재 혜택 | 금액·업체 제공 정보·혜택을 한 탭에 묶었다 |
| 후기 | ⑧ 이용한 사람들의 경험 · ⑨ 후기 + 업체 반론 | |
| 정보 | ⑩ 공식정보(지역·확인일·출처·지도·정보 오류 제보) | |
| (탭 밖, 하단 고정) | ⑤ Pick 56 + 비교 | 탭 전환과 무관하게 항상 보이는 footer로 뺐다(Figma의 fixed CTA 배치를 가져옴). **Primary는 Pick 하나뿐** — Figma의 Pick+상담예약 2개 동시 노출은 가져오지 않았다(CLAUDE.md 「화면당 Primary CTA 1개」) |

**색·서체·수치는 옮기지 않았다.** 탭 인디케이터·활성 텍스트는 `theme.tint`, 탭 바 밑선은
`theme.border` — 전부 기존 토큰 참조고 신규 하드코딩 0건. `docs/screen-capture.md` 절차로
네 탭을 전부 찍어 확인했다(`scripts/screenshot-screens.mjs --build`, fixture는 아래 절 참고) —
탭 전환·금액 표기·후기·공식정보 전부 정상 렌더링, 새 팔레트(#E7898D 계열)가 Pick 버튼·활성
탭·별점·스타일 칩에 실제로 적용된 것을 육안으로 확인했다.

## 캡처 인프라 수리 — fixture 추가 + API URL 버그

이 화면들은 실제 데이터 없이는 스크린샷이 「연결이 불안정해요」로만 찍혔다. 두 가지가
막고 있었다:

1. **`scripts/fixtures/api.cjs`에 `GET /v1/vendors/:vendorId`(+`/images` · `/conditions` ·
   `/reviews`) 목이 아예 없었다** — 다른 화면(검색·목록)만 fixture가 있었다. `vendorDetailSchema`
   등 실제 계약대로 값을 채워 추가하고, `packages/api-contract/src/capture-fixtures.test.ts`에
   계약 검증 케이스 4개를 더했다(`api-contract` 시험 22→26, 전부 통과).
2. **`EXPO_PUBLIC_API_URL` 더미값에 `/capture` 경로가 붙어 있었다** — `client.ts`의 `send()`가
   `${baseUrl}${path}`를 URL 재해석 없이 문자열로 그냥 이어 붙여서, 실제 요청 pathname이
   `/capture/v1/...`가 되어 `installFixtures`의 `pathname.startsWith('/v1/')` 검사를 벗어났다.
   가로채지 못한 요청이 포트 1(unsafe port)로 그대로 나가 `ERR_UNSAFE_PORT`로 막혔다 — fixture를
   아무리 채워도 화면에 닿을 수 없는 상태였다. `scripts/screenshot-screens.mjs`의 더미 주소에서
   `/capture` 경로를 뺐다(`http://127.0.0.1:1`만 남김). 이 버그는 업체 상세만이 아니라 **fetch가
   필요한 모든 화면의 캡처를 막고 있었다** — 다른 세션의 캡처 결과도 이 수정 전에는 실데이터
   화면이 아니었을 수 있다는 뜻이라 알려둔다.

## 대표님께 올릴 목록 — 「피그마엔 있는데 서버가 없어서 못 만든다」

| 자리 | 무엇이 없어서 못 만드는가 |
| --- | --- |
| 상담 예약(`ConsultPage`/`BookingPage`) | 상담원 배정·시간대·캘린더 공유 개념 자체가 도메인·API 스키마 어디에도 없다(grep 0건) |
| 후기 상세의 좋아요·댓글 | `reviewSchema`(`packages/api-contract/src/reviews.ts`)에 `likes`·`comments` 필드가 없다 |
| 업체 상세 FAQ 아코디언 | `vendorDetailSchema`에 FAQ 필드가 없다 |
| 후기 상세의 별점 4축 분해(분위기·친절도·결과물·가격) | `reviewSchema.aspects`는 업종별 자유 배열이라 Figma가 고정한 4축과 안 맞고, 지금 리뷰에는 4축을 채울 자료가 없다 |
| 이미지 「업체 제공/사용자 제공」 탭 구분 | `vendorPhotoSchema`(`vendors.ts`)에 업로드 주체를 가르는 필드가 없다 — 있는 것은 저작권 근거(`copyright_basis`류)뿐이고, 그건 「누가 올렸는가」를 말하지 않는다 |

## B등급 수치 — 토큰화 후보 없음

`VendorFlows.tsx`에서 나온 px·rem 수치(예: 히어로 `h-72`, 별점 `52px` 등)는 **하나도 토큰에 올리지
않았다.** 담당 화면 7개가 이미 root 시안(대표님 직접 원본, A급 취급)과 `spec/tokens.json` 기존 값으로
전부 맞춰져 있어, Figma의 B등급 근사치 수치를 끌어올 필요 자체가 없었다. 새로 필요한 값이 생기면
이 표에 「B등급 · 확인 필요」로 남기고 MASTER에 먼저 보고한다 — 지금은 그 줄이 없다.

## 요약

- **`index.tsx`에 Figma `VendorDetailPage`의 탭 넷(소개·가격·후기·정보) 배치를 반영했다**
  (2026-09-14 대표님 「피그마 기준 개편」 지시가 root 정본 우선 지시보다 늦다 — MASTER 확정).
  안의 문구·수치·데이터는 그대로 두고 담는 그릇만 바꿨다. Primary CTA는 Pick 하나만
  하단 고정 영역에 남겼다(Figma의 Pick+상담예약 2개 동시 노출은 가져오지 않음).
- 나머지 자리(용어·통계형 카드·이미지 탭 미생성·FAQ·상담예약·후기상세)는 **정본(root·
  CLAUDE.md·서버 스키마)이 이긴 자리** 그대로 유지했다 — 근거는 위 「대표님께 올릴 목록」.
- `ContractVerify`(FlowScreens.tsx)는 `claude/rn-nav-auth` 담당이라 이 표에서 대조만 남기고
  구현 판단은 넘긴다.
- 색·서체는 `claude/rn-tokens`를 직접 머지해 받았다(충돌 없음, main 대비 8커밋 — 전부 토큰 세션
  소유). `claude/rn-components`는 아직 `rn-tokens` 최신판 기준으로 재정렬되지 않아 직접 머지 시
  `theme.ts`·`tokens.json` 충돌이 나 보류 중이다.
- 검증: typecheck·lint·`lint-copy`·jest(mobile 332 · api-contract 26) 전부 초록.
  `scripts/screenshot-screens.mjs --build`로 네 탭을 전부 찍어 새 팔레트·구조를 육안 확인함
  (아래 「캡처 인프라 수리」 참고 — 이 과정에서 fixture 부재와 API URL 버그를 같이 고쳤다).
