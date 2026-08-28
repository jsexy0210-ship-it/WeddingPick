-- 인증, 분석 작업, 인증 신청.
-- 0001이 도메인 데이터를 담았다면 여기부터는 서비스를 돌리는 데 필요한 것들이다.

-- ---------------------------------------------------------------------------
-- 인증
-- ---------------------------------------------------------------------------

CREATE TYPE identity_provider AS ENUM ('apple', 'kakao');

-- 개인정보 밀도가 높아 구조화 데이터와 같은 스키마에 두지 않는다.
CREATE SCHEMA identity;
COMMENT ON SCHEMA identity IS
  '로그인 수단과 세션. 이름·이메일 같은 개인정보가 들어오는 유일한 곳이다.';

CREATE TABLE identity.identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  provider identity_provider NOT NULL,
  -- 제공자가 주는 안정적인 식별자 (Apple sub, Kakao id)
  subject text NOT NULL,
  -- 제공자가 이메일을 줄 때만 채운다. 없어도 서비스는 돌아간다.
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, subject)
);

CREATE INDEX identities_user_idx ON identity.identities (user_id);

CREATE TABLE identity.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  -- 토큰 원문은 저장하지 않는다. 유출돼도 세션을 복원할 수 없다.
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT session_expires_after_creation CHECK (expires_at > created_at)
);
COMMENT ON COLUMN identity.sessions.token_hash IS
  '세션 토큰의 SHA-256. 원문은 발급 시 한 번만 앱에 준다.';

CREATE INDEX sessions_user_idx ON identity.sessions (user_id);

CREATE VIEW identity.active_sessions AS
SELECT id, user_id, token_hash, expires_at
FROM identity.sessions
WHERE revoked_at IS NULL
  AND expires_at > now();

-- ---------------------------------------------------------------------------
-- 분석 작업
-- ---------------------------------------------------------------------------

CREATE TYPE analysis_status AS ENUM ('pending', 'running', 'succeeded', 'failed');
CREATE TYPE analysis_failure AS ENUM ('unreadable', 'not_a_document', 'internal');

CREATE TABLE structured.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_document_id uuid NOT NULL REFERENCES originals.raw_documents (id) ON DELETE CASCADE,
  wedding_id uuid NOT NULL REFERENCES structured.weddings (id) ON DELETE CASCADE,
  status analysis_status NOT NULL DEFAULT 'pending',
  quote_id uuid REFERENCES structured.quotes (id) ON DELETE SET NULL,
  failure_reason analysis_failure,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  -- AI 호출 비용 관리를 위해 문서 단위로 기록한다. 사업계획서 35번.
  input_tokens integer,
  output_tokens integer,
  -- 성공하면 문서가 나오고, 실패하면 이유가 남는다. 둘 다 없거나 둘 다 있는 상태는 없다.
  CONSTRAINT succeeded_has_quote
    CHECK ((status = 'succeeded') = (quote_id IS NOT NULL)),
  CONSTRAINT failed_has_reason
    CHECK ((status = 'failed') = (failure_reason IS NOT NULL)),
  CONSTRAINT finished_states_have_timestamp
    CHECK ((status IN ('succeeded', 'failed')) = (finished_at IS NOT NULL))
);

CREATE INDEX analyses_pending_idx ON structured.analyses (created_at)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 인증 신청
-- ---------------------------------------------------------------------------

CREATE TYPE verification_status AS ENUM ('received', 'in_review', 'approved', 'rejected');
CREATE TYPE verification_evidence_kind AS ENUM (
  'quote_document',
  'contract_document',
  'payment_receipt',
  'usage_proof'
);

CREATE TABLE structured.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES structured.quotes (id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  target_level verification_level NOT NULL,
  status verification_status NOT NULL DEFAULT 'received',
  received_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  rejection_reason text,
  -- 서비스정책서 7번: 자동승인 금지. 사람이 증빙을 확인해야 결론이 난다.
  CONSTRAINT decision_has_reviewer
    CHECK ((status IN ('approved', 'rejected')) = (decided_at IS NOT NULL)),
  CONSTRAINT approved_is_not_self_service
    CHECK (status <> 'approved' OR decided_by IS NOT NULL),
  CONSTRAINT rejected_has_reason
    CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL),
  -- L0은 신청 대상이 아니다.
  CONSTRAINT target_level_is_requestable CHECK (target_level > 'L0')
);
COMMENT ON CONSTRAINT approved_is_not_self_service ON structured.verification_requests IS
  '승인에는 심사자가 반드시 남는다. 자동승인을 스키마에서 막는다.';

CREATE INDEX verification_requests_quote_idx ON structured.verification_requests (quote_id);
CREATE INDEX verification_requests_open_idx ON structured.verification_requests (received_at)
  WHERE status IN ('received', 'in_review');

CREATE TABLE structured.verification_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES structured.verification_requests (id) ON DELETE CASCADE,
  kind verification_evidence_kind NOT NULL,
  raw_document_id uuid NOT NULL REFERENCES originals.raw_documents (id) ON DELETE CASCADE
);

CREATE INDEX verification_evidence_request_idx ON structured.verification_evidence (request_id);
