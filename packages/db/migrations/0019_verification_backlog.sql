-- 인증 심사 적체.
--
-- 0018에서 보관 기간 기준을 검증 완료 후로 옮기면서, 심사가 열려 있는 동안
-- 원본이 남게 됐다. 그 기간에 상한이 없다 — 심사가 밀리면 개인정보가 그만큼
-- 오래 남는다.
--
-- 며칠부터 밀린 것으로 볼지가 정해져야 알릴 수 있다. **7일로 정했다**(2026-08-28).

CREATE FUNCTION structured.verification_backlog_days() RETURNS integer
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT 7 $$;

COMMENT ON FUNCTION structured.verification_backlog_days() IS
  '접수 후 며칠이 지나도록 결론이 나지 않으면 밀린 것으로 보는가. 도메인의 VERIFICATION_POLICY.backlogDays와 같아야 한다.';

/*
 * 밀린 심사.
 *
 * 접수한 날부터 센다. 심사를 시작했다고(in_review) 시계를 되돌리지 않는다 —
 * 시작은 결론이 아니고, 신청한 사람이 기다리는 것은 결론이다.
 */
CREATE VIEW structured.backlogged_verification_requests AS
SELECT
  r.id,
  r.quote_id,
  r.requested_by,
  r.target_level,
  r.status,
  r.received_at,
  -- 며칠째인지. 화면이 다시 세지 않게 여기서 준다.
  floor(extract(epoch FROM (now() - r.received_at)) / 86400)::integer AS waiting_days,
  -- 이 신청 때문에 파기가 미뤄지고 있는 원본 수.
  (SELECT count(*)
     FROM structured.verification_evidence e
    WHERE e.request_id = r.id) AS held_document_count
FROM structured.verification_requests r
WHERE r.status IN ('received', 'in_review')
  AND r.received_at <= now() - (structured.verification_backlog_days() || ' days')::interval;

COMMENT ON VIEW structured.backlogged_verification_requests IS
  '접수 후 기준 일수가 지나도록 결론이 나지 않은 인증 신청. 밀리는 동안 그 증빙 원본은 파기되지 않는다.';

-- ---------------------------------------------------------------------------
-- 알림 기록을 종류별로
-- ---------------------------------------------------------------------------
--
-- 0013의 retention_alerts는 파기 전용이었다. 심사 적체도 같은 규칙으로 알려야
-- 하는데(늘었을 때와 오래 방치됐을 때만), 표를 따로 만들면 같은 로직이 두 벌이
-- 된다. 종류를 컬럼으로 들인다.
--
-- 종류를 나누는 것이 중요하다. 하나로 합쳐 세면 파기가 줄어드는 사이 심사가
-- 쌓여도 "숫자가 그대로"라 조용해진다.

CREATE TYPE operator_alert_kind AS ENUM ('retention_due', 'verification_backlog');

ALTER TABLE structured.retention_alerts
  RENAME TO operator_alerts;

ALTER TABLE structured.operator_alerts
  ADD COLUMN kind operator_alert_kind NOT NULL DEFAULT 'retention_due';

-- 기존 행은 모두 파기 알림이었다. 기본값을 남겨두면 새 종류를 넣을 때 잊는다.
ALTER TABLE structured.operator_alerts
  ALTER COLUMN kind DROP DEFAULT;

ALTER TABLE structured.operator_alerts
  RENAME COLUMN due_count TO subject_count;

COMMENT ON COLUMN structured.operator_alerts.subject_count IS
  '보낼 당시 처리해야 할 건수. 종류마다 세는 대상이 다르다 — 파기할 원본이거나, 밀린 심사이거나.';

ALTER INDEX structured.retention_alerts_operator_idx
  RENAME TO operator_alerts_operator_idx;

DROP INDEX structured.operator_alerts_operator_idx;
CREATE INDEX operator_alerts_lookup_idx
  ON structured.operator_alerts (operator_user_id, kind, sent_at DESC);
