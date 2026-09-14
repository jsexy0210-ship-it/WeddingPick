# 이용점수와 무드 — 지금 저장소에 있는 것

조사 기준 커밋 `8a25960` (`origin/main`, 2026-09-14).
조사자: `claude/vendor-social-signals` 세션. **코드 변경 없음. 이 문서 한 장뿐이다.**

저장수(Pick 수)는 **2026-09-14 대표 지시로 보류**다. 마이그레이션 `0290` 배정도 회수됐다.
이 문서는 남은 둘(이용점수 · 무드 라벨)과, 조사 중 드러난 사실을 적는다.

**적는 규칙:** 눈으로 확인한 것만 적는다. 확인하지 못한 것은 「확인 못 함」이라고 적는다.
실행해서 확인한 것은 무엇을 어떻게 돌렸는지 함께 적는다.

---

## 이용점수(별점)

### 어디에 정의돼 있나

| | 자리 |
| --- | --- |
| 점수 한 개(1~5) | `packages/api-contract/src/reviews.ts:21` — `ratingSchema = z.int().min(MIN_RATING).max(MAX_RATING)` |
| 업체 이용점수 전체 | `packages/api-contract/src/reviews.ts:178` — `usageScoreSchema` |
| 타입 | 같은 파일 `UsageScore` |
| 범위 상수 | `packages/domain/src/review.ts:153-154` — `MIN_RATING = 1`, `MAX_RATING = 5` |
| 문턱 | `packages/domain/src/review.ts:242` — `MINIMUM_REVIEW_COUNT = 5` |

`usageScoreSchema`는 `available`로 갈리는 discriminated union이다.

```
available: true    average · count · aspects[] · checklist[] · caption
available: false   reason · count
```

`aspects`(별점 업종의 항목별 평균 1~5)와 `checklist`(결정사 등 체크리스트 업종의 0~100 환산)는
**서로 다른 배열이다.** 스키마 주석이 이유를 적어 두었다 — 「4.2점과 78%는 다른 것을 재는
숫자이고, 한 배열에 넣으면 화면이 같은 막대로 그린다」.

### 어디서 계산되나

**한 곳이다.** `apps/api/src/review-view.ts:24` `loadUsageScore(pool, vendorId, category)`.

부르는 곳은 둘뿐이고 둘 다 업체 하나를 볼 때다.

- `apps/api/src/routes/vendors.ts:355` — 업체 상세
- `apps/api/src/routes/reviews.ts:561` — 후기 목록

계산은 두 단계로 갈라져 있다.

1. **SQL이 재료만 낸다.** 관문은 `structured.scored_reviews` 뷰 하나다.
   ```sql
   SELECT s.overall, s.verification, (…항목별 평점…)
   FROM structured.scored_reviews s
   WHERE s.vendor_id = $1
   ```
2. **도메인이 점수를 만든다.** `computeUsageScore()` (`packages/domain/src/review.ts:257`)가
   확인된 것만 걸러 세고, 문턱 미만이면 숫자를 만들지 않는다.

`scored_reviews` 뷰의 실제 정의(`packages/db/migrations/0057_objection_expiry.sql:67`):

```sql
CREATE OR REPLACE VIEW structured.scored_reviews AS
SELECT r.id, r.vendor_id, r.role, r.overall, r.verification, r.created_at
FROM structured.reviews r
JOIN structured.review_visibility v ON v.review_id = r.id
WHERE v.effective_status = 'published'
  AND r.verification <> 'reported'::review_verification;
```

`computeUsageScore`의 필터는 `countsTowardScore()` = `verification !== 'reported'`
(`review.ts:195`). **뷰의 조건과 도메인의 조건이 정확히 같다.** 우연이 아니라
`review-view.ts`의 주석이 그렇게 하라고 적어 두었다 — 「여기서 조건을 다시 쓰지 않는 것이
중요하다. 두 군데에 적으면 언젠가 한쪽만 바뀌고, 그때 미인증 후기가 점수에 섞인다」.

평균은 `Math.round(x * 10) / 10`으로 소수 한 자리다(`review.ts:276`).

### 목록에서 재사용할 수 있나

**함수는 그대로 못 쓴다. 도메인 규칙은 반드시 재사용해야 한다.** 둘을 갈라서 봐야 한다.

