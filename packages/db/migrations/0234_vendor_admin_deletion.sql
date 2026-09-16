-- 삭제는 폐업과 구분하고 기존 회원 기록이 가리키는 업체 행은 보존한다.
ALTER TABLE structured.vendors ADD COLUMN deleted_at timestamptz;
ALTER TABLE structured.vendors DROP CONSTRAINT vendors_inactive_requires_reason;
ALTER TABLE structured.vendors ADD CONSTRAINT vendors_inactive_requires_reason CHECK (
  is_active OR closed_at IS NOT NULL OR suspended_at IS NOT NULL
  OR merged_into_vendor_id IS NOT NULL OR deleted_at IS NOT NULL
);
ALTER TABLE structured.vendors ADD CONSTRAINT deleted_vendor_is_hidden CHECK (
  deleted_at IS NULL OR (NOT is_active AND admin_locked)
);
CREATE FUNCTION structured.keep_vendor_deletion() RETURNS trigger AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION '삭제된 업체는 복원할 수 없다';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER vendors_keep_deletion BEFORE UPDATE OF deleted_at ON structured.vendors
  FOR EACH ROW EXECUTE FUNCTION structured.keep_vendor_deletion();
COMMENT ON COLUMN structured.vendors.deleted_at IS
  '관리자 삭제 시각. 공개 조회에서는 제외하고 제보, 후기, Pick 및 변경 이력은 보존한다.';
