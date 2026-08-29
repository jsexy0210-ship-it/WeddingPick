-- 결정사 업체평가 — 체크리스트.
--
-- 디자인 핸드오프 8번: "별점이 아니라 체크리스트 응답을 환산한 값이에요".
--
-- **별점을 걷어내지 않는다. 업종으로 가른다.** 체크리스트 항목(가격설명·계약일치·
-- 매칭이행·과도권유)은 결정사 계약에만 있는 것이라 웨딩홀 음식이나 스튜디오 보정에는
-- 쓸 수 없다. 한 벌로 억지로 맞추면 둘 다 흐려진다.
--
-- 표를 따로 두는 이유도 같다. review_aspects에 answer 컬럼을 붙이면 rating과
-- answer 중 하나만 채워진 행이 생기고, 언젠가 한 질의가 둘을 섞는다.

CREATE TYPE checklist_answer AS ENUM ('yes', 'no', 'unknown');

COMMENT ON TYPE checklist_answer IS
  '예/아니오/모름. 모름은 점수 계산의 분모에서 빠진다 — 모르는 것을 0으로 세면 비율이 늘 낮게 나온다.';

CREATE TABLE structured.review_checklist_answers (
  review_id uuid NOT NULL REFERENCES structured.reviews (id) ON DELETE CASCADE,
  -- 'price_explained' | 'contract_matched' | … 항목 목록은 도메인이 든다.
  item text NOT NULL CHECK (length(btrim(item)) > 0),
  answer checklist_answer NOT NULL,
  PRIMARY KEY (review_id, item)
);

COMMENT ON TABLE structured.review_checklist_answers IS
  '결정사 업체평가 응답. 별점(review_aspects)과 다른 표다 — 한 표에 두면 언젠가 한 질의가 둘을 섞는다.';

/*
 * 한 후기가 두 방식을 섞어 쓸 수 없다.
 *
 * 업종이 방식을 정하므로 원래 섞일 일이 없지만, 라우트가 실수하면 섞인다. 그러면
 * 업체평가에 별점 막대와 비율 막대가 나란히 서게 되고, 읽는 사람은 두 숫자가
 * 같은 것을 재는 줄 안다.
 */
CREATE FUNCTION structured.enforce_single_evaluation_mode() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM structured.review_aspects WHERE review_id = NEW.review_id) THEN
    RAISE EXCEPTION '한 후기에 별점과 체크리스트를 함께 쓸 수 없다';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_checklist_single_mode
  BEFORE INSERT ON structured.review_checklist_answers
  FOR EACH ROW EXECUTE FUNCTION structured.enforce_single_evaluation_mode();

CREATE FUNCTION structured.enforce_single_evaluation_mode_aspects() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM structured.review_checklist_answers WHERE review_id = NEW.review_id
  ) THEN
    RAISE EXCEPTION '한 후기에 별점과 체크리스트를 함께 쓸 수 없다';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_aspects_single_mode
  BEFORE INSERT ON structured.review_aspects
  FOR EACH ROW EXECUTE FUNCTION structured.enforce_single_evaluation_mode_aspects();
