-- 가격 제보.
--
-- 문서 없이 "나는 이만큼 냈다"를 받는다. 콜드 스타트를 넘기 위한 것이다 —
-- 계약서를 찍어 올리는 것은 문턱이 높고, 그 문턱 때문에 표본이 모이지 않으면
-- 비교가 서지 않고, 비교가 없으면 계약서를 올릴 이유도 없다.
--
-- **검증된 계약과 섞이지 않게 표를 아예 나눈다.**
--
-- 컬럼 하나(is_verified 같은 것)로 구분했다면 언젠가 그 조건을 빠뜨린 쿼리가
-- 나온다. 서비스정책서 2번이 시장 대표가격의 근거를 L2 이상으로 못박았으므로,
-- 제보가 그 자리에 들어가는 일은 실수로도 일어나면 안 된다. 다른 표에 있으면
-- 합치려는 사람이 조인을 써야 하고, 조인은 눈에 띈다.

CREATE TABLE structured.price_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES structured.vendors (id) ON DELETE CASCADE,
  /*
   * 누가 제보했는지는 남기되 화면에는 익명이다. 남기는 것은 중복 제보와
   * 허위 제보를 다루기 위해서다.
   */
  reporter_user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,

  -- 같은 업체라도 상품마다 가격이 다르다.
  product_name text NOT NULL CHECK (length(btrim(product_name)) > 0),
  total_amount bigint NOT NULL CHECK (total_amount BETWEEN 10000 AND 500000000),
  -- 가격은 시점에 따라 달라진다. 연월까지만 받는다 — 날짜까지는 필요 없고,
  -- 좁게 받을수록 사람이 특정되기 쉬워진다.
  contracted_on date NOT NULL,

  -- 웨딩홀은 이 셋이 가격을 크게 좌우한다. 있으면 받고 없으면 비운다.
  guaranteed_guests integer CHECK (guaranteed_guests > 0),
  meal_price_per_person bigint CHECK (meal_price_per_person >= 0),
  included_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  /*
   * 허위로 판단해 뺀 제보. 지우지 않고 표시만 한다 — 지우면 같은 사람이 다시
   * 넣었을 때 알 수 없다.
   */
  rejected_at timestamptz,
  rejected_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  rejection_reason text,

  CONSTRAINT rejection_has_reviewer
    CHECK ((rejected_at IS NULL) = (rejected_by IS NULL AND rejection_reason IS NULL)),

  -- 한 사람이 한 업체의 한 상품에 하나. 여러 번 넣으면 중앙값을 끌 수 있다.
  UNIQUE (vendor_id, reporter_user_id, product_name)
);

COMMENT ON TABLE structured.price_reports IS
  '문서 확인 없이 받은 가격. 시장 대표가격(comparable_quotes)과 절대 섞지 않는다 — 서비스정책서 2번.';

CREATE INDEX price_reports_vendor_idx
  ON structured.price_reports (vendor_id, product_name)
  WHERE rejected_at IS NULL;

-- 집계에 들어가는 제보. 허위로 판단된 것은 빠진다.
CREATE VIEW structured.usable_price_reports AS
SELECT id, vendor_id, product_name, total_amount, contracted_on,
       guaranteed_guests, meal_price_per_person
FROM structured.price_reports
WHERE rejected_at IS NULL;

COMMENT ON VIEW structured.usable_price_reports IS
  '집계에 쓰는 제보. 이 뷰는 comparable_quotes와 UNION하지 않는다 — 둘은 다른 것을 말한다.';