#### `loadUsageScore()`를 목록에서 부르면 안 된다

업체 한 곳당 질의 1회, 체크리스트 업종이면 2회다. 목록 20줄이면 20~40회 왕복이 된다.
`docs/render-region-move.md:56`이 잰 값이 **DB 왕복 1회 약 199ms**(API는 Ohio, DB는 싱가포르)다.
지금 목록이 이미 대표 이미지 서브쿼리 때문에 느린 자리라, 여기에 배수를 하나 더 붙이면 안 된다.

만드는 값도 목록에 필요 없는 것까지다 — 카드가 그리는 것은 「4.8 · 167」 둘뿐인데
`loadUsageScore`는 항목별 평균과 체크리스트 환산까지 만든다.

#### 대신 쓸 수 있는 것 — **저장소에 이미 같은 모양의 선례가 있다**

`structured.vendor_paid_window` (`packages/db/migrations/0035_vendor_price_window.sql:11`)가
그 모양이다. 업체별 결제 요약을 **GROUP BY로 미리 묶은 뷰**로 두고, 목록 질의가
`LEFT JOIN` **한 번**으로 붙인다(`apps/api/src/routes/vendors.ts:574`).

```sql
FROM found v
LEFT JOIN structured.vendor_paid_window w ON w.vendor_id = v.id
```

업체당 서브쿼리가 아니라 조인 하나라 왕복이 늘지 않는다. 그리고 그 뷰의 주석이
**중요한 규칙**을 적어 두었다 — 「중앙값이나 단계는 여기서 만들지 않는다. 몇 건부터 무엇을
보여줄지는 도메인의 사다리가 정하고, SQL은 재료만 낸다」.

이용점수도 같은 규칙을 따라야 한다. **SQL은 `count`와 `avg`만 내고, 문턱(5건)과 반올림은
도메인 것을 그대로 쓴다.** 목록에서 문턱을 다시 정하면 목록에 뜬 별점이 상세에서
「수집 중」으로 바뀐다.

#### 실제로 돌려서 확인했다

컨테이너에 Postgres 16을 띄우고 `packages/db/migrations/*.sql` **115개를 처음부터 전부
적용**한 뒤, 아래 집계를 시험 데이터로 돌렸다(전부 `ROLLBACK`으로 끝냈고 **저장소에는
아무것도 남기지 않았다**).

```sql
SELECT s.vendor_id, count(*) AS scored_count, avg(s.overall) AS overall_average
FROM structured.scored_reviews s
GROUP BY s.vendor_id;
```

| 시험 | 넣은 것 | 나온 것 | 판정 |
| --- | --- | --- | --- |
| 미인증이 섞이는가 | 확인된 후기 5건(4,5,5,5,5) + **미인증 1건(1점)** | `count 5` · `avg 4.8000` | 미인증 1점이 **빠졌다.** 안 빠졌으면 4.17이 나온다 |
| 문턱 아래도 재료는 나오는가 | 확인된 후기 4건(전부 5점) | `count 4` · `avg 5.0000` | 재료는 나온다. 문턱은 도메인이 걸어야 한다 |

`4.8`은 `computeUsageScore`가 같은 후기로 만드는 값과 같다. **관문이 하나라 두 경로가
같은 답을 낸다는 것이 실측으로 확인됐다.**

### `VendorSummary`에 실으려면 정확히 무엇을 더해야 하나

`packages/api-contract/src/vendors.ts:28` `vendorSummarySchema`에 **필드 하나만 더하면 된다.**
기존 필드는 하나도 건드릴 필요가 없다.

```ts
// usageScoreSchema 를 통째로 넣지 않는다 — 목록 스무 줄에는 무겁다.
usageScore: z.object({
  average: z.number().min(MIN_RATING).max(MAX_RATING),
  count: z.int().positive(),
}).nullable(),
```

`null`이 「확인된 후기가 5건에 못 미친다」는 뜻이다. `guidePrice`가 이미 그 모양이라
(`vendors.ts:66` `guidePriceSchema.nullable()`) 새 관례를 만들 필요가 없다.

서버 쪽에 필요한 것은 셋이다.

1. **집계 뷰 하나** — `scored_reviews`를 `GROUP BY vendor_id`로 묶어 `count`·`avg`를 내는 뷰.
   `vendor_paid_window`(0035) 옆에 같은 꼴로. **마이그레이션이 필요하다.**
