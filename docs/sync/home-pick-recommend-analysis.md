# 홈 전면 개편 — 구현 전 분석 (2026-09-15)

대표님 홈 개편 사양 22절(「구현 전 분석」 열아홉 가지)에 대한 실사 결과다. 코드를 고치기
전에 **저장소를 직접 재서** 적었고, 셀 수 있는 것은 로컬 PostgreSQL 16에 마이그레이션
전부(0001~0410)를 올리고 `seed:samples`로 240곳을 넣은 뒤 질의해서 세었다.

세션: `claude/home-pick-recommend` · 기준 `main` 6d45e20

---

## 0. 결론 요약

| | |
| --- | --- |
| DB 테이블 신규 | **0건** |
| 신규 API | **1개** — `GET /v1/me/recommendations` |
| 기존 API 확장 | **2개** — `/v1/app/bootstrap` · `/v1/vendors` 요약의 별점 칸 |
| 신규 화면 | **1개** — `/recommendations` (웨딩픽 추천 전체) |
| 추천 로직 | **기존 재사용** — `recommendVendors()`. 새로 만들지 않는다 |

---

## 1. 열아홉 항목 실사

| # | 항목 | 지금 어디에 | 판정 |
| --- | --- | --- | --- |
| ① | 홈 컴포넌트 | `app/(tabs)/index.tsx` (681줄) + `features/home/` 9개 | 있음 |
| ② | 홈 데이터 API | `GET /v1/app/bootstrap` (`api/routes/app.ts`) | 있음 · 확장 |
| ③ | 업체 카드 | `features/home/recommendation.tsx` `Card` | **재사용** |
| ④ | Pick 데이터 | `CandidateListResponse.groups[]` | 있음 |
| ⑤ | 비교 | `/search/compare?ids=` · `POST /v1/…/comparisons` | 있음 |
| ⑥ | 추천 로직 | `recommendVendors()` (`api/routes/recommendations.ts`) | 있음 · 확장 |
| ⑦ | 업종 상태 | `PreparationState` = `before`·`picking`·`decided` 셋 | 모자람 → §3 |
| ⑧ | DECIDED 처리 | `PUT /v1/weddings/{id}/decisions` · `categoryStatuses()` | 있음 |
| ⑨ | 예식일·예식장 | 예식일 있음 · **예식장 필드 없음** → §4 | 부분 |
| ⑩ | 예산 | `GET /v1/weddings/{id}/expenses` → `budget{set,budget,spent,remaining,over}` | 있음 |
| ⑪ | 커플 연결 | `spouseLinked`·`partnerDisplayName` + `GET /v1/weddings/{id}/invites` | 있음 |
| ⑫ | 박람회 | `GET /v1/expos` → 기간·title·venue·region·`status` | **그대로 맞음** |
| ⑬ | 웨딩피드 | `GET /v1/wedding-feed` → categoryLabel·title·imageUrl | 부분 → §6 |
| ⑭ | 이벤트 | 목록형 이벤트 표 **없음**. 월간 웨딩지원금뿐 | → §5 |
| ⑮ | 검색 | `/search` · `/search?category=` | 있음 |
| ⑯ | 업체 상세 | `/search/[vendorId]` | 있음 |
| ⑰ | Pick 비교 | `/search/compare?ids=` · 업종별 후보 `/pick/[category]` | 있음 |
| ⑱ | 신규 route | `/recommendations` → §7 | — |
| ⑲ | 공유 추천 source | bootstrap이 **단일 업종 3곳**만 준다 | 신규 1개 → §2 |

---

## 2. 추천 — 기존 로직을 쓴다. 지어낸 순서가 아니다

`recommendVendors(ctx, {userId, category, region, limit})`(`api/routes/recommendations.ts`)가
이미 있다. 무엇으로 고르는지도 이미 정해져 있다 — **지역 + 스타일 태그 겹침 + 업체 안내
가격 + 실 제보 수**이고, 자격 판정과 이유 문장은 도메인(`top3.ts`)이 만든다. 홈과 TOP3
화면이 이미 같은 함수를 쓴다. **여기서 순서를 새로 지어내지 않는다.**

