-- 회원탈퇴 운영자 개입. 05번 명세 14·35번.
--
-- 자동 파기(0052)는 그대로 둔다. 다만 사람이 볼 곳도, 필요하면 잠깐 멈출 곳도
-- 없었다 — `deletable_accounts`에 뜬 계정은 다음 워커 실행에 조용히 지워진다.
-- 운영자가 확인할 시간이 필요한 사고(도용된 계정의 탈퇴, 진행 중인 신고 등)가
-- 생기면 막을 방법이 없었다.
--
-- **무기한으로 막지는 않는다.** `hold_until` 없는 HOLD를 허용하면, 잠깐 멈추려던
-- 것이 운영자가 잊는 순간 영원한 보류가 된다. 그건 탈퇴 요청을 운영자가 임의로
-- 취소한 것과 다르지 않다 — 사용자는 지워달라고 했는데 아무도 답을 안 준 상태다.

-- ---------------------------------------------------------------------------
-- 보류 — 활성 보류는 계정당 하나
-- ---------------------------------------------------------------------------
--
-- `resolved_at IS NULL`이 "지금 걸려 있다"는 뜻이다. 이력을 지우지 않고 새 행을
-- 추가하는 이유는 감사 목적이다 — 몇 번 걸렸다 풀렸는지도 근거가 된다.

CREATE TABLE structured.withdrawal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  hold_reason text NOT NULL,
  hold_by uuid NOT NULL REFERENCES structured.users (id),
  hold_at timestamptz NOT NULL DEFAULT now(),
  -- 무기한 보류를 금지한다. NULL을 허용하지 않는다.
  hold_until timestamptz NOT NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES structured.users (id),
  resolved_reason text,
  CONSTRAINT withdrawal_holds_until_after_at CHECK (hold_until > hold_at)
);

-- 계정당 활성 보류는 하나뿐이다. 둘을 걸면 어느 쪽 사유·만료가 맞는지 알 수 없다.
CREATE UNIQUE INDEX withdrawal_holds_active_idx
  ON structured.withdrawal_holds (user_id)
  WHERE resolved_at IS NULL;

CREATE INDEX withdrawal_holds_user_idx ON structured.withdrawal_holds (user_id);

COMMENT ON TABLE structured.withdrawal_holds IS
  '운영자가 건 탈퇴 보류. hold_until이 지나거나 resolved_at이 찍히면 더는 막지 않는다.';

-- ---------------------------------------------------------------------------
-- 감사로그 — 계정이 지워져도 남는다
-- ---------------------------------------------------------------------------
--
-- `account_id`를 외래키로 두지 않는다. 외래키(RESTRICT)를 걸면 감사 대상 계정을
-- 영원히 못 지우고, CASCADE를 걸면 사고 조사 기록이 계정과 함께 사라진다. 둘 다
-- 감사로그의 존재 이유를 없앤다. 대신 이 로그 자체는 삭제 API를 두지 않는다.

CREATE TABLE structured.withdrawal_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES structured.users (id),
  account_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('hold', 'resume', 'retry')),
  reason text NOT NULL,
  before_status text NOT NULL,
  after_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX withdrawal_audit_log_account_idx
  ON structured.withdrawal_audit_log (account_id, created_at DESC);

COMMENT ON TABLE structured.withdrawal_audit_log IS
  '탈퇴 관련 운영자 개입 전부. account_id는 외래키가 아니다 — 계정이 지워져도 이 기록은 남는다.';

-- ---------------------------------------------------------------------------
-- 파기 대상에서 보류 중인 계정을 뺀다
-- ---------------------------------------------------------------------------
--
-- 열 목록·타입은 0052와 같다 — 뷰를 보는 쪽(worker.ts)이 바뀌지 않아도 되게.
-- hold_until이 지난 보류는 저절로 조건에서 빠진다. 별도 만료 워커가 필요 없다.

CREATE OR REPLACE VIEW structured.deletable_accounts AS
SELECT u.id AS user_id, u.deleted_at
FROM structured.users u
WHERE u.deleted_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM originals.raw_documents d
    WHERE d.owner_user_id = u.id AND d.status <> 'deleted'
  )
  AND NOT EXISTS (
    SELECT 1 FROM structured.withdrawal_holds h
    WHERE h.user_id = u.id AND h.resolved_at IS NULL AND h.hold_until > now()
  );

COMMENT ON VIEW structured.deletable_accounts IS
  '탈퇴를 접수했고 원본 파일이 모두 파기됐고 활성 보류가 없는 계정. 이 뷰에 뜬 계정만 지운다.';

-- ---------------------------------------------------------------------------
-- 실패 — 다음 실행이 조용히 넘어가지 않게
-- ---------------------------------------------------------------------------
--
-- 지우기 시도가 실패하면(외래키 제약, DB 연결 등) 이전에는 콘솔에 한 줄 남고
-- 다음 배치가 다시 시도했다 — 몇 번째 시도인지, 왜 실패했는지 아무도 몰랐다.
-- 성공하면 이 행을 지운다. 재시도할 것이 없는 계정을 "실패"라고 남겨두지 않는다.

CREATE TABLE structured.withdrawal_deletion_failures (
  user_id uuid PRIMARY KEY REFERENCES structured.users (id) ON DELETE CASCADE,
  error_message text NOT NULL,
  failed_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 1
);

COMMENT ON TABLE structured.withdrawal_deletion_failures IS
  '계정 파기 시도가 실패한 기록. 성공하면 지운다 — 재시도가 필요한 계정만 남는다.';
