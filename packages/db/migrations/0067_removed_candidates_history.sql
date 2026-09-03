-- Pick에서 뺀 업체 이력. 핸드오프 Pick 히스토리.
--
-- vendor_candidates(0026)는 후보 목록이고, DELETE로 지운다. 지우면 흔적이
-- 남지 않아 "전에 Pick했다가 뺀 곳"을 다시 보여줄 수 없었다.
--
-- 이 테이블은 그 이력을 남긴다. 삭제 트리거가 채운다 — 사람이 직접 INSERT하지
-- 않아도 vendor_candidates에서 지울 때 자동으로 기록된다.
--
-- **vendor_candidates를 지울 때만 생긴다.** 업체 자체가 삭제되어 CASCADE로
-- 지워지는 경우에도 트리거가 동작한다 — 그 업체가 사라진 사실도 이력이다.

CREATE TABLE IF NOT EXISTS structured.removed_candidates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 어느 웨딩에서 담았다 뺐는지.
  wedding_id  uuid        NOT NULL,
  -- vendor가 삭제되면 이 FK는 NULL이 될 수 있다(SET NULL). 업체가 사라진
  -- 경우에도 이력 행 자체는 살린다 — 빠진 사실은 빠진 업체와 무관하다.
  vendor_id   uuid,

  -- 담을 때 업체의 업종. vendor가 지워진 뒤에도 조회할 수 있게 복사해둔다.
  category    text        NOT NULL,
  -- 업체명도 같은 이유로 복사한다.
  vendor_name text        NOT NULL,

  -- 담은 시점. vendor_candidates.added_at에서 옮긴다.
  added_at    timestamptz,
  -- 뺀 시점. 트리거가 채운다.
  removed_at  timestamptz NOT NULL DEFAULT now(),
  -- 누가 뺐는지. vendor_candidates는 누가 담았는지를 added_by로 저장하지만,
  -- 삭제 요청자는 트리거가 알 수 없다 — DELETE는 세션 변수로 전달하지 않으면
  -- 누가 눌렀는지 DB가 모른다. 일단 NULL로 두고, 필요하면 app.set_config()로
  -- 세션 변수를 주입하는 방식을 고려한다.
  removed_by  uuid        REFERENCES structured.users (id) ON DELETE SET NULL,

  FOREIGN KEY (wedding_id) REFERENCES structured.weddings (id) ON DELETE CASCADE
);

COMMENT ON TABLE structured.removed_candidates IS
  'Pick에서 뺀 업체 이력. vendor_candidates DELETE 트리거가 채운다.';
COMMENT ON COLUMN structured.removed_candidates.vendor_id IS
  'NULL 허용 — 업체가 삭제된 뒤에도 이력 행은 남는다(SET NULL).';
COMMENT ON COLUMN structured.removed_candidates.vendor_name IS
  'vendor가 지워진 뒤에도 보여줄 수 있도록 담을 때 이름을 복사해둔다.';

-- 웨딩별 이력 조회가 주 접근 패턴이다.
CREATE INDEX IF NOT EXISTS removed_candidates_wedding_idx
  ON structured.removed_candidates (wedding_id, removed_at DESC);

-- Pick에서 뺄 때 자동으로 이력을 남기는 트리거.
CREATE OR REPLACE FUNCTION structured.record_removed_candidate() RETURNS trigger AS $$
BEGIN
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

  -- vendor가 이미 삭제된 경우 JOIN이 0행을 반환한다 — INSERT가 일어나지 않는다.
  -- 그 경우에는 업체 정보를 알 수 없어 이력을 남기지 않는다.

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendor_candidates_removed_history
  AFTER DELETE ON structured.vendor_candidates
  FOR EACH ROW EXECUTE FUNCTION structured.record_removed_candidate();
