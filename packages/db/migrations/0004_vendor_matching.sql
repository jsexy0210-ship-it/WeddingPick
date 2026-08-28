-- 업체 매칭.
--
-- AI는 문서에 적힌 업체 이름을 읽을 뿐이고, 그것이 어느 업체인지 확정하는 것은 서버 몫이다
-- (사업계획서 27번). 이름 표기가 제각각이라 정규화한 이름으로 맞춰본다.

/**
 * 업체 이름 비교용 정규화.
 * 공백·괄호·가운뎃점·하이픈을 지우고 소문자로 만든다.
 * "더 채플 앳 청담" / "더채플앳청담" / "더채플 앳 청담(청담)" 이 같은 값이 된다.
 */
CREATE FUNCTION structured.normalize_vendor_name(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT regexp_replace(lower(name), '[[:space:]()\[\]{}·・,.\-_/]', '', 'g')
$$;

ALTER TABLE structured.vendors
  ADD COLUMN normalized_name text
    GENERATED ALWAYS AS (structured.normalize_vendor_name(name)) STORED;

-- 같은 지역에 같은 이름의 업체를 두 번 만들지 않는다.
CREATE UNIQUE INDEX vendors_normalized_name_region_idx
  ON structured.vendors (normalized_name, region);

CREATE INDEX vendors_normalized_name_idx ON structured.vendors (normalized_name);

-- 브랜드명·지점명·옛 상호 등 같은 업체를 가리키는 다른 이름들.
CREATE TABLE structured.vendor_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES structured.vendors (id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text GENERATED ALWAYS AS (structured.normalize_vendor_name(alias)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX vendor_aliases_normalized_idx
  ON structured.vendor_aliases (normalized_alias);

COMMENT ON TABLE structured.vendor_aliases IS
  '같은 업체를 가리키는 다른 이름. 매칭 실패가 쌓이면 여기에 별칭을 더한다.';

-- AI가 읽은 업체 이름 원문. 매칭에 실패해도 남겨둔다 —
-- 나중에 업체가 등록되면 이 값으로 다시 맞출 수 있다.
ALTER TABLE structured.quotes
  ADD COLUMN vendor_name_raw text;

COMMENT ON COLUMN structured.quotes.vendor_name_raw IS
  'AI가 문서에서 읽은 업체 이름. vendor_id가 비어 있으면 아직 매칭되지 않은 것이다.';

-- 매칭되지 않은 이름들. 어떤 업체를 먼저 등록해야 하는지 보여준다.
CREATE VIEW structured.unmatched_vendor_names AS
SELECT
  structured.normalize_vendor_name(vendor_name_raw) AS normalized_name,
  min(vendor_name_raw) AS sample_name,
  count(*) AS quote_count
FROM structured.quotes
WHERE vendor_id IS NULL AND vendor_name_raw IS NOT NULL
GROUP BY 1
ORDER BY count(*) DESC;

COMMENT ON VIEW structured.unmatched_vendor_names IS
  '아직 연결되지 않은 업체 이름과 그 빈도. 등록 우선순위를 정하는 데 쓴다.';