문제는 하나다. `GET /v1/app/bootstrap`이 그 함수를 **한 업종에 대해 3곳** 부른다
(`PICK_COUNT = 3`). 업종별 아코디언도, 미결정 전 업종을 펼치는 신규 페이지도 못 채운다.

**신규 엔드포인트 1개로 푼다. DB 변경 0, 추천 로직 재작성 0.**

```
GET /v1/me/recommendations?limit=<업종 수>
→ groups: [{ category, categoryLabel, state, vendors: VendorSummary[≤3] }]
```

서버가 노출 규칙(§11 — `DECIDED`·`SKIPPED` 제외)과 정렬 우선순위(COMPARING → SHORTLISTED
→ NOT_STARTED, 동순위는 `PREPARATION_CATEGORIES` 준비 순서)로 업종을 세우고, 그 순서대로
`recommendVendors`를 부른다. **홈은 `limit=3`, 신규 페이지는 무제한** — 사양 §12·§14의
「같은 추천 데이터 · 별도 상태 복제 금지」가 이 한 줄로 지켜진다.

**비용을 미리 적는다.** 업종 하나당 최대 2회 질의(구 → 시/도 확장)라 미결정 12업종이면
최대 24회다. 홈은 6회. 병렬로 묶고 실제 시간을 재서 PR에 적는다. 느리면 신규 페이지를
아코디언으로 바꿔 펼칠 때 부른다(사양 §12가 허용한 자리다).

---

## 3. 카테고리 상태 여섯 — 넷만 만들어진다

| 사양 | 지금 근거 | 판정 |
| --- | --- | --- |
| `DECIDED` | `wedding_preparation.state='decided'` ∥ `me.preparedCategories` 포함 | 그대로 |
| `COMPARING` | `pick_count >= 2` (`MIN_COMPARABLE`) | 개수로 가른다 |
| `SHORTLISTED` | `pick_count == 1` | 개수로 가른다 |
| `NOT_STARTED` | `pick_count == 0` | 그대로 |
| `EXPLORING` | **조회 기록이 없다** | `NOT_STARTED`와 합친다 |
| `SKIPPED` | **정하는 자리도 저장할 칸도 없다** | 이번 범위 밖 |

### `EXPLORING`을 합치는 근거

마이그레이션 전체(0001~0410)에 `vendor_views`·`impressions` 류의 조회 기록 표가 **한 개도
없다.** 「업체 보는 중 · Pick 없음」을 「손도 안 댔음」과 구별할 방법이 없다.

화면 문구는 어차피 둘 다 `[추천]`이라 **사용자에게는 같아 보인다**(사양 §7 표). 그래서
합친다. 2026-09-15 MASTER 확인.

거의 되는 길이 하나 있었고, 안 쓰기로 했다 — `structured.removed_candidates`(0067)가
`vendor_candidates` DELETE 트리거로 쌓이고 `category`를 복사해 갖고 있어서, 「담았다가 다
뺀 업종」은 잡힌다. 그런데 그건 「둘러보기만 한 사람」을 못 잡고, 잡아봐야 정렬에서
③④가 갈릴 뿐 화면은 똑같다. **볼 수 없는 구분을 위해 순위를 흔들지 않는다.**

**본 기록이 생기면 여기서 갈린다** — 그때 매핑 한 줄만 더하면 된다.

### `SKIPPED`를 안 만드는 근거

「이 준비는 안 할래요」를 정하는 화면이 없다. 상태를 만들면 그것을 켜고 끄는 화면도 만들어야
하고, 대표님이 시키지 않은 화면이 는다. **타입에는 두되 아무도 만들지 않는 값으로 남긴다** —
노출 규칙의 제외 목록에는 이름이 그대로 있다.

---

## 4. 별점 — 있는 관문을 그대로 쓴다

### 집계 방법

