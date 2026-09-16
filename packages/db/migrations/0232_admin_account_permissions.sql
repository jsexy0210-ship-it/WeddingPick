-- 기존 운영 계정의 권한은 보존하고, 새 계정의 삭제 권한은 API에서 명시적으로 받는다.
ALTER TABLE structured.admin_accounts
  ADD COLUMN can_edit boolean NOT NULL DEFAULT true,
  ADD COLUMN can_delete boolean NOT NULL DEFAULT true,
  ADD COLUMN deleted_at timestamptz;

ALTER TABLE structured.users ADD COLUMN suspended_at timestamptz;

COMMENT ON COLUMN structured.admin_accounts.deleted_at IS
  '관리자 삭제 시각. 감사 기록의 행위자를 보존하며 다시 활성화할 수 없다.';

ALTER TABLE structured.admin_accounts ADD CONSTRAINT deleted_admin_is_disabled
  CHECK (deleted_at IS NULL OR disabled_at IS NOT NULL);
