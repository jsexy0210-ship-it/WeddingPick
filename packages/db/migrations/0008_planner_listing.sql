-- 플래너 탐색 (A-16).
--
-- 플래너는 업체 부속정보가 아니라 독립 비교대상이다(사업계획서 11번). 그런데 업체와
-- 결정적으로 다른 점이 하나 있다 — **플래너는 개인이다.**
--
-- 견적서에서 읽어낸 플래너 이름은 사용자가 자기 계약을 확인받으려고 올린 문서에서
-- 나온 것이다. 그것을 누구나 검색할 수 있는 목록에 싣는 것은 수집 목적과 다른 이용이다.
-- 그래서 공개 여부를 컬럼 기본값으로 막고, 공개하려면 근거를 함께 적게 한다.
--
-- 이 파일이 지키려는 것은 하나다: **문서에서 알게 된 이름이 검색 목록으로 새어나가지
-- 않는다.** 규칙을 코드 관례가 아니라 스키마에 둔 이유다.

CREATE TYPE planner_listing_status AS ENUM (
  -- 우리 안에서만 쓴다. 견적을 플래너에 잇고, 그 사용자의 비교에만 반영한다.
  'private',
  -- 검색에 나온다. 근거가 있어야만 이 값이 될 수 있다.
  'public',
  -- 내려달라는 요청을 받았다. 다시 올라가지 않는다.
  'withdrawn'
);

ALTER TABLE structured.planners
  ADD COLUMN listing_status planner_listing_status NOT NULL DEFAULT 'private',
  -- 무엇을 근거로 공개했는지. AI 추출은 근거가 될 수 없다.
  ADD COLUMN listing_source source_type,
  ADD COLUMN listed_at timestamptz,
  ADD COLUMN withdrawn_at timestamptz,
  ADD COLUMN normalized_name text
    GENERATED ALWAYS AS (structured.normalize_vendor_name(name)) STORED;

COMMENT ON COLUMN structured.planners.listing_status IS
  '검색 노출 여부. 기본값은 private — 문서에서 읽어낸 이름은 저절로 공개되지 않는다.';

/*
 * 공개에는 근거가 있어야 한다.
 *
 * public_data는 공개된 자료에 이미 실려 있다는 뜻이고, vendor_official은 업체·본인이
 * 스스로 밝혔다는 뜻이다. ai_extraction은 남의 계약서에서 읽은 것이라 근거가 아니다.
 */
ALTER TABLE structured.planners
  ADD CONSTRAINT public_listing_has_basis
    CHECK (
      listing_status <> 'public'
      OR (listing_source IN ('public_data', 'vendor_official') AND listed_at IS NOT NULL)
    );

ALTER TABLE structured.planners
  ADD CONSTRAINT withdrawn_has_timestamp
    CHECK ((listing_status = 'withdrawn') = (withdrawn_at IS NOT NULL));

/*
 * 내려달라고 한 사람은 다시 올라가지 않는다.
 *
 * 공개 자료를 다시 가져오는 작업이 돌 때마다 되살아나면, 내려달라는 요청은 아무 뜻이
 * 없다. 되돌리려면 사람이 직접 이 트리거를 알고 손대야 한다.
 */
CREATE FUNCTION structured.block_relisting_withdrawn_planner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.listing_status = 'withdrawn' AND NEW.listing_status <> 'withdrawn' THEN
    RAISE EXCEPTION '내려달라고 요청한 플래너는 다시 공개할 수 없다 (planner_id=%)', OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER planners_withdrawn_is_final
  BEFORE UPDATE ON structured.planners
  FOR EACH ROW
  EXECUTE FUNCTION structured.block_relisting_withdrawn_planner();

/*
 * 검색이 보는 유일한 곳.
 *
 * 노출 조건이 뷰 안에 있어, 검색 경로가 조건을 빠뜨릴 방법이 없다.
 * structured.comparable_quotes가 집계에 대해 하는 일과 같다.
 */
CREATE VIEW structured.listed_planners AS
SELECT
  p.id,
  p.name,
  p.normalized_name,
  p.vendor_id,
  p.regions,
  p.listing_source,
  p.listed_at
FROM structured.planners p
WHERE p.listing_status = 'public';

COMMENT ON VIEW structured.listed_planners IS
  '검색에 나올 수 있는 플래너. 노출 조건은 이 뷰 안에만 있다.';

CREATE INDEX planners_listed_idx ON structured.planners (name, id)
  WHERE listing_status = 'public';

CREATE INDEX planners_normalized_name_trgm_idx
  ON structured.planners USING gin (normalized_name gin_trgm_ops);

-- 플래너별 가격을 낼 때 쓴다. 등급·확인 조건은 comparable_quotes가 이미 걸러준다.
CREATE INDEX quotes_planner_idx ON structured.quotes (planner_id)
  WHERE planner_id IS NOT NULL AND confirmed_at IS NOT NULL;
