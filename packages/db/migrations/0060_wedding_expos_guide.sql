-- 박람회 · 웨딩 정보. 디자인 핸드오프 WP-EXPO-001~004.
--
-- 업체·플래너와 같은 모양을 그대로 따른다: 값마다 출처(source)와 마지막 확인일
-- (last_verified_at)을 들고 다닌다(사업계획서 25번, 0001의 vendors가 이미 그
-- 규칙이다) — 박람회 일정이나 가이드 본문은 시간이 지나면 낡는 정보라, 언제
-- 확인한 값인지 없이 보여주면 사용자는 지금도 맞는 정보인지 알 수 없다.
--
-- 둘 다 개인 데이터가 아니라 운영이 올리는 공개 콘텐츠다. 그래서 사용자별
-- 소유자(user_id)가 없다 — vendors·planners와 같은 자리에 둔다. 등록·수정
-- 화면(관리자)은 이번 마이그레이션 범위가 아니다. 이 세션은 읽기 API와
-- 화면만 만든다.

-- ---------------------------------------------------------------------------
-- 박람회. WP-EXPO-001·002.
-- ---------------------------------------------------------------------------

CREATE TABLE structured.wedding_expos (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text        NOT NULL,
  organizer         text,
  region            text        NOT NULL,
  venue             text,
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz NOT NULL,
  -- 사전등록 링크. 없는 박람회도 있어 nullable이다.
  registration_url  text,
  -- 참가 혜택 한 줄. 값을 지어내지 않으므로 없으면 NULL이다.
  benefits_note     text,
  source            source_type NOT NULL,
  last_verified_at  timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT wedding_expo_ends_after_starts CHECK (ends_at >= starts_at)
);

COMMENT ON TABLE structured.wedding_expos IS
  '웨딩박람회 일정. 운영이 올리는 공개 콘텐츠 — 사용자별 소유자가 없다.';

-- 목록 화면의 정렬(일정순)과 필터(지역)가 바로 쓰는 색인.
CREATE INDEX wedding_expos_starts_idx ON structured.wedding_expos (starts_at);
CREATE INDEX wedding_expos_region_idx ON structured.wedding_expos (region);

-- ---------------------------------------------------------------------------
-- 웨딩 정보. WP-EXPO-003·004.
-- ---------------------------------------------------------------------------
--
-- 준비단계 태그는 `packages/domain/src/lifecycle.ts`의 LIFECYCLE_STAGES와
-- 값을 맞춘다. 다만 그 파일의 lifecycle()은 "저장하지 않고 계산한다"고
-- 정했다 — 그건 **사용자의** 지금 단계 얘기고, 이 컬럼은 **콘텐츠가** 어느
-- 단계에 맞는 글인지를 운영이 붙이는 분류다. 다른 종류의 값이라 같은 원칙이
-- 적용되지 않는다.

CREATE TYPE wedding_guide_stage AS ENUM (
  'early', 'preparing', 'imminent', 'wedding_day', 'newlywed', 'married_life', 'beyond'
);

CREATE TABLE structured.wedding_guide_articles (
  id                uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text                NOT NULL,
  body              text                NOT NULL,
  -- 준비단계별 정보. 특정 단계에 매이지 않는 글이면 NULL.
  stage             wedding_guide_stage,
  -- 카테고리별 가이드. 화면이 이 값으로 검색(카테고리 필터)에 연결한다.
  related_category  vendor_category,
  source            source_type         NOT NULL,
  last_verified_at  timestamptz         NOT NULL DEFAULT now(),
  published_at      timestamptz         NOT NULL DEFAULT now(),
  created_at        timestamptz         NOT NULL DEFAULT now()
);

COMMENT ON TABLE structured.wedding_guide_articles IS
  '웨딩 정보 글. 운영이 올리는 공개 콘텐츠 — 사용자별 소유자가 없다.';

CREATE INDEX wedding_guide_articles_stage_idx
  ON structured.wedding_guide_articles (stage) WHERE stage IS NOT NULL;
CREATE INDEX wedding_guide_articles_category_idx
  ON structured.wedding_guide_articles (related_category) WHERE related_category IS NOT NULL;
CREATE INDEX wedding_guide_articles_published_idx
  ON structured.wedding_guide_articles (published_at DESC);
