-- WP-RPT-008 후속: supplement_requested 이벤트 종류 추가 + 뷰 재정의
-- 0069가 최초 실행된 뒤 추가된 내용만 담는다.

ALTER TYPE structured.verification_event_kind ADD VALUE IF NOT EXISTS 'supplement_requested' AFTER 'review_started';

-- pending 뷰: needs_supplement는 심사 대기열에 남아야 관리자가 볼 수 있다
CREATE OR REPLACE VIEW structured.pending_verification_requests AS
SELECT
  r.id,
  r.quote_id,
  r.requested_by,
  r.target_level,
  r.status,
  r.received_at,
  q.vendor_id,
  q.total_amount,
  COALESCE(
    (SELECT array_agg(DISTINCT e.kind::text ORDER BY e.kind::text)
       FROM structured.verification_evidence e
      WHERE e.request_id = r.id),
    ARRAY[]::text[]
  ) AS evidence_kinds
FROM structured.verification_requests r
JOIN structured.quotes q ON q.id = r.quote_id
WHERE r.status IN ('received', 'in_review', 'needs_supplement');

COMMENT ON VIEW structured.pending_verification_requests IS
  '심사가 필요한 신청. 목표 등급과 실제 증빙을 나란히 둬, 맞는지 눈으로 볼 수 있게 한다.';

-- backlog 뷰: needs_supplement도 증빙 원본을 붙잡고 있으므로 밀린 것으로 센다
CREATE OR REPLACE VIEW structured.backlogged_verification_requests AS
SELECT
  r.id,
  r.quote_id,
  r.requested_by,
  r.target_level,
  r.status,
  r.received_at,
  floor(extract(epoch FROM (now() - r.received_at)) / 86400)::integer AS waiting_days,
  (SELECT count(*)
     FROM structured.verification_evidence e
    WHERE e.request_id = r.id) AS held_document_count
FROM structured.verification_requests r
WHERE r.status IN ('received', 'in_review', 'needs_supplement')
  AND r.received_at <= now() - (structured.verification_backlog_days() || ' days')::interval;

COMMENT ON VIEW structured.backlogged_verification_requests IS
  '접수 후 기준 일수가 지나도록 결론이 나지 않은 인증 신청. 밀리는 동안 그 증빙 원본은 파기되지 않는다.';
