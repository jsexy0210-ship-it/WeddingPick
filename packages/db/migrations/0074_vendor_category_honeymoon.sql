-- 업종에 허니문을 더한다. 디자인 핸드오프 검색 화면(WP-SEARCH, 06-search.dc.html)
-- 카테고리 칩 8개 중 이것만 vendor_category enum에 없었다 — 스드메처럼 의도한
-- 병합이 아니라 그냥 빠져 있었다(packages/domain/src/vendor.ts 참고).
--
-- Postgres는 ALTER TYPE ... ADD VALUE로 더한 값을 같은 트랜잭션 안에서 쓰지
-- 못한다(0016_planner_listing_evidence.sql 참고) — 이 파일은 값만 더하고 끝낸다.

ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS 'honeymoon';
