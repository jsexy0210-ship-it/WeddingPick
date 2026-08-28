-- 인증 심사 운영.
--
-- 신청은 0002부터 받아왔지만 사람이 결론을 낼 길이 없었다. 접수만 되고 결정이
-- 나지 않으면 L1~L4는 영원히 붙지 않고, 시장 대표가격은 L2 이상만 쓰므로
-- 가격 비교 자체가 서지 않는다.
--
-- 여기서 두 가지를 한다. 하나는 0002가 이름과 달리 막지 못한 구멍을 막는 것,
-- 다른 하나는 결정에 이르는 과정을 남기는 것이다.

-- ---------------------------------------------------------------------------
-- 1. 본인 승인 구멍을 막는다
-- ---------------------------------------------------------------------------
--
-- 0002의 approved_is_not_self_service는 이름이 "self service가 아니다"이고 주석이
-- "자동승인을 스키마에서 막는다"인데, 실제로 검사하는 것은 decided_by IS NOT NULL
-- 하나뿐이었다. 신청자가 자기 id를 decided_by에 넣으면 그대로 통과한다. 이름이
-- 약속한 것을 제약이 지키지 않고 있었다.
--
-- 서비스정책서 7번은 사람이 증빙을 확인할 것을 요구한다. 자기 증빙을 자기가
-- 확인하는 것은 확인이 아니다.

ALTER TABLE structured.verification_requests
  DROP CONSTRAINT approved_is_not_self_service;

ALTER TABLE structured.verification_requests
  ADD CONSTRAINT decision_has_reviewer_who_is_not_the_requester
    CHECK (
      status NOT IN ('approved', 'rejected')
      OR (decided_by IS NOT NULL AND decided_by <> requested_by)
    );

COMMENT ON CONSTRAINT decision_has_reviewer_who_is_not_the_requester
  ON structured.verification_requests IS
  '승인이든 반려든 결론에는 신청자가 아닌 심사자가 남는다. 자동승인과 본인 승인을 스키마에서 막는다.';

-- ---------------------------------------------------------------------------
-- 2. 심사 이력
-- ---------------------------------------------------------------------------
--
-- 문의(0009)와 같은 이유다. 결론만 남기면 왜 그렇게 결정했는지가 사라진다.
-- 업체가 반론하거나(서비스정책서 6번) 사용자가 재심을 요청할 때 우리가 무엇을
-- 보고 판단했는지 되짚을 수 있어야 한다.

CREATE TYPE verification_event_kind AS ENUM (
  'received',
  'review_started',
  'approved',
  'rejected'
);

CREATE TABLE structured.verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL
    REFERENCES structured.verification_requests (id) ON DELETE CASCADE,
  kind verification_event_kind NOT NULL,
  -- 접수는 사람이 하는 일이 아니므로 비어 있다. 나머지는 사람이 남는다.
  actor_user_id uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  -- 심사자가 무엇을 보고 그렇게 판단했는지. 반려 사유와 별개로, 승인에도 적는다.
  note text,
  occurred_at timestamptz NOT NULL DEFAULT now(),

  -- 접수 외에는 누가 했는지가 반드시 남는다.
  CONSTRAINT human_action_has_actor
    CHECK (kind = 'received' OR actor_user_id IS NOT NULL)
);

CREATE INDEX verification_events_request_idx
  ON structured.verification_events (request_id, occurred_at);

-- 접수 기록은 신청과 함께 자동으로 남긴다. 사람이 잊어서 비는 일이 없게.
CREATE FUNCTION structured.log_verification_receipt() RETURNS trigger AS $$
BEGIN
  INSERT INTO structured.verification_events (request_id, kind, occurred_at)
  VALUES (NEW.id, 'received', NEW.received_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verification_requests_log_receipt
  AFTER INSERT ON structured.verification_requests
  FOR EACH ROW EXECUTE FUNCTION structured.log_verification_receipt();

-- ---------------------------------------------------------------------------
-- 3. 심사 대기 목록
-- ---------------------------------------------------------------------------
--
-- 심사자가 봐야 하는 것은 신청 한 줄이 아니라 "이 신청에 목표 등급에 맞는 증빙이
-- 들어 있는가"다. 그 판단에 필요한 것을 한 곳에 모아, 도구가 조인을 새로 짜다가
-- 빠뜨리는 일이 없게 한다.

CREATE VIEW structured.pending_verification_requests AS
SELECT
  r.id,
  r.quote_id,
  r.requested_by,
  r.target_level,
  r.status,
  r.received_at,
  q.vendor_id,
  q.total_amount,
  -- 실제로 낸 증빙 종류. 목표 등급에 맞는지는 도메인 규칙이 판단한다.
  COALESCE(
    (SELECT array_agg(DISTINCT e.kind::text ORDER BY e.kind::text)
       FROM structured.verification_evidence e
      WHERE e.request_id = r.id),
    ARRAY[]::text[]
  ) AS evidence_kinds
FROM structured.verification_requests r
JOIN structured.quotes q ON q.id = r.quote_id
WHERE r.status IN ('received', 'in_review');

COMMENT ON VIEW structured.pending_verification_requests IS
  '심사가 필요한 신청. 목표 등급과 실제 증빙을 나란히 둬, 맞는지 눈으로 볼 수 있게 한다.';
