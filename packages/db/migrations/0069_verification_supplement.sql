-- WP-RPT-008: 보완 필요 상태 추가
-- VIEW는 0070에서 정의한다. PostgreSQL은 ALTER TYPE ADD VALUE와 해당 값을 사용하는
-- DDL을 같은 트랜잭션에서 실행하지 못하므로 분리한다.

ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'needs_supplement' AFTER 'in_review';
ALTER TYPE verification_event_kind ADD VALUE IF NOT EXISTS 'supplement_requested' AFTER 'review_started';

ALTER TABLE structured.verification_requests
  ADD COLUMN IF NOT EXISTS supplement_reason text;

COMMENT ON COLUMN structured.verification_requests.supplement_reason IS
  'needs_supplement 상태일 때 사용자에게 전달하는 보완 요청 사유';
