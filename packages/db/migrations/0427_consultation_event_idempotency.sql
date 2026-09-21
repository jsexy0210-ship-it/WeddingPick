-- 상담 시트 일정 저장의 멱등성.
-- 일반 wedding_events는 그대로 두고 상담 전용 요청만 idempotency_key를 채운다.

ALTER TABLE structured.wedding_events
  ADD COLUMN IF NOT EXISTS idempotency_key text;

COMMENT ON COLUMN structured.wedding_events.idempotency_key IS
  '상담 일정 전용 멱등성 키. 같은 웨딩에서 같은 키의 재전송은 기존 eventId를 재사용한다.';

CREATE UNIQUE INDEX IF NOT EXISTS wedding_events_idempotency_idx
  ON structured.wedding_events (wedding_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
