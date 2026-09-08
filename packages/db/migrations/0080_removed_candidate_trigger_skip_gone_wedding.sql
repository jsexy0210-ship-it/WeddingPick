-- Pick 이력 트리거(0067)가 회원탈퇴를 막던 것을 고친다.
--
-- structured.users를 지우면 weddings → vendor_candidates가 CASCADE로 따라
-- 지워진다. 그때 vendor_candidates의 AFTER DELETE 트리거가 이미 사라진
-- wedding_id로 removed_candidates에 INSERT하려다 FK에 걸렸다 — Pick이 하나라도
-- 있는 사람은 계정 행이 끝내 안 지워지고 withdrawal_deletion_failures에만
-- 쌓였다. API는 completed=false로 «접수»라 답해 아무도 눈치채지 못했다.
--
-- 웨딩이 이미 없으면 이력을 남기지 않는다. removed_candidates.wedding_id도
-- 웨딩에 CASCADE라, 남겼더라도 곧 같이 사라질 행이다 — 이력으로서 의미가 없다.
-- 업체(vendor)가 사라진 경우의 처리(0행 → INSERT 없음)는 그대로다.

CREATE OR REPLACE FUNCTION structured.record_removed_candidate() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM structured.weddings w WHERE w.id = OLD.wedding_id) THEN
    RETURN OLD;
  END IF;

  INSERT INTO structured.removed_candidates
    (wedding_id, vendor_id, category, vendor_name, added_at)
  SELECT
    OLD.wedding_id,
    OLD.vendor_id,
    v.category::text,
    v.name,
    OLD.added_at
  FROM structured.vendors v
  WHERE v.id = OLD.vendor_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION structured.record_removed_candidate() IS
  'vendor_candidates DELETE 이력. 웨딩이 이미 사라진 CASCADE 삭제에서는 남기지 않는다(0080).';