`structured.scored_reviews` 뷰가 이미 있다(`0020_reviews.sql:147`). 들어오는 것은 **게시 중
(`status='published'`) + 확인된(`verification <> 'unverified'`)** 후기뿐이다. 업체 상세의
이용점수(`loadUsageScore` → `computeUsageScore`)가 그 뷰 하나만 본다.

**목록에서도 그 관문을 그대로 쓴다.** `review-view.ts`가 적어둔 이유가 그대로 적용된다 —
「여기서 조건을 다시 쓰지 않는 것이 중요하다. 두 군데에 적으면 언젠가 한쪽만 바뀌고, 그때
미인증 후기가 점수에 섞인다」. 상세에서 4.3인 업체가 홈 카드에서 4.6이면 둘 다 못 믿는다.

**문턱도 그대로다** — `MINIMUM_REVIEW_COUNT = 5`(`packages/domain/src/review.ts:242`).
확인된 후기 5건 미만이면 점수를 만들지 않는다. SQL에 5를 박지 않고 도메인 상수를 넘긴다.

계약은 얇은 칸 하나를 더한다. `VendorDetail.usageScore`(항목별 평균·체크리스트까지 든 것)와
**이름을 달리한다** — 같은 이름이면 목록이 상세 것을 덜 실은 줄 알고 언젠가 합쳐진다.

```ts
/** 이용점수. 확인된 후기 5건 미만이거나 체크리스트 업종이면 null — 화면이 별점 줄을 안 그린다. */
rating: z.object({ average: z.number(), count: z.int().positive() }).nullable()
```

### 후기 0건 업체 비율 — 실측

로컬 DB에 `seed:samples`(240곳)를 넣고 `scored_reviews`로 세었다.

| 기준 | 곳 | 별점 뜸 | 비율 |
| --- | --- | --- | --- |
| 시드 샘플 **전체** | 240 | **171** | **71.3%** |
| 별점 업종만(결정사 제외) | 220 | 171 | 77.7% |
| **결정사** | 20 | **0** | 0% — 체크리스트 업종 |

업종별로는 본식스냅 60%가 가장 낮고 예물 90%가 가장 높다. 별점 값은 업체 평균의 평균
**4.29**, 최저 3.3, 최고 5.0.

**세 가지를 분명히 적는다.**

1. **운영 DB는 이 세션에서 못 본다.** 위 수는 저장소의 `seed-samples.ts`를 실제로 돌려 센
   것이고, 시드가 고정 난수라 누가 돌려도 같은 수가 나온다.
2. **실제 업체는 이 비율에 안 들어간다.** 공공데이터 import·`seed-real-vendors.mts`로 들어온
   업체에는 후기를 넣는 경로가 없다 — **구조적으로 0건이고 전부 별점이 안 뜬다.** 운영의
   실제 비율은 71.3%보다 **낮다.**
3. **결정사는 영원히 별점이 없다.** `evaluationModeFor`가 결정사만 체크리스트로 보낸다.
   사양 §6이 카드에 별점을 필수로 뒀는데, 결정사 카드에는 못 넣는다.

### 값이 없을 때 카드

**별점 줄을 그리지 않는다.** `★0.0`도 `★-`도 `★ 수집 중`도 아니다. 저장소의 답이 세 군데에서
같다 — 대표 이미지 없으면 「사진 준비 중」 상자를 안 그리고(`vendors.ts`), 실 제보 없으면
「0건」이 아니라 「수집 중」이고(v3.24), 표본 모자란 점수는 흐리게도 안 보여준다
(`review.ts:248`).

지금 카드의 마지막 줄은 이미 `space-between`이고 오른쪽이 비어 있다(`recommendation.tsx`
`priceRow` — 별점 자리로 비워둔 것이다). 있으면 넣고 없으면 가격만 남는다. **카드 높이는
안 변한다.**

