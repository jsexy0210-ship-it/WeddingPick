-- 스타일 4종 · 업체 안내 가격(정보 0층) — 디자인 핸드오프 v3.22(2026-09-09) SPEC §2 · §13.6.
--
-- 스타일: 사용자 화면에는 도시적인 · 자연스러운 · 로맨틱한 · 화려한 넷만 노출한다.
-- DB 기준값은 영문 태그다 — 한글 문자열을 기준값으로 쓰지 않는다.
--   사용자(웨딩)  style_tags  최소 1 · 최대 2 — API가 지킨다
--   업체          style_tags  개수 제한 없음
-- 태그는 정렬 가중치로만 쓴다. 태그가 다르다고 업체를 목록에서 빼지 않는다.
--
-- 업체 안내 가격(정보 0층): 실 제보 0건일 때 «업체 안내 150만원~»를 회색으로 대신
-- 보여준다. 실 제보와 섞지 않는다 — 라벨이 «업체 안내»로 다르고 실 제보가 3건이 되는
-- 순간 자동으로 실 제보 표기로 바뀐다(클라이언트가 stage로 판단). 출처를 함께 적는다.

CREATE TYPE wedding_style AS ENUM ('URBAN', 'NATURAL', 'ROMANTIC', 'GLAMOROUS');

ALTER TABLE structured.weddings
  ADD COLUMN style_tags wedding_style[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN structured.weddings.style_tags IS
  '온보딩 5/5 스타일(도시적인·자연스러운·로맨틱한·화려한). 최소 1 · 최대 2. 추천 정렬 가중치.';

ALTER TABLE structured.vendors
  ADD COLUMN style_tags wedding_style[] NOT NULL DEFAULT '{}',
  ADD COLUMN guide_price_from bigint CHECK (guide_price_from IS NULL OR guide_price_from > 0),
  ADD COLUMN guide_price_source text
    CHECK (guide_price_source IS NULL OR char_length(btrim(guide_price_source)) > 0),
  ADD COLUMN guide_price_checked_at timestamptz,
  ADD CONSTRAINT vendors_guide_price_source_with_amount
    CHECK (guide_price_from IS NOT NULL OR (guide_price_source IS NULL AND guide_price_checked_at IS NULL));

COMMENT ON COLUMN structured.vendors.style_tags IS
  '업체 스타일 태그(URBAN·NATURAL·ROMANTIC·GLAMOROUS). 개수 제한 없음. 정렬 가중치로만 쓴다.';
COMMENT ON COLUMN structured.vendors.guide_price_from IS
  '업체가 안내한 시작 금액(원). 실 제보 3건 미만일 때 «업체 안내 N만원~»로 대신 보여준다(정보 0층). 실 제보와 섞지 않는다.';
COMMENT ON COLUMN structured.vendors.guide_price_source IS
  '업체 안내 가격의 출처 표기(예: 업체 홈페이지 · 공식 안내문). 화면에 «출처 · …»로 적는다.';

CREATE INDEX vendors_style_tags_idx ON structured.vendors USING gin (style_tags);
