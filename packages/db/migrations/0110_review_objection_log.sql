-- 후기 이의 처리 기록.
--
-- 화면(관리자 · 후기 이의제기)은 되살리기 · 내리기 · 기한 늘리기 셋 다 메모를
-- 필수로 받고, 라우트도 빈 메모를 거절한다. 그런데 받은 메모가 어디에도
-- 남지 않았다 — `objection-decide.ts`는 `note`를 인자로 받아 쓰지 않고 버렸다.
--
-- 사유를 받아놓고 버리면 받지 않은 것과 같다. 특히 **내리기는 되돌릴 수 없다**:
-- 후기가 `removed`가 되고 쓴 사람은 다시 올릴 수 없다. 나중에 「왜 내렸느냐」는
-- 물음에 답할 근거가 `structured.decisions`의 `reason_code`
-- (`objection_upheld`) 한 낱말뿐이었다.
--
-- `structured.decisions`에 글을 넣지 않는 것은 그 표가 **가리키기만 하는 표**이기
-- 때문이다(값이 아니라 참조만 담는다). 그래서 `withdrawal_audit_log`와 같은 자리에
-- 같은 모양으로 따로 둔다.

CREATE TABLE structured.review_objection_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  /*
   * 후기를 가리키지만 외래키가 아니다 — `withdrawal_audit_log.account_id`와 같은
   * 이유다. 후기 행이 사라져도 왜 내렸는지는 남아야 한다.
   */
  review_id uuid NOT NULL,

  operator_id uuid NOT NULL REFERENCES structured.users (id),

  action text NOT NULL CHECK (action IN ('hold', 'restore', 'remove')),

  -- 빈 사유를 적어두는 것은 사유가 없는 것과 같다. 스키마가 막는다.
  note text NOT NULL CHECK (length(btrim(note)) > 0),

  before_status text NOT NULL,
  after_status text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX review_objection_log_review_idx
  ON structured.review_objection_log (review_id, created_at DESC);

COMMENT ON TABLE structured.review_objection_log IS
  '후기 이의 처리에서 운영자가 적은 사유. structured.decisions는 참조만 담아서 글이 들어갈 자리가 없다.';
