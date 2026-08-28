-- 견적서에 적혀 있는데 담을 곳이 없던 정보들.
--
-- 실제 견적서로 확인해보니 다음이 빠져 있었다:
--   계약금·잔금, 금액 범위("150만원~300만원"), 예식일, 웨딩홀 조건(보증인원·식대 단가),
--   스드메 패키지의 하위 업체(스튜디오·드레스·메이크업이 각각 다른 회사다)

ALTER TABLE structured.quotes
  -- 가계약 검증(사업계획서 8번)이 보는 값이다. 계약조건 본문에만 있으면 비교할 수 없다.
  ADD COLUMN deposit_amount bigint CHECK (deposit_amount >= 0),
  ADD COLUMN balance_amount bigint CHECK (balance_amount >= 0),
  -- 계약일과 다르다. 위약금 기준이 예식일까지 남은 날짜로 정해진다.
  ADD COLUMN wedding_date date,
  -- 웨딩홀 조건. 보증인원과 식대 단가가 총액을 좌우하므로 같은 상품이라도 이 값이
  -- 다르면 같은 분포에 넣으면 안 된다 (사업계획서 14번).
  ADD COLUMN hall_name text,
  ADD COLUMN guaranteed_guests integer CHECK (guaranteed_guests > 0),
  ADD COLUMN meal_price_per_person bigint CHECK (meal_price_per_person >= 0);

COMMENT ON COLUMN structured.quotes.deposit_amount IS
  '계약금 또는 가계약금. 가계약 검증이 보는 값이다.';
COMMENT ON COLUMN structured.quotes.wedding_date IS
  '예식일. 취소 위약금 기준이 이 날짜까지 남은 날로 정해진다.';
COMMENT ON COLUMN structured.quotes.guaranteed_guests IS
  '보증인원. 식대 단가와 함께 총액을 좌우한다.';

-- 견적서에는 "150만원 ~ 300만원", "35만원부터" 같은 범위가 흔하다.
-- 단일 금액만 담으면 추가비용의 크기를 비교할 수 없다.
ALTER TABLE structured.quote_line_items
  ADD COLUMN amount_min bigint CHECK (amount_min >= 0),
  ADD COLUMN amount_max bigint CHECK (amount_max >= 0),
  ADD CONSTRAINT line_item_range_is_ordered
    CHECK (amount_min IS NULL OR amount_max IS NULL OR amount_min <= amount_max);

COMMENT ON COLUMN structured.quote_line_items.amount_min IS
  '금액이 범위로 적힌 경우의 하한. 확정 금액은 amount에 둔다.';

-- 스드메 패키지는 업체가 하나가 아니다. 플래닝 회사 아래 스튜디오·드레스·메이크업이
-- 각각 다른 업체다. 하나로 뭉치면 사업계획서 19번(세 가지를 한 평점으로 합치지 않는다)을
-- 지킬 수 없다.
CREATE TYPE package_role AS ENUM ('studio', 'dress', 'makeup', 'planning', 'snap', 'other');

CREATE TABLE structured.quote_sub_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES structured.quotes (id) ON DELETE CASCADE,
  role package_role NOT NULL,
  -- 문서에 적힌 이름. 업체 매칭은 vendor_id로 따로 붙는다.
  name_raw text NOT NULL,
  vendor_id uuid REFERENCES structured.vendors (id) ON DELETE SET NULL,
  amount bigint CHECK (amount >= 0),
  UNIQUE (quote_id, role, name_raw)
);

CREATE INDEX quote_sub_vendors_quote_idx ON structured.quote_sub_vendors (quote_id);
CREATE INDEX quote_sub_vendors_vendor_idx ON structured.quote_sub_vendors (vendor_id)
  WHERE vendor_id IS NOT NULL;

COMMENT ON TABLE structured.quote_sub_vendors IS
  '패키지 견적 안의 개별 업체. 스튜디오·드레스·메이크업을 따로 비교하기 위한 것이다.';

-- 아직 연결되지 않은 하위 업체 이름도 등록 우선순위에 포함한다.
-- sum()이 numeric을 주므로 뷰를 다시 만든다 (CREATE OR REPLACE는 컬럼 타입을 못 바꾼다).
DROP VIEW structured.unmatched_vendor_names;

CREATE VIEW structured.unmatched_vendor_names AS
SELECT
  normalized_name,
  min(sample_name) AS sample_name,
  sum(quote_count)::bigint AS quote_count
FROM (
  SELECT
    structured.normalize_vendor_name(vendor_name_raw) AS normalized_name,
    vendor_name_raw AS sample_name,
    count(*) AS quote_count
  FROM structured.quotes
  WHERE vendor_id IS NULL AND vendor_name_raw IS NOT NULL
  GROUP BY 1, 2

  UNION ALL

  SELECT
    structured.normalize_vendor_name(name_raw),
    name_raw,
    count(*)
  FROM structured.quote_sub_vendors
  WHERE vendor_id IS NULL
  GROUP BY 1, 2
) AS names
GROUP BY normalized_name
ORDER BY sum(quote_count) DESC;