**⚠️ 대표님 판단이 필요한 자리.** 없는 카드가 28.7%(실제 업체 포함하면 더)라 가로 슬라이드
세 장 중 한 장만 별점이 있는 꼴이 나온다. 「이 집만 평가가 있다」로 읽힐 수 있다. 세션 쪽
제안은 **그래도 그린다**이다 — 없는 별점을 만드는 것보다 낫고 후기가 쌓이면 메워진다.

### 저장 수 — 이번에 안 그린다

`structured.vendor_candidates`를 `vendor_id`로 묶으면 업체별 저장 수가 나온다(한 줄짜리
집계, DB 변경 불필요). `wedding_preparation` 뷰의 `pick_count`는 **웨딩별·업종별**이라
다른 축이다 — 헷갈리면 안 된다.

값이 문제다. 시드 DB의 `vendor_candidates`는 **0행**이고 운영에서도 출시 초기엔 대부분 0이다.
**「저장 0」은 「아무도 안 담은 곳」으로 읽힌다.** 별점 0과 같은 함정이라 집계 쿼리만
준비해두고 값이 붙으면 켠다.

---

## 5. 히어로 — 예식장·예산·커플 연결

### 예식장: 웨딩홀 결정 업체명이 곧 예식장이다 (2026-09-15 확정)

어떤 계약에도 예식장 필드가 없다. **별도 입력 칸을 만들지 않는다.** 사용자가 웨딩홀로
**결정**한 업체의 이름이 이 앱에서 예식장이 정해지는 유일한 경로다. `categoryStatuses()`가
이미 `decidedName`을 만들고 있어 자료가 그대로 있다.

```
웨딩홀 DECIDED    2027.04.17 · <그 업체 이름>
예식일만 있음      2027.04.17 · 예식장 미정
둘 다 없음         예식일 · 예식장 미정
```

「예식장 미정」을 누르면 웨딩홀 추천으로 간다(사양 §3-2). **업체 이름이 길면 줄인다** —
히어로 한 줄이고 날짜와 같이 있어서 잘리는 꼴을 찍어 확인한다.

### 예산

`GET /v1/weddings/{id}/expenses` → `budget`이 판별 유니온이다. `set:true`면
`budget`·`spent`·`remaining`·`over`가 다 있다. 사용률 = spent / budget × 100.

**함정 하나.** 온보딩에서 「4,000만원 이상」·「아직 모르겠어요」를 고른 사람은 상한이 없어
`budget.set === false`인데 **이미 답한 사람이다.** `features/home/priority.ts`가 이 함정을
이미 주석으로 적어놨다 — 「예산을 정해볼까요?」는 `budgetBracket`까지 null인 사람에게만
보인다.

### 커플 연결

`spouseLinked`(있음) · 「초대 수락을 기다리고 있어요」는 `GET /v1/weddings/{id}/invites`의
`invite !== null`. 히어로 하나 때문에 왕복을 둘 더 만들지 않고 **`/v1/app/bootstrap`에
예산 요약과 초대 여부를 얹는다**(기존 API 확장).

---

## 6. 이벤트 · 웨딩피드 · 박람회

**이벤트(사양 §18)** — 목록형 이벤트 표가 없다. 있는 것은 월간 웨딩지원금
(`GET /v1/me/monthly-draw`)뿐이다. **배너형 하나**로 세우고 활성 이벤트가 없으면 섹션째
안 그린다(사양이 그렇게 정했다). **운영 기간을 적지 않는다** — `하루 안에`·`매달`·`~까지`·
`30일 안에`·`마감일`·`당첨 확률` 금지, 「확인 후 알려드려요」 꼴로 쓴다.

**웨딩피드(사양 §17)** — 지금 카드가 이미 썸네일 + 카테고리 + 제목이고 **시간 정보가 없다.**
§17을 이미 지키고 있다. 다만 메타 형식 `[드레스] · 웨딩 가이드`의 뒤쪽(콘텐츠 유형)은
`weddingFeedPostSchema`에 칸이 없다 — 없으면 카테고리만 적는다.

