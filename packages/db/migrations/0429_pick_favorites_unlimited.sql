-- 관심업체(하트)와 나의 Pick을 분리한다.
--
-- 관심업체는 개인의 탐색 상태다. 배우자와 공유되는 vendor_candidates(Pick)와 섞지 않는다.
-- 둘 다 개수 제한은 두지 않는다.

CREATE TABLE IF NOT EXISTS structured.favorite_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES structured.vendors (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, vendor_id)
);

COMMENT ON TABLE structured.favorite_vendors IS
  '사용자 개인 관심업체(하트). 웨딩 공유 Pick(vendor_candidates)과 독립된 목록.';

CREATE INDEX IF NOT EXISTS favorite_vendors_user_idx
  ON structured.favorite_vendors (user_id, created_at DESC);

-- Pick은 더 이상 30곳 상한을 두지 않는다.
DROP TRIGGER IF EXISTS vendor_candidates_limit ON structured.vendor_candidates;
DROP FUNCTION IF EXISTS structured.enforce_candidate_limit();
