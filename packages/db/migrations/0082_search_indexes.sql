-- 검색 목록 질의가 행마다 세는 것들에 색인을 준다(2026-09-08 «로딩이 길다»).
--
-- 검색은 업체 한 행마다 (1) 확인된 계약 수(comparable_quotes → quotes)와
-- (2) 최근 12개월 결제인증 금액을 센다. quotes에는 vendor_id 색인이 없어 업체
-- 수 × quotes 전체를 훑었다.

CREATE INDEX IF NOT EXISTS quotes_vendor_confirmed_idx
  ON structured.quotes (vendor_id)
  WHERE confirmed_at IS NOT NULL AND vendor_id IS NOT NULL;