2. **목록·추천 질의에 `LEFT JOIN` 한 줄씩** — 서브쿼리 아님.
3. **재료를 요약으로 바꾸는 함수 하나** — 문턱은 `MINIMUM_REVIEW_COUNT`, 반올림은
   `Math.round(x*10)/10`. 둘 다 도메인 것을 부른다. 검색과 추천이 같이 쓰므로
   `apps/api/src/review-view.ts`(`loadUsageScore` 옆)에 두는 것이 맞다.

#### ⚠️ 놓치기 쉬운 자리 — `VendorSummary`를 만드는 곳이 **셋**이다

`vendorSummarySchema`는 필수 필드다(`.nullable()`은 「없어도 된다」가 아니라 「null일 수
있다」다). 그래서 필드를 더하면 **이 셋을 다 고쳐야 한다.** 하나라도 빠지면 런타임에서
계약 검증이 깨진다.

| 만드는 곳 | 자리 |
| --- | --- |
| 검색 목록 | `apps/api/src/routes/vendors.ts` — `toSummary()` (`:124`) + 목록 질의 |
| 업체 상세 | 같은 파일 `loadVendorDetail()` — `vendorDetailSchema`가 summary를 `.extend`한다(`vendors.ts:223`) |
| 웨딩픽 추천 | `apps/api/src/routes/recommendations.ts` — `Recommendation` 타입(`:61`)과 그 질의. `app.ts`의 bootstrap이 이 결과를 `vendorSummarySchema`로 검증한다(`api-contract/src/app.ts:25,29`) |

상세는 `usageScore`를 **전체 스키마로 덮어쓰므로**(`vendors.ts:229`) 요약 필드가 가려진다 —
문제는 없지만 알고 있어야 한다.

그 밖에 고쳐야 하는 자리 둘을 실제로 부딪혀 확인했다.

- `scripts/fixtures/api.cjs` — 캡처용 가짜 응답. `packages/api-contract/src/capture-fixtures.test.ts`가
  계약으로 검증하므로 **필드를 안 채우면 시험이 빨개진다.**
- `apps/web/src/site.test.ts` · `apps/web/src/vendor-pages.test.ts` — `VendorSummary`·`VendorDetail`
  fixture를 손으로 만든다. **타입 검사에서 걸린다.**

---

## 스타일 태그(해시태그)

### 이미 내려가는 것이 맞나 — 맞다

`packages/api-contract/src/vendors.ts:61`:

```ts
styleTags: z.array(weddingStyleSchema),
```

DB에도 있다 — `packages/db/migrations/0090_style_tags_guide_price.sql:22`가
`structured.vendors.style_tags wedding_style[] NOT NULL DEFAULT '{}'`를 더하고
GIN 인덱스까지 걸어 뒀다. 서버가 읽어 내려보내는 것도 확인했다
(`apps/api/src/routes/vendors.ts:134` — `styleTags: (row.style_tags ?? []).filter(isWeddingStyle)`).

**확인 방법:** 스키마·마이그레이션·API 매핑 세 자리를 직접 읽었다. 운영 DB에 실제로 값이
들어 있는지는 **확인 못 함** — 운영 DB를 보지 않았다.

### 화면이 지금 그걸 어떻게 쓰나

**정렬 가중치만 쓰는 것이 아니다. 업체 상세는 이미 칩으로 그리고 있다.**

| 자리 | 하는 일 |
| --- | --- |
| **업체 상세** `apps/mobile/src/app/(tabs)/search/[vendorId]/index.tsx:396-420` | **`vendor.styleTags`를 전부 칩으로 그린다.** 내가 고른 것과 겹치는 칩에는 「· 고른 스타일」을 덧붙인다 |
| **검색 목록 카드** `apps/mobile/src/app/(tabs)/search/index.tsx:711` `renderVendorCard()` | **안 그린다.** 이미지 · 이름 · 금액 한 줄 · Pick pill 뿐 |
| 홈 조건 칩 | `apps/mobile/src/features/home/state.ts:382` — **사용자가 고른** 스타일을 칩으로. 업체 태그가 아니다 |
| 정렬 가중치 | `styleOverlap()` / `styleMatchReason()` (`packages/domain/src/style.ts`). 추천 질의가 교집합 개수로 1차 정렬(`recommendations.ts:189`) |

