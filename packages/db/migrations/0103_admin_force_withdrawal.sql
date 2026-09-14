-- ---------------------------------------------------------------------------
-- 운영자가 계정을 대신 탈퇴시키는 것을 감사 기록이 담을 수 있게 한다
-- ---------------------------------------------------------------------------
--
-- 「내가 탈퇴도 시키고 해야하는데」(2026-09-10 대표). 지금까지 관리자가 할 수 있던
-- 것은 **사용자가 스스로 낸 탈퇴**를 보류 · 재개 · 재시도하는 셋뿐이었다. 시작을
-- 대신 눌러 줄 자리가 없었다.
--
-- 그 셋만 담도록 `action`에 CHECK가 걸려 있어서, 새 동작을 적으려 하면 제약에서
-- 막힌다. 목록을 넓힌다 — 넓히는 것이지 푸는 것이 아니다. 아는 동작만 들어와야
-- 나중에 이 표를 읽는 사람이 「이 값은 무슨 뜻인가」를 묻지 않는다.
--
-- **기록을 남기는 것이 이 마이그레이션의 요점이다.** 남이 대신 지운 계정은 본인이
-- 지운 계정과 결과가 같아서, 기록이 없으면 나중에 둘을 가릴 방법이 없다. 누가 ·
-- 언제 · 왜 눌렀는지가 남아야 한다.

ALTER TABLE structured.withdrawal_audit_log
  DROP CONSTRAINT withdrawal_audit_log_action_check;

ALTER TABLE structured.withdrawal_audit_log
  ADD CONSTRAINT withdrawal_audit_log_action_check
  CHECK (action IN ('hold', 'resume', 'retry', 'force'));

COMMENT ON COLUMN structured.withdrawal_audit_log.action IS
  'hold · resume · retry는 본인이 낸 탈퇴에 운영자가 개입한 것. force는 운영자가 대신 시작한 탈퇴다.';
