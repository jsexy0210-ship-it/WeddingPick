-- 같은 알림을 두 번 보내지 않기. 최종통합정책 v2.0 36·37번.
--
-- 알림을 만드는 곳이 늘면 반드시 겪는 일이 있다: **워커가 한 바퀴 더 돌면 같은
-- 알림이 또 간다.** 보내는 쪽마다 "이미 보냈나"를 각자 기억하게 두면 언젠가 한
-- 곳이 잊고, 그 사람은 같은 말을 하루에 열 번 듣는다.

/*
 * 이 알림이 무엇에 대한 것인지 한 줄로 나타낸 열쇠.
 *
 * 예: `task_due:<task-id>:7`(예식 7일 전 알림), `price:<vendor-id>:2026-08-29`.
 * 같은 열쇠로는 한 번만 들어간다.
 *
 * NULL을 허용한다 — 반론 심사 결과처럼 **원래 한 번만 일어나는 일**은 열쇠가
 * 필요 없고, 억지로 만들면 그 열쇠를 만드는 규칙이 또 하나 생긴다.
 */
ALTER TABLE structured.notifications
  ADD COLUMN dedupe_key text;

CREATE UNIQUE INDEX notifications_dedupe_idx
  ON structured.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

COMMENT ON COLUMN structured.notifications.dedupe_key IS
  '같은 알림을 두 번 보내지 않기 위한 열쇠. 한 번만 일어나는 알림은 NULL이다.';

-- ---------------------------------------------------------------------------
-- 가격 변동 알림의 기준점
-- ---------------------------------------------------------------------------
--
-- v2.0 37번: **신규 인증 1건이 들어올 때마다 알림을 보내지 않는다.** 의미 있게
-- 바뀐 경우만 보내려면 "마지막으로 알린 값"이 남아 있어야 한다.
--
-- 사람마다 따로 둔다. 같은 업체를 담아둔 두 사람이 서로 다른 시점에 담았고,
-- 각자에게 의미 있는 변화의 기준도 그때부터 시작한다.

CREATE TABLE structured.price_alert_marks (
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES structured.vendors (id) ON DELETE CASCADE,

  /** 마지막으로 알린(또는 처음 본) 구간. 수집 중이었으면 NULL이다. */
  low bigint,
  high bigint,
  /** 그때의 공개 단계. 수집 중에서 벗어나는 것 자체가 알릴 일이다. */
  stage text NOT NULL CHECK (length(btrim(stage)) > 0),

  sent_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, vendor_id),

  CONSTRAINT range_is_whole CHECK ((low IS NULL) = (high IS NULL)),
  CONSTRAINT range_is_ordered CHECK (low IS NULL OR low <= high)
);

COMMENT ON TABLE structured.price_alert_marks IS
  '가격 변동 알림의 기준점. 신규 인증 한 건마다 보내지 않기 위해 마지막으로 알린 값을 남긴다.';