**규칙은 그대로다:** 태그가 다르다고 업체를 목록에서 빼지 않는다. 교집합 개수를 순서에만
반영한다(`style.ts` 머리말).

### ⚠️ 피그마가 그리는 해시태그는 `styleTags`가 아니다

이것이 이 문서에서 제일 중요한 발견일 수 있다.

피그마(`weddingpick_figma@3d1705d`, `src/app/components/Search.tsx:308-314`)의 카드는
`v.tags`를 `#{tag}`로 그린다. 그 값들은 이렇다.

```
#웨딩홀전용 #야외정원 · #자연광 #야외촬영 · #필름감성 · #A라인 #볼가운
#이탈리안브랜드 #럭셔리 · #당일메이크업 #리허설포함 · #자연스러운웨딩룩
```

`styleTags`가 담을 수 있는 값은 **넷뿐이다** — `URBAN` · `NATURAL` · `ROMANTIC` · `GLAMOROUS`.

그리고 `packages/domain/src/style.ts:11`이 **명시적으로 거부하고 있다.**

> 업종별 세부 속성(실크 · 비즈 · 필름톤 …)은 여기 넣지 않는다.

피그마가 그리는 것이 정확히 그 「업종별 세부 속성」이다.

**결과:** `styleTags`를 목록 카드에 그대로 그리면 모든 웨딩홀 카드가 같은 두 칩을
반복한다. 글자 모양은 피그마와 비슷하고 정보량은 다르다.

**이건 배관 문제가 아니라 없는 데이터 문제다.** 업종별 태그를 새 필드로 만들지는
결정이 필요하다. `packages/domain/src/taste.ts:60-100`에 업종별 세부 항목이 이미 있지만
(`studio_film` 「따뜻한 필름」, `dress_silk` 「실크」 …) 그건 **사용자 취향 선택지**이고
업체에 붙는 태그가 아니다 — 업체 쪽에 그 값을 담는 열은 **없다**(확인함).

---

## 무드 4종 라벨

### 라벨이 지금 어디에 적혀 있나

**`packages/domain/src/style.ts:19-24`에 코드로 박혀 있다.**

```ts
export const WEDDING_STYLE_LABEL: Record<WeddingStyle, string> = {
  URBAN: '도시적인',
  NATURAL: '자연스러운',
  ROMANTIC: '로맨틱한',
  GLAMOROUS: '화려한',
};
```

**`spec/strings.ko.json`에는 없다.** 검색해서 확인했다 — 그 파일에 「도시적인」·「로맨틱한」은
한 번도 나오지 않는다. 「값(문구)은 `spec/strings.ko.json`에서만 가져온다. 하드코딩 금지」라는
CLAUDE.md 규칙에 **지금 어긋나 있는 자리다.**

옮길 방법은 이미 저장소 안에 있다. `packages/domain/src/copy-rules.ts:15`가
`import glossary from '../../../spec/glossary.json'`으로 `spec/`을 직접 읽는다.
`packages/domain/tsconfig.json`에 `resolveJsonModule: true`가 켜져 있다.

키 넷 자체는 `style.ts:14` `WEDDING_STYLES`이고, DB에서는 `wedding_style` enum이다(0090).

### 라벨을 바꾸면 같이 깨지는 자리

바꾸기 전에 알아야 할 것 — 라벨을 참조하는 곳이 **아홉 자리**다(`WEDDING_STYLE_LABEL` 검색).
화면 넷(온보딩 스타일 격자 · 홈 조건 칩 · 업체 상세 칩 · 내 웨딩 설정), 요약 함수 하나
(`onboarding/flow.ts:179`), 그리고 **시험 둘이 옛 문구를 하드코딩하고 있다.**

- `apps/mobile/src/features/onboarding/flow.test.ts:99,130,147` — `'도시적인 · 로맨틱한'`
- `apps/mobile/src/features/home/state.test.ts:358,359,370,371` — `'도시적인'` · `'로맨틱한'`

**라벨을 바꾸면 이 다섯 개 단언이 즉시 빨개진다.** 문구를 다시 적는 대신
`WEDDING_STYLE_LABEL`을 참조하게 고치는 편이 낫다 — 그러면 다음에 문구가 바뀔 때
또 빨개지지 않는다.

