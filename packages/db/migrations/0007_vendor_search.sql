-- 업체 검색 (A-16).
--
-- 사용자는 "아펠가모"라고 치고 "아펠가모 공덕"을 찾는다. 앞부분만 맞는 것으로는 부족해
-- 부분 문자열로 찾아야 하는데, 일반 btree 색인은 '%검색어%'에 쓰이지 않는다.
-- pg_trgm의 GIN 색인이 이걸 받는다.
--
-- 두 글자 이하 검색어에는 색인이 쓰이지 않고 훑는다. 그 경우는 느려지되 결과는 같다 —
-- 조용히 다른 결과를 주는 것보다 낫다.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX vendors_normalized_name_trgm_idx
  ON structured.vendors USING gin (normalized_name gin_trgm_ops);

CREATE INDEX vendor_aliases_normalized_trgm_idx
  ON structured.vendor_aliases USING gin (normalized_alias gin_trgm_ops);

-- 지역 필터는 "서울"처럼 시도까지만 받는다. region은 "서울 마포구" 형태라 앞부분으로 맞춘다.
CREATE INDEX vendors_region_prefix_idx
  ON structured.vendors (region text_pattern_ops);

-- 검색 결과를 이름 순으로 넘길 때 쓰는 커서 키.
CREATE INDEX vendors_name_id_idx ON structured.vendors (name, id);
