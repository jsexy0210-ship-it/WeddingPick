-- 직접 입력한 결정 — 우리 목록에 없는 업체로 이미 정한 경우(2026-09-26 대표 지시
-- 「직접입력하는 방법 고안하라」).
--
-- 온보딩 3/5(준비 현황)에서 카드를 누르면 업체 검색 시트가 뜬다. 찾는 곳이 우리 목록에
-- 없으면 이름을 직접 적어 그 카드의 «결정»으로 남긴다. 같은 지시의 둘째 줄 「결정으로
-- 넣는다」로 목록에서 고른 업체도 이 표에 결정으로 들어간다(0041).
--
-- **업체가 없는 결정**이라 `vendor_id`가 비고 `manual_name`이 찬다. 둘 중 정확히 하나만
-- 찬다 — 업체도 이름도 없는 결정, 업체와 다른 이름이 같이 적힌 결정은 무엇을 정했는지
-- 말하지 못한다.
--
-- `decision_is_a_pick`(0041, (wedding_id, vendor_id) → vendor_candidates)은 그대로 둔다.
-- 외래키는 MATCH SIMPLE이라 `vendor_id`가 NULL이면 검사하지 않는다 — 직접 입력은 Pick한
-- 곳이 아니어도 되고, 업체를 고른 결정은 여전히 Pick한 곳이어야 한다.
--
-- 기본키 (wedding_id, category)도 그대로다. 한 업종에 결정은 하나 — 직접 입력이든 업체든.

ALTER TABLE structured.category_decisions ALTER COLUMN vendor_id DROP NOT NULL;

ALTER TABLE structured.category_decisions ADD COLUMN manual_name text;

ALTER TABLE structured.category_decisions
  ADD CONSTRAINT decision_vendor_or_manual
    CHECK ((vendor_id IS NULL) <> (manual_name IS NULL));

-- 앞뒤 공백 없이 1~30자. 앱과 계약(`MANUAL_DECISION_NAME_MAX`)이 같은 수를 쓴다.
ALTER TABLE structured.category_decisions
  ADD CONSTRAINT decision_manual_name_shape
    CHECK (manual_name IS NULL
           OR (manual_name = btrim(manual_name) AND char_length(manual_name) BETWEEN 1 AND 30));

COMMENT ON COLUMN structured.category_decisions.manual_name IS
  '우리 목록에 없는 곳으로 정했을 때 사용자가 적은 이름. 이때 vendor_id는 NULL이다(0440).';

/*
 * 준비 상태 뷰(0041)는 «업체가 있어야 결정»으로 셌다. 직접 입력도 결정이다 — 결정 행이
 * 있으면 결정 완료다. 열 이름 · 순서는 그대로라 부르는 쪽(nudges · recommendations)은
 * 바뀌지 않는다.
 */
CREATE OR REPLACE VIEW structured.wedding_preparation AS
SELECT w.id AS wedding_id,
       c.category,
       count(p.vendor_id) AS pick_count,
       d.vendor_id AS decided_vendor_id,
       CASE
         WHEN d.category IS NOT NULL THEN 'decided'
         WHEN count(p.vendor_id) > 0 THEN 'picking'
         ELSE 'before'
       END AS state
FROM structured.weddings w
CROSS JOIN unnest(enum_range(NULL::vendor_category)) AS c (category)
LEFT JOIN structured.vendor_candidates p
       ON p.wedding_id = w.id
      AND p.vendor_id IN (SELECT id FROM structured.vendors v WHERE v.category = c.category)
LEFT JOIN structured.category_decisions d
       ON d.wedding_id = w.id AND d.category = c.category
GROUP BY w.id, c.category, d.vendor_id, d.category;