### 피그마 네 문구를 우리 키 넷에 어떻게 붙일지 — 제안과 근거

피그마 원문(`Search.tsx:350`, 「선호 무드」 필터):

```js
options={["자연스러운 무드", "화려한 연출", "미니멀", "클래식"]}
```

| 키 | 지금 | 제안 | 판정 |
| --- | --- | --- | --- |
| `NATURAL` | 자연스러운 | **자연스러운 무드** | 확실 |
| `GLAMOROUS` | 화려한 | **화려한 연출** | 확실 |
| `URBAN` | 도시적인 | **미니멀** | ⚠️ **확인 필요** |
| `ROMANTIC` | 로맨틱한 | **클래식** | ⚠️ **확인 필요** |

앞의 둘은 같은 말에 꾸밈이 붙은 것뿐이라 근거를 댈 것이 없다.

**뒤의 둘은 남은 자리를 채운 것이지 같은 말이라서 붙인 것이 아니다.** 피그마에 넷뿐이고
앞의 둘이 확실하니 뒤의 둘은 서로 짝이 될 수밖에 없었다. 판단의 근거로 쓸 수 있는 것은
`style.ts:27-32`의 내부 정의(`WEDDING_STYLE_NOTE`)뿐이다.

```
URBAN       모던 · 세련됨 · 도심 · 현대적
ROMANTIC    부드러움 · 감성적 · 사랑스러움
```

- **`URBAN` → 「미니멀」** — 넷 중에서는 가장 낫다. 「모던 · 세련됨」과는 닿는다(둘 다
  덜어내는 쪽의 말이다). 다만 **「도심」과는 닿지 않는다** — 미니멀은 장소가 아니라
  장식의 양을 말한다. 「클래식」에 붙이는 것보다 나은 이유는 분명하다: 클래식은
  「현대적」의 반대말이라 정면으로 충돌한다.
- **`ROMANTIC` → 「클래식」** — **순수하게 소거법이다.** 「부드러움 · 감성적 ·
  사랑스러움」과 「클래식(전통 · 격식)」은 거의 닿지 않는다. **넷 중 가장 약한 연결이고,
  근거라고 부를 만한 것이 없다.** 다른 셋이 정해지면 남는 자리가 여기라서 여기다.

#### 함께 결정해야 할 것 — 라벨만 바꾸면 생기는 드리프트 ⚠️

`WEDDING_STYLE_NOTE`는 **업체를 이 넷으로 분류할 때 쓰는 기준**이다. 라벨만 바꾸고 노트를
그대로 두면, 「도심이라서」 `URBAN`이 붙은 웨딩홀이 화면에 **`#미니멀`**로 뜬다.
붙인 근거와 보이는 말이 어긋난다.

반대로 노트를 라벨에 맞춰 고치면 **이미 태그가 붙은 업체들의 근거가 사후에 바뀐다.**

**어느 쪽도 공짜가 아니다.** 매핑이 확정되기 전에는 노트를 건드리지 않는 편이 안전하다고
본다 — 라벨은 되돌리기 쉽고 태그된 데이터는 되돌리기 어렵다. 확정되면 재태깅이 필요한
업체 범위를 뽑아야 한다.

#### 피그마 필터가 단일 선택이다 ⚠️

`Search.tsx:139`가 `useState("자연스러운 무드")` — **문자열 하나**다. `FilterGroup`도
`value`/`onChange` 단수라 하나만 고를 수 있다.

우리 규칙은 **「최소 1 · 최대 2」**다(`style.ts:34-35` `STYLE_PICK_MIN`/`STYLE_PICK_MAX`,
SPEC §13.6). 지시도 「최소 1 · 최대 2는 그대로」였다.

피그마 쪽 파일이 Figma Make가 만든 근사치(B등급)라 **우리 규칙이 정본이라고 본다.**
다만 대표님 시안 원본(`docs/design-handoff/root/`)에서 이 필터가 몇 개를 고르게 그려져
있는지는 **확인 못 함** — 그쪽을 열어보지 않았다.

---

## 내가 틀린 것 (MASTER 표 대비)

배정받은 표는 셋 중 둘이 이미 있다고 했다. **두 줄은 맞고 한 줄은 틀렸다.**

