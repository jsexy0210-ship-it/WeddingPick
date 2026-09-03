-- WP-RPT-008: 보완 필요 상태 추가
-- 심사자가 사용자에게 자료 보완을 요청할 수 있는 중간 상태다.
-- 반려(rejected)와 달리 재신청이 가능하며, 사용자에게 구체적 안내를 줄 수 있다.

ALTER TYPE structured.verification_status ADD VALUE IF NOT EXISTS 'needs_supplement' AFTER 'in_review';

ALTER TABLE structured.verification_requests
  ADD COLUMN IF NOT EXISTS supplement_reason text;

COMMENT ON COLUMN structured.verification_requests.supplement_reason IS
  'needs_supplement 상태일 때 사용자에게 전달하는 보완 요청 사유';