**박람회(사양 §16)** — `GET /v1/expos`가 기간·명·장소·지역·`status`를 다 준다. 종료 제외는
`status <> 'closed'`. 우선순위의 「접근성」은 잴 자료가 없어 지역·일정만 쓴다.

---

## 7. 신규 route — `/recommendations`

`apps/mobile/src/app/(tabs)/(home)/recommendations.tsx`.

근거: 홈이 소유한 하위 화면이 그 그룹에 **홑명사**로 이미 셋 있다 — `/feed` · `/progress` ·
`/top3`. `(home)`은 `OFF_TAB_ROUTES`라 **탭이 되지 않고**, Root 탭은 다섯 그대로다. 진입은
홈 > Pick 추천 > 더보기, 뒤로가기는 홈으로 복귀.

**기존 주소는 한 글자도 안 건드린다** — `/wedding`(웨딩노트) · `/community`(라운지)는 이름이
바뀌어도 주소를 유지한다는 규칙이 CLAUDE.md에 있다. `depth-back-rules.ts`의 `ROUTES`에
`/recommendations`를 등록한다(안 하면 `depth-back.test.ts`가 깨진다).

---

## 8. 재사용 / 수정 / 신규 / 영향도

**재사용(손 안 댐)** — 업체 카드(`recommendation.tsx` `Card`) · `CategoryImage` ·
`WeddingContent` · `useMyCandidates` · `PickDoneSheet`/`UnpickSheet` · `priceLine` ·
`formatCount` · `recommendVendors` · `scored_reviews` 뷰 · `/search/compare` · `GET /v1/expos`.

**수정** — `app/(tabs)/index.tsx` · `features/home/state.ts` · `features/home/recommendation.tsx` ·
`api/routes/app.ts` · `packages/api-contract/src/vendors.ts` · `api/routes/vendors.ts` ·
`features/navigation/depth-back-rules.ts`.

**신규** — `(home)/recommendations.tsx` · 업체 카드 공통 컴포넌트 추출 · 아코디언 · 히어로
재작성 · 박람회 슬라이드 · 이벤트 배너 · `GET /v1/me/recommendations` · 도메인 상태 매핑 ·
정렬 함수 + 테스트.

**사라지는 것(영향 보고)** — 준비현황 2×2 `Board`(Pick 추천에 흡수) · `CategoryGrid`
(사양 §19 「전체 카테고리 목록은 홈에 나열하지 않는다」) · 조건 칩 · `heroCopy` 두 줄 제목 ·
「N곳 비교하기」 문구(사양 §4 N건 금지). `Board`·`CategoryGrid`는 홈 말고 쓰는 데가 없어
고아가 된다 — 지울지는 홈 개편 PR에서 다시 묻는다. `features/home/state.test.ts`(475줄)는
상당 부분 다시 쓴다.

---

## 9. 피그마 정본과의 관계

CLAUDE.md 최상위 1번은 「모든 디자인·UX·UI는 피그마 기준」이고 3번은 「피그마에 없는 화면은
피그마의 «규칙»으로 만든다」다. **이번 사양은 피그마에 없는 구조다** — 피그마 홈은 히어로 +
준비현황 2×2 + 추천 캐러셀 + 카테고리 6 그리드 + 웨딩피드다.

**구조는 대표님 사양이 이긴다**(「대표님이 나중에 내린 지시는 시안보다 앞선다」의 적용이고,
2026-09-15 대표님이 「저대로 만들어」라고 확인하셨다). **값은 피그마 규칙과 `spec/tokens.json`
에서 온다** — 좌우 20(`Layout.pageX`) · SEED 토큰 · Pretendard. 화면 코드에 hex·px를 직접
적지 않는다. 이것이 3번이 말하는 「그림이 없어도 규칙은 있다」다.

금지어: 화면 문구는 `검색`을 쓴다(`탐색` 금지). 상태 이름 `EXPLORING`은 변수명이라 면제
대상이다. 숫자는 전부 `formatCount`를 거치고 가격은 `priceLine` 하나로만 만든다.