| 표의 주장 | 판정 | 실제 |
| --- | --- | --- |
| 별점은 이미 있다. 배관만 이으면 된다 | ✅ **맞다** | 위에 적은 대로다 |
| 저장수는 없다. 이것만 진짜 신규다 | ✅ **맞다** | `vendor_candidates`(0026)에 Pick 행은 있지만 업체별로 세는 것은 어디에도 없다 |
| 해시태그는 이미 있다. **지금은 정렬 가중치로만 쓰고 화면에 안 그린다** | ❌ **틀렸다 (두 군데)** | 아래 |

**틀린 것 1 — 이미 그리고 있다.** 업체 상세(`search/[vendorId]/index.tsx:396-420`)가
`vendor.styleTags`를 칩으로 그린다. 「화면에 안 그린다」는 **검색 목록 카드**에만 해당한다.

**틀린 것 2 — 「표시할 수 있게 두면 끝」이 아니다.** 피그마가 그리는 해시태그는
`styleTags`가 담을 수 없는 값이다(위 「⚠️ 피그마가 그리는 해시태그는 `styleTags`가
아니다」). 필드를 표시로 돌리는 문제가 아니라 없는 데이터를 만들지 말지의 문제다.

### 덤 — 저장수 보류와 관련해 알아둘 것

저장수는 보류지만, **화면이 이미 그 자리를 비워두고 기다리고 있다.**
`apps/mobile/src/app/(tabs)/search/index.tsx:765-768` 주석 그대로다.

> 시안은 이 자리에 하트 + **Pick 수**를 적지만 서버가 업체별 Pick 수를 내려주지 않는다
> (`vendorSummarySchema`) — 모양만 시안대로 두고 라벨은 «Pick»으로 간다(2026-09-11 대표
> 지시). 수가 붙으면 라벨 자리만 숫자로 바꾼다.

즉 나중에 저장수를 만들면 **화면 변경은 라벨 한 자리**다.

그리고 세는 단위를 정할 때 알아야 할 것 하나 — **Pick은 사람이 아니라 웨딩에 매달려
있다**(`0026_vendor_candidates.sql`, `UNIQUE (wedding_id, vendor_id)`). 「Pick한 사람 수」를
그대로 세면 배우자가 연결된 웨딩에서 한 결정이 둘로 세어진다.

### 정렬 주석은 손대지 않았다

`packages/api-contract/src/vendors.ts:78`의 「**`인기 순`은 없다.** 인기를 재는 것이 우리에게
없고 …」는 **저장수가 보류된 지금 여전히 사실이다.** 그대로 뒀다.

다만 나중에 저장수나 이용점수가 목록에 실리면 그 문장은 사실이 아니게 된다. 그때 함께
봐야 할 것: 피그마 검색 화면의 정렬 드롭다운은 이미 넷을 그리고 있다
(`Search.tsx:117` · 피그마 — `["인기순", "평점순", "계약인증순", "최신등록순"]`).

---

## 확인하지 못한 것

지어내지 않으려고 따로 적는다.

- **운영 DB의 실제 값** — `vendors.style_tags`에 값이 실제로 얼마나 채워져 있는지,
  이용점수 문턱(5건)을 넘는 업체가 몇 곳인지. 운영 DB를 보지 않았다.
- **`apps/api` 통합 시험 52개** — 로컬 Postgres로 돌리기 시작했으나 지시가 바뀌어 중단했다.
  코드 변경을 되돌렸으므로 지금 저장소 상태로는 돌릴 것도 없다.
- **대표님 시안 원본(`docs/design-handoff/root/`)의 무드 필터** — 몇 개를 고르게 그려져
  있는지 열어보지 않았다.
- **피그마의 px·색 수치** — Figma Make가 만든 근사치(B등급)라 애초에 근거로 쓰지 않았다.
  이 문서는 화면 구성 · 라벨 · 필드 목록만 피그마에서 가져왔다.

## 이 조사가 저장소에 남긴 것

**이 문서 한 장뿐이다.** 조사 중 코드·계약·마이그레이션을 만들었다가 지시 변경에 따라
전부 되돌렸다. 마이그레이션 `0290`도 만들었다가 지웠다 — **번호 `0290`은 쓰이지 않았고
비어 있다.** 로컬에 띄운 Postgres는 컨테이너 안에만 있고 운영 DB는 건드리지 않았다.
